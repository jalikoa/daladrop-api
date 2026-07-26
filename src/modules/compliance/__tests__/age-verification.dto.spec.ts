import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AgeVerificationMethod } from '@prisma/client';
import { SubmitAgeVerificationDto } from '../dto/age-verification.dto';

describe('SubmitAgeVerificationDto method normalization', () => {
  it.each([
    ['id_document', AgeVerificationMethod.ID_DOCUMENT],
    ['ID_DOCUMENT', AgeVerificationMethod.ID_DOCUMENT],
    ['Id_Document', AgeVerificationMethod.ID_DOCUMENT],
    ['in_person', AgeVerificationMethod.IN_PERSON],
    ['IN_PERSON', AgeVerificationMethod.IN_PERSON],
  ])('accepts %s and normalizes to %s', async (input, expected) => {
    const dto = plainToInstance(SubmitAgeVerificationDto, { method: input });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.method).toBe(expected);
  });

  it('rejects an unknown method', async () => {
    const dto = plainToInstance(SubmitAgeVerificationDto, {
      method: 'passport',
    });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe('method');
  });
});
