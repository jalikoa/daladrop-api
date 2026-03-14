export enum WebhookSource {
  DARAJA = 'DARAJA',
  AFRICASTALKING = 'AFRICASTALKING',
  FIREBASE = 'FIREBASE',
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
}

export enum WebhookStatus {
  RECEIVED = 'RECEIVED',
  VALIDATED = 'VALIDATED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DUPLICATE = 'DUPLICATE',
}

export enum WebhookEventType {
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_CANCELLED = 'payment.cancelled',
  SMS_DELIVERED = 'sms.delivered',
  SMS_FAILED = 'sms.failed',
  EMAIL_SENT = 'email.sent',
  PUSH_DELIVERED = 'push.delivered',
}
