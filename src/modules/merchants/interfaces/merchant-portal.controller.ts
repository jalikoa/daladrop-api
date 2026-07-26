import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import {
  ReplaceOpeningHoursDto,
  SubmitMerchantKycDto,
  UpdateStoreDto,
} from '../dto/merchants.dto';
import { MerchantPortalService } from '../use-cases/merchant-portal.service';

@ApiTags('Merchant Portal')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'merchant', version: '1' })
export class MerchantPortalController {
  public constructor(private readonly portal: MerchantPortalService) {}

  @Get('stores')
  public listStores(@CurrentAuth() principal: AuthPrincipalView) {
    return this.portal.listStores(principal.id);
  }

  @Get('stores/:id')
  public getStore(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portal.getStore(principal.id, id);
  }

  @Put('stores/:id')
  @HttpCode(200)
  public updateStore(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStoreDto,
  ) {
    return this.portal.updateStore(principal.id, id, body);
  }

  @Put('stores/:id/opening-hours')
  @HttpCode(200)
  public replaceOpeningHours(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReplaceOpeningHoursDto,
  ) {
    return this.portal.replaceOpeningHours(principal.id, id, body);
  }

  @Get('kyc')
  public getKyc(@CurrentAuth() principal: AuthPrincipalView) {
    return this.portal.getKyc(principal.id);
  }

  @Put('kyc')
  @HttpCode(200)
  public upsertKyc(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: SubmitMerchantKycDto,
  ) {
    return this.portal.upsertKyc(principal.id, body);
  }

  @Post('kyc/submit')
  @HttpCode(200)
  public submitKyc(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: SubmitMerchantKycDto,
  ) {
    return this.portal.submitKyc(principal.id, body);
  }
}
