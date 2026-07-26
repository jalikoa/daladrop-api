import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeatureFlagStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';

export interface UpsertFeatureFlagInput {
  readonly key: string;
  readonly status?: FeatureFlagStatus;
  readonly percentage?: number | null;
  readonly description?: string | null;
  readonly payload?: Record<string, unknown> | null;
}

@Injectable()
export class FeatureFlagsService {
  public constructor(private readonly prisma: PrismaService) {}

  public async list() {
    const rows = await this.prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });
    return {
      success: true as const,
      items: rows.map((row) => this.toView(row)),
    };
  }

  public async get(key: string) {
    const row = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!row) throw new NotFoundException('Feature flag not found');
    return { success: true as const, flag: this.toView(row) };
  }

  public async upsert(input: UpsertFeatureFlagInput) {
    const key = input.key.trim();
    if (!key) throw new BadRequestException('key is required');
    if (
      input.percentage != null &&
      (input.percentage < 0 || input.percentage > 100)
    ) {
      throw new BadRequestException('percentage must be 0–100');
    }
    const row = await this.prisma.featureFlag.upsert({
      where: { key },
      create: {
        key,
        status: input.status ?? FeatureFlagStatus.DISABLED,
        percentage: input.percentage ?? null,
        description: input.description ?? null,
        payload:
          input.payload === undefined || input.payload === null
            ? undefined
            : (input.payload as Prisma.InputJsonValue),
      },
      update: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.percentage !== undefined
          ? { percentage: input.percentage }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.payload !== undefined
          ? {
              payload:
                input.payload === null
                  ? Prisma.JsonNull
                  : (input.payload as Prisma.InputJsonValue),
            }
          : {}),
      },
    });
    return { success: true as const, flag: this.toView(row) };
  }

  public async remove(key: string) {
    const existing = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!existing) throw new NotFoundException('Feature flag not found');
    await this.prisma.featureFlag.delete({ where: { key } });
    return { success: true as const };
  }

  private toView(row: {
    id: string;
    key: string;
    status: FeatureFlagStatus;
    percentage: number | null;
    description: string | null;
    payload: unknown;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      key: row.key,
      status: row.status,
      percentage: row.percentage,
      description: row.description,
      payload: row.payload,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
