package com.quickcommerce.controller;

import com.quickcommerce.dto.OrderDtos.CancelRequest;
import com.quickcommerce.dto.OrderDtos.OrderResponse;
import com.quickcommerce.dto.OrderDtos.TrackingUpdate;
import com.quickcommerce.security.CurrentUser;
import com.quickcommerce.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @GetMapping
    public List<OrderResponse> myOrders(@RequestParam(defaultValue = "0") int page) {
        return orderService.myOrders(CurrentUser.require(), page);
    }

    @GetMapping("/{orderId}")
    public OrderResponse get(@PathVariable Long orderId) {
        return orderService.getForUser(CurrentUser.require(), orderId);
    }

    /** Polling fallback for live tracking (clients should poll no faster than every 10 s). */
    @GetMapping("/{orderId}/tracking")
    public TrackingUpdate tracking(@PathVariable Long orderId) {
        return orderService.latestTracking(CurrentUser.require(), orderId);
    }

    @PostMapping("/{orderId}/cancel")
    public OrderResponse cancel(@PathVariable Long orderId, @Valid @RequestBody(required = false) CancelRequest req) {
        return orderService.cancelByCustomer(CurrentUser.require(), orderId, req == null ? null : req.reason());
    }
}
