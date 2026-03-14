import { GeneratePdfDto } from '../dto/generate-pdf.dto';
import { MerchantCardData } from '../value-objects/pdf-document.vo';

export interface IPdfService {
  generate(dto: GeneratePdfDto): Promise<Buffer>;
  generateMerchantCard(data: MerchantCardData): Promise<Buffer>;
  saveToFile(buffer: Buffer, filePath: string): Promise<string>;
  getFileInfo(buffer: Buffer): PdfFileInfo;
}

export interface PdfFileInfo {
  size: number;
  sizeFormatted: string;
  mimeType: string;
}
