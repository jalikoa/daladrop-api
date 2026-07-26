import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AgeVerificationMethod, AgeVerificationStatus } from '@prisma/client';

/**
 * Clients send the method in varying casings (e.g. `id_document`,
 * `ID_DOCUMENT`, `In_Person`). Normalize to the upper-snake-case Prisma
 * enum value before validation so any casing is accepted.
 */
function normalizeEnumCasing(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export class SubmitAgeVerificationDto {
  @Transform(({ value }) => normalizeEnumCasing(value))
  @IsEnum(AgeVerificationMethod)
  method: AgeVerificationMethod;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  documentType?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  documentImageUrl?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}

export class ReviewAgeVerificationDto {
  @IsEnum(['APPROVED', 'REJECTED'] as const)
  decision: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ListAgeVerificationsQueryDto {
  @IsOptional()
  @IsEnum(AgeVerificationStatus)
  status?: AgeVerificationStatus;
}
