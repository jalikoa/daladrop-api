export const PAYMENT_CONSTANTS = {
  BASE_PAYMENT_URL:"https://tappay.lads.sc.ke",
  EVENT_PREFIX: 'payment',
  EVENTS: {
    SESSION_CREATED: 'payment.session.created',
    INITIATED: 'payment.initiated',
    COMPLETED: 'payment.completed',
    FAILED: 'payment.failed',
    CANCELLED: 'payment.cancelled',
    REFUNDED: 'payment.refunded',
  },
  QUEUE: {
    NAME: 'payment-events',
    PROCESSORS: {
      INITIATED: 'payment.initiated',
      COMPLETED: 'payment.completed',
      FAILED: 'payment.failed',
    },
  },
  STK: {
    TIMEOUT_SECONDS: 300, // 5 minutes
    MAX_AMOUNT: 150000, // KES 150,000
    MIN_AMOUNT: 1,
    CURRENCY: 'KES',
  },
  DARAJA: {
    SANDBOX_URL: 'https://sandbox.safaricom.co.ke',
    PRODUCTION_URL: 'https://api.safaricom.co.ke',
    STK_PUSH_ENDPOINT: '/mpesa/stkpush/v1/processrequest',
    CALLBACK_PATH: '/webhooks/daraja/stk',
    TOKEN_ENDPOINT: '/oauth/v1/generate?grant_type=client_credentials',
  },
  IDEMPOTENCY: {
    WINDOW_HOURS: 24,
    KEY_FIELD: 'mpesa_receipt_number',
  },
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  INITIATED: 'INITIATED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;
