package com.quickcommerce.service;

import com.quickcommerce.config.AppProperties;
import com.quickcommerce.dto.StoreDtos.DarkStoreResponse;
import com.quickcommerce.dto.StoreDtos.StoreMatchResponse;
import com.quickcommerce.entity.DarkStore;
import com.quickcommerce.exception.ApiException;
import com.quickcommerce.repository.DarkStoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StoreService {

    private final DarkStoreRepository storeRepository;
    private final AppProperties props;

    @Cacheable("stores")
    public List<DarkStoreResponse> listActive() {
        return storeRepository.findByActiveTrue().stream().map(StoreService::toResponse).toList();
    }

    public DarkStore require(Long storeId) {
        return storeRepository.findById(storeId).filter(DarkStore::isActive)
                .orElseThrow(() -> ApiException.notFound("This store is closed right now. Pick another location."));
    }

    /** Maps GPS coordinates to the nearest operational dark store. */
    public StoreMatchResponse nearest(double lat, double lng) {
        DarkStore best = storeRepository.findByActiveTrue().stream()
                .min(Comparator.comparingDouble(s -> GeoUtils.haversineKm(lat, lng, s.getLatitude(), s.getLongitude())))
                .orElseThrow(() -> ApiException.notFound("No dark stores are operating yet."));
        double km = GeoUtils.haversineKm(lat, lng, best.getLatitude(), best.getLongitude());
        boolean serviceable = km <= props.checkout().serviceableRadiusKm();
        return new StoreMatchResponse(toResponse(best), round1(km), GeoUtils.etaMinutes(km), serviceable,
                serviceable ? best.getCity() : "Outside delivery zone");
    }

    /** Pincode lookup: exact match, then same postal region (first 3 digits), else not serviceable. */
    public StoreMatchResponse byPincode(String pincode) {
        if (pincode == null || !pincode.matches("\\d{6}")) throw ApiException.badRequest("Enter a 6-digit pincode.");
        List<DarkStore> exact = storeRepository.findByPincodeAndActiveTrue(pincode);
        if (!exact.isEmpty()) {
            return new StoreMatchResponse(toResponse(exact.get(0)), 1.2, 9, true, exact.get(0).getCity() + " " + pincode);
        }
        List<DarkStore> region = storeRepository.findByPincodeStartingWithAndActiveTrue(pincode.substring(0, 3));
        if (!region.isEmpty()) {
            return new StoreMatchResponse(toResponse(region.get(0)), 4.5, 16, true, region.get(0).getCity() + " " + pincode);
        }
        DarkStore fallback = storeRepository.findByActiveTrue().stream().findFirst()
                .orElseThrow(() -> ApiException.notFound("No dark stores are operating yet."));
        return new StoreMatchResponse(toResponse(fallback), 0, 0, false, "We don't deliver to " + pincode + " yet");
    }

    public static DarkStoreResponse toResponse(DarkStore s) {
        return new DarkStoreResponse(s.getId(), s.getStoreCode(), s.getName(), s.getAddress(), s.getCity(),
                s.getPincode(), s.getLatitude(), s.getLongitude());
    }

    private static double round1(double v) { return Math.round(v * 10) / 10.0; }
}
