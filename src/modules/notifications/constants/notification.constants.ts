export const NOTIFICATION_CONSTANTS = {
  EVENT_PREFIX: 'notification',
  EVENTS: {
    SENT: 'notification.sent',
    FAILED: 'notification.failed',
    QUEUED: 'notification.queued',
    RETRIED: 'notification.retried',
  },
  QUEUE: {
    NAME: 'notification-events',
    PROCESSORS: {
      SEND_SMS: 'notification.send.sms',
      SEND_EMAIL: 'notification.send.email',
      SEND_PUSH: 'notification.send.push',
      RETRY: 'notification.retry',
    },
  },
  CHANNELS: {
    SMS: 'SMS',
    EMAIL: 'EMAIL',
    PUSH: 'PUSH',
    WHATSAPP: 'WHATSAPP',
  },
  PRIORITY: {
    LOW: 'LOW',
    NORMAL: 'NORMAL',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL',
  },
  RETRY: {
    MAX_ATTEMPTS: 5,
    BACKOFF_DELAY_MS: 5000,
    BACKOFF_TYPE: 'exponential',
  },
  RATE_LIMITS: {
    SMS_PER_MINUTE: 60,
    EMAIL_PER_MINUTE: 100,
    PUSH_PER_MINUTE: 500,
  },
  TEMPLATES: {
    PAYMENT_RECEIPT: 'payment_receipt',
    WELCOME: 'welcome',
    PASSWORD_RESET: 'password_reset',
    MERCHANT_VERIFICATION: 'merchant_verification',
  },
} as const;

export const NOTIFICATION_STATUS = {
  QUEUED: 'QUEUED',
  SENDING: 'SENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
