import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ModuleOrderStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { MerchantOrdersService } from '../use-cases/merchant-orders.service';

class MerchantOrdersQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ enum: ModuleOrderStatus })
  @IsOptional()
  @IsEnum(ModuleOrderStatus)
  status?: ModuleOrderStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

class MerchantOrderStatusDto {
  @IsEnum(ModuleOrderStatus)
  status!: ModuleOrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  podPhotoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  podSignatureUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  recipientName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  podNotes?: string;

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

@ApiTags('Merchant Orders')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'merchant/orders', version: '1' })
export class MerchantOrdersController {
  public constructor(private readonly orders: MerchantOrdersService) {}

  @Get()
  public list(
    @CurrentAuth() principal: AuthPrincipalView,
    @Query() query: MerchantOrdersQueryDto,
  ) {
    return this.orders.listMine(principal.id, query);
  }

  @Get(':id')
  public get(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.getMine(principal.id, id);
  }

  @Patch(':id/status')
  public updateStatus(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MerchantOrderStatusDto,
  ) {
    return this.orders.updateStatus(principal.id, id, body.status, body.reason, {
      photoUrl: body.podPhotoUrl,
      signatureUrl: body.podSignatureUrl,
      recipientName: body.recipientName,
      notes: body.podNotes,
      otpCode: body.otpCode,
      latitude: body.latitude,
      longitude: body.longitude,
    });
  }

  /** Legacy vendor dashboard alias. */
  @Post(':id/ready')
  public ready(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.markReady(principal.id, id);
  }
}
