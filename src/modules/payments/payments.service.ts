import { Injectable } from '@nestjs/common';
import { InitiateStkDto } from './dto/initiate-stk.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { InitiateStkUseCase } from './use-cases/initiate-stk.usecase';
import { GetPaymentUseCase } from './use-cases/get-payment.usecase';
import { GetMerchantPaymentsUseCase } from './use-cases/get-merchant-payments.usecase';
import { PaymentMapper } from './mappers/payment.mapper';
import { PaymentStatus } from './enums/payment-status.enum';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly initiateStkUseCase: InitiateStkUseCase,
    private readonly getPaymentUseCase: GetPaymentUseCase,
    private readonly getMerchantPaymentsUseCase: GetMerchantPaymentsUseCase,
  ) {}

  async initiateStk(dto: InitiateStkDto): Promise<any> {
    const session = await this.initiateStkUseCase.execute(dto);
    return PaymentMapper.toDTO(session);
  }

  async findOne(id: number): Promise<PaymentResponseDto> {
    const payment = await this.getPaymentUseCase.byId(id);
    return PaymentMapper.toDTO(payment);
  }

  async findByUuid(uuid: string): Promise<PaymentResponseDto> {
    const payment = await this.getPaymentUseCase.byUuid(uuid);
    return PaymentMapper.toDTO(payment);
  }

  async findByMerchant(merchantId: number, page: number, limit: number, status?: PaymentStatus): Promise<{ data: PaymentResponseDto[]; total: number }> {
    const result = await this.getMerchantPaymentsUseCase.execute(merchantId, page, limit, status);
    return { data: PaymentMapper.toDTOArray(result.data), total: result.total };
  }

  async getStatistics(merchantId: number, startDate: Date, endDate: Date): Promise<{ count: number; totalAmount: number }> {
    return this.getMerchantPaymentsUseCase.getStatistics(merchantId, startDate, endDate);
  }
}
