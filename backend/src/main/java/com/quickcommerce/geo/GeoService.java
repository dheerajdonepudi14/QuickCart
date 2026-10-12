package com.quickcommerce.geo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.quickcommerce.config.GeoProperties;
import com.quickcommerce.exception.ApiException;
import com.quickcommerce.geo.GeoDtos.GeoAddress;
import com.quickcommerce.geo.GeoDtos.PlaceSuggestion;
import com.quickcommerce.integration.ExternalHttp;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.StringJoiner;

/**
 * Server-side address intelligence (keeps API keys off the browser and lets us cache popular prefixes):
 *  - Google Places API (New) autocomplete + details and Google Geocoding when GOOGLE_MAPS_API_KEY is set;
 *  - otherwise Photon (OSM) autocomplete and Nominatim (OSM) geocoding / reverse geocoding.
 */
@Slf4j
@Service
public class GeoService {

    private final GeoProperties props;
    private final ExternalHttp http;
    private final ObjectMapper mapper;

    private final Cache<String, List<PlaceSuggestion>> autocompleteCache = Caffeine.newBuilder()
            .maximumSize(5_000).expireAfterWrite(Duration.ofHours(6)).build();
    private final Cache<String, Optional<GeoAddress>> geocodeCache = Caffeine.newBuilder()
            .maximumSize(10_000).expireAfterWrite(Duration.ofDays(7)).build();

    /** Nominatim's usage policy allows ~1 request/second per application. */
    private long lastNominatimCall;

    public GeoService(GeoProperties props, ExternalHttp http, ObjectMapper mapper) {
        this.props = props;
        this.http = http;
        this.mapper = mapper;
    }

    public String provider() { return props.google() ? "google" : "openstreetmap"; }

    // ------------------------------------------------------------------ autocomplete

    public List<PlaceSuggestion> autocomplete(String query, Double lat, Double lng, String sessionToken) {
        String q = query == null ? "" : query.trim();
        if (q.length() < 3) return List.of();
        String key = q.toLowerCase(Locale.ROOT) + "|" + round(lat) + "|" + round(lng);
        List<PlaceSuggestion> cached = autocompleteCache.getIfPresent(key);
        if (cached != null) return cached;
        List<PlaceSuggestion> result = props.google() ? googleAutocomplete(q, lat, lng, sessionToken) : photonAutocomplete(q, lat, lng);
        autocompleteCache.put(key, result);
        return result;
    }

    private List<PlaceSuggestion> googleAutocomplete(String q, Double lat, Double lng, String sessionToken) {
        ObjectNode body = mapper.createObjectNode();
        body.put("input", q);
        body.putArray("includedRegionCodes").add(props.country());
        if (sessionToken != null && !sessionToken.isBlank()) body.put("sessionToken", sessionToken);
        if (lat != null && lng != null) {
            ObjectNode circle = body.putObject("locationBias").putObject("circle");
            circle.putObject("center").put("latitude", lat).put("longitude", lng);
            circle.put("radius", 20000.0);
        }
        HttpRequest req = ExternalHttp.request("https://places.googleapis.com/v1/places:autocomplete", 8)
                .header("Content-Type", "application/json")
                .header("X-Goog-Api-Key", props.googleMapsApiKey())
                .POST(HttpRequest.BodyPublishers.ofString(body.toString())).build();
        JsonNode json = call("google_places", "autocomplete", req);
        List<PlaceSuggestion> out = new ArrayList<>();
        for (JsonNode s : json.path("suggestions")) {
            JsonNode p = s.path("placePrediction");
            if (p.isMissingNode()) continue;
            out.add(new PlaceSuggestion(p.path("placeId").asText(),
                    p.path("structuredFormat").path("mainText").path("text").asText(p.path("text").path("text").asText()),
                    p.path("structuredFormat").path("secondaryText").path("text").asText(""), null, null, "google"));
        }
        return out;
    }

