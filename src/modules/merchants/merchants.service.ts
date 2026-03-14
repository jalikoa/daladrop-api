import { Injectable } from '@nestjs/common';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { MerchantResponseDto } from './dto/merchant-response.dto';
import { PaymentLinkResponseDto } from './dto/payment-link.dto';
import { CreateMerchantUseCase } from './use-cases/create-merchant.usecase';
import { FindMerchantUseCase } from './use-cases/find-merchant.usecase';
import { GeneratePaymentLinkUseCase } from './use-cases/generate-payment-link.usecase';
import type { IMerchantRepository } from './interfaces/merchant-repository.interface';
import { MerchantMapper } from './mappers/merchant.mapper';

@Injectable()
export class MerchantsService {
  constructor(
    private readonly createMerchantUseCase: CreateMerchantUseCase,
    private readonly findMerchantUseCase: FindMerchantUseCase,
    private readonly generatePaymentLinkUseCase: GeneratePaymentLinkUseCase,
    private readonly merchantRepo: IMerchantRepository,
  ) {}

  async create(userId: number, dto: CreateMerchantDto): Promise<MerchantResponseDto> {
    const merchant = await this.createMerchantUseCase.execute(userId, dto);
    return MerchantMapper.toDTO(merchant);
  }

  async findOne(id: number): Promise<MerchantResponseDto> {
    const merchant = await this.findMerchantUseCase.byId(id);
    return MerchantMapper.toDTO(merchant);
  }

  async findByUserId(userId: number): Promise<MerchantResponseDto> {
    const merchant = await this.findMerchantUseCase.byUserId(userId);
    return MerchantMapper.toDTO(merchant);
  }

  async generatePaymentLink(
    merchantId: number,
    includeQr: boolean = true,
  ): Promise<PaymentLinkResponseDto> {
    return this.generatePaymentLinkUseCase.execute({ merchantId, includeQr });
  }

  async update(id: number, dto: UpdateMerchantDto): Promise<MerchantResponseDto> {
    const merchant = await (this.merchantRepo as any).update(id, dto);
    return MerchantMapper.toDTO(merchant);
  }

  async findAll(page: number, limit: number): Promise<{ data: MerchantResponseDto[]; total: number }> {
    const result = await (this.merchantRepo as any).findAll(page, limit);
    return {
      data: MerchantMapper.toDTOArray(result.data),
      total: result.total,
    };
  }

  async countActive(): Promise<number> {
    return this.merchantRepo.countActive();
  }
}
