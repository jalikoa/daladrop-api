import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MerchantCard } from '../../merchants/entities/merchant-card.entity';

@Injectable()
export class MerchantCardRepository {
  constructor(
    @InjectRepository(MerchantCard)
    private readonly repo: Repository<MerchantCard>,
  ) {}

  async save(merchantId: number, pdfUrl: string, qrCodeUrl: string): Promise<MerchantCard> {
    const card = this.repo.create({ merchant_id: merchantId, pdf_url: pdfUrl, qr_code_url: qrCodeUrl });
    return this.repo.save(card);
  }

  async findByMerchant(merchantId: number): Promise<MerchantCard[]> {
    return this.repo.find({
      where: { merchant_id: merchantId },
      order: { created_at: 'DESC' },
    });
  }

  async findLatest(merchantId: number): Promise<MerchantCard | null> {
    return this.repo.findOne({
      where: { merchant_id: merchantId },
      order: { created_at: 'DESC' },
    });
  }
}