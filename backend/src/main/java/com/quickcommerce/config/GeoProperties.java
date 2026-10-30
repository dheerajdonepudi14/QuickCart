package com.quickcommerce.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Address autocomplete, geocoding and routing. With a Google Maps key the Places (New) and Geocoding APIs
 * are used; otherwise the free OpenStreetMap stack (Photon autocomplete, Nominatim geocoding, OSRM routing).
 */
@ConfigurationProperties(prefix = "app.geo")
public record GeoProperties(String googleMapsApiKey, String nominatimUrl, String photonUrl, String osrmUrl,
                            String contactEmail, String countryCode) {

    private static boolean has(String v) { return v != null && !v.isBlank(); }

    public boolean google() { return has(googleMapsApiKey); }
    public String nominatim() { return has(nominatimUrl) ? nominatimUrl : "https://nominatim.openstreetmap.org"; }
    public String photon() { return has(photonUrl) ? photonUrl : "https://photon.komoot.io"; }
    public String osrm() { return has(osrmUrl) ? osrmUrl : "https://router.project-osrm.org"; }
    public String email() { return has(contactEmail) ? contactEmail : "support@quickcart.dev"; }
    public String country() { return has(countryCode) ? countryCode.toLowerCase() : "in"; }
    public String userAgent() { return "QuickCart/2.0 (+" + email() + ")"; }
}
