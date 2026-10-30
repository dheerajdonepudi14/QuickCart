package com.quickcommerce.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Road routing through the free public OSRM server (OpenStreetMap data, no API key).
 * The frontend draws the same route, so the simulated rider follows the streets shown on the map.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RouteService {

    private final ObjectMapper objectMapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();

    @Value("${app.routing.osrm-url:https://router.project-osrm.org}")
    private String osrmUrl;

    /** Returns [lat, lng] points from origin to destination, or an empty list if routing is unavailable. */
    public List<double[]> route(double fromLat, double fromLng, double toLat, double toLng) {
        String url = String.format(Locale.ROOT, "%s/route/v1/driving/%.6f,%.6f;%.6f,%.6f?overview=full&geometries=geojson",
                osrmUrl, fromLng, fromLat, toLng, toLat);
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(6))
                    .header("User-Agent", "QuickCart/1.0 (delivery simulation)").GET().build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) return List.of();
            JsonNode coords = objectMapper.readTree(res.body()).path("routes").path(0).path("geometry").path("coordinates");
            List<double[]> points = new ArrayList<>();
            for (JsonNode c : coords) points.add(new double[]{c.get(1).asDouble(), c.get(0).asDouble()});
            return points;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return List.of();
        } catch (Exception e) {
            log.debug("OSRM routing unavailable: {}", e.getMessage());
            return List.of();
        }
    }
}
