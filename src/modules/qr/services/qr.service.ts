import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import { IQrService, QRCodeInfo } from '../interfaces/qr-service.interface';
import { GenerateQrDto } from '../dto/generate-qr.dto';
import { QRCodeValueObject } from '../value-objects/qr-code.vo';
import { QR_CONSTANTS } from '../constants/qr.constants';

@Injectable()
export class QrService implements IQrService {
  private readonly logger = new Logger(QrService.name);

  constructor(private readonly configService: ConfigService) {}

  async generate(dto: GenerateQrDto): Promise<string> {
    try {
      const qrVO = new QRCodeValueObject(
        dto.data,
        dto.size,
        dto.errorCorrection as 'L' | 'M' | 'Q' | 'H',
        dto.margin,
      );

      const dataUrl = await QRCode.toDataURL(qrVO.data, qrVO.getOptions());

      this.logger.log(`QR code generated successfully (${dto.data.length} chars)`);

      return dataUrl;
    } catch (error) {
      this.logger.error('Failed to generate QR code', error);
      throw new BadRequestException('Failed to generate QR code');
    }
  }

  async generateToBuffer(dto: GenerateQrDto): Promise<Buffer> {
    try {
      const qrVO = new QRCodeValueObject(
        dto.data,
        dto.size,
        dto.errorCorrection as 'L' | 'M' | 'Q' | 'H',
        dto.margin,
      );

      const buffer = await QRCode.toBuffer(qrVO.data, {
        ...qrVO.getOptions(),
        type: 'png',
      });

      this.logger.log(`QR code buffer generated (${buffer.length} bytes)`);

      return buffer;
    } catch (error) {
      this.logger.error('Failed to generate QR code buffer', error);
      throw new BadRequestException('Failed to generate QR code buffer');
    }
  }

  async generateToFile(dto: GenerateQrDto, filePath: string): Promise<string> {
    try {
      const qrVO = new QRCodeValueObject(
        dto.data,
        dto.size,
        dto.errorCorrection as 'L' | 'M' | 'Q' | 'H',
        dto.margin,
      );

      await QRCode.toFile(filePath, qrVO.data, {
        ...qrVO.getOptions(),
        type: 'png',
      });

      this.logger.log(`QR code saved to ${filePath}`);

      return filePath;
    } catch (error) {
      this.logger.error('Failed to save QR code to file', error);
      throw new BadRequestException('Failed to save QR code to file');
    }
  }

  validateData(data: string): boolean {
    if (!data || data.length === 0) {
      return false;
    }

    if (data.length > QR_CONSTANTS.MAX_URL_LENGTH) {
      return false;
    }

    if (data.startsWith('http')) {
      try {
        new URL(data);
        return true;
      } catch {
        return false;
      }
    }

    return true;
  }

  getQRCodeInfo(dataUrl: string): QRCodeInfo {
    const matches = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new BadRequestException(
        'Invalid QR code data URL format — expected data:image/<type>;base64,<data>',
      );
    }

    const [, format, base64Data] = matches;
    const size = Buffer.from(base64Data, 'base64').length;

    return {
      format: format.replace('image/', ''),
      size,
      encoding: 'base64',
    };
  }

  async generateForMerchant(paymentUrl: string, merchantId: number): Promise<{ dataUrl: string; buffer: Buffer }> {
    const [dataUrl, buffer] = await Promise.all([
      this.generate({ data: paymentUrl, size: 300, errorCorrection: 'H', margin: 2 }),
      this.generateToBuffer({ data: paymentUrl, size: 300, errorCorrection: 'H', margin: 2 }),
    ]);

    return { dataUrl, buffer };
  }
}
