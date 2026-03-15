import { QR_CONSTANTS, QR_ERROR_CORRECTION } from '../constants/qr.constants';
import { BadRequestException } from '@nestjs/common';

export class QRCodeValueObject {
  constructor(
    public readonly data: string,
    public readonly size: number = QR_CONSTANTS.DEFAULT_SIZE,
    public readonly errorCorrection: keyof typeof QR_ERROR_CORRECTION = 'M',
    public readonly margin: number = QR_CONSTANTS.DEFAULT_MARGIN,
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.data || this.data.length === 0) {
      throw new BadRequestException('QR code data cannot be empty');
    }
 
    if (this.data.length > QR_CONSTANTS.MAX_URL_LENGTH) {
      throw new BadRequestException(
        `QR code data length ${this.data.length} exceeds maximum of ${QR_CONSTANTS.MAX_URL_LENGTH} characters`,
      );
    }
 
    if (this.size < 100 || this.size > 1000) {
      throw new BadRequestException(
        `QR code size ${this.size}px is out of range — must be between 100 and 1000`,
      );
    }
 
    if (this.margin < 1 || this.margin > 10) {
      throw new BadRequestException(
        `QR code margin ${this.margin} is out of range — must be between 1 and 10`,
      );
    }
  }

  getOptions(): QRCodeOptions {
    return {
      width: this.size,
      margin: this.margin,
      errorCorrectionLevel: this.errorCorrection,
    };
  }

  toJSON(): Record<string, unknown> {
    return {
      data: this.data,
      size: this.size,
      errorCorrection: this.errorCorrection,
      margin: this.margin,
    };
  }
}

export interface QRCodeOptions {
  width: number;
  margin: number;
  errorCorrectionLevel: keyof typeof QR_ERROR_CORRECTION;
}
