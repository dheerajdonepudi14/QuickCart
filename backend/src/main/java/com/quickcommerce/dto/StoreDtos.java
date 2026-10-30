package com.quickcommerce.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class StoreDtos {
    private StoreDtos() {}

    public record DarkStoreResponse(Long id, String storeCode, String name, String address, String city,
                                    String pincode, double latitude, double longitude) {}

    public record StoreMatchResponse(DarkStoreResponse store, double distanceKm, int etaMinutes,
                                     boolean serviceable, String locationLabel) {}

    /**
     * line1 = flat / house no. + building, line2 = street / area. When latitude/longitude are missing the server
     * geocodes the address and rejects it with a clear message if it can't be located.
     */
    public record AddressRequest(@Size(max = 30) String label,
                                 @Size(max = 100) String contactName,
                                 @Pattern(regexp = "^$|^[+]?[0-9]{10,14}$", message = "must be a valid phone number") String contactPhone,
                                 @NotBlank @Size(max = 200) String line1,
                                 @Size(max = 200) String line2,
                                 @Size(max = 120) String locality,
                                 @Size(max = 200) String landmark,
                                 @NotBlank @Size(max = 80) String city,
                                 @Size(max = 80) String state,
                                 @NotBlank @Pattern(regexp = "^[1-9][0-9]{5}$", message = "must be a 6-digit pincode") String pincode,
                                 Double latitude, Double longitude,
                                 @Size(max = 300) String placeId,
                                 @Size(max = 30) String geocodeSource,
                                 boolean makeDefault) {}

    public record AddressResponse(Long id, String label, String contactName, String contactPhone, String line1, String line2,
                                  String locality, String landmark, String city, String state, String pincode,
                                  Double latitude, Double longitude, boolean isDefault, String fullText,
                                  String formattedAddress, String geocodeSource, String warning) {
}
}
