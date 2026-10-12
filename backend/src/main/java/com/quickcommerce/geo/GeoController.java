package com.quickcommerce.geo;

import com.quickcommerce.exception.ApiException;
import com.quickcommerce.geo.GeoDtos.GeoAddress;
import com.quickcommerce.geo.GeoDtos.PlaceSuggestion;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Address autocomplete / geocoding proxy used by the address form (debounced on the client, cached here). */
@RestController
@RequestMapping("/api/v1/geo")
@RequiredArgsConstructor
public class GeoController {

    private final GeoService geo;

    @GetMapping("/provider")
    public Map<String, String> provider() {
        return Map.of("provider", geo.provider());
    }

    @GetMapping("/autocomplete")
    public List<PlaceSuggestion> autocomplete(@RequestParam String q,
                                              @RequestParam(required = false) Double lat,
                                              @RequestParam(required = false) Double lng,
                                              @RequestParam(required = false) String sessionToken) {
        if (q.length() > 200) throw ApiException.badRequest("Query too long.");
        return geo.autocomplete(q, lat, lng, sessionToken);
    }

    @GetMapping("/place/{placeId}")
    public GeoAddress place(@PathVariable String placeId, @RequestParam(required = false) String sessionToken) {
        return geo.placeDetails(placeId, sessionToken);
    }

    @GetMapping("/reverse")
    public GeoAddress reverse(@RequestParam double lat, @RequestParam double lng) {
        return geo.reverse(lat, lng).orElseThrow(() -> ApiException.notFound("No address found at this point."));
    }

    @GetMapping("/geocode")
    public GeoAddress geocode(@RequestParam(required = false) String line1, @RequestParam(required = false) String line2,
                              @RequestParam(required = false) String locality, @RequestParam(required = false) String city,
                              @RequestParam(required = false) String state, @RequestParam(required = false) String pincode) {
        return geo.geocode(line1, line2, locality, city, state, pincode)
                .orElseThrow(() -> ApiException.notFound("We couldn't locate this address. Check the pincode or pin it on the map."));
    }
}
