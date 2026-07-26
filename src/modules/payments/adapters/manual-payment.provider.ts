import { Injectable } from '@nestjs/common';
import {
  deterministicReference,
  type NormalizedWebhookResult,
  type PaymentProvider,
  type ProviderActionCommand,
  type ProviderCommand,
  type ProviderHealth,
  type ProviderResult,
  UnsupportedProviderCapabilityError,
  type WebhookInput,
} from '../domain/payment-provider';

@Injectable()
export class ManualPaymentProvider implements PaymentProvider {
  public readonly code = 'MANUAL';

  public async initiatePayment(command: ProviderCommand): Promise<ProviderResult> {
    return {
      status: 'PENDING',
      providerReference: this.generateReference(command.paymentId),
      message: 'Manual payment is awaiting authorised administrator approval',
      raw: { approvalRequired: true, idempotencyKey: command.idempotencyKey },
    };
  }

  public async queryPayment(command: ProviderActionCommand): Promise<ProviderResult> {
    return {
      status: 'PENDING',
      providerReference: command.providerReference,
      message: 'Manual payment state is managed by administrator approval',
    };
  }

  public async cancelPayment(command: ProviderActionCommand): Promise<ProviderResult> {
    return { status: 'CANCELLED', providerReference: command.providerReference };
  }

  public async reversePayment(command: ProviderActionCommand): Promise<ProviderResult> {
    return {
      status: 'REVERSED',
      providerReference: command.providerReference,
      message: 'Manual reversal recorded',
    };
  }

  public async refundPayment(command: ProviderActionCommand): Promise<ProviderResult> {
    return {
      status: 'REFUNDED',
      providerReference: command.providerReference,
      message: 'Manual refund recorded',
    };
  }

  public async validateCallback(): Promise<boolean> {
    return false;
  }

  public async handleWebhook(_input: WebhookInput): Promise<NormalizedWebhookResult> {
    throw new UnsupportedProviderCapabilityError(this.code, 'webhooks');
  }

  public generateReference(paymentId: string): string {
    return deterministicReference('MAN', paymentId);
  }

  public async verifySignature(): Promise<boolean> {
    return false;
  }

  public async healthCheck(): Promise<ProviderHealth> {
    return { available: true, providerCode: this.code };
  }

  public validateConfiguration(): readonly string[] {
    return [];
  }
}
