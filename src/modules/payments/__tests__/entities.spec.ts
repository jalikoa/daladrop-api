import { PaymentSession } from '../entities/payment-session.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { MerchantProfile } from '../../merchants/entities/merchant-profile.entity';
import { MerchantStatus } from '../../merchants/enums/merchant-status.enum';
import { MerchantVerificationStatus } from '../../merchants/enums/merchant-status.enum';
// ─── PaymentSession entity methods ────────────────────────────────────────────
describe('PaymentSession entity', () => {
  const makeSession = (status = PaymentStatus.PENDING): PaymentSession => {
    const s = new PaymentSession();
    s.id = 1;
    s.session_uuid = 'uuid-1234';
    s.merchant_id = 1;
    s.customer_phone = '254712345678';
    s.amount = 500;
    s.currency = 'KES';
    s.status = status;
    s.payment_type = 'NFC_TAP' as any;
    s.checkout_request_id = null;
    s.mpesa_receipt = null;
    s.created_at = new Date();
    s.updated_at = new Date();
    s.completed_at = null;
    return s;
  };

  describe('isCompleted()', () => {
    it('returns true when status is COMPLETED', () => {
      expect(makeSession(PaymentStatus.COMPLETED).isCompleted()).toBe(true);
    });

    it('returns false for any other status', () => {
      for (const s of [PaymentStatus.PENDING, PaymentStatus.FAILED, PaymentStatus.CANCELLED]) {
        expect(makeSession(s).isCompleted()).toBe(false);
      }
    });
  });

  describe('isPending()', () => {
    it('returns true for PENDING status', () => {
      expect(makeSession(PaymentStatus.PENDING).isPending()).toBe(true);
    });

    it('returns true for INITIATED status', () => {
      expect(makeSession(PaymentStatus.INITIATED).isPending()).toBe(true);
    });

    it('returns false for COMPLETED status', () => {
      expect(makeSession(PaymentStatus.COMPLETED).isPending()).toBe(false);
    });
  });

  describe('canTransitionTo()', () => {
    it('PENDING → INITIATED is valid', () => {
      expect(makeSession(PaymentStatus.PENDING).canTransitionTo(PaymentStatus.INITIATED)).toBe(true);
    });

    it('PENDING → CANCELLED is valid', () => {
      expect(makeSession(PaymentStatus.PENDING).canTransitionTo(PaymentStatus.CANCELLED)).toBe(true);
    });

    it('INITIATED → COMPLETED is valid', () => {
      expect(makeSession(PaymentStatus.INITIATED).canTransitionTo(PaymentStatus.COMPLETED)).toBe(true);
    });

    it('INITIATED → FAILED is valid', () => {
      expect(makeSession(PaymentStatus.INITIATED).canTransitionTo(PaymentStatus.FAILED)).toBe(true);
    });

    it('COMPLETED → REFUNDED is valid', () => {
      expect(makeSession(PaymentStatus.COMPLETED).canTransitionTo(PaymentStatus.REFUNDED)).toBe(true);
    });

    it('COMPLETED → PENDING is invalid', () => {
      expect(makeSession(PaymentStatus.COMPLETED).canTransitionTo(PaymentStatus.PENDING)).toBe(false);
    });

    it('FAILED → COMPLETED is invalid', () => {
      expect(makeSession(PaymentStatus.FAILED).canTransitionTo(PaymentStatus.COMPLETED)).toBe(false);
    });

    it('CANCELLED → anything is invalid', () => {
      for (const next of Object.values(PaymentStatus)) {
        expect(makeSession(PaymentStatus.CANCELLED).canTransitionTo(next as PaymentStatus)).toBe(false);
      }
    });
  });

  describe('generateUUID() @BeforeInsert', () => {
    it('sets session_uuid when it is not already set', () => {
      const s = makeSession();
      s.session_uuid = '';
      s.generateUUID();
      expect(s.session_uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('does not overwrite an existing session_uuid', () => {
      const s = makeSession();
      s.session_uuid = 'existing-uuid';
      s.generateUUID();
      expect(s.session_uuid).toBe('existing-uuid');
    });
  });

  describe('toJSON()', () => {
    it('strips the merchant relation from the output', () => {
      const s = makeSession();
      (s as any).merchant = { id: 1, business_name: 'DemoShop' };
      const json = s.toJSON();
      expect(json).not.toHaveProperty('merchant');
      expect(json).toHaveProperty('id');
    });
  });
});

// ─── MerchantProfile entity methods ──────────────────────────────────────────
describe('MerchantProfile entity', () => {
  const makeProfile = (
    status = MerchantStatus.ACTIVE,
    verif = MerchantVerificationStatus.VERIFIED,
  ): MerchantProfile => {
    const m = new MerchantProfile();
    m.id = 1;
    m.user_id = 2;
    m.business_name = '  DemoShop  ';
    m.paybill_number = ' 123 456 789 ';
    m.account_number = ' ACC 001 ';
    m.status = status;
    m.verification_status = verif;
    return m;
  };

  describe('isActive()', () => {
    it('returns true when ACTIVE and VERIFIED', () => {
      expect(makeProfile(MerchantStatus.ACTIVE, MerchantVerificationStatus.VERIFIED).isActive()).toBe(true);
    });

    it('returns false when PENDING', () => {
      expect(makeProfile(MerchantStatus.PENDING, MerchantVerificationStatus.VERIFIED).isActive()).toBe(false);
    });

    it('returns false when ACTIVE but UNVERIFIED', () => {
      expect(makeProfile(MerchantStatus.ACTIVE, MerchantVerificationStatus.UNVERIFIED).isActive()).toBe(false);
    });

    it('returns false when SUSPENDED even if VERIFIED', () => {
      expect(makeProfile(MerchantStatus.SUSPENDED, MerchantVerificationStatus.VERIFIED).isActive()).toBe(false);
    });
  });

  describe('normalizeData() @BeforeInsert/@BeforeUpdate', () => {
    it('trims whitespace from business_name', () => {
      const m = makeProfile();
      m.normalizeData();
      expect(m.business_name).toBe('DemoShop');
    });

    it('removes all spaces from paybill_number', () => {
      const m = makeProfile();
      m.normalizeData();
      expect(m.paybill_number).toBe('123456789');
    });

    it('removes all spaces from account_number', () => {
      const m = makeProfile();
      m.normalizeData();
      expect(m.account_number).toBe('ACC001');
    });
  });

  describe('toJSON()', () => {
    it('strips the user relation from output', () => {
      const m = makeProfile();
      (m as any).user = { id: 2, email: 'alice@example.com' };
      const json = m.toJSON();
      expect(json).not.toHaveProperty('user');
      expect(json).toHaveProperty('id');
    });
  });
});