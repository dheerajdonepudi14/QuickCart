package com.quickcommerce.service;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** Pushes STOMP messages only after the surrounding transaction commits, so clients never see uncommitted state. */
@Component
@RequiredArgsConstructor
public class RealtimePublisher {

    private final SimpMessagingTemplate messaging;

    public void publishAfterCommit(String destination, Object payload) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    messaging.convertAndSend(destination, payload);
                }
            });
        } else {
            messaging.convertAndSend(destination, payload);
        }
    }

    public static String orderTopic(Long orderId) { return "/topic/orders/" + orderId; }
    public static String trackingTopic(Long orderId) { return "/topic/orders/" + orderId + "/tracking"; }
    public static String storeOrdersTopic(Long storeId) { return "/topic/stores/" + storeId + "/orders"; }
    public static String storeAlertsTopic(Long storeId) { return "/topic/stores/" + storeId + "/alerts"; }
}
