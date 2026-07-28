import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActorType,
  AuditAction,
  EventStatus,
  Prisma,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../operations/use-cases/audit-log.service';
import type {
  CreateEventDto,
  EventCategoryDto,
  EventTicketTypeDto,
  UpdateEventCategoryDto,
  UpdateEventDto,
  UpdateEventTicketTypeDto,
} from '../dto/events.dto';

@Injectable()
export class AdminEventsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly events: EventEmitter2,
  ) {}

  // -------------------------------------------------------------------------
  // Event categories
  // -------------------------------------------------------------------------

  public listCategories() {
    return this.prisma.eventCategory.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  public async createCategory(actorId: string, input: EventCategoryDto) {
    const slug = this.slugify(input.slug ?? input.name);
    await this.ensureCategorySlugAvailable(slug);
    const category = await this.prisma.eventCategory.create({
      data: {
        name: input.name.trim(),
        slug,
        iconKey: input.iconKey,
        imageUrl: input.imageUrl,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
      },
    });
    await this.emitMutation(
      actorId,
      'event_categories',
      category.id,
      AuditAction.INSERT,
      'events.category.created',
    );
    return category;
  }

  public async updateCategory(
    actorId: string,
    id: string,
    input: UpdateEventCategoryDto,
  ) {
    const category = await this.findCategory(id);
    const slug =
      input.slug !== undefined
        ? this.slugify(input.slug)
        : input.name !== undefined
          ? this.slugify(input.name)
          : undefined;
    if (slug && slug !== category.slug) {
      await this.ensureCategorySlugAvailable(slug, id);
    }
    const updated = await this.prisma.eventCategory.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(input.iconKey !== undefined ? { iconKey: input.iconKey } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.sortOrder !== undefined
          ? { sortOrder: input.sortOrder }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    await this.emitMutation(
      actorId,
      'event_categories',
      updated.id,
      AuditAction.UPDATE,
      'events.category.updated',
    );
    return updated;
  }

  public async deleteCategory(actorId: string, id: string) {
    await this.findCategory(id);
    const deleted = await this.prisma.eventCategory.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.emitMutation(
      actorId,
      'event_categories',
      deleted.id,
      AuditAction.SOFT_DELETE,
      'events.category.deleted',
    );
    return { success: true as const };
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  public async listEvents(status?: string) {
    const normalized = this.parseStatus(status);
    const rows = await this.prisma.event.findMany({
      where: {
        deletedAt: null,
        ...(normalized ? { status: normalized } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { category: true, ticketTypes: true },
    });
    return rows.map((row) => this.serializeEvent(row));
  }

  public async getEvent(id: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, deletedAt: null },
      include: { category: true, ticketTypes: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    return this.serializeEvent(event);
  }

  public async createEvent(actorId: string, input: CreateEventDto) {
    await this.ensureMerchantExists(input.merchantId);
    const event = await this.prisma.event.create({
      data: {
        merchantId: input.merchantId,
        organizerId: input.organizerId ?? null,
        categoryId: input.categoryId ?? null,
        name: input.name.trim(),
        description: input.description,
        venue: input.venue,
        address: input.address,
        city: input.city,
        bannerUrl: input.bannerUrl,
        coverImageUrl: input.coverImageUrl,
        gallery: input.gallery ?? [],
        startAt: new Date(input.startAt),
        endAt: input.endAt ? new Date(input.endAt) : null,
        latitude:
          input.latitude !== undefined
            ? new Prisma.Decimal(input.latitude)
            : null,
        longitude:
          input.longitude !== undefined
            ? new Prisma.Decimal(input.longitude)
            : null,
        isFeatured: input.isFeatured ?? false,
        status: EventStatus.DRAFT,
      },
    });
    await this.emitMutation(
      actorId,
      'events',
      event.id,
      AuditAction.INSERT,
      'events.event.created',
    );
    return this.getEvent(event.id);
  }

  public async updateEvent(
    actorId: string,
    id: string,
    input: UpdateEventDto,
  ) {
    await this.getEvent(id);
    if (input.merchantId) await this.ensureMerchantExists(input.merchantId);
    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        ...(input.merchantId !== undefined
          ? { merchantId: input.merchantId }
          : {}),
        ...(input.organizerId !== undefined
          ? { organizerId: input.organizerId }
          : {}),
        ...(input.categoryId !== undefined
          ? { categoryId: input.categoryId }
          : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.venue !== undefined ? { venue: input.venue } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.bannerUrl !== undefined
          ? { bannerUrl: input.bannerUrl }
          : {}),
        ...(input.coverImageUrl !== undefined
          ? { coverImageUrl: input.coverImageUrl }
          : {}),
        ...(input.gallery !== undefined ? { gallery: input.gallery } : {}),
        ...(input.startAt !== undefined
          ? { startAt: new Date(input.startAt) }
          : {}),
        ...(input.endAt !== undefined
          ? { endAt: input.endAt ? new Date(input.endAt) : null }
          : {}),
        ...(input.latitude !== undefined
          ? { latitude: new Prisma.Decimal(input.latitude) }
          : {}),
        ...(input.longitude !== undefined
          ? { longitude: new Prisma.Decimal(input.longitude) }
          : {}),
        ...(input.isFeatured !== undefined
          ? { isFeatured: input.isFeatured }
          : {}),
      },
    });
    await this.emitMutation(
      actorId,
      'events',
      updated.id,
      AuditAction.UPDATE,
      'events.event.updated',
    );
    return this.getEvent(id);
  }

  public async publishEvent(actorId: string, id: string) {
    await this.getEvent(id);
    await this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.PUBLISHED },
    });
    await this.emitMutation(
      actorId,
      'events',
      id,
      AuditAction.STATUS_CHANGE,
      'events.event.published',
    );
    return this.getEvent(id);
  }

  public async deleteEvent(actorId: string, id: string) {
    await this.getEvent(id);
    const deleted = await this.prisma.event.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: actorId,
        status: EventStatus.ARCHIVED,
      },
    });
    await this.emitMutation(
      actorId,
      'events',
      deleted.id,
      AuditAction.SOFT_DELETE,
      'events.event.deleted',
    );
    return { success: true as const };
  }

  // -------------------------------------------------------------------------
  // Ticket types
  // -------------------------------------------------------------------------

  public async listTicketTypes(eventId: string) {
    await this.getEvent(eventId);
    const rows = await this.prisma.eventTicketType.findMany({
      where: { eventId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.serializeTicketType(row));
  }

  public async createTicketType(
    actorId: string,
    eventId: string,
    input: EventTicketTypeDto,
  ) {
    await this.getEvent(eventId);
    const ticketType = await this.prisma.eventTicketType.create({
      data: {
        eventId,
        productId: input.productId ?? null,
        name: input.name.trim(),
        priceAmount: BigInt(input.priceAmount),
        currency: input.currency ?? 'KES',
        totalQty: input.totalQty,
        isActive: input.isActive ?? true,
      },
    });
    await this.emitMutation(
      actorId,
      'event_ticket_types',
      ticketType.id,
      AuditAction.INSERT,
      'events.ticket_type.created',
    );
    return this.serializeTicketType(ticketType);
  }

  public async updateTicketType(
    actorId: string,
    eventId: string,
    ticketTypeId: string,
    input: UpdateEventTicketTypeDto,
  ) {
    await this.findTicketType(eventId, ticketTypeId);
    const updated = await this.prisma.eventTicketType.update({
      where: { id: ticketTypeId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.productId !== undefined
          ? { productId: input.productId }
          : {}),
        ...(input.priceAmount !== undefined
          ? { priceAmount: BigInt(input.priceAmount) }
          : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.totalQty !== undefined ? { totalQty: input.totalQty } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    await this.emitMutation(
      actorId,
      'event_ticket_types',
      updated.id,
      AuditAction.UPDATE,
      'events.ticket_type.updated',
    );
    return this.serializeTicketType(updated);
  }

  public async deleteTicketType(
    actorId: string,
    eventId: string,
    ticketTypeId: string,
  ) {
    await this.findTicketType(eventId, ticketTypeId);
    const deleted = await this.prisma.eventTicketType.update({
      where: { id: ticketTypeId },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.emitMutation(
      actorId,
      'event_ticket_types',
      deleted.id,
      AuditAction.SOFT_DELETE,
      'events.ticket_type.deleted',
    );
    return { success: true as const };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async findCategory(id: string) {
    const category = await this.prisma.eventCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!category) throw new NotFoundException('Event category not found');
    return category;
  }

  private async findTicketType(eventId: string, ticketTypeId: string) {
    const ticketType = await this.prisma.eventTicketType.findFirst({
      where: { id: ticketTypeId, eventId, deletedAt: null },
    });
    if (!ticketType) throw new NotFoundException('Ticket type not found');
    return ticketType;
  }

  private async ensureMerchantExists(merchantId: string) {
    const merchant = await this.prisma.merchant.findFirst({
      where: { id: merchantId, deletedAt: null },
      select: { id: true },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
  }

  private async ensureCategorySlugAvailable(slug: string, excludeId?: string) {
    const existing = await this.prisma.eventCategory.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Event category slug already exists');
    }
  }

  private slugify(value: string): string {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) throw new ConflictException('A valid category slug is required');
    return slug;
  }

  private parseStatus(status?: string): EventStatus | undefined {
    if (!status) return undefined;
    const upper = status.toUpperCase();
    return (EventStatus as Record<string, EventStatus>)[upper];
  }

  private serializeEvent<
    T extends {
      ticketTypes?: Array<{
        id: string;
        eventId: string;
        productId: string | null;
        name: string;
        priceAmount: bigint;
        currency: string;
        totalQty: number;
        soldQty: number;
        isActive: boolean;
      }>;
      latitude?: { toNumber?: () => number } | number | null;
      longitude?: { toNumber?: () => number } | number | null;
      ratingAvg?: { toNumber?: () => number } | number;
    },
  >(event: T) {
    const latitude =
      event.latitude != null && typeof event.latitude === 'object'
        ? Number(event.latitude.toNumber?.() ?? event.latitude)
        : event.latitude ?? null;
    const longitude =
      event.longitude != null && typeof event.longitude === 'object'
        ? Number(event.longitude.toNumber?.() ?? event.longitude)
        : event.longitude ?? null;
    const ratingAvg =
      event.ratingAvg != null && typeof event.ratingAvg === 'object'
        ? Number(event.ratingAvg.toNumber?.() ?? event.ratingAvg)
        : event.ratingAvg;
    return {
      ...event,
      latitude,
      longitude,
      ratingAvg,
      ticketTypes: (event.ticketTypes ?? []).map((t) =>
        this.serializeTicketType(t),
      ),
    };
  }

  private serializeTicketType(ticketType: {
    id: string;
    eventId: string;
    productId: string | null;
    name: string;
    priceAmount: bigint;
    currency: string;
    totalQty: number;
    soldQty: number;
    isActive: boolean;
  }) {
    return {
      id: ticketType.id,
      eventId: ticketType.eventId,
      productId: ticketType.productId,
      name: ticketType.name,
      priceAmount: Number(ticketType.priceAmount),
      currency: ticketType.currency,
      totalQty: ticketType.totalQty,
      soldQty: ticketType.soldQty,
      availableQty: Math.max(0, ticketType.totalQty - ticketType.soldQty),
      isActive: ticketType.isActive,
    };
  }

  private async emitMutation(
    actorId: string,
    tableName: string,
    recordId: string,
    action: AuditAction,
    eventName: string,
  ): Promise<void> {
    await this.audit.record({
      tableName,
      recordId,
      action,
      actorId,
      actorType: ActorType.ADMIN,
      reason: eventName,
    });
    this.events.emit(eventName, { id: recordId, actorId });
  }
}
