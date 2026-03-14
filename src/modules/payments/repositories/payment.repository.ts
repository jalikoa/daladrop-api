import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PaymentSession } from '../entities/payment-session.entity';
import { PaymentCallback } from '../entities/payment-callback.entity';
import { IPaymentRepository, CreateSessionData, SaveCallbackData } from '../interfaces/payment-repository.interface';
import { PaymentStatus } from '../enums/payment-status.enum';

@Injectable()
export class PaymentRepository implements IPaymentRepository {
  constructor(
    @InjectRepository(PaymentSession)
    private readonly sessionRepo: Repository<PaymentSession>,
    @InjectRepository(PaymentCallback)
    private readonly callbackRepo: Repository<PaymentCallback>,
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: number): Promise<PaymentSession | null> {
    return this.sessionRepo.findOne({ where: { id }, relations: ['merchant'] });
  }

  async findByUuid(uuid: string): Promise<PaymentSession | null> {
    return this.sessionRepo.findOne({ where: { session_uuid: uuid }, relations: ['merchant'] });
  }

  async findByCheckoutId(checkoutId: string): Promise<PaymentSession | null> {
    return this.sessionRepo.findOne({ where: { checkout_request_id: checkoutId } });
  }

  async findByReceipt(receipt: string): Promise<PaymentSession | null> {
    return this.sessionRepo.findOne({ where: { mpesa_receipt: receipt } });
  }

  async findByMerchant(
    merchantId: number,
    page: number = 1,
    limit: number = 10,
    status?: PaymentStatus,
  ): Promise<{ data: PaymentSession[]; total: number }> {
    const queryBuilder = this.sessionRepo.createQueryBuilder('session')
      .leftJoinAndSelect('session.merchant', 'merchant')
      .where('session.merchant_id = :merchantId', { merchantId });

    if (status) {
      queryBuilder.andWhere('session.status = :status', { status });
    }

    const [data, total] = await queryBuilder
      .orderBy('session.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }

  async createSession(data: CreateSessionData): Promise<PaymentSession> {
    const session = this.sessionRepo.create({
      merchant_id: data.merchantId,
      customer_phone: data.customerPhone,
      amount: data.amount,
      currency: data.currency || 'KES',
      payment_type: data.paymentType || 'NFC_TAP',
      description: data.description,
      metadata: data.metadata,
      session_uuid: data.sessionUuid,
      status: PaymentStatus.PENDING,
    });

    return this.sessionRepo.save(session);
  }

  async updateStatus(id: number, status: PaymentStatus, metadata?: Partial<PaymentSession>): Promise<PaymentSession> {
    const session = await this.findById(id);
    if (!session) {
      throw new NotFoundException(`Payment session ${id} not found`);
    }

    if (!session.canTransitionTo(status)) {
      throw new ConflictException(`Cannot transition from ${session.status} to ${status}`);
    }

    await this.sessionRepo.update(id, {
      status,
      ...metadata,
      updated_at: new Date(),
      completed_at: status === PaymentStatus.COMPLETED ? new Date() : undefined,
    });

    return this.findById(id) as Promise<PaymentSession>;
  }

  async markCompleted(id: number, receipt: string): Promise<PaymentSession> {
    return this.updateStatus(id, PaymentStatus.COMPLETED, {
      mpesa_receipt: receipt,
      completed_at: new Date(),
    });
  }

  async markFailed(id: number, reason: string, code?: string): Promise<PaymentSession> {
    return this.updateStatus(id, PaymentStatus.FAILED, {
      failure_reason: reason,
      daraja_result_code: code,
    });
  }

  async saveCallback(data: SaveCallbackData): Promise<PaymentCallback> {
    const callback = this.callbackRepo.create({
      checkout_request_id: data.checkoutRequestId,
      mpesa_receipt_number: data.mpesaReceiptNumber,
      result_code: data.resultCode,
      result_desc: data.resultDesc,
      payload: data.payload,
      ip_address: data.ipAddress,
    });

    return this.callbackRepo.save(callback);
  }

  async hasProcessedCallback(receipt: string): Promise<boolean> {
    if (!receipt) return false;
    const exists = await this.callbackRepo.exist({ where: { mpesa_receipt_number: receipt } as any }).catch(() => false);
    return !!exists;
  }

  async countByMerchant(merchantId: number, status?: PaymentStatus): Promise<number> {
    return this.sessionRepo.count({ where: status ? { merchant_id: merchantId, status } : { merchant_id: merchantId } as any });
  }

  async sumByMerchant(merchantId: number, startDate: Date, endDate: Date): Promise<number> {
    const result = await this.sessionRepo
      .createQueryBuilder('session')
      .select('SUM(session.amount)', 'total')
      .where('session.merchant_id = :merchantId', { merchantId })
      .andWhere('session.status = :status', { status: PaymentStatus.COMPLETED })
      .andWhere('session.created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
      .getRawOne();

    return parseFloat(result?.total) || 0;
  }
}
