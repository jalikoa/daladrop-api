import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ActorType } from '@prisma/client';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { RequirePermission } from '../../authorization/decorators/require-permission.decorator';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { ProofOfDeliveryService } from '../use-cases/proof-of-delivery.service';

export class SubmitPodDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  rideId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  photoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  signatureUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  recipientName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(12)
  otpCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}

@ApiTags('Proof of Delivery')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'pod', version: '1' })
export class ProofOfDeliveryController {
  public constructor(private readonly pod: ProofOfDeliveryService) {}

  @Post()
  public submit(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: SubmitPodDto,
  ) {
    return this.pod.submit({
      ...body,
      actorId: principal.id,
      actorType: ActorType.USER,
    });
  }

  @Get('orders/:orderId')
  public getOrder(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    const isAdmin = principal.roles.includes('ADMIN') || principal.roles.includes('SUPPORT');
    return this.pod.getForOrder(orderId, principal.id, isAdmin);
  }

  @Get('rides/:rideId')
  public getRide(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('rideId', ParseUUIDPipe) rideId: string,
  ) {
    const isAdmin = principal.roles.includes('ADMIN') || principal.roles.includes('SUPPORT');
    return this.pod.getForRide(rideId, principal.id, isAdmin);
  }
}

@ApiTags('Admin POD')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin/pod', version: '1' })
export class AdminProofOfDeliveryController {
  public constructor(private readonly pod: ProofOfDeliveryService) {}

  @Post()
  @RequirePermission('manage', 'pod')
  public submit(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: SubmitPodDto,
  ) {
    return this.pod.submit({
      ...body,
      actorId: principal.id,
      actorType: ActorType.ADMIN,
    });
  }

  @Get('orders/:orderId')
  @RequirePermission('read', 'pod')
  public getOrder(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.pod.getForOrder(orderId, principal.id, true);
  }

  @Get('rides/:rideId')
  @RequirePermission('read', 'pod')
  public getRide(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('rideId', ParseUUIDPipe) rideId: string,
  ) {
    return this.pod.getForRide(rideId, principal.id, true);
  }
}
