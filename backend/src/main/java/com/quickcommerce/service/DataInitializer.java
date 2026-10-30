package com.quickcommerce.service;

import com.quickcommerce.config.AppProperties;
import com.quickcommerce.entity.AuthProvider;
import com.quickcommerce.entity.DarkStore;
import com.quickcommerce.entity.Role;
import com.quickcommerce.entity.User;
import com.quickcommerce.repository.DarkStoreRepository;
import com.quickcommerce.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Creates the central admin, a demo customer, and two riders per store on first boot. */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private static final String[][] RIDERS = {
            {"Ravi Kumar", "Arjun Singh"}, {"Imran Shaikh", "Suresh Babu"}, {"Vikram Patil", "Deepak Yadav"},
            {"Manoj Tiwari", "Rahul Verma"}, {"Kiran Reddy", "Naveen Goud"}, {"Karthik R", "Senthil Kumar"},
            {"Aniket Joshi", "Sagar Pawar"}, {"Sai Teja", "Venkatesh N"}, {"Ramesh Chowdary", "Harsha V"},
            {"Anil Kumar", "Gopi Krishna"}
    };

    private final UserRepository userRepository;
    private final DarkStoreRepository storeRepository;
    private final PasswordEncoder encoder;
    private final AppProperties props;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        boolean firstBoot = userRepository.countByRole(Role.ROLE_STORE_ADMIN) == 0;
        if (firstBoot) {
            create("Central Admin", props.seed().adminEmail(), props.seed().adminPassword(), Role.ROLE_STORE_ADMIN, null, "+919000000001");
            create("Demo Shopper", "shopper@quickcart.dev", "Shopper@123", Role.ROLE_CUSTOMER, null, "+919000000002");
        }
        seedStoreStaff();
        if (firstBoot) log.info("Seeded users. Admin: {} / {}", props.seed().adminEmail(), props.seed().adminPassword());
    }

    /** Idempotent: every active store (including ones added by later migrations) gets a manager and two riders. */
    private void seedStoreStaff() {
        int s = 0;
        for (DarkStore store : storeRepository.findByActiveTrue()) {
            String code = store.getStoreCode().toLowerCase();
            String[] names = RIDERS[s++ % RIDERS.length];
            createIfMissing(store.getName() + " Manager", "manager." + code + "@quickcart.dev", "Manager@123",
                    Role.ROLE_STORE_ADMIN, store, "+91910000" + String.format("%04d", store.getId()));
            for (int r = 0; r < names.length; r++) {
                createIfMissing(names[r], "rider" + (r + 1) + "." + code + "@quickcart.dev", "Rider@123",
                        Role.ROLE_DELIVERY_PARTNER, store, "+9198" + String.format("%03d", store.getId()) + String.format("%05d", r + 1));
            }
        }
    }

    private void createIfMissing(String name, String email, String password, Role role, DarkStore store, String phone) {
        if (!userRepository.existsByEmailIgnoreCase(email) && !userRepository.existsByPhoneNumber(phone)) {
            create(name, email, password, role, store, phone);
        }
    }

    private void create(String name, String email, String password, Role role, DarkStore store, String phone) {
        User u = new User();
        u.setFullName(name);
        u.setEmail(email);
        u.setPasswordHash(encoder.encode(password));
        u.setRole(role);
        u.setProvider(AuthProvider.LOCAL);
        u.setStore(store);
        u.setPhoneNumber(phone);
        userRepository.save(u);
    }
}
