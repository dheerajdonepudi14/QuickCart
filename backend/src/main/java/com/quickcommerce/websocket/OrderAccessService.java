package com.quickcommerce.websocket;

import com.quickcommerce.repository.OrderRepository;
import com.quickcommerce.security.UserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

@Service
public class OrderAccessService {

    private final OrderRepository orderRepository;

    public OrderAccessService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    @Transactional(readOnly = true)
    public boolean canView(UserPrincipal p, Long orderId) {
        if (p == null) return false;
        List<Object[]> rows = orderRepository.findAccessTuple(orderId);
        if (rows.isEmpty()) return false;
        Object[] t = rows.get(0);
        Long ownerId = (Long) t[0], storeId = (Long) t[1], agentId = (Long) t[2];
        return Objects.equals(ownerId, p.id()) || Objects.equals(agentId, p.id()) || p.canManageStore(storeId);
    }

    @Transactional(readOnly = true)
    public boolean canPushLocation(UserPrincipal p, Long orderId) {
        if (p == null) return false;
        List<Object[]> rows = orderRepository.findAccessTuple(orderId);
        if (rows.isEmpty()) return false;
        Object[] t = rows.get(0);
        return Objects.equals(t[2], p.id()) || p.canManageStore((Long) t[1]);
    }
}
