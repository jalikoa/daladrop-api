export const NFC_CONSTANTS = {
  EVENT_PREFIX: 'nfc',
  EVENTS: {
    TAG_CREATED: 'nfc.tag.created',
    TAG_DECODED: 'nfc.tag.decoded',
    PAYMENT_SESSION_STARTED: 'nfc.payment-session.started',
  },
  TOKEN_TTL_SECONDS: 3600,
  MAX_TAGS_PER_MERCHANT: 100,
} as const;
