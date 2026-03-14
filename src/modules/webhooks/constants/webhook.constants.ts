export const WEBHOOK_CONSTANTS = {
  EVENT_PREFIX: 'webhook',
  EVENTS: {
    RECEIVED: 'webhook.received',
    PROCESSED: 'webhook.processed',
    FAILED: 'webhook.failed',
    DARAJA_CALLBACK: 'webhook.daraja.callback',
    AFRICASTALKING_CALLBACK: 'webhook.africastalking.callback',
  },
  SOURCES: {
    DARAJA: 'DARAJA',
    AFRICASTALKING: 'AFRICASTALKING',
    FIREBASE: 'FIREBASE',
    STRIPE: 'STRIPE',
  },
  SECURITY: {
    IP_WHITELIST: {
      DARAJA: [
        '156.154.64.0/24',
        '156.154.65.0/24',
        '196.201.216.0/24',
      ],
    },
    SIGNATURE_HEADER: {
      DARAJA: 'X-Signature',
      STRIPE: 'Stripe-Signature',
    },
    MAX_RETRY_ATTEMPTS: 3,
    IDEMPOTENCY_WINDOW_HOURS: 48,
  },
  DARAJA: {
    RESULT_CODE_SUCCESS: '0',
    RESULT_CODE_CANCELLED: '1032',
    RESULT_CODE_INSUFFICIENT_FUNDS: '1031',
    RESULT_CODE_INVALID_PHONE: '1037',
  },
} as const;

export const WEBHOOK_STATUS = {
  RECEIVED: 'RECEIVED',
  VALIDATED: 'VALIDATED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  DUPLICATE: 'DUPLICATE',
} as const;