    private List<PlaceSuggestion> photonAutocomplete(String q, Double lat, Double lng) {
        StringBuilder url = new StringBuilder(props.photon()).append("/api/?limit=7&lang=en&q=").append(enc(q));
        if (lat != null && lng != null) url.append("&lat=").append(lat).append("&lon=").append(lng);
        HttpRequest req = ExternalHttp.request(url.toString(), 8).header("User-Agent", props.userAgent()).GET().build();
        JsonNode json = call("photon", "autocomplete", req);
        List<PlaceSuggestion> out = new ArrayList<>();
        for (JsonNode f : json.path("features")) {
            JsonNode p = f.path("properties");
            String cc = p.path("countrycode").asText("").toLowerCase(Locale.ROOT);
            if (!cc.isEmpty() && !cc.equals(props.country())) continue;
            JsonNode coords = f.path("geometry").path("coordinates");
            String primary = join(p.path("name").asText(null), p.path("housenumber").asText(null), p.path("street").asText(null));
            String secondary = join(p.path("district").asText(null), p.path("city").asText(null),
                    p.path("state").asText(null), p.path("postcode").asText(null));
            String id = "osm:" + p.path("osm_type").asText("N") + p.path("osm_id").asText("");
            out.add(new PlaceSuggestion(id, primary.isBlank() ? secondary : primary, secondary,
                    coords.path(1).asDouble(), coords.path(0).asDouble(), "photon"));
        }
        return out;
    }

    // ------------------------------------------------------------------ details / reverse / geocode

    /** Google place details (Places API New). OSM suggestions already carry coordinates → reverse geocode instead. */
    public GeoAddress placeDetails(String placeId, String sessionToken) {
        if (placeId.startsWith("osm:")) throw ApiException.badRequest("OpenStreetMap suggestions already include coordinates.");
        if (!props.google()) throw ApiException.badRequest("Google Places isn't configured.");
        String url = "https://places.googleapis.com/v1/places/" + enc(placeId)
                + (sessionToken != null && !sessionToken.isBlank() ? "?sessionToken=" + enc(sessionToken) : "");
        HttpRequest req = ExternalHttp.request(url, 8)
                .header("X-Goog-Api-Key", props.googleMapsApiKey())
                .header("X-Goog-FieldMask", "id,formattedAddress,addressComponents,location")
                .GET().build();
        JsonNode p = call("google_places", "details", req);
        return fromGoogleComponents(p.path("addressComponents"), p.path("formattedAddress").asText(null),
                p.path("location").path("latitude").asDouble(), p.path("location").path("longitude").asDouble(),
                "google", p.path("id").asText(placeId), true);
    }

    public Optional<GeoAddress> reverse(double lat, double lng) {
        String key = "rev|" + round(lat) + "|" + round(lng);
        return geocodeCache.get(key, k -> props.google() ? googleGeocode("latlng=" + lat + "," + lng) : nominatimReverse(lat, lng));
    }

    /** Forward geocoding of a typed address; empty when the address can't be located. */
    public Optional<GeoAddress> geocode(String line1, String line2, String locality, String city, String state, String pincode) {
        StringJoiner full = new StringJoiner(", ");
        for (String part : new String[]{line1, line2, locality, city, state, pincode}) {
            if (part != null && !part.isBlank()) full.add(part.trim());
        }
        String key = "fwd|" + full.toString().toLowerCase(Locale.ROOT);
        return geocodeCache.get(key, k -> {
            if (props.google()) {
                return googleGeocode("address=" + enc(full + ", India") + "&components=country:" + props.country().toUpperCase());
            }
            // Try the most specific query first, then fall back to locality + city + pincode.
            Optional<GeoAddress> r = nominatimSearch(full.toString());
            if (r.isEmpty()) {
                StringJoiner coarse = new StringJoiner(", ");
                for (String part : new String[]{line2, locality, city, pincode}) {
                    if (part != null && !part.isBlank()) coarse.add(part.trim());
                }
                r = nominatimSearch(coarse.toString());
            }
            if (r.isEmpty() && pincode != null && !pincode.isBlank()) r = nominatimSearch(pincode + ", " + (city == null ? "" : city));
            return r;
        });
    }

    private Optional<GeoAddress> googleGeocode(String query) {
        HttpRequest req = ExternalHttp.request("https://maps.googleapis.com/maps/api/geocode/json?" + query
                + "&region=" + props.country() + "&key=" + enc(props.googleMapsApiKey()), 8).GET().build();
        JsonNode json = call("google_geocoding", "geocode", req);
        JsonNode r = json.path("results").path(0);
        if (r.isMissingNode()) return Optional.empty();
        JsonNode loc = r.path("geometry").path("location");
        return Optional.of(fromGoogleComponents(r.path("address_components"), r.path("formatted_address").asText(null),
                loc.path("lat").asDouble(), loc.path("lng").asDouble(), "google", r.path("place_id").asText(null), false));
    }

