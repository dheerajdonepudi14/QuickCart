package com.quickcommerce.repository;

import com.quickcommerce.entity.DarkStore;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DarkStoreRepository extends JpaRepository<DarkStore, Long> {
    List<DarkStore> findByActiveTrue();
    List<DarkStore> findByPincodeAndActiveTrue(String pincode);
    List<DarkStore> findByPincodeStartingWithAndActiveTrue(String prefix);
}
