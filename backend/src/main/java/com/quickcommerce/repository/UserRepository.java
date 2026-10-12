package com.quickcommerce.repository;

import com.quickcommerce.entity.Role;
import com.quickcommerce.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByPhoneNumber(String phoneNumber);
    List<User> findByRoleAndStoreId(Role role, Long storeId);
    long countByRole(Role role);
}
