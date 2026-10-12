package com.quickcommerce.repository;

import com.quickcommerce.entity.WebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface WebhookEventRepository extends JpaRepository<WebhookEvent, Long> {

    Optional<WebhookEvent> findByGatewayAndEventId(String gateway, String eventId);

    @Query("SELECT w.id FROM WebhookEvent w WHERE w.status = 'FAILED' AND w.nextAttemptAt <= :now ORDER BY w.nextAttemptAt")
    List<Long> findDueForRetry(@Param("now") Instant now);

    long countByStatus(String status);
}
