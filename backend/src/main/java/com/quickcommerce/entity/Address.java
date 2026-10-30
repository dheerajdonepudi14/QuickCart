package com.quickcommerce.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "addresses")
@Getter @Setter @NoArgsConstructor
public class Address {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false, length = 30)
    private String label = "Home";

    @Column(nullable = false, length = 200)
    private String line1;

    @Column(length = 200)
    private String line2;

    @Column(nullable = false, length = 80)
    private String city;

    @Column(name = "contact_name", length = 100)
    private String contactName;

    @Column(name = "contact_phone", length = 20)
    private String contactPhone;

    @Column(length = 120)
    private String locality;

    @Column(length = 200)
    private String landmark;

    @Column(length = 80)
    private String state;

    @Column(name = "formatted_address", columnDefinition = "TEXT")
    private String formattedAddress;

    /** gps | google | nominatim | photon | pin — how the coordinates were obtained. */
    @Column(name = "geocode_source", length = 30)
    private String geocodeSource;

    @Column(name = "place_id", length = 300)
    private String placeId;

    @Column(nullable = false, length = 10)
    private String pincode;

    private Double latitude;
    private Double longitude;

    @Column(name = "is_default", nullable = false)
    private boolean defaultAddress;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public String toSingleLine() {
        StringBuilder sb = new StringBuilder(line1);
        if (line2 != null && !line2.isBlank()) sb.append(", ").append(line2);
        if (locality != null && !locality.isBlank() && (line2 == null || !line2.contains(locality))) sb.append(", ").append(locality);
        sb.append(", ").append(city);
        if (state != null && !state.isBlank()) sb.append(", ").append(state);
        return sb.append(" - ").append(pincode).toString();
    }
}
