export const MERCHANT_CONSTANTS = {
  MAX_BUSINESS_NAME_LENGTH: 255,
  MAX_PHONE_LENGTH: 20,
  MIN_PAYBILL_LENGTH: 5,
  MAX_PAYBILL_LENGTH: 20,
  PAYMENT_LINK_TTL_HOURS: 24 * 365, // 1 year for static NFC tags
  EVENT_PREFIX: 'merchant',
  EVENTS: {
    CREATED: 'merchant.created',
    UPDATED: 'merchant.updated',
    PAYMENT_LINK_GENERATED: 'merchant.payment-link.generated',
    CARD_GENERATED: 'merchant.card.generated',
  },
} as const;
