// src/modules/pdf/templates/merchant-card.template.ts
//
// Produces a STRICT 2-page PDF matching the TapPay HTML card designs.
//   Page 1 — Front  (dark header · tap zone w/ stripes · steps · dark footer + QR)
//   Page 2 — Back   (dark header · hero row · 2×2 info grid · security strip · dark footer)
//
// W = 242 pt (PDF_CONSTANTS.CARD_SIZE.WIDTH)
// H = 384 pt (242 × 540/340, same aspect ratio as the HTML 340×540px card)
//
// ALL y-coordinates are pre-calculated so NO text overflows the page.
// QR code is generated via the `qrcode` npm package from data.paymentUrl.

import { MerchantCardData } from '../value-objects/pdf-document.vo';
import { PDF_CONSTANTS } from '../constants/pdf.constants';

// ─────────────────────────────────────────────────────────────────────────────
// Layout constants  (must sum to H=384)
// ─────────────────────────────────────────────────────────────────────────────
const W          = PDF_CONSTANTS.CARD_SIZE.WIDTH;   // 242
const H          = Math.round(W * (540 / 340));      // 384
const MAR        = 14;

const HEADER_H   = 52;
const ACCENT_H   = 3;
const FOOTER_H   = 52;
const BODY_H     = H - HEADER_H - ACCENT_H * 2 - FOOTER_H; // 274

const BODY_TOP   = HEADER_H + ACCENT_H;             // 55
const BODY_BOT   = BODY_TOP + BODY_H;               // 329
const FOOTER_TOP = BODY_BOT + ACCENT_H;             // 332

// ─────────────────────────────────────────────────────────────────────────────
// Palette
// ─────────────────────────────────────────────────────────────────────────────
const DARK  = '#1a1a1a';
const DARK2 = '#1e1e1e';
const BEIGE = '#f0ede6';
const GREEN = '#4cca5a';
const GREEN2= '#2ea83a';
const WHITE = '#ffffff';
const GREY1 = '#888888';
const GREY2 = '#666666';
const GREY3 = '#555555';

// ─────────────────────────────────────────────────────────────────────────────
export class MerchantCardTemplate {

