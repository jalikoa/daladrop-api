import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgeVerificationService } from '../use-cases/age-verification.service';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import type { AuditLogService } from '../../operations/use-cases/audit-log.service';

describe('AgeVerificationService.getStatus', () => {
  const audit = { record: jest.fn() } as unknown as AuditLogService;
  const emitter = new EventEmitter2();

  it('maps enum status to lowercase UI status with verifiedAt and method', async () => {
    const verifiedAt = new Date('2026-01-02T03:04:05.000Z');
    const prisma = {
      ageVerification: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'v1',
          userId: 'u1',
          status: 'VERIFIED',
          method: 'ID_DOCUMENT',
          verifiedAt,
        }),
      },
    } as unknown as PrismaService;

    const service = new AgeVerificationService(prisma, audit, emitter);
    const result = await service.getStatus('u1');

    expect(result).toEqual({
      status: 'verified',
      verifiedAt: verifiedAt.toISOString(),
      method: 'id_document',
    });
  });

  it('returns unverified when no record exists', async () => {
    const prisma = {
      ageVerification: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;

    const service = new AgeVerificationService(prisma, audit, emitter);
    const result = await service.getStatus('u1');

    expect(result).toEqual({ status: 'unverified' });
  });

  it('maps pending status without verifiedAt', async () => {
    const prisma = {
      ageVerification: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'v2',
          userId: 'u2',
          status: 'PENDING',
          method: 'IN_PERSON',
          verifiedAt: null,
        }),
      },
    } as unknown as PrismaService;

    const service = new AgeVerificationService(prisma, audit, emitter);
    const result = await service.getStatus('u2');

    expect(result).toEqual({ status: 'pending', method: 'in_person' });
  });
});
