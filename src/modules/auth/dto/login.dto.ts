import { IsString, MinLength, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @Matches(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$|^\+?[1-9]\d{1,14}$/, {
    message: 'Valid email or phone number required',
  })
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}