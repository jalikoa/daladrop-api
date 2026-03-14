import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IPdfService, PdfFileInfo } from '../interfaces/pdf-service.interface';
import { GeneratePdfDto } from '../dto/generate-pdf.dto';
import { MerchantCardData, PdfDocumentValueObject } from '../value-objects/pdf-document.vo';
import { MerchantCardTemplate } from '../templates/merchant-card.template';
import { PDF_CONSTANTS } from '../constants/pdf.constants';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfService implements IPdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = this.configService.get('PDF_UPLOAD_DIR') || './uploads/pdf';
    this.ensureUploadDir();
  }

  private ensureUploadDir(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Generate generic PDF from DTO
   */
  async generate(dto: GeneratePdfDto): Promise<Buffer> {
    try {
      const pdfVO = new PdfDocumentValueObject(
        dto.title,
        dto.width,
        dto.height,
      );

      // If merchant data provided, generate merchant card
      if (dto.merchantData) {
        return this.generateMerchantCard(dto.merchantData as unknown as MerchantCardData);
      }

      // Generic PDF (placeholder - implement based on needs)
      this.logger.log(`Generating generic PDF: ${dto.title}`);
      throw new BadRequestException('Generic PDF generation not implemented');
    } catch (error) {
      this.logger.error('Failed to generate PDF', error);
      throw new BadRequestException('Failed to generate PDF');
    }
  }

  /**
   * Generate merchant ID card PDF
   */
  async generateMerchantCard(data: MerchantCardData): Promise<Buffer> {
    try {
      this.logger.log(`Generating merchant card for merchant ${data.merchantId}`);

      // Use pdfkit implementation (more mature for this use case)
      const buffer = await MerchantCardTemplate.generateWithPdfkit(data);

      this.logger.log(`Merchant card generated (${buffer.length} bytes)`);

      return buffer;
    } catch (error) {
      this.logger.error('Failed to generate merchant card', error);
      throw new BadRequestException('Failed to generate merchant card');
    }
  }

  /**
   * Save PDF buffer to file
   */
  async saveToFile(buffer: Buffer, filePath: string): Promise<string> {
    try {
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.uploadDir, filePath);

      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, buffer);

      this.logger.log(`PDF saved to ${fullPath}`);

      return fullPath;
    } catch (error) {
      this.logger.error('Failed to save PDF to file', error);
      throw new BadRequestException('Failed to save PDF to file');
    }
  }

  /**
   * Get PDF file info
   */
  getFileInfo(buffer: Buffer): PdfFileInfo {
    const size = buffer.length;
    const sizeFormatted = this.formatFileSize(size);

    return {
      size,
      sizeFormatted,
      mimeType: PDF_CONSTANTS.MIME_TYPE,
    };
  }

  /**
   * Format file size to human readable
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  /**
   * Generate and save merchant card (convenience method)
   */
  async generateAndSaveMerchantCard(
    data: MerchantCardData,
    fileName?: string,
  ): Promise<{ buffer: Buffer; filePath: string; info: PdfFileInfo }> {
    const buffer = await this.generateMerchantCard(data);
    const safeFileName = fileName || `merchant_${data.merchantId}_card_${Date.now()}.pdf`;
    const filePath = await this.saveToFile(buffer, safeFileName);
    const info = this.getFileInfo(buffer);

    return { buffer, filePath, info };
  }
}
