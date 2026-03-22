import { Injectable, Logger, Inject,BadRequestException,NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IPaymentRepository } from '../interfaces/payment-repository.interface';
import type { IDarajaAdapter } from '../interfaces/daraja-adapter.interface';
import { InitiateStkDto } from '../dto/initiate-stk.dto';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PAYMENT_CONSTANTS } from '../constants/payment.constants';
import { PhoneNumber } from '../value-objects/phone-number.vo';
import { Money } from '../value-objects/money.vo';
import { MerchantRepository } from '../../merchants/repositories/merchant.repository';
import { EncryptionService } from '../../../common/security/encryption.service';

@Injectable()
export class InitiateStkUseCase {
  private readonly logger = new Logger(InitiateStkUseCase.name);

  constructor(
    @Inject('IPaymentRepository') private readonly paymentRepo: IPaymentRepository,
    @Inject('IDarajaAdapter') private readonly darajaAdapter: IDarajaAdapter,
    private readonly eventEmitter: EventEmitter2,
    private readonly encryptionService: EncryptionService,
    private readonly merchantRepo: MerchantRepository,
  ) {}

  async execute(dto: InitiateStkDto) {
    const phone = new PhoneNumber(dto.phone);
    const money = new Money(dto.amount);
    const decrypted = this.encryptionService.decryptPayload(dto.merchant_hash);
    const payload = JSON.parse(decrypted);

    if (!payload.mid || !payload.issuedAt) {
      throw new BadRequestException('Invalid token payload');
    }

    if (payload.expiresAt && new Date(payload.expiresAt) < new Date()) {
      throw new BadRequestException('Token has expired');
    }

    const merchant = await this.merchantRepo.findById(payload.mid);
    if (!merchant || !merchant.isActive()) {
      throw new NotFoundException('Merchant not found or inactive');
    }
    const session = await this.paymentRepo.createSession({
      merchantId: merchant.id,
      customerPhone: phone.toString(),
      amount: money.amount,
      currency: money.currency,
      paymentType: 'NFC_TAP',
      description: dto.description,
      metadata: dto.metadata ? JSON.parse(dto.metadata) : undefined,
      sessionUuid: dto.session_uuid,
    });

    this.logger.log(`Payment session created: ${session.session_uuid}`);

    this.eventEmitter.emit(PAYMENT_CONSTANTS.EVENTS.SESSION_CREATED, {
      sessionUuid: session.session_uuid,
      merchantId: session.merchant_id,
      amount: session.amount,
      timestamp: new Date(),
    });

    try {
      const stkResponse = await this.darajaAdapter.stkPush({
        phone: phone.toString(),
        amount: Math.round(session.amount),
        accountReference: `PAY-${session.session_uuid.substring(0, 8)}`,
        transactionDesc: dto.description || 'NFC Payment',
        callbackUrl: `${process.env.PUBLIC_URL}${PAYMENT_CONSTANTS.DARAJA.CALLBACK_PATH}`,
      });

      await this.paymentRepo.updateStatus(session.id, PaymentStatus.INITIATED, {
        checkout_request_id: stkResponse.checkoutRequestID,
        merchant_request_id: stkResponse.merchantRequestID,
      } as any);

      this.eventEmitter.emit(PAYMENT_CONSTANTS.EVENTS.INITIATED, {
        paymentId: session.id,
        sessionUuid: session.session_uuid,
        merchantId: session.merchant_id,
        checkoutRequestId: stkResponse.checkoutRequestID,
        amount: session.amount,
        phone: phone.toString(),
        timestamp: new Date(),
      });

      this.logger.log(`STK Push initiated for session ${session.session_uuid}`);
      return session;
    } catch (error) {
      await this.paymentRepo.markFailed(session.id, error.message || 'STK push failed', 'INITIATION_ERROR');
      this.eventEmitter.emit(PAYMENT_CONSTANTS.EVENTS.FAILED, {
        paymentId: session.id,
        sessionUuid: session.session_uuid,
        reason: error.message,
        timestamp: new Date(),
      });
      throw error;
    }
  }
}