    private Optional<GeoAddress> nominatimSearch(String q) {
        if (q.isBlank()) return Optional.empty();
        String url = props.nominatim() + "/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=" + props.country()
                + "&q=" + enc(q) + "&email=" + enc(props.email());
        JsonNode arr = nominatim("search", url);
        return arr.isArray() && arr.size() > 0 ? Optional.of(fromNominatim(arr.get(0))) : Optional.empty();
    }

    private Optional<GeoAddress> nominatimReverse(double lat, double lng) {
        String url = props.nominatim() + "/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=" + lat + "&lon=" + lng
                + "&email=" + enc(props.email());
        JsonNode r = nominatim("reverse", url);
        return r.has("error") || !r.has("lat") ? Optional.empty() : Optional.of(fromNominatim(r));
    }

    private JsonNode nominatim(String op, String url) {
        synchronized (this) {
            long wait = 1100 - (System.currentTimeMillis() - lastNominatimCall);
            if (wait > 0) {
                try {
                    Thread.sleep(wait);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
            lastNominatimCall = System.currentTimeMillis();
        }
        HttpRequest req = ExternalHttp.request(url, 10)
                .header("User-Agent", props.userAgent()).header("Accept-Language", "en").GET().build();
        return call("nominatim", op, req);
    }

    // ------------------------------------------------------------------ parsing

    private GeoAddress fromNominatim(JsonNode r) {
        JsonNode a = r.path("address");
        String line1 = join(a.path("house_number").asText(null), a.path("building").asText(null), a.path("amenity").asText(null));
        String street = first(a, "road", "pedestrian", "residential", "footway");
        String locality = first(a, "suburb", "neighbourhood", "quarter", "city_district", "village");
        String city = first(a, "city", "town", "municipality", "county", "state_district");
        return new GeoAddress(line1.isBlank() ? null : line1, street, locality, city, a.path("state").asText(null),
                a.path("postcode").asText("").replace(" ", ""), r.path("display_name").asText(null),
                r.path("lat").asDouble(), r.path("lon").asDouble(), "nominatim",
                "osm:" + r.path("osm_type").asText("").toUpperCase(Locale.ROOT) + r.path("osm_id").asText(""));
    }

    private GeoAddress fromGoogleComponents(JsonNode comps, String formatted, double lat, double lng, String source,
                                            String placeId, boolean placesApiFormat) {
        String streetNumber = null, premise = null, route = null, sublocality = null, locality = null,
                district = null, state = null, postal = null;
        for (JsonNode c : comps) {
            String text = placesApiFormat ? c.path("longText").asText(null) : c.path("long_name").asText(null);
            for (JsonNode t : c.path("types")) {
                switch (t.asText()) {
                    case "street_number" -> streetNumber = text;
                    case "premise", "subpremise" -> premise = premise == null ? text : premise + ", " + text;
                    case "route" -> route = text;
                    case "sublocality_level_1", "sublocality", "neighborhood" -> { if (sublocality == null) sublocality = text; }
                    case "locality" -> locality = text;
                    case "administrative_area_level_3", "administrative_area_level_2" -> { if (district == null) district = text; }
                    case "administrative_area_level_1" -> state = text;
                    case "postal_code" -> postal = text;
                    default -> { }
                }
            }
        }
        String line1 = join(premise, streetNumber);
        return new GeoAddress(line1.isBlank() ? null : line1, route, sublocality, locality != null ? locality : district,
                state, postal == null ? "" : postal.replace(" ", ""), formatted, lat, lng, source, placeId);
    }

    private JsonNode call(String service, String op, HttpRequest req) {
        HttpResponse<String> res;
        try {
            res = http.send(service, op, req, true);
        } catch (ExternalHttp.ExternalCallException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Address lookup is temporarily unavailable. You can still pin your location on the map.");
        }
        if (res.statusCode() >= 400) {
            log.warn("{} {} returned {}", service, op, res.statusCode());
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Address lookup is temporarily unavailable. You can still pin your location on the map.");
        }
        try {
            return mapper.readTree(res.body());
        } catch (Exception e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Address lookup returned an unexpected response.");
        }
    }

    private static String first(JsonNode a, String... keys) {
        for (String k : keys) {
            String v = a.path(k).asText(null);
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    private static String join(String... parts) {
        StringJoiner j = new StringJoiner(", ");
        for (String p : parts) if (p != null && !p.isBlank()) j.add(p);
        return j.toString();
    }

    private static String round(Double v) {
        return v == null ? "-" : String.format(Locale.ROOT, "%.2f", v);
    }

    private static String enc(String v) {
        return URLEncoder.encode(v == null ? "" : v, StandardCharsets.UTF_8);
    }
}
