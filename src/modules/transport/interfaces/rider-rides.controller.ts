import {
  Body,
  Controller,
  ConflictException,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActorType, Prisma, RideStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { toRideSummaryView } from '../domain/ride-view';
import { RiderRidesQueryDto, UpdateRideStatusDto } from '../dto/transport.dto';
import { RideDispatchService } from '../use-cases/ride-dispatch.service';

const ACTIVE_RIDER_STATUSES: RideStatus[] = [
  RideStatus.ASSIGNED,
  RideStatus.ARRIVING,
  RideStatus.IN_PROGRESS,
];

/** `/v1/rider/rides/*` — rider-facing assignment + status updates (Phase 13/14). */
@ApiTags('Rider Rides')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'rider/rides', version: '1' })
export class RiderRidesController {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly dispatch: RideDispatchService,
  ) {}

  @Get()
  public async list(
    @CurrentAuth() principal: AuthPrincipalView,
    @Query() query: RiderRidesQueryDto,
  ) {
    const riderId = await this.resolveRiderId(principal.id);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where: Prisma.RideWhereInput = {
      deletedAt: null,
      OR: [
        { riderId, status: { in: ACTIVE_RIDER_STATUSES } },
        { status: RideStatus.SEARCHING, riderId: null },
      ],
    };

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

  @Post(':id/accept')
  public async accept(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const riderId = await this.resolveRiderId(principal.id);
    const ride = await this.prisma.ride.findFirst({
      where: { id, deletedAt: null },
    });
    if (!ride) throw new NotFoundException('Ride not found');
    if (ride.status !== RideStatus.SEARCHING) {
      throw new ConflictException(
        `Ride cannot be accepted while ${ride.status}`,
      );
    }
    if (ride.riderId && ride.riderId !== riderId) {
      throw new ForbiddenException('Ride is already assigned to another rider');
    }

    const rideView = await this.dispatch.assignRider(
      id,
      riderId,
      principal.id,
      ActorType.USER,
    );
    return { success: true as const, ride: rideView };
  }

  @Post(':id/status')
  public async updateStatus(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRideStatusDto,
  ) {
    const riderId = await this.resolveRiderId(principal.id);
    await this.requireAssignedRide(id, riderId);

    const rideView = await this.dispatch.updateStatus(
      id,
      body.status,
      { actorId: principal.id, actorType: ActorType.USER, role: 'RIDER' },
      body.reason,
      {
        podPhotoUrl: body.podPhotoUrl,
        podSignatureUrl: body.podSignatureUrl,
        podNotes: body.podNotes,
      },
    );
    return { success: true as const, ride: rideView };
  }

  private async requireAssignedRide(rideId: string, riderId: string) {
    const ride = await this.prisma.ride.findFirst({
      where: { id: rideId, deletedAt: null },
    });
    if (!ride) throw new NotFoundException('Ride not found');
    if (ride.riderId !== riderId) {
      throw new ForbiddenException('Ride is not assigned to this rider');
    }
    return ride;
  }

  private async resolveRiderId(userId: string): Promise<string> {
    const rider = await this.prisma.rider.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    if (!rider) {
      throw new NotFoundException('No rider linked to this account');
    }
    return rider.id;
  }
}
