import { Injectable, Inject } from '@nestjs/common';
import { CreateNfcTagDto } from './dto/create-nfc-tag.dto';
import { DecodeTokenDto } from './dto/decode-token.dto';
import { NfcTagResponseDto, DecodedTokenResponseDto } from './dto/nfc-tag-response.dto';
import { CreateNfcTagUseCase } from './use-cases/create-nfc-tag.usecase';
import { DecodeTokenUseCase } from './use-cases/decode-token.usecase';
import type { INfcRepository } from './interfaces/nfc-repository.interface';

@Injectable()
export class NfcService {
  constructor(
    private readonly createNfcTagUseCase: CreateNfcTagUseCase,
    private readonly decodeTokenUseCase: DecodeTokenUseCase,
    @Inject('INfcRepository') private readonly nfcRepo: INfcRepository,
  ) {}

  async createTag(merchantId: number, dto: CreateNfcTagDto): Promise<NfcTagResponseDto> {
    const tag = await this.createNfcTagUseCase.execute(merchantId, dto);
    return this.mapToResponse(tag);
  }

  async decodeToken(dto: DecodeTokenDto, ipAddress?: string, userAgent?: string): Promise<DecodedTokenResponseDto> {
    return this.decodeTokenUseCase.execute({
      encryptedToken: dto.token,
      ipAddress,
      userAgent,
    });
  }

  async findOne(id: number): Promise<NfcTagResponseDto> {
    const tag = await (this.nfcRepo as any).findById(id);
    if (!tag) {
      throw new Error('NFC tag not found');
    }
    return this.mapToResponse(tag);
  }

  async findByMerchant(merchantId: number, page: number, limit: number): Promise<{ data: NfcTagResponseDto[]; total: number }> {
    const result = await (this.nfcRepo as any).findByMerchantId(merchantId, page, limit);
    return {
      data: result.data.map((tag) => this.mapToResponse(tag)),
      total: result.total,
    };
  }

  private mapToResponse(tag: any): NfcTagResponseDto {
    return {
      id: tag.id,
      merchant_id: tag.merchant_id,
      tag_uid: tag.tag_uid,
      encrypted_payload: tag.encrypted_payload,
      is_active: tag.is_active,
      description: tag.description,
      created_at: tag.created_at,
    };
  }
}
