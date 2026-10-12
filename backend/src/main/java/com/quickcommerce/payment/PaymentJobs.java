package com.quickcommerce.payment;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Background work for payments: webhook retry queue and sandbox UPI confirmation. */
@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentJobs {

    private final PaymentFlowService flow;

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void retryWebhooks() {
        try {
            flow.retryDueWebhooks();
        } catch (RuntimeException e) {
            log.warn("Webhook retry sweep failed: {}", e.getMessage());
        }
    }

    @Scheduled(fixedDelay = 4_000, initialDelay = 15_000)
    public void sandboxUpi() {
        try {
            flow.autoConfirmSandboxUpi();
        } catch (RuntimeException e) {
            log.debug("Sandbox UPI sweep failed: {}", e.getMessage());
        }
    }
}
