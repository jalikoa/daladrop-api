import { Injectable } from '@nestjs/common';
import { IPaymentRepository } from '../interfaces/payment-repository.interface';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentSession } from '../entities/payment-session.entity';

@Injectable()
export class GetMerchantPaymentsUseCase {
  constructor(private readonly paymentRepo: IPaymentRepository) {}

  async execute(merchantId: number, page: number = 1, limit: number = 10, status?: PaymentStatus): Promise<{ data: PaymentSession[]; total: number }> {
    return this.paymentRepo.findByMerchant(merchantId, page, limit, status);
  }

  async getStatistics(merchantId: number, startDate: Date, endDate: Date): Promise<{ count: number; totalAmount: number }> {
    const [count, totalAmount] = await Promise.all([
      this.paymentRepo.countByMerchant(merchantId, PaymentStatus.COMPLETED),
      this.paymentRepo.sumByMerchant(merchantId, startDate, endDate),
    ]);
    return { count, totalAmount };
  }
}
