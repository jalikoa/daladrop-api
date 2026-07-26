/** Default chart seeded by `docs/database/seeds/002_daladrop_pricing_and_policies.sql`. */
export const DEFAULT_CHART_CODE = 'DALADROP_KES';

/** Chart-of-accounts codes (KES whole shillings, scale 0). */
export const CoaCodes = {
  PLATFORM_CASH: '1000',
  CUSTOMER_WALLETS: '1100',
  ESCROW_COMMERCE: '1200',
  ESCROW_RIDES: '1300',
  MERCHANT_PAYABLES: '2000',
  RIDER_PAYABLES: '2100',
  ORGANIZER_PAYABLES: '2200',
  REVENUE_HOLDING: '3000',
  SERVICE_FEE_REVENUE: '4000',
  DELIVERY_FEE_REVENUE: '4100',
  TICKET_PLATFORM_FEE_REVENUE: '4200',
  DELIVERY_EXPENSE: '5000',
  REFUNDS_CHARGEBACKS: '5100',
  PAYOUT_CLEARING: '6000',
} as const;

export type CoaCode = (typeof CoaCodes)[keyof typeof CoaCodes];

export const COA_LABELS: Readonly<Record<CoaCode, string>> = {
  [CoaCodes.PLATFORM_CASH]: 'Platform Cash (M-Pesa Clearing)',
  [CoaCodes.CUSTOMER_WALLETS]: 'Customer Wallets',
  [CoaCodes.ESCROW_COMMERCE]: 'Escrow — Commerce',
  [CoaCodes.ESCROW_RIDES]: 'Escrow — Rides',
  [CoaCodes.MERCHANT_PAYABLES]: 'Merchant Payables',
  [CoaCodes.RIDER_PAYABLES]: 'Rider Payables',
  [CoaCodes.ORGANIZER_PAYABLES]: 'Organizer Payables',
  [CoaCodes.REVENUE_HOLDING]: 'Daladrop Revenue Holding',
  [CoaCodes.SERVICE_FEE_REVENUE]: 'Service Fee Revenue',
  [CoaCodes.DELIVERY_FEE_REVENUE]: 'Delivery Fee / Platform Margin',
  [CoaCodes.TICKET_PLATFORM_FEE_REVENUE]: 'Ticket Platform Fee Revenue',
  [CoaCodes.DELIVERY_EXPENSE]: 'Delivery Expense (Rider Cost)',
  [CoaCodes.REFUNDS_CHARGEBACKS]: 'Refunds & Chargebacks',
  [CoaCodes.PAYOUT_CLEARING]: 'Payout Clearing',
};
