package com.quickcommerce.entity;

/**
 * STRIPE = international cards, RAZORPAY = cards/UPI/netbanking/wallets, PHONEPE = PhonePe PG hosted checkout,
 * UPI = Google Pay / any UPI app via intent or QR, MOCK_ONLINE = demo gateway, CASH_ON_DELIVERY = pay the rider.
 */
public enum PaymentMethod {
    STRIPE, RAZORPAY, PHONEPE, UPI, MOCK_ONLINE, CASH_ON_DELIVERY;

    public boolean online() { return this != CASH_ON_DELIVERY; }
}
