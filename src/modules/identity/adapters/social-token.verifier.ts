export type SocialProvider = 'google' | 'apple';

export interface VerifiedSocialIdentity {
  readonly providerUserId: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly rawProfile?: Readonly<Record<string, unknown>>;
}

export interface SocialTokenVerifier {
  verify(
    provider: SocialProvider,
    token: string,
  ): Promise<VerifiedSocialIdentity | null>;
}

/**
 * Safe default: social login is unavailable until a cryptographic provider
 * adapter is registered. Never decode an unverified JWT as identity.
 */
export class UnconfiguredSocialTokenVerifier implements SocialTokenVerifier {
  public verify(): Promise<null> {
    return Promise.resolve(null);
  }
}
