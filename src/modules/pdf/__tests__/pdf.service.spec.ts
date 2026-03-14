import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PdfService } from '../services/pdf.service';
import { MerchantCardData } from '../value-objects/pdf-document.vo';

describe('PdfService', () => {
  let service: PdfService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [PdfService],
    }).compile();

    service = module.get<PdfService>(PdfService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate merchant card PDF', async () => {
    const merchantData: MerchantCardData = {
      merchantId: 1,
      businessName: 'Test Merchant',
      businessEmail: 'test@example.com',
      businessPhone: '254700000000',
      logoUrl: null,
      paybillNumber: '123456',
      accountNumber: 'TEST001',
      qrCodeDataUrl: 'data:image/png;base64,test',
      paymentUrl: 'https://pay.example.com/pay?merchant=1',
      generatedAt: new Date(),
    };

    const buffer = await service.generateMerchantCard(merchantData);

    expect(buffer).toBeDefined();
    expect(buffer instanceof Buffer).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should get PDF file info', () => {
    const mockBuffer = Buffer.from('test pdf content');
    const info = service.getFileInfo(mockBuffer);

    expect(info.size).toBe(mockBuffer.length);
    expect(info.mimeType).toBe('application/pdf');
    expect(info.sizeFormatted).toMatch(/B|KB|MB/);
  });

  it('should format file sizes correctly', () => {
    const smallBuffer = Buffer.alloc(500); // 500 B
    const mediumBuffer = Buffer.alloc(1500); // 1.46 KB
    const largeBuffer = Buffer.alloc(1500000); // 1.43 MB

    expect(service.getFileInfo(smallBuffer).sizeFormatted).toContain('B');
    expect(service.getFileInfo(mediumBuffer).sizeFormatted).toContain('KB');
    expect(service.getFileInfo(largeBuffer).sizeFormatted).toContain('MB');
  });
});
