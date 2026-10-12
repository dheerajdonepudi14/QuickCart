package com.quickcommerce.controller;

import com.quickcommerce.dto.OrderDtos.LocationUpdate;
import com.quickcommerce.dto.OrderDtos.OrderResponse;
import com.quickcommerce.dto.OrderDtos.TrackingUpdate;
import com.quickcommerce.security.CurrentUser;
import com.quickcommerce.security.UserPrincipal;
import com.quickcommerce.service.DeliverySimulationService;
import com.quickcommerce.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Rider app API + telemetry intake.
 * STOMP: SEND /app/orders/{id}/location (authorised by StompAuthChannelInterceptor).
 * REST:  POST /api/v1/delivery/orders/{id}/location for rider apps without sockets.
 * Every accepted fix is broadcast on /topic/orders/{id}/tracking; a rider's own fixes pause the simulator.
 */
@RestController
@RequiredArgsConstructor
public class OrderTrackingController {

    private final OrderService orderService;
    private final DeliverySimulationService simulation;

    @MessageMapping("/orders/{orderId}/location")
    public void onLocation(@DestinationVariable Long orderId, @Payload @Valid LocationUpdate update) {
        simulation.noteManualUpdate(orderId);
        orderService.updateRiderLocation(orderId, update.latitude(), update.longitude());
    }

    @GetMapping("/api/v1/delivery/orders")
    public List<OrderResponse> myDeliveries() {
        return orderService.riderOrders(CurrentUser.require());
    }

    @PostMapping("/api/v1/delivery/orders/{orderId}/location")
    public TrackingUpdate restLocation(@PathVariable Long orderId, @Valid @RequestBody LocationUpdate update) {
        UserPrincipal rider = CurrentUser.require();
        orderService.getForUser(rider, orderId); // access check: only the assigned rider (or store staff)
        simulation.noteManualUpdate(orderId);
        return orderService.updateRiderLocation(orderId, update.latitude(), update.longitude());
    }

    @PostMapping("/api/v1/delivery/orders/{orderId}/delivered")
    public OrderResponse delivered(@PathVariable Long orderId) {
        return orderService.riderMarkDelivered(CurrentUser.require(), orderId);
    }
}
