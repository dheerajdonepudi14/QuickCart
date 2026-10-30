package com.quickcommerce.controller;

import com.quickcommerce.dto.StoreDtos.*;
import com.quickcommerce.security.CurrentUser;
import com.quickcommerce.service.AddressService;
import com.quickcommerce.service.StoreService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class StoreController {

    private final StoreService storeService;
    private final AddressService addressService;

    @GetMapping("/api/v1/stores")
    public List<DarkStoreResponse> stores() {
        return storeService.listActive();
    }

    @GetMapping("/api/v1/stores/nearest")
    public StoreMatchResponse nearest(@RequestParam double lat, @RequestParam double lng) {
        return storeService.nearest(lat, lng);
    }

    @GetMapping("/api/v1/stores/by-pincode/{pincode}")
    public StoreMatchResponse byPincode(@PathVariable String pincode) {
        return storeService.byPincode(pincode);
    }

    @GetMapping("/api/v1/me/addresses")
    public List<AddressResponse> addresses() {
        return addressService.list(CurrentUser.require().id());
    }

    @PostMapping("/api/v1/me/addresses")
    @ResponseStatus(HttpStatus.CREATED)
    public AddressResponse addAddress(@Valid @RequestBody AddressRequest req) {
        return addressService.create(CurrentUser.require().id(), req);
    }

    @DeleteMapping("/api/v1/me/addresses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAddress(@PathVariable Long id) {
        addressService.delete(CurrentUser.require().id(), id);
    }
}
