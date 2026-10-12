package com.quickcommerce.repository;

import com.quickcommerce.entity.PaymentTransaction;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {

    Optional<PaymentTransaction> findFirstByOrderIdOrderByCreatedAtDesc(Long orderId);

    List<PaymentTransaction> findByOrderIdOrderByCreatedAtDesc(Long orderId);

    @EntityGraph(attributePaths = {"order"})
    Optional<PaymentTransaction> findByGatewayAndGatewayOrderId(String gateway, String gatewayOrderId);

    @EntityGraph(attributePaths = {"order"})
    Optional<PaymentTransaction> findFirstByGatewayAndGatewayPaymentId(String gateway, String gatewayPaymentId);

    @EntityGraph(attributePaths = {"order"})
    Optional<PaymentTransaction> findFirstByGatewayAndRefundId(String gateway, String refundId);

    @EntityGraph(attributePaths = {"order"})
    List<PaymentTransaction> findByGatewayAndStatus(String gateway, String status);

    long countByOrderId(Long orderId);
}
