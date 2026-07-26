import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';

/** Announcements reuse MaintenanceWindow as the published banner surface. */
@Injectable()
export class AnnouncementsService {
  public constructor(private readonly prisma: PrismaService) {}

  public async listPublic() {
    const now = new Date();
    const rows = await this.prisma.maintenanceWindow.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: { startsAt: 'desc' },
    });
    return {
      success: true as const,
      items: rows.map((row) => this.toView(row)),
      announcements: rows.map((row) => this.toView(row)),
    };
  }

  public async adminList() {
    const rows = await this.prisma.maintenanceWindow.findMany({
      orderBy: { startsAt: 'desc' },
      take: 100,
    });
    return {
      success: true as const,
      items: rows.map((row) => this.toView(row)),
    };
  }

  public async create(input: {
    readonly title: string;
    readonly message?: string;
    readonly startsAt: string;
    readonly endsAt: string;
    readonly isActive?: boolean;
  }) {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('startsAt and endsAt must be ISO dates');
    }
    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
    const row = await this.prisma.maintenanceWindow.create({
      data: {
        title: input.title.trim(),
        message: input.message?.trim() || null,
        startsAt,
        endsAt,
        isActive: input.isActive ?? true,
      },
    });
    return { success: true as const, announcement: this.toView(row) };
  }

  public async update(
    id: string,
    input: {
      readonly title?: string;
      readonly message?: string | null;
      readonly startsAt?: string;
      readonly endsAt?: string;
      readonly isActive?: boolean;
    },
  ) {
    await this.require(id);
    const row = await this.prisma.maintenanceWindow.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.message !== undefined
          ? { message: input.message?.trim() || null }
          : {}),
        ...(input.startsAt !== undefined
          ? { startsAt: new Date(input.startsAt) }
          : {}),
        ...(input.endsAt !== undefined ? { endsAt: new Date(input.endsAt) } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    return { success: true as const, announcement: this.toView(row) };
  }

  public async remove(id: string) {
    await this.require(id);
    await this.prisma.maintenanceWindow.delete({ where: { id } });
    return { success: true as const };
  }

  private async require(id: string) {
    const row = await this.prisma.maintenanceWindow.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Announcement not found');
    return row;
  }

  private toView(row: {
    id: string;
    title: string;
    message: string | null;
    startsAt: Date;
    endsAt: Date;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      title: row.title,
      message: row.message,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
