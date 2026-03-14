import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { MerchantCardData } from '../value-objects/pdf-document.vo';
import { PDF_CONSTANTS } from '../constants/pdf.constants';

export class MerchantCardTemplate {
  /**
   * Generate ID-1 sized merchant card PDF using pdf-lib
   * This is more modern than pdfkit and supports embedding images better
   */
  static async generate(data: MerchantCardData): Promise<Uint8Array> {
    // Create new PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Add page (ID-1 card size in points)
    const page = pdfDoc.addPage([
      PDF_CONSTANTS.CARD_SIZE.WIDTH,
      PDF_CONSTANTS.CARD_SIZE.HEIGHT,
    ]);

    // Embed fonts
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Draw background (white)
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PDF_CONSTANTS.CARD_SIZE.WIDTH,
      height: PDF_CONSTANTS.CARD_SIZE.HEIGHT,
      color: rgb(1, 1, 1),
    });

    // Draw header bar (primary color)
    page.drawRectangle({
      x: 0,
      y: PDF_CONSTANTS.CARD_SIZE.HEIGHT - 20,
      width: PDF_CONSTANTS.CARD_SIZE.WIDTH,
      height: 20,
      color: rgb(
        PDF_CONSTANTS.COLORS.PRIMARY[0] / 255,
        PDF_CONSTANTS.COLORS.PRIMARY[1] / 255,
        PDF_CONSTANTS.COLORS.PRIMARY[2] / 255,
      ),
    });

    // Draw business name
    page.drawText(data.businessName.toUpperCase(), {
      x: PDF_CONSTANTS.MARGIN.LEFT,
      y: PDF_CONSTANTS.CARD_SIZE.HEIGHT - 8,
      size: PDF_CONSTANTS.FONTS.BUSINESS_NAME.size,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    // Draw logo if available (placeholder - in production, embed actual image)
    if (data.logoUrl) {
      // Note: For actual image embedding, you'd fetch and embed the image
      // This is a simplified version
      page.drawText('LOGO', {
        x: PDF_CONSTANTS.LOGO.X,
        y: PDF_CONSTANTS.CARD_SIZE.HEIGHT - 35,
        size: 8,
        font: normalFont,
        color: rgb(
          PDF_CONSTANTS.COLORS.SECONDARY[0] / 255,
          PDF_CONSTANTS.COLORS.SECONDARY[1] / 255,
          PDF_CONSTANTS.COLORS.SECONDARY[2] / 255,
        ),
      });
    }

    // Draw payment instructions
    page.drawText('SCAN TO PAY', {
      x: PDF_CONSTANTS.QR_CODE.X,
      y: PDF_CONSTANTS.QR_CODE.Y - 5,
      size: PDF_CONSTANTS.FONTS.INSTRUCTIONS.size,
      font: boldFont,
      color: rgb(
        PDF_CONSTANTS.COLORS.PRIMARY[0] / 255,
        PDF_CONSTANTS.COLORS.PRIMARY[1] / 255,
        PDF_CONSTANTS.COLORS.PRIMARY[2] / 255,
      ),
    });

    // Draw Paybill info
    page.drawText(`Paybill: ${data.paybillNumber}`, {
      x: PDF_CONSTANTS.MARGIN.LEFT,
      y: 35,
      size: 7,
      font: boldFont,
      color: rgb(
        PDF_CONSTANTS.COLORS.SECONDARY[0] / 255,
        PDF_CONSTANTS.COLORS.SECONDARY[1] / 255,
        PDF_CONSTANTS.COLORS.SECONDARY[2] / 255,
      ),
    });

    page.drawText(`Account: ${data.accountNumber}`, {
      x: PDF_CONSTANTS.MARGIN.LEFT,
      y: 25,
      size: 7,
      font: normalFont,
      color: rgb(
        PDF_CONSTANTS.COLORS.SECONDARY[0] / 255,
        PDF_CONSTANTS.COLORS.SECONDARY[1] / 255,
        PDF_CONSTANTS.COLORS.SECONDARY[2] / 255,
      ),
    });

    // Draw footer
    page.drawText('NFC Payment Card', {
      x: PDF_CONSTANTS.CARD_SIZE.WIDTH - 80,
      y: 8,
      size: 5,
      font: normalFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Note: QR code would be embedded as image here
    // In production, you'd convert the QR data URL to PNG and embed it

    // Save and return
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  }

  /**
   * Alternative: Generate using pdfkit (if preferred)
   */
  static async generateWithPdfkit(data: MerchantCardData): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default;
    
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: [PDF_CONSTANTS.CARD_SIZE.WIDTH, PDF_CONSTANTS.CARD_SIZE.HEIGHT],
        margin: 0,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Background
      doc.rect(0, 0, PDF_CONSTANTS.CARD_SIZE.WIDTH, PDF_CONSTANTS.CARD_SIZE.HEIGHT).fill('#FFFFFF');

      // Header bar
      doc
        .fillColor('#0066CC')
        .rect(0, PDF_CONSTANTS.CARD_SIZE.HEIGHT - 20, PDF_CONSTANTS.CARD_SIZE.WIDTH, 20)
        .fill();

      // Business name
      doc
        .fillColor('#FFFFFF')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(data.businessName.toUpperCase(), PDF_CONSTANTS.MARGIN.LEFT, PDF_CONSTANTS.CARD_SIZE.HEIGHT - 15, {
          width: PDF_CONSTANTS.CARD_SIZE.WIDTH - 20,
          align: 'left',
        });

      // QR Code placeholder (in production, embed actual QR image)
      doc
        .fillColor('#0066CC')
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('SCAN TO PAY', PDF_CONSTANTS.QR_CODE.X, PDF_CONSTANTS.QR_CODE.Y - 5, {
          align: 'center',
          width: PDF_CONSTANTS.QR_CODE.SIZE,
        });

      // QR border
      doc
        .strokeColor('#CCCCCC')
        .lineWidth(1)
        .rect(PDF_CONSTANTS.QR_CODE.X, PDF_CONSTANTS.QR_CODE.Y, PDF_CONSTANTS.QR_CODE.SIZE, PDF_CONSTANTS.QR_CODE.SIZE)
        .stroke();

      // Paybill info
      doc
        .fillColor('#333333')
        .fontSize(7)
        .font('Helvetica-Bold')
        .text(`Paybill: ${data.paybillNumber}`, PDF_CONSTANTS.MARGIN.LEFT, 35);

      doc
        .fontSize(7)
        .font('Helvetica')
        .text(`Account: ${data.accountNumber}`, PDF_CONSTANTS.MARGIN.LEFT, 25);

      // Footer
      doc
        .fontSize(5)
        .font('Helvetica')
        .fillColor('#808080')
        .text('NFC Payment Card', PDF_CONSTANTS.CARD_SIZE.WIDTH - 80, 8, {
          align: 'right',
        });

      doc.end();
    });
  }
}
