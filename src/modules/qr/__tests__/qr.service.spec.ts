import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { QrService } from '../services/qr.service';
import { GenerateQrDto } from '../dto/generate-qr.dto';

describe('QrService', () => {
  let service: QrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [QrService],
    }).compile();

    service = module.get<QrService>(QrService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate QR code data URL', async () => {
    const dto: GenerateQrDto = {
      data: 'https://pay.example.com/pay?token=test',
      size: 300,
      errorCorrection: 'M',
    };

    const dataUrl = await service.generate(dto);

    expect(dataUrl).toBeDefined();
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('should generate QR code buffer', async () => {
    const dto: GenerateQrDto = {
      data: 'https://pay.example.com/pay?token=test',
      size: 300,
    };

    const buffer = await service.generateToBuffer(dto);

    expect(buffer).toBeDefined();
    expect(buffer instanceof Buffer).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should validate valid URL data', () => {
    const valid = service.validateData('https://pay.example.com/pay?token=test');
    expect(valid).toBe(true);
  });

  it('should reject empty data', () => {
    const valid = service.validateData('');
    expect(valid).toBe(false);
  });

  it('should reject data exceeding max length', () => {
    const longData = 'a'.repeat(3000);
    const valid = service.validateData(longData);
    expect(valid).toBe(false);
  });

  it('should get QR code info from data URL', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const info = service.getQRCodeInfo(dataUrl);

    expect(info.format).toBe('png');
    expect(info.encoding).toBe('base64');
    expect(info.size).toBeGreaterThan(0);
  });
});