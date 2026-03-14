export const QR_CONSTANTS = {
  EVENT_PREFIX: 'qr',
  EVENTS: {
    GENERATED: 'qr.generated',
    DOWNLOAD_REQUESTED: 'qr.download.requested',
  },
  DEFAULT_SIZE: 300, // pixels
  DEFAULT_ERROR_CORRECTION: 'M' as const, // L, M, Q, H
  DEFAULT_MARGIN: 2,
  MIME_TYPE: 'image/png',
  MAX_URL_LENGTH: 2048,
} as const;

export const QR_ERROR_CORRECTION = {
  L: 'low', // 7% error recovery
  M: 'medium', // 15% error recovery
  Q: 'quartile', // 25% error recovery
  H: 'high', // 30% error recovery
} as const;
