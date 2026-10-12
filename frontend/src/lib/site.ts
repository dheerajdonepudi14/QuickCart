/**
 * Business contact details shown across the storefront.
 * Configure them per deployment with NEXT_PUBLIC_SUPPORT_PHONE / NEXT_PUBLIC_SUPPORT_EMAIL
 * (build-time variables, see frontend/.env.example). The defaults are placeholders.
 */
const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || '+91 90000 00000';
const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@quickcart.example';
const digits = phone.replace(/[^\d]/g, '');

export const SITE = {
  name: 'QuickCart',
  phoneDisplay: phone,
  phoneHref: `tel:+${digits}`,
  whatsappHref: `https://wa.me/${digits}`,
  email,
  emailHref: `mailto:${email}`,
} as const;
