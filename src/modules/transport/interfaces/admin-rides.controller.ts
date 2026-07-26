import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActorType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { RequirePermission } from '../../authorization/decorators/require-permission.decorator';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { toRideSummaryView } from '../domain/ride-view';
import {
  AdminListRidesQueryDto,
  AssignRiderDto,
  CancelRideDto,
  UpdateRideStatusDto,
} from '../dto/transport.dto';
import { RideDispatchService } from '../use-cases/ride-dispatch.service';
import { RidesService } from '../use-cases/rides.service';

/** `/v1/admin/rides/*` — ops console (Phase 13/14). */
@ApiTags('Admin Rides')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin/rides', version: '1' })
export class AdminRidesController {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly dispatch: RideDispatchService,
    private readonly rides: RidesService,
  ) {}

  @Get()
  @RequirePermission('read', 'rides')
  public async list(@Query() query: AdminListRidesQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: Prisma.RideWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.serviceType) where.serviceType = query.serviceType;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.ride.count({ where }),
      this.prisma.ride.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      success: true as const,
      items: rows.map(toRideSummaryView),
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  @Get(':id')
  @RequirePermission('read', 'rides')
  public get(@Param('id', ParseUUIDPipe) id: string) {
    return this.rides.getRideAdmin(id);
  }

  @Post(':id/assign')
  @RequirePermission('manage', 'rides')
  public async assign(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignRiderDto,
  ) {
    const rideView = await this.dispatch.assignRider(
      id,
      body.riderId,
      principal.id,
      ActorType.ADMIN,
    );
    return { success: true as const, ride: rideView };
  }

  @Post(':id/status')
  @RequirePermission('manage', 'rides')
  public async updateStatus(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRideStatusDto,
  ) {
    const rideView = await this.dispatch.updateStatus(
      id,
      body.status,
      { actorId: principal.id, actorType: ActorType.ADMIN, role: 'ADMIN' },
      body.reason,
      {
        podPhotoUrl: body.podPhotoUrl,
        podSignatureUrl: body.podSignatureUrl,
        podNotes: body.podNotes,
      },
    );
    return { success: true as const, ride: rideView };
  }

  @Post(':id/cancel')
  @RequirePermission('manage', 'rides')
  public async cancel(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelRideDto,
  ) {
    const rideView = await this.dispatch.updateStatus(
      id,
      'CANCELLED',
      { actorId: principal.id, actorType: ActorType.ADMIN, role: 'ADMIN' },
      body?.reason ?? 'Cancelled by admin',
    );
    return { success: true as const, ride: rideView };
  }
}
