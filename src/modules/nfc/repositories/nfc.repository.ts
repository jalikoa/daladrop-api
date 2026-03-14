import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NfcTag } from '../entities/nfc-tag.entity';
import { INfcRepository } from '../interfaces/nfc-repository.interface';
import { CreateNfcTagDto } from '../dto/create-nfc-tag.dto';

@Injectable()
export class NfcRepository implements INfcRepository {
  constructor(
    @InjectRepository(NfcTag, 'merchant')
    private readonly repo: Repository<NfcTag>,
  ) {}

  async findById(id: number): Promise<NfcTag | null> {
    return this.repo.findOne({ where: { id }, relations: ['merchant'] });
  }

  async findByMerchantId(
    merchantId: number,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: NfcTag[]; total: number }> {
    const [data, total] = await this.repo.findAndCount({
      where: { merchant_id: merchantId },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { data, total };
  }

  async findByTagUid(tagUid: string): Promise<NfcTag | null> {
    return this.repo.findOne({ where: { tag_uid: tagUid.toUpperCase() } });
  }

  async create(
    merchantId: number,
    data: CreateNfcTagDto & { encrypted_payload: string },
  ): Promise<NfcTag> {
    if (data.tag_uid) {
      const exists = await this.repo.exists({ where: { tag_uid: data.tag_uid.toUpperCase() } });
      if (exists) {
        throw new ConflictException('NFC tag UID already registered');
      }
    }

    const tag = this.repo.create({
      merchant_id: merchantId,
      ...data,
      metadata: data.metadata ? JSON.parse(data.metadata) : null,
    });

    return this.repo.save(tag);
  }

  async update(id: number, data: Partial<NfcTag>): Promise<NfcTag> {
    const tag = await this.findById(id);
    if (!tag) {
      throw new NotFoundException(`NFC tag with ID ${id} not found`);
    }

    // Remove relation properties to avoid TypeORM type mismatch
    const { merchant, ...updateData } = data as any;

    await this.repo.update(id, updateData);
    return this.findById(id) as Promise<NfcTag>;
  }

  async deactivate(id: number): Promise<void> {
    await this.repo.update(id, { is_active: false });
  }

  async countByMerchant(merchantId: number): Promise<number> {
    return this.repo.count({ where: { merchant_id: merchantId } });
  }
}