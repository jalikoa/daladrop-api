import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;
}

export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @IsString()
  @IsIn(['CUSTOMER'])
  role: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;
}

export class AppleLoginDto {
  @IsString()
  @IsNotEmpty()
  identityToken: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsString()
  @IsIn(['CUSTOMER'])
  role: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;
}

export class IdentifierDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;
}

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @Matches(/^\d{6}$/)
  otp: string;
}

export class ResetPasswordDto extends VerifyOtpDto {
  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class LegalAcceptanceDto {
  @IsString()
  @IsNotEmpty()
  termsVersion: string;

  @IsString()
  @IsNotEmpty()
  privacyVersion: string;

  @IsString()
  @IsNotEmpty()
  signatureName: string;
}

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsString()
  surname?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  confirmPassword: string;

  @IsString()
  @IsNotEmpty()
  signupToken: string;

  @ValidateNested()
  @Type(() => LegalAcceptanceDto)
  legalAcceptance: LegalAcceptanceDto;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class VerifyMfaLoginDto {
  @IsString()
  @IsNotEmpty()
  mfaChallengeId: string;

  @IsString()
  @MinLength(6)
  code: string;
}

export class ResendMfaLoginDto {
  @IsString()
  @IsNotEmpty()
  mfaChallengeId: string;
}

export class EnrollTotpDto {
  @IsOptional()
  @IsString()
  label?: string;
}

export class VerifyTotpEnrollmentDto {
  @IsString()
  @IsNotEmpty()
  factorId: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}

export class DisableMfaDto {
  @IsString()
  @MinLength(6)
  code: string;
}
