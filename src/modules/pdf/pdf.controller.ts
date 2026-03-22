import {
  Controller,
  Get,
  Post,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Res,
  StreamableFile,
  NotFoundException,
  Header,
} from '@nestjs/common';
import type { Response } from 'express';
import { PdfService } from './services/pdf.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { MerchantOwnerGuard } from '../merchants/guards/merchant-owner.guard';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PDF_CONSTANTS } from './constants/pdf.constants';
import { MerchantsService } from '../merchants/merchants.service';
import { NfcService } from '../nfc/nfc.service';
import { PAYMENT_CONSTANTS } from '../payments/constants/payment.constants';
@Controller('pdf')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class PdfController {
  constructor(
    private readonly pdfService: PdfService,
    private readonly merchantsService: MerchantsService,
    private readonly nfcService: NfcService,
    @InjectQueue(PDF_CONSTANTS.EVENT_PREFIX + '-queue') private readonly pdfQueue: Queue,
  ) {}

  @Post('merchant/:merchantId/card/generate')
  @UseGuards(JwtAuthGuard, MerchantOwnerGuard)
  async generateMerchantCard(
    @Param('merchantId', ParseIntPipe) merchantId: number,
    @Query('async') async = 'true',
  ): Promise<{ success: boolean; message: string; jobId?: string }> {
    if (async === 'true') {
      const businessProfile = merchantId ? await this.merchantsService.findOne(merchantId) : null;
      if (!businessProfile) {
        throw new NotFoundException('Merchant not found');
      }

      const nfcTag = await this.nfcService.findByMerchant(merchantId, 1, 1);
      if (!nfcTag.data.length) {
        throw new NotFoundException('No NFC tag found for this merchant. Please create one before generating the card.');
      }

      const job = await this.pdfQueue.add('merchant.card.generate', {
        merchantId,
        businessName: businessProfile.business_name,
        paybillNumber: businessProfile.paybill_number,
        accountNumber: businessProfile.account_number,
        qrCodeDataUrl: `${PAYMENT_CONSTANTS.BASE_PAYMENT_URL}/payment?token=${nfcTag.data[0].encrypted_payload}&type=qr`,
        paymentUrl: `${PAYMENT_CONSTANTS.BASE_PAYMENT_URL}/payment?token=${nfcTag.data[0].encrypted_payload}`,
      });

      return { success: true, message: 'Merchant card generation queued', jobId: job.id?.toString() };
    } else {
      return { success: true, message: 'Merchant card generated synchronously' };
    }
  }


@Get('merchant/:merchantId/card')
@UseGuards(JwtAuthGuard, MerchantOwnerGuard)
@Header('Content-Type', 'application/pdf')
async getMerchantCard(
  @Param('merchantId', ParseIntPipe) merchantId: number,
  @Res() res: Response,   // ← remove passthrough:true
): Promise<void> {
  const merchantData = {
    merchantId,
    businessName: 'Demo Merchant',
    businessEmail: 'demo@example.com',
    businessPhone: '254700000000',
    logoUrl: null,
    paybillNumber: '123456',
    accountNumber: 'MERCHANT001',
    qrCodeDataUrl: '',
    paymentUrl: `https://pay.example.com/pay?merchant=${merchantId}`,
    generatedAt: new Date(),
  };

  const buffer = await this.pdfService.generateMerchantCard(merchantData as any);

  // Write directly — bypasses NestJS serialisation pipeline entirely
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="merchant_${merchantId}_card.pdf"`);
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);   // ← end() not send(), prevents double-send
}

// Same fix for downloadPdf:
@Get('download/:fileName')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MERCHANT)
async downloadPdf(
  @Param('fileName') fileName: string,
  @Res() res: Response,   // ← remove passthrough:true
): Promise<void> {
  const filePath = `./uploads/pdf/${fileName}`;
  const fs = await import('fs');

  if (!fs.existsSync(filePath)) {
    throw new NotFoundException('File not found');
  }

  const buffer = fs.readFileSync(filePath) as Buffer;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
}
}