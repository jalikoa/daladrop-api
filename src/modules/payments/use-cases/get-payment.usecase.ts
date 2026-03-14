import { Injectable, NotFoundException } from '@nestjs/common';
import { IPaymentRepository } from '../interfaces/payment-repository.interface';
import { PaymentSession } from '../entities/payment-session.entity';

@Injectable()
export class GetPaymentUseCase {
  constructor(private readonly paymentRepo: IPaymentRepository) {}

  async byId(id: number): Promise<PaymentSession> {
    const payment = await this.paymentRepo.findById(id);
    if (!payment) throw new NotFoundException(`Payment session ${id} not found`);
    return payment;
  }

  async byUuid(uuid: string): Promise<PaymentSession> {
    const payment = await this.paymentRepo.findByUuid(uuid);
    if (!payment) throw new NotFoundException(`Payment session ${uuid} not found`);
    return payment;
  }

  async byCheckoutId(checkoutId: string): Promise<PaymentSession> {
    const payment = await this.paymentRepo.findByCheckoutId(checkoutId);
    if (!payment) throw new NotFoundException(`Payment session ${checkoutId} not found`);
    return payment;
  }
}
