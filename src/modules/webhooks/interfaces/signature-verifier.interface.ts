export interface ISignatureVerifier {
  verify(payload: string, signature: string, secret?: string): Promise<boolean>;
  generateSignature(payload: string, secret: string): Promise<string>;
}
