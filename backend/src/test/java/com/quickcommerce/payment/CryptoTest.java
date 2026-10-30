package com.quickcommerce.payment;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class CryptoTest {

    @Test
    void razorpayCheckoutSignatureMatchesDocumentedExample() {
        // Example from Razorpay's "verify payment signature" documentation.
        String sig = Crypto.hmacSha256Hex("order_IEIaMR65cu6nz3|pay_IH4NVgf4Dreq1l", "EnLs21M47BllR3X8PSFtjtbd");
        assertEquals("0d4e745a1838664ad6c9c9902212a32d627d68e917290b0ad5f08ff4561bc50f", sig);
    }

    @Test
    void paiseConversionRoundsHalfUp() {
        assertEquals(14750, Crypto.toPaise(new BigDecimal("147.50")));
        assertEquals(100, Crypto.toPaise(new BigDecimal("1.004")));
        assertEquals(101, Crypto.toPaise(new BigDecimal("1.005")));
    }

    @Test
    void safeEqualsIsCaseInsensitiveAndNullSafe() {
        assertTrue(Crypto.safeEquals("ABCdef", "abcDEF"));
        assertFalse(Crypto.safeEquals(null, "x"));
        assertFalse(Crypto.safeEquals("a", "b"));
    }
}
