export const AUDIT_CONSTANTS = {
  QUEUE: {
    NAME: 'audit-queue',
  },
  BATCH: {
    MAX_SIZE: 100,
    FLUSH_INTERVAL_MS: 3000,
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    BACKOFF_DELAY_MS: 1000,
  },
} as const;
