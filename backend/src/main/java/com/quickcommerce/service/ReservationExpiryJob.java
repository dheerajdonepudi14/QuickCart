package com.quickcommerce.service;

import com.quickcommerce.entity.OrderStatus;
import com.quickcommerce.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

/** Returns held stock to the shelf when a checkout isn't paid within the reservation window. */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReservationExpiryJob {

    private final OrderRepository orderRepository;
    private final OrderService orderService;

    @Scheduled(fixedDelay = 30_000, initialDelay = 15_000)
    public void releaseExpiredHolds() {
        for (Long id : orderRepository.findExpiredReservationIds(OrderStatus.CREATED, Instant.now())) {
            try {
                orderService.expireReservation(id); // one transaction per order: a failure never blocks the rest
            } catch (Exception ex) {
                log.warn("Could not expire reservation for order {}: {}", id, ex.getMessage());
            }
        }
    }
}
