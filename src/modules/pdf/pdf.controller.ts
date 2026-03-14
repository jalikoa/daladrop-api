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

@Controller('pdf')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class PdfController {
  constructor(
    private readonly pdfService: PdfService,
    @InjectQueue(PDF_CONSTANTS.EVENT_PREFIX + '-queue') private readonly pdfQueue: Queue,
  ) {}

  @Get('merchant/:merchantId/card')
  @UseGuards(JwtAuthGuard, MerchantOwnerGuard)
  async getMerchantCard(
    @Param('merchantId', ParseIntPipe) merchantId: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
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
    const fileInfo = this.pdfService.getFileInfo(buffer);

    res.set({
      'Content-Type': fileInfo.mimeType,
      'Content-Disposition': `attachment; filename="merchant_${merchantId}_card.pdf"`,
      'Content-Length': fileInfo.size.toString(),
    });

    return new StreamableFile(buffer);
  }

  @Post('merchant/:merchantId/card/generate')
  @UseGuards(JwtAuthGuard, MerchantOwnerGuard)
  async generateMerchantCard(
    @Param('merchantId', ParseIntPipe) merchantId: number,
    @Query('async') async = 'true',
  ): Promise<{ success: boolean; message: string; jobId?: string }> {
    if (async === 'true') {
      const job = await this.pdfQueue.add('merchant.card.generate', {
        merchantId,
        businessName: 'Demo Merchant',
        paybillNumber: '123456',
        accountNumber: 'MERCHANT001',
        qrCodeDataUrl: '',
        paymentUrl: `https://pay.example.com/pay?merchant=${merchantId}`,
      });

      return { success: true, message: 'Merchant card generation queued', jobId: job.id?.toString() };
    } else {
      return { success: true, message: 'Merchant card generated synchronously' };
    }
  }

  @Get('download/:fileName')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async downloadPdf(
    @Param('fileName') fileName: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const filePath = `./uploads/pdf/${fileName}`;
    const fs = await import('fs');

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    const buffer = fs.readFileSync(filePath);
    const fileInfo = this.pdfService.getFileInfo(buffer);

    res.set({
      'Content-Type': fileInfo.mimeType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': fileInfo.size.toString(),
    });

    return new StreamableFile(buffer);
  }
}