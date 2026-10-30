package com.quickcommerce.controller;

import com.quickcommerce.dto.CommonDtos.MessageResponse;
import com.quickcommerce.dto.CommonDtos.NewsletterRequest;
import com.quickcommerce.service.NewsletterService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class NewsletterController {
    private final NewsletterService newsletterService;

    @PostMapping("/api/v1/newsletter")
    public MessageResponse subscribe(@Valid @RequestBody NewsletterRequest req) {
        newsletterService.subscribe(req.email());
        return new MessageResponse("Subscribed. Watch your inbox for weekly deals.");
    }
}
