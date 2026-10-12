package com.quickcommerce.service;

public final class GeoUtils {
    private static final double EARTH_RADIUS_KM = 6371.0088;

    private GeoUtils() {}

    public static double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /** Rider ETA: 4 min pick/pack + ~2.5 min per km on a two-wheeler in city traffic. */
    public static int etaMinutes(double distanceKm) {
        return (int) Math.max(8, Math.round(4 + distanceKm * 2.5));
    }

    /** Moves a point toward a target by at most stepMeters. Returns {lat, lng, remainingKm}. */
    public static double[] stepToward(double lat, double lng, double targetLat, double targetLng, double stepMeters) {
        double remainingKm = haversineKm(lat, lng, targetLat, targetLng);
        double stepKm = stepMeters / 1000.0;
        if (remainingKm <= stepKm) return new double[]{targetLat, targetLng, 0};
        double f = stepKm / remainingKm;
        // Tiny lateral wobble so the marker looks like it's following streets, not a ruler.
        double wobble = (Math.random() - 0.5) * 0.00015;
        double nLat = lat + (targetLat - lat) * f + wobble;
        double nLng = lng + (targetLng - lng) * f - wobble;
        return new double[]{nLat, nLng, haversineKm(nLat, nLng, targetLat, targetLng)};
    }
}
