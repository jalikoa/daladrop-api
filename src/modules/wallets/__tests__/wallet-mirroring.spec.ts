import { WalletOwnerType } from '@prisma/client';
import { DEFAULT_PLATFORM_WALLET_OWNER_ID } from '../constants/platform-wallet';
import { WalletMirroringService } from '../use-cases/wallet-mirroring.service';

describe('WalletMirroringService', () => {
  const prisma = {
    journalEntry: { findUnique: jest.fn() },
    payment: { findUnique: jest.fn() },
    walletTransaction: { findFirst: jest.fn() },
    refund: { findUnique: jest.fn() },
  };
  const wallets = {
    getOrCreate: jest.fn(),
    credit: jest.fn(),
    debit: jest.fn(),
  };
  const escrow = {
    ensureHoldForPayment: jest.fn(),
    refundForPayment: jest.fn(),
  };

  let service: WalletMirroringService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WalletMirroringService(
      prisma as never,
      wallets as never,
      escrow as never,
    );
  });

  it('skips when journalId is missing', async () => {
    await service.mirrorJournalPosted({ journalId: '' as never });
    expect(prisma.journalEntry.findUnique).not.toHaveBeenCalled();
  });

  it('skips journals without a payment', async () => {
    prisma.journalEntry.findUnique.mockResolvedValue({
      id: 'j1',
      entryNumber: 'JE-1',
      paymentId: null,
    });
    await service.mirrorJournalPosted({ journalId: 'j1' });
    expect(escrow.ensureHoldForPayment).not.toHaveBeenCalled();
  });

  it('mirrors ORDER payments into escrow holds with journalId', async () => {
    prisma.journalEntry.findUnique.mockResolvedValue({
      id: 'j1',
      entryNumber: 'JE-1',
      paymentId: 'p1',
    });
    prisma.payment.findUnique.mockResolvedValue({
      id: 'p1',
      purpose: 'ORDER',
      amount: 1200n,
      currency: 'KES',
      customerId: 'c1',
    });

    await service.mirrorJournalPosted({
      journalId: 'j1',
      paymentId: 'p1',
    });

    expect(escrow.ensureHoldForPayment).toHaveBeenCalledWith({
      paymentId: 'p1',
      journalEntryId: 'j1',
      actorId: null,
    });
  });

  it('credits customer available for WALLET_TOP_UP', async () => {
    prisma.journalEntry.findUnique.mockResolvedValue({
      id: 'j2',
      entryNumber: 'JE-2',
      paymentId: 'p2',
    });
    prisma.payment.findUnique.mockResolvedValue({
      id: 'p2',
      purpose: 'WALLET_TOP_UP',
      amount: 500n,
      currency: 'KES',
      customerId: 'cust-1',
    });
    wallets.getOrCreate.mockResolvedValue({ id: 'w-cust' });
    prisma.walletTransaction.findFirst.mockResolvedValue(null);
    wallets.credit.mockResolvedValue({ success: true });

    await service.mirrorJournalPosted({ journalId: 'j2', paymentId: 'p2' });

    expect(wallets.getOrCreate).toHaveBeenCalledWith(
      'CUSTOMER',
      'cust-1',
      'KES',
    );
    expect(wallets.credit).toHaveBeenCalledWith(
      'w-cust',
      expect.objectContaining({ amount: 500 }),
      expect.objectContaining({
        paymentId: 'p2',
        journalEntryId: 'j2',
        idempotencyKey: 'topup:p2:j2',
      }),
    );
    expect(escrow.ensureHoldForPayment).not.toHaveBeenCalled();
  });

  it('is idempotent when top-up txn already exists', async () => {
    prisma.journalEntry.findUnique.mockResolvedValue({
      id: 'j2',
      paymentId: 'p2',
    });
    prisma.payment.findUnique.mockResolvedValue({
      id: 'p2',
      purpose: 'WALLET_TOP_UP',
      amount: 500n,
      currency: 'KES',
      customerId: 'cust-1',
    });
    wallets.getOrCreate.mockResolvedValue({ id: 'w-cust' });
    prisma.walletTransaction.findFirst.mockResolvedValue({ id: 'txn-1' });

    await service.mirrorJournalPosted({ journalId: 'j2' });
    expect(wallets.credit).not.toHaveBeenCalled();
  });

  it('skips SETTLEMENT and REFUND purposes', async () => {
    prisma.journalEntry.findUnique.mockResolvedValue({
      id: 'j3',
      paymentId: 'p3',
    });
    prisma.payment.findUnique.mockResolvedValue({
      id: 'p3',
      purpose: 'SETTLEMENT',
      amount: 1n,
      currency: 'KES',
    });

    await service.mirrorJournalPosted({ journalId: 'j3' });
    expect(escrow.ensureHoldForPayment).not.toHaveBeenCalled();
  });

  it('unwinds escrow for a refund via refundId on the event', async () => {
    prisma.journalEntry.findUnique.mockResolvedValue({
      id: 'j-refund',
      entryNumber: 'JE-4',
      paymentId: null,
      externalRef: 'refund:r1',
    });
    prisma.refund.findUnique.mockResolvedValue({
      id: 'r1',
      paymentId: 'p1',
      amount: 300n,
      currency: 'KES',
    });
    prisma.payment.findUnique.mockResolvedValue({
      id: 'p1',
      purpose: 'ORDER',
      amount: 1200n,
      currency: 'KES',
      customerId: 'c1',
    });

    await service.mirrorJournalPosted({ journalId: 'j-refund', refundId: 'r1' });

    expect(escrow.refundForPayment).toHaveBeenCalledWith({
      paymentId: 'p1',
      amount: 300n,
      refundId: 'r1',
      journalEntryId: 'j-refund',
    });
    expect(escrow.ensureHoldForPayment).not.toHaveBeenCalled();
  });

  it('falls back to parsing refundId from the journal externalRef', async () => {
    prisma.journalEntry.findUnique.mockResolvedValue({
      id: 'j-refund2',
      entryNumber: 'JE-5',
      paymentId: null,
      externalRef: 'refund:r2',
    });
    prisma.refund.findUnique.mockResolvedValue({
      id: 'r2',
      paymentId: 'p2',
      amount: 500n,
      currency: 'KES',
    });
    prisma.payment.findUnique.mockResolvedValue({
      id: 'p2',
      purpose: 'RIDE',
      amount: 500n,
      currency: 'KES',
      customerId: 'c2',
    });

    await service.mirrorJournalPosted({ journalId: 'j-refund2' });

    expect(escrow.refundForPayment).toHaveBeenCalledWith({
      paymentId: 'p2',
      amount: 500n,
      refundId: 'r2',
      journalEntryId: 'j-refund2',
    });
  });

  it('debits the customer wallet for a WALLET_TOP_UP refund instead of unholding escrow', async () => {
    prisma.journalEntry.findUnique.mockResolvedValue({
      id: 'j-refund3',
      paymentId: null,
      externalRef: 'refund:r3',
    });
    prisma.refund.findUnique.mockResolvedValue({
      id: 'r3',
      paymentId: 'p3',
      amount: 200n,
      currency: 'KES',
    });
    prisma.payment.findUnique.mockResolvedValue({
      id: 'p3',
      purpose: 'WALLET_TOP_UP',
      amount: 200n,
      currency: 'KES',
      customerId: 'cust-3',
    });
    wallets.getOrCreate.mockResolvedValue({ id: 'w-cust-3' });
    prisma.walletTransaction.findFirst.mockResolvedValue(null);

    await service.mirrorJournalPosted({ journalId: 'j-refund3', refundId: 'r3' });

    expect(wallets.getOrCreate).toHaveBeenCalledWith('CUSTOMER', 'cust-3', 'KES');
    expect(wallets.debit).toHaveBeenCalledWith(
      'w-cust-3',
      expect.objectContaining({ amount: 200 }),
      expect.objectContaining({
        paymentId: 'p3',
        journalEntryId: 'j-refund3',
        reference: 'refund:r3',
        idempotencyKey: 'refund:r3',
      }),
    );
    expect(escrow.refundForPayment).not.toHaveBeenCalled();
  });

  it('is idempotent when the top-up refund txn already exists', async () => {
    prisma.journalEntry.findUnique.mockResolvedValue({
      id: 'j-refund4',
      paymentId: null,
      externalRef: 'refund:r4',
    });
    prisma.refund.findUnique.mockResolvedValue({
      id: 'r4',
      paymentId: 'p4',
      amount: 200n,
      currency: 'KES',
    });
    prisma.payment.findUnique.mockResolvedValue({
      id: 'p4',
      purpose: 'WALLET_TOP_UP',
      amount: 200n,
      currency: 'KES',
      customerId: 'cust-4',
    });
    wallets.getOrCreate.mockResolvedValue({ id: 'w-cust-4' });
    prisma.walletTransaction.findFirst.mockResolvedValue({ id: 'txn-existing' });

    await service.mirrorJournalPosted({ journalId: 'j-refund4', refundId: 'r4' });

    expect(wallets.debit).not.toHaveBeenCalled();
  });

  it('skips gracefully when the refund cannot be found', async () => {
    prisma.journalEntry.findUnique.mockResolvedValue({
      id: 'j-refund5',
      paymentId: null,
      externalRef: 'refund:missing',
    });
    prisma.refund.findUnique.mockResolvedValue(null);

    await service.mirrorJournalPosted({ journalId: 'j-refund5' });

    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
    expect(escrow.refundForPayment).not.toHaveBeenCalled();
  });

  it('documents platform owner id constant', () => {
    expect(DEFAULT_PLATFORM_WALLET_OWNER_ID).toBe(
      '00000000-0000-4000-8000-000000000001',
    );
    expect(WalletOwnerType.PLATFORM).toBe('PLATFORM');
  });
});
