import { Expose } from 'class-transformer';

export class AuthResponseDto {
  @Expose()
  access_token: string;

  @Expose()
  refresh_token: string;

  @Expose()
  token_type: string = 'Bearer';

  @Expose()
  expires_in: number;

  @Expose()
  user: {
    id: number;
    uuid: string;
    email: string | null;
    role: string;
  };
}
