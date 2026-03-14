import { NfcTag } from '../entities/nfc-tag.entity';
import { CreateNfcTagDto } from '../dto/create-nfc-tag.dto';

export interface INfcRepository {
  findById(id: number): Promise<NfcTag | null>;
  findByMerchantId(merchantId: number, page: number, limit: number): Promise<{ data: NfcTag[]; total: number }>;
  findByTagUid(tagUid: string): Promise<NfcTag | null>;
  create(merchantId: number, data: CreateNfcTagDto & { encrypted_payload: string }): Promise<NfcTag>;
  update(id: number, data: Partial<NfcTag>): Promise<NfcTag>;
  deactivate(id: number): Promise<void>;
  countByMerchant(merchantId: number): Promise<number>;
}
