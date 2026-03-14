import { QR_CONSTANTS, QR_ERROR_CORRECTION } from '../constants/qr.constants';

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
      throw new Error('QR code data cannot be empty');
    }

    if (this.data.length > QR_CONSTANTS.MAX_URL_LENGTH) {
      throw new Error(`QR code data exceeds maximum length of ${QR_CONSTANTS.MAX_URL_LENGTH}`);
    }

    if (this.size < 100 || this.size > 1000) {
      throw new Error('QR code size must be between 100 and 1000 pixels');
    }

    if (this.margin < 1 || this.margin > 10) {
      throw new Error('QR code margin must be between 1 and 10');
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
