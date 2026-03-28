import { MerchantProfile } from '../entities/merchant-profile.entity';
import { CreateMerchantDto } from '../dto/create-merchant.dto';
import { UpdateMerchantDto } from '../dto/update-merchant.dto';
import { MerchantStatus } from '../enums/merchant-status.enum';

export interface IMerchantRepository {
  findById(id: number): Promise<MerchantProfile | null>;
  findByUid(uid: string): Promise<MerchantProfile | null>;
  findByUserId(userId: number): Promise<MerchantProfile | null>;
  findByPaybill(paybill: string): Promise<MerchantProfile | null>;
  findAll(page: number, limit: number, status?: MerchantStatus): Promise<{ data: MerchantProfile[]; total: number }>;
  create(userId: number, data: CreateMerchantDto): Promise<MerchantProfile>;
  update(id: number, data: UpdateMerchantDto): Promise<MerchantProfile>;
  updateStatus(id: number, status: MerchantStatus): Promise<void>;
  softDelete(id: number): Promise<void>;
  existsByUserId(userId: number): Promise<boolean>;
  countActive(): Promise<number>;
}
