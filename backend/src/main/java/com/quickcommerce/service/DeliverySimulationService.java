package com.quickcommerce.service;

import com.quickcommerce.config.AppProperties;
import com.quickcommerce.entity.Order;
import com.quickcommerce.entity.OrderStatus;
import com.quickcommerce.entity.Role;
import com.quickcommerce.entity.User;
import com.quickcommerce.repository.OrderRepository;
import com.quickcommerce.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Demo fleet: streams rider GPS every tick for OUT_FOR_DELIVERY orders and, when auto-progress is on,
 * walks paid orders through packing and dispatch. A real rider app pushing /app/orders/{id}/location
 * takes over from the simulator for that order.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeliverySimulationService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final OrderService orderService;
    private final TransactionTemplate tx;
    private final AppProperties props;

    private final RouteService routeService;

    private final Map<Long, Instant> manualUpdates = new ConcurrentHashMap<>();
    /** Road path per order being driven by the simulator, plus the index of the next waypoint. */
    private final Map<Long, RoutePlan> routes = new ConcurrentHashMap<>();

    private static final class RoutePlan {
        final List<double[]> points;
        int next = 0;
        RoutePlan(List<double[]> points) { this.points = points; }

        /** Moves up to {@code meters} along the path; falls back to a straight line when there is no path. */
        synchronized double[] advance(double lat, double lng, double destLat, double destLng, double meters) {
            if (points.isEmpty() || next >= points.size()) {
                return GeoUtils.stepToward(lat, lng, destLat, destLng, meters);
            }
            double remaining = meters;
            double curLat = lat, curLng = lng;
            while (remaining > 0 && next < points.size()) {
                double[] target = points.get(next);
                double d = GeoUtils.haversineKm(curLat, curLng, target[0], target[1]) * 1000;
                if (d <= remaining) {
                    curLat = target[0];
                    curLng = target[1];
                    remaining -= d;
                    next++;
                } else {
                    double[] step = GeoUtils.stepToward(curLat, curLng, target[0], target[1], remaining);
                    curLat = step[0];
                    curLng = step[1];
                    remaining = 0;
                }
            }
            if (next >= points.size() && remaining > 0) {
                return GeoUtils.stepToward(curLat, curLng, destLat, destLng, remaining);
            }
            return new double[]{curLat, curLng};
        }

        /** Road distance (km) left from the given position along the remaining waypoints; null without a route. */
        synchronized Double remainingKm(double lat, double lng) {
            if (points.isEmpty() || next >= points.size()) return null;
            double km = 0;
            double pLat = lat, pLng = lng;
            for (int i = next; i < points.size(); i++) {
                double[] pt = points.get(i);
                km += GeoUtils.haversineKm(pLat, pLng, pt[0], pt[1]);
                pLat = pt[0];
                pLng = pt[1];
            }
            return km;
        }
    }

    public void noteManualUpdate(Long orderId) {
        manualUpdates.put(orderId, Instant.now());
    }

    @Scheduled(fixedDelayString = "${app.simulation.tracking-interval-ms:3000}", initialDelay = 10_000)
    public void tickRiders() {
        List<Long> active = orderRepository.findIdsByStatus(OrderStatus.OUT_FOR_DELIVERY);
        routes.keySet().retainAll(Set.copyOf(active));
        for (Long id : active) {
            Instant manual = manualUpdates.get(id);
            if (manual != null && manual.isAfter(Instant.now().minusSeconds(15))) continue;
            try {
                double[] state = tx.execute(s -> {
                    Order o = orderService.load(id);
                    if (o.getStatus() != OrderStatus.OUT_FOR_DELIVERY || o.getRiderLatitude() == null
                            || o.getDeliveryLatitude() == null) return null;
                    return new double[]{o.getRiderLatitude(), o.getRiderLongitude(), o.getDeliveryLatitude(), o.getDeliveryLongitude()};
                });
                if (state == null) continue;
                // Network call happens outside any transaction.
                RoutePlan plan = routes.computeIfAbsent(id,
                        k -> new RoutePlan(routeService.route(state[0], state[1], state[2], state[3])));
                double[] next = plan.advance(state[0], state[1], state[2], state[3], props.simulation().riderSpeedMetersPerTick());
                Double roadKm = plan.remainingKm(next[0], next[1]);
                tx.executeWithoutResult(s -> orderService.updateRiderLocation(id, next[0], next[1], roadKm));
            } catch (Exception ex) {
                log.debug("Rider tick skipped for {}: {}", id, ex.getMessage());
            }
        }
        manualUpdates.entrySet().removeIf(e -> e.getValue().isBefore(Instant.now().minusSeconds(600)));
    }

    @Scheduled(fixedDelay = 5_000, initialDelay = 12_000)
    public void autoProgress() {
        if (!props.simulation().autoProgress()) return;
        Instant cutoff = Instant.now().minus(Duration.ofSeconds(props.simulation().packingSeconds()));

        for (Long id : orderRepository.findIdsByStatusUpdatedBefore(OrderStatus.ORDER_PLACED, cutoff)) {
            safely(id, () -> orderService.markPacking(id));
        }
        for (Long id : orderRepository.findIdsByStatusUpdatedBefore(OrderStatus.PACKING_IN_PROGRESS, cutoff)) {
            safely(id, () -> {
                Order o = orderService.load(id);
                List<User> riders = userRepository.findByRoleAndStoreId(Role.ROLE_DELIVERY_PARTNER, o.getDarkStore().getId());
                if (riders.isEmpty()) return;
                Set<Long> busy = Set.copyOf(orderRepository.findIdsByStatus(OrderStatus.OUT_FOR_DELIVERY));
                User rider = riders.get((int) (id % riders.size()));
                orderService.assignAgentAndDispatch(id, rider.getId());
                log.debug("Auto-dispatched order {} with {} ({} orders already on the road)", id, rider.getFullName(), busy.size());
            });
        }
    }

    private void safely(Long id, Runnable r) {
        try {
            tx.executeWithoutResult(s -> r.run());
        } catch (Exception ex) {
            log.debug("Auto-progress skipped for {}: {}", id, ex.getMessage());
        }
    }
}
