package com.quickcommerce.service;

import com.quickcommerce.entity.NewsletterSubscriber;
import com.quickcommerce.repository.NewsletterSubscriberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NewsletterService {
    private final NewsletterSubscriberRepository repository;

    @Transactional
    public void subscribe(String email) {
        String normalized = email.trim().toLowerCase();
        if (repository.existsByEmailIgnoreCase(normalized)) return;
        NewsletterSubscriber s = new NewsletterSubscriber();
        s.setEmail(normalized);
        repository.save(s);
    }
}
