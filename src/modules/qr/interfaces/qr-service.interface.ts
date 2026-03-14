import { GenerateQrDto } from '../dto/generate-qr.dto';

export interface IQrService {
  generate(dto: GenerateQrDto): Promise<string>; // Returns data URL
  generateToBuffer(dto: GenerateQrDto): Promise<Buffer>;
  generateToFile(dto: GenerateQrDto, filePath: string): Promise<string>;
  validateData(data: string): boolean;
  getQRCodeInfo(dataUrl: string): QRCodeInfo;
}

export interface QRCodeInfo {
  format: string;
  size: number;
  encoding: string;
}
