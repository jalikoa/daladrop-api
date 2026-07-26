/**
 * Fixed owner id for the singleton PLATFORM liability wallet.
 * Override with `PLATFORM_WALLET_OWNER_ID` when needed (must be a UUID).
 */
export const DEFAULT_PLATFORM_WALLET_OWNER_ID =
  '00000000-0000-4000-8000-000000000001';

export function platformWalletOwnerId(): string {
  const fromEnv = process.env.PLATFORM_WALLET_OWNER_ID?.trim();
  return fromEnv && fromEnv.length > 0
    ? fromEnv
    : DEFAULT_PLATFORM_WALLET_OWNER_ID;
}
