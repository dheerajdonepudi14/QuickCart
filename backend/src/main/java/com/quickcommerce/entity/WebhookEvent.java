package com.quickcommerce.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Inbox for gateway webhooks: deduplicated by (gateway, eventId) and retried when processing fails. */
@Entity
@Table(name = "webhook_events")
@Getter @Setter @NoArgsConstructor
public class WebhookEvent {

    public static final String RECEIVED = "RECEIVED";
    public static final String PROCESSED = "PROCESSED";
    public static final String FAILED = "FAILED";
    public static final String IGNORED = "IGNORED";
    public static final String DEAD = "DEAD";

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String gateway;

    @Column(name = "event_id", nullable = false, length = 200)
    private String eventId;

    @Column(name = "event_type", nullable = false, length = 100)
    private String eventType;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String payload;

    @Column(nullable = false, length = 20)
    private String status = RECEIVED;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "last_error", length = 500)
    private String lastError;

    @Column(name = "received_at", nullable = false, updatable = false)
    private Instant receivedAt = Instant.now();

    @Column(name = "processed_at")
    private Instant processedAt;

    @Column(name = "next_attempt_at")
    private Instant nextAttemptAt;
}
