import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OptionalAuthGuard } from '../../identity/guards/optional-auth.guard';
import { OptionalCurrentAuth } from '../../identity/decorators/optional-current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { MerchantListQueryDto } from '../dto/merchants.dto';
import { MerchantDiscoveryService } from '../use-cases/merchant-discovery.service';

/** Public "browse all merchants" surface, spanning every commerce vertical. */
@ApiTags('Merchants')
@UseGuards(OptionalAuthGuard)
@Controller({ path: 'merchants', version: '1' })
export class MerchantsController {
  public constructor(private readonly discovery: MerchantDiscoveryService) {}

  @Get()
  @HttpCode(200)
  public list(
    @Query() query: MerchantListQueryDto,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    return this.discovery.list(query, principal?.id);
  }

  @Get('feed')
  @HttpCode(200)
  public feed(
    @Query() query: MerchantListQueryDto,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    return this.discovery.feed(query, principal?.id);
  }

  @Get('featured')
  @HttpCode(200)
  public featured(
    @Query() query: MerchantListQueryDto,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    return this.discovery.featured(query, principal?.id);
  }

  @Get('near')
  @HttpCode(200)
  public near(
    @Query() query: MerchantListQueryDto,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    return this.discovery.near(query, principal?.id);
  }

  @Get('categories')
  @HttpCode(200)
  public categories() {
    return this.discovery.categories();
  }

  @Get(':id')
  @HttpCode(200)
  public async get(
    @Param('id', ParseUUIDPipe) id: string,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    const merchant = await this.discovery.getById(id, principal?.id);
    if (!merchant) throw new NotFoundException('Merchant not found');
    return { success: true as const, merchant };
  }
}
