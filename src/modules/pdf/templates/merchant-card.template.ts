import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { MerchantCardData } from '../value-objects/pdf-document.vo';
import { PDF_CONSTANTS } from '../constants/pdf.constants';

export class MerchantCardTemplate {
  static async generate(data: MerchantCardData): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([PDF_CONSTANTS.CARD_SIZE.WIDTH, PDF_CONSTANTS.CARD_SIZE.HEIGHT]);

    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    page.drawRectangle({ x: 0, y: 0, width: PDF_CONSTANTS.CARD_SIZE.WIDTH, height: PDF_CONSTANTS.CARD_SIZE.HEIGHT, color: rgb(1, 1, 1) });

    page.drawRectangle({ x: 0, y: PDF_CONSTANTS.CARD_SIZE.HEIGHT - 20, width: PDF_CONSTANTS.CARD_SIZE.WIDTH, height: 20, color: rgb(PDF_CONSTANTS.COLORS.PRIMARY[0] / 255, PDF_CONSTANTS.COLORS.PRIMARY[1] / 255, PDF_CONSTANTS.COLORS.PRIMARY[2] / 255) });

    page.drawText(data.businessName.toUpperCase(), {
      x: PDF_CONSTANTS.MARGIN.LEFT,
      y: PDF_CONSTANTS.CARD_SIZE.HEIGHT - 8,
      size: PDF_CONSTANTS.FONTS.BUSINESS_NAME.size,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    if (data.logoUrl) {
      page.drawText('LOGO', { x: PDF_CONSTANTS.LOGO.X, y: PDF_CONSTANTS.CARD_SIZE.HEIGHT - 35, size: 8, font: normalFont, color: rgb(PDF_CONSTANTS.COLORS.SECONDARY[0] / 255, PDF_CONSTANTS.COLORS.SECONDARY[1] / 255, PDF_CONSTANTS.COLORS.SECONDARY[2] / 255) });
    }

    page.drawText('SCAN TO PAY', {
      x: PDF_CONSTANTS.QR_CODE.X,
      y: PDF_CONSTANTS.QR_CODE.Y - 5,
      size: PDF_CONSTANTS.FONTS.INSTRUCTIONS.size,
      font: boldFont,
      color: rgb(PDF_CONSTANTS.COLORS.PRIMARY[0] / 255, PDF_CONSTANTS.COLORS.PRIMARY[1] / 255, PDF_CONSTANTS.COLORS.PRIMARY[2] / 255),
    });

    page.drawText(`Paybill: ${data.paybillNumber}`, { x: PDF_CONSTANTS.MARGIN.LEFT, y: 35, size: 7, font: boldFont, color: rgb(PDF_CONSTANTS.COLORS.SECONDARY[0] / 255, PDF_CONSTANTS.COLORS.SECONDARY[1] / 255, PDF_CONSTANTS.COLORS.SECONDARY[2] / 255) });

    page.drawText(`Account: ${data.accountNumber}`, { x: PDF_CONSTANTS.MARGIN.LEFT, y: 25, size: 7, font: normalFont, color: rgb(PDF_CONSTANTS.COLORS.SECONDARY[0] / 255, PDF_CONSTANTS.COLORS.SECONDARY[1] / 255, PDF_CONSTANTS.COLORS.SECONDARY[2] / 255) });

    page.drawText('NFC Payment Card', { x: PDF_CONSTANTS.CARD_SIZE.WIDTH - 80, y: 8, size: 5, font: normalFont, color: rgb(0.5, 0.5, 0.5) });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  }

  static async generateWithPdfkit(data: MerchantCardData): Promise<Buffer> {
    const PDFDocumentPkg = (await import('pdfkit')).default;
    return new Promise((resolve, reject) => {
      const doc = new PDFDocumentPkg({ size: [PDF_CONSTANTS.CARD_SIZE.WIDTH, PDF_CONSTANTS.CARD_SIZE.HEIGHT], margin: 0 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.rect(0, 0, PDF_CONSTANTS.CARD_SIZE.WIDTH, PDF_CONSTANTS.CARD_SIZE.HEIGHT).fill('#FFFFFF');

      doc.fillColor('#0066CC').rect(0, PDF_CONSTANTS.CARD_SIZE.HEIGHT - 20, PDF_CONSTANTS.CARD_SIZE.WIDTH, 20).fill();

      doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold').text(data.businessName.toUpperCase(), PDF_CONSTANTS.MARGIN.LEFT, PDF_CONSTANTS.CARD_SIZE.HEIGHT - 15, { width: PDF_CONSTANTS.CARD_SIZE.WIDTH - 20, align: 'left' });

      doc.fillColor('#0066CC').fontSize(8).font('Helvetica-Bold').text('SCAN TO PAY', PDF_CONSTANTS.QR_CODE.X, PDF_CONSTANTS.QR_CODE.Y - 5, { align: 'center', width: PDF_CONSTANTS.QR_CODE.SIZE });

      doc.strokeColor('#CCCCCC').lineWidth(1).rect(PDF_CONSTANTS.QR_CODE.X, PDF_CONSTANTS.QR_CODE.Y, PDF_CONSTANTS.QR_CODE.SIZE, PDF_CONSTANTS.QR_CODE.SIZE).stroke();

      doc.fillColor('#333333').fontSize(7).font('Helvetica-Bold').text(`Paybill: ${data.paybillNumber}`, PDF_CONSTANTS.MARGIN.LEFT, 35);
      doc.fontSize(7).font('Helvetica').text(`Account: ${data.accountNumber}`, PDF_CONSTANTS.MARGIN.LEFT, 25);

      doc.fontSize(5).font('Helvetica').fillColor('#808080').text('NFC Payment Card', PDF_CONSTANTS.CARD_SIZE.WIDTH - 80, 8, { align: 'right' });

      doc.end();
    });
  }
}
