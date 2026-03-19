import { Injectable, Inject } from '@nestjs/common';
import type { IPaymentRepository } from '../interfaces/payment-repository.interface';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentSession } from '../entities/payment-session.entity';

@Injectable()
export class GetAllPaymentsUseCase {
  constructor(@Inject('IPaymentRepository') private readonly paymentRepo: IPaymentRepository) {}

  async execute(page: number = 1, limit: number = 10, status?: PaymentStatus): Promise<{ data: PaymentSession[]; total: number }> {
    return this.paymentRepo.findAll(page, limit, status);
  }
}
