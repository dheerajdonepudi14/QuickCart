package com.quickcommerce.payment;

import com.quickcommerce.config.PaymentProperties;
import com.quickcommerce.entity.WebhookEvent;
import com.quickcommerce.integration.AlertService;
import com.quickcommerce.repository.WebhookEventRepository;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Durable, idempotent webhook intake. The event is written before it is processed; a redelivered event with
 * the same id is acknowledged without being processed twice (no double capture / double confirmation).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WebhookInbox {

    private final WebhookEventRepository repository;
    private final PaymentProperties props;
    private final MeterRegistry meters;
    private final AlertService alerts;

    /** Stores the event; returns empty when it was already received (duplicate delivery). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<WebhookEvent> receive(String gateway, String eventId, String eventType, String payload) {
        if (repository.findByGatewayAndEventId(gateway, eventId).isPresent()) {
            meters.counter("quickcart.webhooks", "gateway", gateway, "status", "duplicate").increment();
            log.info("Duplicate {} webhook {} ({}) ignored", gateway, eventId, eventType);
            return Optional.empty();
        }
        WebhookEvent ev = new WebhookEvent();
        ev.setGateway(gateway);
        ev.setEventId(eventId.length() > 200 ? eventId.substring(0, 200) : eventId);
        ev.setEventType(eventType.length() > 100 ? eventType.substring(0, 100) : eventType);
        ev.setPayload(payload);
        try {
            WebhookEvent saved = repository.saveAndFlush(ev);
            meters.counter("quickcart.webhooks", "gateway", gateway, "status", "received").increment();
            return Optional.of(saved);
        } catch (DataIntegrityViolationException race) {
            return Optional.empty(); // concurrent duplicate delivery
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markProcessed(Long id, boolean ignored) {
        repository.findById(id).ifPresent(ev -> {
            ev.setStatus(ignored ? WebhookEvent.IGNORED : WebhookEvent.PROCESSED);
            ev.setAttempts(ev.getAttempts() + 1);
            ev.setProcessedAt(Instant.now());
            ev.setLastError(null);
            ev.setNextAttemptAt(null);
            meters.counter("quickcart.webhooks", "gateway", ev.getGateway(), "status", ev.getStatus().toLowerCase()).increment();
        });
    }

    /** Exponential backoff: 1, 2, 4 … 60 minutes; after maxAttempts the event is parked as DEAD and ops are alerted. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(Long id, String error) {
        repository.findById(id).ifPresent(ev -> {
            int attempts = ev.getAttempts() + 1;
            ev.setAttempts(attempts);
            ev.setLastError(error == null ? "unknown" : error.length() > 500 ? error.substring(0, 500) : error);
            if (attempts >= props.webhooks().attempts()) {
                ev.setStatus(WebhookEvent.DEAD);
                ev.setNextAttemptAt(null);
                alerts.notify(AlertService.Kind.SYSTEM, ":skull: " + ev.getGateway() + " webhook " + ev.getEventType()
                        + " (" + ev.getEventId() + ") failed " + attempts + " times: " + ev.getLastError());
            } else {
                ev.setStatus(WebhookEvent.FAILED);
                long minutes = Math.min(60, 1L << Math.min(attempts - 1, 6));
                ev.setNextAttemptAt(Instant.now().plus(Duration.ofMinutes(minutes)));
            }
            meters.counter("quickcart.webhooks", "gateway", ev.getGateway(), "status", "failed").increment();
            log.warn("Webhook {} {} processing failed (attempt {}): {}", ev.getGateway(), ev.getEventId(), attempts, error);
        });
    }

    @Transactional(readOnly = true)
    public List<Long> dueForRetry() {
        return repository.findDueForRetry(Instant.now());
    }

    @Transactional(readOnly = true)
    public Optional<WebhookEvent> find(Long id) {
        return repository.findById(id);
    }
}
