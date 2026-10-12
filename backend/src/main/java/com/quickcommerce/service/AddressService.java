package com.quickcommerce.service;

import com.quickcommerce.dto.StoreDtos.AddressRequest;
import com.quickcommerce.dto.StoreDtos.AddressResponse;
import com.quickcommerce.entity.Address;
import com.quickcommerce.exception.ApiException;
import com.quickcommerce.geo.GeoDtos.GeoAddress;
import com.quickcommerce.geo.GeoService;
import org.springframework.http.HttpStatus;
import com.quickcommerce.repository.AddressRepository;
import com.quickcommerce.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AddressService {

    private final AddressRepository addressRepository;
    private final UserRepository userRepository;
    private final GeoService geo;

    @Transactional(readOnly = true)
    public List<AddressResponse> list(Long userId) {
        return addressRepository.findByUserIdOrderByDefaultAddressDescCreatedAtDesc(userId).stream()
                .map(AddressService::toResponse).toList();
    }

    @Transactional
    public AddressResponse create(Long userId, AddressRequest req) {
        List<Address> existing = addressRepository.findByUserIdOrderByDefaultAddressDescCreatedAtDesc(userId);
        if (existing.size() >= 10) throw ApiException.badRequest("You can save up to 10 addresses. Delete one first.");

        Double lat = req.latitude(), lng = req.longitude();
        String source = req.geocodeSource() == null || req.geocodeSource().isBlank() ? "pin" : req.geocodeSource();
        String formatted = null, warning = null;
        if (lat == null || lng == null) {
            // Server-side geocoding when the client didn't send coordinates.
            GeoAddress g = geo.geocode(req.line1(), req.line2(), req.locality(), req.city(), req.state(), req.pincode())
                    .orElseThrow(() -> new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
                            "We couldn't find this address on the map. Check the locality and pincode, or drop a pin."));
            lat = g.latitude();
            lng = g.longitude();
            formatted = g.formattedAddress();
            source = g.source();
            if (g.pincode() != null && !g.pincode().isBlank() && !g.pincode().equals(req.pincode().trim())) {
                warning = "The map places this address in pincode " + g.pincode() + ". Please double-check your pincode.";
            }
        } else if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            throw ApiException.badRequest("Invalid map location.");
        }

        boolean makeDefault = req.makeDefault() || existing.isEmpty();
        if (makeDefault) addressRepository.clearDefault(userId);
        Address a = new Address();
        a.setUser(userRepository.getReferenceById(userId));
        a.setLabel(req.label() == null || req.label().isBlank() ? "Home" : req.label().trim());
        a.setContactName(blankToNull(req.contactName()));
        a.setContactPhone(blankToNull(req.contactPhone()));
        a.setLine1(req.line1().trim());
        a.setLine2(blankToNull(req.line2()));
        a.setLocality(blankToNull(req.locality()));
        a.setLandmark(blankToNull(req.landmark()));
        a.setCity(req.city().trim());
        a.setState(blankToNull(req.state()));
        a.setPincode(req.pincode().trim());
        a.setLatitude(lat);
        a.setLongitude(lng);
        a.setPlaceId(blankToNull(req.placeId()));
        a.setGeocodeSource(source);
        a.setFormattedAddress(formatted);
        a.setDefaultAddress(makeDefault);
        return toResponse(addressRepository.save(a), warning);
    }

    @Transactional
    public void delete(Long userId, Long addressId) {
        Address a = addressRepository.findByIdAndUserId(addressId, userId)
                .orElseThrow(() -> ApiException.notFound("Address not found."));
        addressRepository.delete(a);
    }

    static AddressResponse toResponse(Address a) {
        return toResponse(a, null);
    }

    static AddressResponse toResponse(Address a, String warning) {
        return new AddressResponse(a.getId(), a.getLabel(), a.getContactName(), a.getContactPhone(), a.getLine1(),
                a.getLine2(), a.getLocality(), a.getLandmark(), a.getCity(), a.getState(), a.getPincode(),
                a.getLatitude(), a.getLongitude(), a.isDefaultAddress(), a.toSingleLine(), a.getFormattedAddress(),
                a.getGeocodeSource(), warning);
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
