import { PDF_CONSTANTS } from '../constants/pdf.constants';
import { BadRequestException } from '@nestjs/common';


export class PdfDocumentValueObject {
  constructor(
    public readonly title: string,
    public readonly width: number = PDF_CONSTANTS.CARD_SIZE.WIDTH,
    public readonly height: number = PDF_CONSTANTS.CARD_SIZE.HEIGHT,
    public readonly orientation: 'portrait' | 'landscape' = 'landscape',
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.title || this.title.trim().length === 0) {
      throw new BadRequestException('PDF title cannot be empty');
    }
 
    if (this.width < 50 || this.width > 1000) {
      throw new BadRequestException(
        `PDF width ${this.width}pt is out of range — must be between 50 and 1000 points`,
      );
    }
 
    if (this.height < 50 || this.height > 1000) {
      throw new BadRequestException(
        `PDF height ${this.height}pt is out of range — must be between 50 and 1000 points`,
      );
    }
  }

  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  getSizeInMM(): { width: number; height: number } {
    return {
      width: Math.round(this.width * 0.352778 * 100) / 100,
      height: Math.round(this.height * 0.352778 * 100) / 100,
    };
  }

  toJSON(): Record<string, unknown> {
    return {
      title: this.title,
      width: this.width,
      height: this.height,
      orientation: this.orientation,
      sizeMM: this.getSizeInMM(),
    };
  }
}

export interface MerchantCardData {
  merchantId: number;
  muid: string;
  businessName: string;
  businessEmail?: string | null;
  businessPhone?: string | null;
  logoUrl?: string | null;
  paybillNumber: string;
  accountNumber: string;
  qrCodeDataUrl: string;
  paymentUrl: string;
  generatedAt: Date;
}
