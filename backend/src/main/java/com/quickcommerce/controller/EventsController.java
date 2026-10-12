package com.quickcommerce.controller;

import com.quickcommerce.exception.ApiException;
import com.quickcommerce.service.ImageExperimentService;
import com.quickcommerce.service.ImageExperimentService.ImageEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Batched storefront analytics events (rate limited by RateLimitFilter). */
@RestController
@RequestMapping("/api/v1/events")
@RequiredArgsConstructor
public class EventsController {

    public record ImageEventBatch(List<ImageEvent> events) {}

    private final ImageExperimentService experiments;

    @PostMapping("/images")
    public Map<String, Integer> images(@RequestBody ImageEventBatch batch) {
        if (batch == null || batch.events() == null) return Map.of("recorded", 0);
        if (batch.events().size() > 100) throw ApiException.badRequest("Send at most 100 events per batch.");
        return Map.of("recorded", experiments.record(batch.events()));
    }
}
