import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { kes, kesToBigInt } from '../../../shared/money';
import type {
  UpsertCourierPartnerDto,
  UpsertInterCountyRouteDto,
} from '../dto/transport.dto';

@Injectable()
export class TransportCatalogService {
  public constructor(private readonly prisma: PrismaService) {}

  public async courierPartners() {
    const rows = await this.prisma.courierPartner.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    const items = rows.map((row) => ({
      id: row.id,
      name: row.name,
      brandUrl: row.brandUrl,
    }));
    return { success: true as const, items, partners: items };
  }

  public async interCountyRoutes() {
    const rows = await this.prisma.interCountyRoute.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { label: 'asc' },
    });
    const items = rows.map((row) => ({
      id: row.id,
      label: row.label,
      quotedFare: Number(row.quotedFareAmount),
      price: Number(row.quotedFareAmount),
      currency: row.currency,
      defaultPickup: row.defaultPickup,
      defaultDropoff: row.defaultDropoff,
    }));
    return { success: true as const, items, routes: items };
  }

  public async adminListPartners() {
    const rows = await this.prisma.courierPartner.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return {
      success: true as const,
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        brandUrl: row.brandUrl,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    };
  }

  public async createPartner(input: UpsertCourierPartnerDto) {
    const row = await this.prisma.courierPartner.create({
      data: {
        name: input.name.trim(),
        brandUrl: input.brandUrl?.trim() || null,
        isActive: input.isActive ?? true,
      },
    });
    return { success: true as const, partner: row };
  }

  public async updatePartner(id: string, input: UpsertCourierPartnerDto) {
    await this.requirePartner(id);
    const row = await this.prisma.courierPartner.update({
      where: { id },
      data: {
        name: input.name.trim(),
        brandUrl: input.brandUrl?.trim() || null,
        isActive: input.isActive ?? true,
      },
    });
    return { success: true as const, partner: row };
  }

  public async softDeletePartner(id: string) {
    await this.requirePartner(id);
    await this.prisma.courierPartner.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { success: true as const };
  }

  public async adminListRoutes() {
    const rows = await this.prisma.interCountyRoute.findMany({
      where: { deletedAt: null },
      orderBy: { label: 'asc' },
    });
    return {
      success: true as const,
      items: rows.map((row) => ({
        id: row.id,
        label: row.label,
        quotedFare: Number(row.quotedFareAmount),
        currency: row.currency,
        defaultPickup: row.defaultPickup,
        defaultDropoff: row.defaultDropoff,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    };
  }

  public async createRoute(input: UpsertInterCountyRouteDto) {
    if (!Number.isFinite(input.quotedFare) || input.quotedFare < 0) {
      throw new BadRequestException('quotedFare must be a non-negative number');
    }
    const row = await this.prisma.interCountyRoute.create({
      data: {
        label: input.label.trim(),
        quotedFareAmount: kesToBigInt(kes(Math.round(input.quotedFare))),
        currency: (input.currency ?? 'KES').toUpperCase(),
        defaultPickup: input.defaultPickup?.trim() || null,
        defaultDropoff: input.defaultDropoff?.trim() || null,
        isActive: input.isActive ?? true,
      },
    });
    return { success: true as const, route: row };
  }

  public async updateRoute(id: string, input: UpsertInterCountyRouteDto) {
    await this.requireRoute(id);
    if (!Number.isFinite(input.quotedFare) || input.quotedFare < 0) {
      throw new BadRequestException('quotedFare must be a non-negative number');
    }
    const row = await this.prisma.interCountyRoute.update({
      where: { id },
      data: {
        label: input.label.trim(),
        quotedFareAmount: kesToBigInt(kes(Math.round(input.quotedFare))),
        currency: (input.currency ?? 'KES').toUpperCase(),
        defaultPickup: input.defaultPickup?.trim() || null,
        defaultDropoff: input.defaultDropoff?.trim() || null,
        isActive: input.isActive ?? true,
      },
    });
    return { success: true as const, route: row };
  }

  public async softDeleteRoute(id: string) {
    await this.requireRoute(id);
    await this.prisma.interCountyRoute.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { success: true as const };
  }

  private async requirePartner(id: string) {
    const row = await this.prisma.courierPartner.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Courier partner not found');
    return row;
  }

  private async requireRoute(id: string) {
    const row = await this.prisma.interCountyRoute.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Inter-county route not found');
    return row;
  }
}
