export interface HumanChallengeInput {
  readonly token?: string;
  readonly action: string;
  readonly subjectKey: string;
}

/**
 * Anti-bot port. Turnstile/reCAPTCHA adapters implement this interface later.
 * The default permits requests only while AUTH_HUMAN_CHALLENGE_REQUIRED=false.
 */
export interface HumanChallengeVerifier {
  verify(input: HumanChallengeInput): Promise<boolean>;
}

export class ConfigurableHumanChallengeVerifier implements HumanChallengeVerifier {
  public constructor(private readonly required: boolean) {}

  public verify(input: HumanChallengeInput): Promise<boolean> {
    if (!this.required) return Promise.resolve(true);
    // Fail closed until a concrete Turnstile/reCAPTCHA adapter is configured.
    void input;
    return Promise.resolve(false);
  }
}
