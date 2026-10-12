package com.quickcommerce.geo;

public final class GeoDtos {
    private GeoDtos() {}

    /**
     * One autocomplete suggestion. When lat/lng are present (OpenStreetMap results) no details call is needed;
     * Google suggestions are resolved with GET /api/v1/geo/place/{id}.
     */
    public record PlaceSuggestion(String id, String primaryText, String secondaryText, Double latitude, Double longitude,
                                  String source) {}

    /** A structured, geocoded address. */
    public record GeoAddress(String line1, String line2, String locality, String city, String state, String pincode,
                             String formattedAddress, Double latitude, Double longitude, String source, String placeId) {}
}
