import { WebhookLog } from '../entities/webhook-log.entity';
import { WebhookSource, WebhookStatus } from '../enums/webhook-source.enum';

// ─── WebhookLog entity methods ────────────────────────────────────────────────
describe('WebhookLog entity', () => {
  const makeLog = (): WebhookLog => {
    const log = new WebhookLog();
    log.id = 1;
    log.source = WebhookSource.DARAJA;
    log.event_type = 'stk.callback';
    log.status = WebhookStatus.RECEIVED;
    log.ip_address = '1.2.3.4';
    log.payload = {};
    log.response_sent = null;
    log.error_message = null;
    log.retry_count = 0;
    log.is_duplicate = false;
    log.idempotency_key = null;
    log.received_at = new Date();
    log.updated_at = new Date();
    log.processed_at = null;
    return log;
  };

  describe('markProcessed()', () => {
    it('sets status to COMPLETED and stamps processed_at', () => {
      const log = makeLog();
      log.markProcessed();
      expect(log.status).toBe(WebhookStatus.COMPLETED);
      expect(log.processed_at).toBeInstanceOf(Date);
    });
  });

  describe('markFailed()', () => {
    it('sets status to FAILED and stores error message', () => {
      const log = makeLog();
      log.markFailed('Timeout connecting to DB');
      expect(log.status).toBe(WebhookStatus.FAILED);
      expect(log.error_message).toBe('Timeout connecting to DB');
    });
  });

  describe('markDuplicate()', () => {
    it('sets status to DUPLICATE and flips is_duplicate flag', () => {
      const log = makeLog();
      log.markDuplicate();
      expect(log.status).toBe(WebhookStatus.DUPLICATE);
      expect(log.is_duplicate).toBe(true);
    });
  });

  describe('canRetry()', () => {
    it('returns true for FAILED log with retries below 3', () => {
      const log = makeLog();
      log.status = WebhookStatus.FAILED;
      log.retry_count = 2;
      expect(log.canRetry()).toBe(true);
    });

    it('returns false when retry_count reaches 3', () => {
      const log = makeLog();
      log.status = WebhookStatus.FAILED;
      log.retry_count = 3;
      expect(log.canRetry()).toBe(false);
    });

    it('returns false for non-FAILED status even if retries are below limit', () => {
      const log = makeLog();
      log.status = WebhookStatus.COMPLETED;
      log.retry_count = 0;
      expect(log.canRetry()).toBe(false);
    });
  });

  describe('incrementRetry()', () => {
    it('increments retry_count by 1 each call', () => {
      const log = makeLog();
      log.incrementRetry();
      expect(log.retry_count).toBe(1);
      log.incrementRetry();
      expect(log.retry_count).toBe(2);
    });
  });

  describe('toJSON()', () => {
    it('exposes only safe fields', () => {
      const log = makeLog();
      const json = log.toJSON();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('source');
      expect(json).toHaveProperty('status');
      // Full payload should NOT be in the safe view
      expect(json).not.toHaveProperty('payload');
      expect(json).not.toHaveProperty('user_agent');
    });
  });
});