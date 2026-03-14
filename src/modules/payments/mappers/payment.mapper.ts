import { PaymentSession } from '../entities/payment-session.entity';
import { PaymentResponseDto } from '../dto/payment-response.dto';
import { plainToInstance } from 'class-transformer';

export class PaymentMapper {
  static toDTO(session: PaymentSession): PaymentResponseDto {
    return plainToInstance(PaymentResponseDto, { ...session, merchant_name: (session as any).merchant?.business_name }, { excludeExtraneousValues: true });
  }

  static toDTOArray(sessions: PaymentSession[]): PaymentResponseDto[] {
    return sessions.map((session) => this.toDTO(session));
  }
}
