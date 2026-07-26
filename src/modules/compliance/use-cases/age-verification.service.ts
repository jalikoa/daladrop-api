import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AgeVerification,
  AgeVerificationMethod,
  AgeVerificationStatus,
  AuditAction,
  ActorType,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../operations/use-cases/audit-log.service';
import type {
  ReviewAgeVerificationDto,
  SubmitAgeVerificationDto,
} from '../dto/age-verification.dto';

export interface AgeVerificationStatusView {
  readonly status: 'unverified' | 'pending' | 'verified' | 'rejected';
  readonly verifiedAt?: string;
  readonly method?: string;
}

const AGE_VERIFICATION_TABLE = 'age_verifications';

@Injectable()
export class AgeVerificationService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly events: EventEmitter2,
  ) {}

  public async getStatus(userId: string): Promise<AgeVerificationStatusView> {
    const record = await this.prisma.ageVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return this.toStatusView(record);
  }

  public async submit(
    actorId: string,
    userId: string,
    input: SubmitAgeVerificationDto,
  ) {
    this.assertSelf(actorId, userId);

    const existing = await this.prisma.ageVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const data = {
      status: AgeVerificationStatus.PENDING,
      method: input.method,
      documentType: input.documentType ?? null,
      documentImageUrl: input.documentImageUrl ?? null,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      verifiedAt: null,
      reviewedBy: null,
      reviewNotes: null,
    };

    const record = existing
      ? await this.prisma.ageVerification.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.ageVerification.create({
          data: { userId, ...data },
        });

    await this.audit.record({
      tableName: AGE_VERIFICATION_TABLE,
      recordId: record.id,
      action: existing ? AuditAction.UPDATE : AuditAction.INSERT,
      actorId,
      actorType: ActorType.USER,
      afterData: {
        status: record.status,
        method: record.method,
      },
      reason: 'Age verification submitted',
    });

    this.events.emit('compliance.age_verification.submitted', {
      verificationId: record.id,
      userId,
      method: record.method,
      submittedAt: record.updatedAt,
    });

    return this.toStatusView(record);
  }

  public async adminReview(
    actorId: string,
    verificationId: string,
    input: ReviewAgeVerificationDto,
  ) {
    const existing = await this.prisma.ageVerification.findUnique({
      where: { id: verificationId },
    });
    if (!existing) throw new NotFoundException('Age verification not found');

    const approved = input.decision === 'APPROVED';
    const record = await this.prisma.ageVerification.update({
      where: { id: verificationId },
      data: {
        status: approved
          ? AgeVerificationStatus.VERIFIED
          : AgeVerificationStatus.REJECTED,
        verifiedAt: approved ? new Date() : null,
        reviewedBy: actorId,
        reviewNotes: input.notes ?? null,
      },
    });

    await this.audit.record({
      tableName: AGE_VERIFICATION_TABLE,
      recordId: record.id,
      action: AuditAction.APPROVAL,
      actorId,
      actorType: ActorType.ADMIN,
      beforeData: { status: existing.status },
      afterData: { status: record.status },
      reason: `Age verification ${input.decision.toLowerCase()}`,
    });

    this.events.emit('compliance.age_verification.reviewed', {
      verificationId: record.id,
      userId: record.userId,
      decision: input.decision,
      reviewedBy: actorId,
      reviewedAt: record.updatedAt,
    });

    return this.toDetailView(record);
  }

  public async listForAdmin(status?: AgeVerificationStatus) {
    const rows = await this.prisma.ageVerification.findMany({
      where: { ...(status ? { status } : {}) },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
    });
    return {
      items: rows.map((row) => ({
        ...this.toDetailView(row),
        user: row.user,
      })),
    };
  }

  private toStatusView(
    record: AgeVerification | null,
  ): AgeVerificationStatusView {
    if (!record) return { status: 'unverified' };
    return {
      status: this.statusLabel(record.status),
      ...(record.verifiedAt
        ? { verifiedAt: record.verifiedAt.toISOString() }
        : {}),
      ...(record.method ? { method: this.methodLabel(record.method) } : {}),
    };
  }

  private toDetailView(record: AgeVerification) {
    return {
      id: record.id,
      userId: record.userId,
      status: this.statusLabel(record.status),
      method: record.method ? this.methodLabel(record.method) : null,
      documentType: record.documentType,
      dateOfBirth: record.dateOfBirth
        ? record.dateOfBirth.toISOString().slice(0, 10)
        : null,
      verifiedAt: record.verifiedAt ? record.verifiedAt.toISOString() : null,
      reviewedBy: record.reviewedBy,
      reviewNotes: record.reviewNotes,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private statusLabel(
    status: AgeVerificationStatus,
  ): AgeVerificationStatusView['status'] {
    return status.toLowerCase() as AgeVerificationStatusView['status'];
  }

  private methodLabel(method: AgeVerificationMethod): string {
    return method.toLowerCase();
  }

  private assertSelf(actorId: string, userId: string): void {
    if (actorId !== userId) {
      throw new ForbiddenException(
        'Cannot manage another user age verification',
      );
    }
  }
}
