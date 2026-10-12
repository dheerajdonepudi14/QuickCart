package com.quickcommerce.controller;

import com.quickcommerce.dto.AdminDtos.*;
import com.quickcommerce.dto.CatalogDtos.PageResponse;
import com.quickcommerce.dto.OrderDtos.OrderResponse;
import com.quickcommerce.dto.StoreDtos.DarkStoreResponse;
import com.quickcommerce.security.CurrentUser;
import com.quickcommerce.security.UserPrincipal;
import com.quickcommerce.service.AdminService;
import com.quickcommerce.service.StoreService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;
    private final StoreService storeService;

    public record OrderActionRequest(String action, Long agentId, String reason) {}

    @GetMapping("/stores")
    public List<DarkStoreResponse> myStores() {
        UserPrincipal admin = CurrentUser.require();
        return storeService.listActive().stream().filter(s -> admin.canManageStore(s.id())).toList();
    }

    @GetMapping("/stores/{storeId}/inventory")
    public PageResponse<InventoryRow> inventory(@PathVariable Long storeId,
                                                @RequestParam(required = false) String q,
                                                @RequestParam(defaultValue = "false") boolean lowStock,
                                                @RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "25") int size) {
        return adminService.inventory(CurrentUser.require(), storeId, q, lowStock, page, size);
    }

    @PatchMapping("/inventory/{inventoryId}")
    public InventoryRow updateInventory(@PathVariable Long inventoryId, @Valid @RequestBody InventoryUpdateRequest req) {
        return adminService.updateInventory(CurrentUser.require(), inventoryId, req);
    }

    @GetMapping("/stores/{storeId}/orders")
    public List<OrderResponse> orders(@PathVariable Long storeId, @RequestParam(defaultValue = "live") String scope) {
        return adminService.controlTower(CurrentUser.require(), storeId, scope);
    }

    @GetMapping("/stores/{storeId}/agents")
    public List<AgentResponse> agents(@PathVariable Long storeId) {
        return adminService.agents(CurrentUser.require(), storeId);
    }

    @PostMapping("/orders/{orderId}/actions")
    public OrderResponse act(@PathVariable Long orderId, @RequestBody OrderActionRequest req) {
        return adminService.act(CurrentUser.require(), orderId, req.action(), req.agentId(), req.reason());
    }

    @GetMapping("/stores/{storeId}/analytics")
    public DashboardResponse analytics(@PathVariable Long storeId, @RequestParam(defaultValue = "daily") String range) {
        return adminService.dashboard(CurrentUser.require(), storeId, range);
    }
}