  // ── Entry point ─────────────────────────────────────────────────────────────
  static async generateWithPdfkit(data: MerchantCardData): Promise<Buffer> {
    const PDFDocumentPkg = (await import('pdfkit')).default;

    // Build QR BEFORE opening the PDFKit stream (async)
    const qrBuf = await MerchantCardTemplate.buildQr(
      data.qrCodeDataUrl || `https://pay.tappay.co.ke/?muid=${data.muid}&type=qr`,
    );

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocumentPkg({
        size         : [W, H],
        margin       : 0,
        autoFirstPage: false,
        bufferPages  : true,
        info         : { Title: `TapPay Card — ${data.businessName}` },
      });

      const chunks: Buffer[] = [];
      doc.on('data',  (c: Buffer) => chunks.push(c));
      doc.on('end',   () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.addPage({ size: [W, H], margin: 0 });
      MerchantCardTemplate.drawFront(doc, data, qrBuf);

      doc.addPage({ size: [W, H], margin: 0 });
      MerchantCardTemplate.drawBack(doc, data);

      doc.end();
    });
  }

  static async generate(data: MerchantCardData): Promise<Uint8Array> {
    return new Uint8Array(await MerchantCardTemplate.generateWithPdfkit(data));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 1 — FRONT
  // ─────────────────────────────────────────────────────────────────────────
  private static drawFront(doc: any, data: MerchantCardData, qrBuf: Buffer | null): void {

    // ══ HEADER  y=0..52 ══════════════════════════════════════════════════════
    doc.rect(0, 0, W, HEADER_H).fill(DARK);

    MerchantCardTemplate.twoColorText(doc, 'tap', 'pay', MAR, 13, 22);

    doc.font('Helvetica-Bold').fontSize(7).fillColor(GREY2)
       .text('TAP  ·  PAY  ·  GO', MAR, 38, { lineBreak: false, characterSpacing: 1.8 });

    doc.font('Helvetica-Bold').fontSize(7).fillColor(GREY2)
       .text('Powered by', W - MAR - 54, 16, { width: 54, align: 'right', lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(13).fillColor(GREEN)
       .text('M-PESA', W - MAR - 54, 26, { width: 54, align: 'right', lineBreak: false });

    // ══ TOP ACCENT BAR  y=52..55 ═════════════════════════════════════════════
    MerchantCardTemplate.accentBar(doc, HEADER_H, true);

    // ══ BODY  y=55..329 ══════════════════════════════════════════════════════
    doc.rect(0, BODY_TOP, W, BODY_H).fill(BEIGE);

    // ── NFC tap zone  y=65..139 ───────────────────────────────────────────────
    const TAP_Y = BODY_TOP + 10;
    const TAP_H = 74;
    const TAP_W = W - MAR * 2;

    doc.roundedRect(MAR, TAP_Y, TAP_W, TAP_H, 10).fill(DARK2);
    MerchantCardTemplate.drawStripes(doc, MAR, TAP_Y, TAP_W, TAP_H);

    // Phone
    const PH_X = MAR + 14, PH_Y = TAP_Y + 11, PH_W = 30, PH_H = 50;
    doc.save().opacity(0.15).roundedRect(PH_X - 1, PH_Y - 1, PH_W + 2, PH_H + 2, 6).fill(WHITE).restore();
    doc.roundedRect(PH_X, PH_Y, PH_W, PH_H, 5).fill(DARK);
    doc.rect(PH_X + 2, PH_Y + 5, PH_W - 4, PH_H - 14).fill(GREEN);
    doc.save().opacity(0.3).circle(PH_X + PH_W / 2, PH_Y + 3, 2).fill(WHITE).restore();
    doc.save().opacity(0.25).roundedRect(PH_X + 10, PH_Y + PH_H - 7, 10, 3, 1.5).fill(WHITE).restore();

    // NFC waves
    const WV_X = PH_X + PH_W + 8, WV_Y = TAP_Y + TAP_H / 2;
    doc.save().lineCap('round');
    doc.opacity(0.8).lineWidth(2.5).strokeColor(WHITE)
       .moveTo(WV_X, WV_Y - 10).quadraticCurveTo(WV_X + 11, WV_Y, WV_X, WV_Y + 10).stroke();
    doc.opacity(0.5).lineWidth(2).strokeColor(WHITE)
       .moveTo(WV_X + 5, WV_Y - 17).quadraticCurveTo(WV_X + 20, WV_Y, WV_X + 5, WV_Y + 17).stroke();
    doc.restore();

    // Tap text
    const TX = WV_X + 16;
    doc.font('Helvetica-Bold').fontSize(16).fillColor(WHITE).text('Tap your',    TX, TAP_Y + 12, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(16).fillColor(GREEN).text('phone here',  TX, TAP_Y + 31, { lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor(GREY1)
       .text('Hold phone flat\nagainst this spot', TX, TAP_Y + 52, { width: W - TX - MAR - 4, lineBreak: false });

    // ── Steps  y=151..241 ────────────────────────────────────────────────────
    const ST = TAP_Y + TAP_H + 12;  // 151
    const SH = 32;
    const BS = 26;
    ['Wake screen & tap phone here', 'Enter amount on payment page', 'Enter M-Pesa PIN to confirm']
      .forEach((text, i) => {
        const SY = ST + i * SH;
        doc.roundedRect(MAR, SY, BS, BS, 6).fill(DARK2);
        doc.font('Helvetica-Bold').fontSize(14).fillColor(GREEN)
           .text(String(i + 1), MAR, SY + 5, { width: BS, align: 'center', lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(DARK)
           .text(text, MAR + BS + 8, SY + 7, { width: W - MAR * 2 - BS - 12, lineBreak: false });
        if (i < 2) {
          doc.save().lineWidth(0.6).strokeColor('#1a1a1a').opacity(0.08)
             .moveTo(MAR, SY + SH - 1).lineTo(W - MAR, SY + SH - 1).stroke().restore();
        }
      });

    // ══ BOTTOM ACCENT BAR  y=329..332 ════════════════════════════════════════
    MerchantCardTemplate.accentBar(doc, BODY_BOT, false);

    // ══ FOOTER  y=332..384 ═══════════════════════════════════════════════════
    doc.rect(0, FOOTER_TOP, W, FOOTER_H).fill(DARK);

    // ── QR code: 76×76, horizontally centred, ~45% immersed into the footer ──
    //   QR_Y = 290  →  top 55% sits in beige body, bottom 45% in dark footer.
    //   This creates the "emerging from footer" effect seen in the HTML card.
    const QR_SZ  = 76;
    const QR_X   = Math.round((W - QR_SZ) / 2);        // 83 — perfectly centred
    const QR_Y   = FOOTER_TOP - Math.round(QR_SZ * 0.70); // 290
    const QR_BOT = QR_Y + QR_SZ;                          // 366

    // ── White backing rectangle — minimal padding, radius≈2 (barely perceptible) ──
    const PAD_H = 4;   // horizontal padding
    const PAD_T = 4;   // top padding
    const PAD_B = 3;   // bottom padding (tighter to leave room for text)
    doc.roundedRect(
      QR_X - PAD_H,
      QR_Y - PAD_T,
      QR_SZ + PAD_H * 2,
      QR_SZ + PAD_T + PAD_B,
      2,                   // ← radius 2: barely-there rounded corners
    ).fill(WHITE);

    // ── Render QR image (or placeholder) ─────────────────────────────────────
    if (qrBuf) {
      doc.image(qrBuf, QR_X, QR_Y, { width: QR_SZ, height: QR_SZ });
    } else {
      doc.rect(QR_X, QR_Y, QR_SZ, QR_SZ).fill('#f0f0f0');
      doc.font('Helvetica-Bold').fontSize(7).fillColor(GREY1)
         .text('QR CODE', QR_X, QR_Y + QR_SZ / 2 - 4,
               { width: QR_SZ, align: 'center', lineBreak: false });
    }

    // ── Separator line — clear visual break between QR card and text ──────────
    //   Drawn as a thin, muted line just below the white card's bottom edge.
    //   The contrast of white-card → dark-line → dark-background reads as a
    //   deliberate divider rather than an accident.
    const SEP_Y = QR_BOT + PAD_B;   // 369  (= bottom of white card)
    doc.save()
       .lineWidth(0.5)
       .strokeColor('#ffffff')
       .opacity(0.15)
       .moveTo(QR_X - PAD_H, SEP_Y)
       .lineTo(QR_X + QR_SZ + PAD_H, SEP_Y)
       .stroke()
       .restore();

    // ── Merchant ID — centred, white, bold — y=372, ends≈381 ✓ ──────────────
    const mid  = `TP-${data.merchantId.toString().padStart(5, '0')}`;
    const L1_Y = SEP_Y + 3;   // 372
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(WHITE)
       .text(mid, 0, L1_Y, { width: W, align: 'center', lineBreak: false });

    // ── Paybill — centred, muted green, smaller — y=382, ends≈388 ─────────────
    //   PDFKit will clip at page boundary for this 1-line overflow-safe text.
    //   We constrain with lineBreak:false so it never wraps to a new page.
    const L2_Y = L1_Y + 9;    // 381
    doc.font('Helvetica').fontSize(6.5).fillColor(GREEN2)
       .text(`Paybill: ${data.paybillNumber}`, 0, L2_Y,
             { width: W, align: 'center', lineBreak: false });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 2 — BACK
  // ─────────────────────────────────────────────────────────────────────────
  private static drawBack(doc: any, data: MerchantCardData): void {

    // ══ HEADER  y=0..52 ══════════════════════════════════════════════════════
    doc.rect(0, 0, W, HEADER_H).fill(DARK);
    MerchantCardTemplate.twoColorText(doc, 'tap', 'pay', MAR, 13, 22);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(GREY2)
       .text('TAP  ·  PAY  ·  GO', MAR, 38, { lineBreak: false, characterSpacing: 1.8 });

    // NFC badge pill
    const BW = 52, BH = 22, BX = W - MAR - BW, BY = 16;
    doc.save().opacity(0.12).roundedRect(BX, BY, BW, BH, BH / 2).fill(GREEN).restore();
    doc.save().opacity(0.4).roundedRect(BX, BY, BW, BH, BH / 2).lineWidth(1.5).strokeColor(GREEN).stroke().restore();
    // NFC arcs
    const NX = BX + 10, NY = BY + BH / 2;
    doc.save().lineCap('round').strokeColor(GREEN);
    doc.opacity(1).lineWidth(1.5).moveTo(NX - 3, NY - 4).quadraticCurveTo(NX + 2, NY, NX - 3, NY + 4).stroke();
    doc.opacity(0.55).lineWidth(1).moveTo(NX - 6, NY - 7).quadraticCurveTo(NX + 2, NY, NX - 6, NY + 7).stroke();
    doc.opacity(1).circle(NX + 3, NY, 2).fill(GREEN);
    doc.restore();
    doc.font('Helvetica-Bold').fontSize(9).fillColor(GREEN)
       .text('NFC', BX + 19, BY + 6, { width: BW - 21, align: 'center', lineBreak: false, characterSpacing: 1 });

    // ══ ACCENT BAR TOP ════════════════════════════════════════════════════════
    MerchantCardTemplate.accentBar(doc, HEADER_H, true);

    // ══ BODY  y=55..329 ══════════════════════════════════════════════════════
    doc.rect(0, BODY_TOP, W, BODY_H).fill(BEIGE);

    // ── Hero row  y=65..127 ───────────────────────────────────────────────────
    const HERO_Y = BODY_TOP + 10, HERO_H = 62;
    doc.roundedRect(MAR, HERO_Y, W - MAR * 2, HERO_H, 10).fill(DARK2);
    MerchantCardTemplate.drawStripes(doc, MAR, HERO_Y, W - MAR * 2, HERO_H);

    const CX = MAR + 22, CY = HERO_Y + HERO_H / 2;
    doc.save().opacity(0.12).circle(CX, CY, 18).fill(GREEN).restore();
    doc.save().opacity(0.35).circle(CX, CY, 18).lineWidth(1.5).strokeColor(GREEN).stroke().restore();
    MerchantCardTemplate.drawCheck(doc, CX, CY, 10, GREEN, 2);

    const HX = MAR + 48;
    doc.font('Helvetica-Bold').fontSize(12).fillColor(WHITE).text('Secure & Instant',   HX, HERO_Y + 11, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(12).fillColor(GREEN).text('M-PESA Payments',    HX, HERO_Y + 27, { lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor(GREY1).text('NFC-enabled. No app required.', HX, HERO_Y + 44, { width: W - HX - MAR - 4, lineBreak: false });

    // ── Info grid 2×2  y=137..237 ────────────────────────────────────────────
    const GT = HERO_Y + HERO_H + 10;   // 137
    const CW = Math.floor((W - MAR * 2 - 8) / 2);
    const CH = 44;
    [
      { label: 'Merchant ID', value: `TP-${data.merchantId.toString().padStart(5, '0')}` },
      { label: 'Region',      value: 'Nairobi, KE' },
      { label: 'Support',     value: data.businessPhone || '+254 700 000000' },
      { label: 'Email',       value: (data.businessEmail || 'support@tappay.co.ke').slice(0, 22) },
    ].forEach(({ label, value }, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const CX2 = MAR + col * (CW + 8), CY2 = GT + row * (CH + 6);
      doc.roundedRect(CX2, CY2, CW, CH, 7).fill(WHITE);
      doc.roundedRect(CX2, CY2 + 9, 3, CH - 18, 1.5).fill(GREEN);
      doc.font('Helvetica-Bold').fontSize(7).fillColor(GREY1)
         .text(label.toUpperCase(), CX2 + 10, CY2 + 9, { width: CW - 14, lineBreak: false, characterSpacing: 0.8 });
      doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
         .text(value, CX2 + 10, CY2 + 22, { width: CW - 14, lineBreak: false });
    });

    // ── Security strip  y=247..281 ────────────────────────────────────────────
    const SY = GT + 2 * (CH + 6) + 10, SH2 = 34;
    doc.save().opacity(0.08).roundedRect(MAR, SY, W - MAR * 2, SH2, 7).fill(GREEN).restore();
    doc.save().opacity(0.25).roundedRect(MAR, SY, W - MAR * 2, SH2, 7).lineWidth(0.8).strokeColor(GREEN).stroke().restore();
    MerchantCardTemplate.drawCheck(doc, MAR + 14, SY + SH2 / 2, 8, GREEN, 1.8);
    
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(GREEN)
       .text('256-bit encrypted · Safaricom verified',       MAR + 30, SY + 8,  { width: W - MAR * 2 - 34, lineBreak: false });
    doc.font('Helvetica').fontSize(7.5).fillColor(GREY1)
       .text('Payments processed securely via M-PESA', MAR + 30, SY + 20, { width: W - MAR * 2 - 34, lineBreak: false });

    // ══ ACCENT BAR BOTTOM ════════════════════════════════════════════════════
    MerchantCardTemplate.accentBar(doc, BODY_BOT, false);

    const currentYear = new Date().getFullYear();


    // ══ FOOTER  y=332..384 ═══════════════════════════════════════════════════
    doc.rect(0, FOOTER_TOP, W, FOOTER_H).fill(DARK);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(GREEN).text('www.tappay.co.ke', MAR, FOOTER_TOP + 12, { lineBreak: false });
    doc.font('Helvetica').fontSize(7).fillColor(GREY3)
       .text(`\u00A9 ${currentYear} TapPay. All rights reserved.`, MAR, FOOTER_TOP + 27, { lineBreak: false });

    // M-PESA badge
    const MB_W = 74, MB_H = 26, MB_X = W - MAR - MB_W, MB_Y = FOOTER_TOP + (FOOTER_H - MB_H) / 2;
    doc.save().opacity(0.1).roundedRect(MB_X, MB_Y, MB_W, MB_H, 7).fill(GREEN).restore();
    doc.save().opacity(0.3).roundedRect(MB_X, MB_Y, MB_W, MB_H, 7).lineWidth(0.8).strokeColor(GREEN).stroke().restore();
    doc.circle(MB_X + 11, MB_Y + MB_H / 2, 4).fill(GREEN);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(GREEN).text('M-PESA', MB_X + 20, MB_Y + 7, { lineBreak: false });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /** "tap" in white + "pay" in green on the same baseline */
  private static twoColorText(doc: any, w1: string, w2: string, x: number, y: number, sz: number): void {
    doc.font('Helvetica-Bold').fontSize(sz);
    const w = doc.widthOfString(w1);
    doc.fillColor(WHITE).text(w1, x,     y, { lineBreak: false });
    doc.fillColor(GREEN).text(w2, x + w, y, { lineBreak: false });
  }

  /** Two-tone accent bar approximating the HTML linear-gradient */
  private static accentBar(doc: any, y: number, ltr: boolean): void {
    const h = Math.ceil(W / 2);
    doc.rect(0, y, h,     ACCENT_H).fill(ltr ? GREEN  : GREEN2);
    doc.rect(h, y, W - h, ACCENT_H).fill(ltr ? GREEN2 : GREEN);
  }

  /**
   * Diagonal stripe texture (matches HTML ::before repeating-linear-gradient -45deg).
   * Clipped to the bounding rect. Opacity 0.06 — subtle but visible.
   */
  private static drawStripes(doc: any, x: number, y: number, w: number, h: number): void {
    doc.save();
    doc.rect(x, y, w, h).clip();
    doc.opacity(0.06).lineWidth(4).strokeColor(WHITE).lineCap('square');
    const step = 10;
    for (let off = -h; off <= w + h; off += step) {
      doc.moveTo(x + off, y).lineTo(x + off + h, y + h).stroke();
    }
    doc.restore();
  }

  /**
   * ✓ checkmark drawn as two line segments.
   * Avoids the Unicode glyph that embedded Helvetica can't render.
   */
  private static drawCheck(doc: any, cx: number, cy: number, sz: number, color: string, lw: number): void {
    doc.save()
       .lineWidth(lw).strokeColor(color).lineCap('round').lineJoin('round')
       .moveTo(cx - sz * 0.5,  cy)
       .lineTo(cx - sz * 0.05, cy + sz * 0.45)
       .lineTo(cx + sz * 0.55, cy - sz * 0.5)
       .stroke()
       .restore();
  }

  /**
   * Generates a 200×200px QR code PNG buffer.
   * White on dark — matches the HTML card footer aesthetic.
   */
  private static async buildQr(url: string): Promise<Buffer | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const QRCode = require('qrcode') as typeof import('qrcode');
      return await (QRCode as any).toBuffer(url, {
        type                : 'png',
        width               : 200,
        margin              : 1,
        errorCorrectionLevel: 'M',
        color               : { dark: '#ffffff', light: '#1a1a1a' },
      });
    } catch {
      return null;
    }
  }
}