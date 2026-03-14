export const PDF_CONSTANTS = {
  EVENT_PREFIX: 'pdf',
  EVENTS: {
    GENERATED: 'pdf.generated',
    DOWNLOAD_REQUESTED: 'pdf.download.requested',
    MERCHANT_CARD_GENERATED: 'pdf.merchant-card.generated',
  },
  // ID-1 Card Dimensions (Credit Card Size)
  // 85.6mm × 53.98mm = 242.65 × 153.01 points (at 72 DPI)
  CARD_SIZE: {
    WIDTH: 242,
    HEIGHT: 153,
    WIDTH_MM: 85.6,
    HEIGHT_MM: 53.98,
  },
  // Margins and Layout
  MARGIN: {
    TOP: 10,
    BOTTOM: 10,
    LEFT: 10,
    RIGHT: 10,
  },
  // Fonts
  FONTS: {
    BUSINESS_NAME: { size: 14, weight: 'bold' as const },
    TAGLINE: { size: 8, weight: 'normal' as const },
    INSTRUCTIONS: { size: 6, weight: 'normal' as const },
  },
  // Colors (RGB)
  COLORS: {
    PRIMARY: [0, 102, 204], // Blue
    SECONDARY: [51, 51, 51], // Dark Gray
    WHITE: [255, 255, 255],
    BLACK: [0, 0, 0],
  },
  // QR Code Position on Card
  QR_CODE: {
    SIZE: 100,
    X: 70,
    Y: 40,
  },
  // Logo Position
  LOGO: {
    SIZE: 40,
    X: 10,
    Y: 10,
  },
  // Output Settings
  MIME_TYPE: 'application/pdf',
  FILE_EXTENSION: '.pdf',
  MAX_FILE_SIZE_MB: 5,
} as const;

export const PDF_QUEUES = {
  MERCHANT_CARD: 'pdf-queue',
  REPORT: 'pdf-report-queue',
} as const;
