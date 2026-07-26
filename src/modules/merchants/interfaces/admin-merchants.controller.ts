import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { RequirePermission } from '../../authorization/decorators/require-permission.decorator';
import {
  AdminListQueryDto,
  CreateMerchantDto,
  ReviewMerchantKycDto,
  SubmitMerchantKycDto,
  UpdateMerchantDto,
} from '../dto/merchants.dto';
import { AdminMerchantsService } from '../use-cases/admin-merchants.service';
import { MerchantKycService } from '../use-cases/merchant-kyc.service';

@ApiTags('Admin Merchants')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin/merchants', version: '1' })
export class AdminMerchantsController {
  public constructor(
    private readonly merchants: AdminMerchantsService,
    private readonly kyc: MerchantKycService,
  ) {}

  @Get()
  @RequirePermission('read', 'merchants')
  public list(@Query() query: AdminListQueryDto) {
    return this.merchants.list({
      q: query.q,
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('kyc/pending')
  @RequirePermission('read', 'merchants')
  public listPendingKyc(@Query() query: AdminListQueryDto) {
    return this.kyc.listPending({
      page: query.page,
      limit: query.limit,
    });
  }

  @Get(':id')
  @RequirePermission('read', 'merchants')
  public get(@Param('id', ParseUUIDPipe) id: string) {
    return this.merchants.get(id);
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('manage', 'merchants')
  public create(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: CreateMerchantDto,
  ) {
    return this.merchants.create(body, principal.id);
  }

  @Put(':id')
  @HttpCode(200)
  @RequirePermission('manage', 'merchants')
  public update(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateMerchantDto,
  ) {
    return this.merchants.update(id, body, principal.id);
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission('manage', 'merchants')
  public softDelete(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.merchants.softDelete(id, principal.id);
  }

  @Get(':id/kyc')
  @RequirePermission('read', 'merchants')
  public getKyc(@Param('id', ParseUUIDPipe) id: string) {
    return this.kyc.get(id);
  }

  @Put(':id/kyc')
  @HttpCode(200)
  @RequirePermission('manage', 'merchants')
  public upsertKyc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SubmitMerchantKycDto,
  ) {
    return this.kyc.upsertDraft(id, body);
  }

  @Post(':id/kyc/submit')
  @HttpCode(200)
  @RequirePermission('manage', 'merchants')
  public submitKyc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SubmitMerchantKycDto,
  ) {
    return this.kyc.submit(id, body);
  }

  @Post(':id/kyc/review')
  @HttpCode(200)
  @RequirePermission('kyc', 'merchants')
  public reviewKyc(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewMerchantKycDto,
  ) {
    return this.kyc.review(id, body, principal.id);
  }
}
