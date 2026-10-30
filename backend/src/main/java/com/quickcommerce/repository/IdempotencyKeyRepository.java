package com.quickcommerce.repository;

import com.quickcommerce.entity.IdempotencyKey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface IdempotencyKeyRepository extends JpaRepository<IdempotencyKey, Long> {

    Optional<IdempotencyKey> findByUserIdAndIdemKey(Long userId, String idemKey);

    @Modifying
    @Query("DELETE FROM IdempotencyKey k WHERE k.createdAt < :before")
    int purgeOlderThan(@Param("before") Instant before);
}
