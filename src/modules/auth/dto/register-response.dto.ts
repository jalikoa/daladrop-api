// src/modules/auth/dto/register-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class RegisterResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  user: {
    id: number;
    uuid: string;
    email: string | null;
    phone_number: string | null;
    role: string;
    status: string;
    created_at: Date;
  };

  @ApiProperty({ required: false })
  access_token?: string;

  @ApiProperty({ required: false })
  token_type?: string;
}