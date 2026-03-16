// import { Injectable, Logger } from '@nestjs/common';
// import { OnEvent } from '@nestjs/event-emitter';
// import { RecordTransactionUseCase } from '../use-cases/record-transaction.usecase';

// @Injectable()
// export class LedgerListener {
//   private readonly logger = new Logger(LedgerListener.name);

//   constructor(private readonly recordTx: RecordTransactionUseCase) {}

//   // Example: listen for payment completed events and record ledger entries
//   @OnEvent('payment.completed')
//   async handlePaymentCompleted(payload: { transactionId: string; debitAccountId: string; creditAccountId: string; amount: string; metadata?: any }) {
//     this.logger.debug('Handling payment.completed event for tx ' + payload.transactionId);
//     await this.recordTx.execute(payload.transactionId, [
//       { accountId: payload.debitAccountId, type: 'debit', amount: payload.amount, metadata: payload.metadata },
//       { accountId: payload.creditAccountId, type: 'credit', amount: payload.amount, metadata: payload.metadata },
//     ]);
//   }
// }

import { Injectable, Logger } from '@nestjs/common';

/**
 * LedgerListener — intentionally has no payment.completed handler.
 *
 * Ledger double-entry for payments is handled by PaymentListener
 * (src/modules/payments/listeners/payment.listener.ts) which runs
 * inside a transaction with the session update and notification.
 *
 * This class is kept as a placeholder for future non-payment ledger events
 * (e.g. manual adjustments, refunds, fee postings).
 */
@Injectable()
export class LedgerListener {
  private readonly logger = new Logger(LedgerListener.name);
}
