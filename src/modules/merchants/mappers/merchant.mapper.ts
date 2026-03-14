import { MerchantProfile } from '../entities/merchant-profile.entity';
import { MerchantResponseDto } from '../dto/merchant-response.dto';
import { plainToInstance } from 'class-transformer';

export class MerchantMapper {
  static toDTO(merchant: MerchantProfile): MerchantResponseDto {
    return plainToInstance(MerchantResponseDto, {
      ...merchant,
      is_active: merchant.isActive(),
    }, {
      excludeExtraneousValues: true,
    });
  }

  static toDTOArray(merchants: MerchantProfile[]): MerchantResponseDto[] {
    return merchants.map((merchant) => this.toDTO(merchant));
  }
}
