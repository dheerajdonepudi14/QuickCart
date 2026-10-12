package com.quickcommerce.payment;

import com.quickcommerce.exception.ApiException;
import org.springframework.http.HttpStatus;

/** A gateway rejected or failed a call; surfaced to the shopper as a 502 with a friendly message. */
public class GatewayException extends ApiException {
    private final String gatewayCode;

    public GatewayException(String message, String gatewayCode) {
        super(HttpStatus.BAD_GATEWAY, message);
        this.gatewayCode = gatewayCode;
    }

    public String gatewayCode() { return gatewayCode; }
}
