import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { QrService } from './services/qr.service';
import { GenerateQrDto } from './dto/generate-qr.dto';
import { QrCodeResponseDto } from './dto/qr-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('qr')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Post('generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async generate(@Body() dto: GenerateQrDto): Promise<QrCodeResponseDto> {
    const dataUrl = await this.qrService.generate(dto);

    return {
      success: true,
      payload: {
        qr_code_data_url: dataUrl,
        qr_code_url: '',
        original_data: dto.data,
        size: dto.size || 300,
        format: 'png',
        created_at: new Date(),
      },
      generated_at: new Date(),
    } as unknown as QrCodeResponseDto;
  }

  @Get('merchant/:merchantId')
  @UseGuards(JwtAuthGuard)
  async getMerchantQr(
    @Param('merchantId', ParseIntPipe) merchantId: number,
    @Query('size') size = 300,
  ): Promise<QrCodeResponseDto> {
    const paymentUrl = `https://pay.example.com/pay?merchant=${merchantId}`;
    const dataUrl = await this.qrService.generate({ data: paymentUrl, size, errorCorrection: 'H' });

    return {
      success: true,
      payload: {
        qr_code_data_url: dataUrl,
        qr_code_url: '',
        original_data: paymentUrl,
        size,
        format: 'png',
        created_at: new Date(),
      },
      generated_at: new Date(),
    } as unknown as QrCodeResponseDto;
  }

  @Get('download/:merchantId')
  @UseGuards(JwtAuthGuard)
  async downloadQr(
    @Param('merchantId', ParseIntPipe) merchantId: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const paymentUrl = `https://pay.example.com/pay?merchant=${merchantId}`;
    const buffer = await this.qrService.generateToBuffer({ data: paymentUrl, size: 500, errorCorrection: 'H' });

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="merchant_${merchantId}_qr.png"`,
      'Content-Length': buffer.length,
    });

    return new StreamableFile(buffer);
  }
}
