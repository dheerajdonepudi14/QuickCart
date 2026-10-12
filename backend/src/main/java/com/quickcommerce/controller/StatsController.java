package com.quickcommerce.controller;

import com.quickcommerce.dto.StatsDtos.PlatformStats;
import com.quickcommerce.service.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/stats")
@RequiredArgsConstructor
public class StatsController {

    private final StatsService statsService;

    /** Public platform counters (no personal data). */
    @GetMapping
    public PlatformStats platform() {
        return statsService.platform();
    }
}
