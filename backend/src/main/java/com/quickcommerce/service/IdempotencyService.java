package com.quickcommerce.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickcommerce.entity.IdempotencyKey;
import com.quickcommerce.exception.ApiException;
import com.quickcommerce.payment.Crypto;
import com.quickcommerce.repository.IdempotencyKeyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * Idempotency-Key support for POST /checkout: a retried request (flaky network, double tap) returns the order
 * created the first time instead of reserving stock and charging twice.
 */
@Service
@RequiredArgsConstructor
public class IdempotencyService {

    public record Claim(boolean replay, Long orderId) {}

    private final IdempotencyKeyRepository repository;
    private final ObjectMapper mapper;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Claim claim(Long userId, String key, Object request) {
        String hash = hash(request);
        Optional<IdempotencyKey> existing = repository.findByUserIdAndIdemKey(userId, key);
        if (existing.isPresent()) {
            IdempotencyKey k = existing.get();
            if (!k.getRequestHash().equals(hash)) {
                throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "This Idempotency-Key was already used for a different checkout.");
            }
            if (k.getOrderId() != null) return new Claim(true, k.getOrderId());
            if (k.getCreatedAt().isAfter(Instant.now().minus(Duration.ofMinutes(2)))) {
                throw ApiException.conflict("Your order is already being placed. Please wait a moment.");
            }
            k.setCreatedAt(Instant.now()); // stale claim from a crashed request: take it over
            return new Claim(false, null);
        }
        IdempotencyKey k = new IdempotencyKey();
        k.setUserId(userId);
        k.setIdemKey(key);
        k.setRequestHash(hash);
        try {
            repository.saveAndFlush(k);
        } catch (DataIntegrityViolationException race) {
            throw ApiException.conflict("Your order is already being placed. Please wait a moment.");
        }
        return new Claim(false, null);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void complete(Long userId, String key, Long orderId) {
        repository.findByUserIdAndIdemKey(userId, key).ifPresent(k -> k.setOrderId(orderId));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void release(Long userId, String key) {
        repository.findByUserIdAndIdemKey(userId, key).ifPresent(repository::delete);
    }

    @Scheduled(cron = "0 40 3 * * *")
    @Transactional
    public void purge() {
        repository.purgeOlderThan(Instant.now().minus(Duration.ofDays(2)));
    }

    private String hash(Object request) {
        try {
            return Crypto.sha256Hex(mapper.writeValueAsString(request));
        } catch (Exception e) {
            return Crypto.sha256Hex(String.valueOf(request));
        }
    }
}
