import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { RequirePermission } from '../../authorization/decorators/require-permission.decorator';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import {
  CreateDeliveryConstraintDto,
  CreateDeliveryPricingRuleDto,
  UpdateDeliveryConstraintDto,
  UpdateDeliveryPricingRuleDto,
} from '../dto/logistics.dto';
import { AdminPricingService } from '../use-cases/admin-pricing.service';

@ApiTags('Admin Logistics')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin', version: '1' })
export class AdminLogisticsController {
  public constructor(private readonly pricing: AdminPricingService) {}

  @Get('delivery-pricing-rules')
  @RequirePermission('read', 'logistics')
  public listRules() {
    return this.pricing.listRules();
  }

  @Post('delivery-pricing-rules')
  @RequirePermission('manage', 'logistics')
  public createRule(@Body() body: CreateDeliveryPricingRuleDto) {
    return this.pricing.createRule(body);
  }

  @Patch('delivery-pricing-rules/:id')
  @RequirePermission('manage', 'logistics')
  public updateRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDeliveryPricingRuleDto,
  ) {
    return this.pricing.updateRule(id, body);
  }

  @Get('delivery-constraints')
  @RequirePermission('read', 'logistics')
  public listConstraints() {
    return this.pricing.listConstraints();
  }

  @Post('delivery-constraints')
  @RequirePermission('manage', 'logistics')
  public createConstraint(@Body() body: CreateDeliveryConstraintDto) {
    return this.pricing.createConstraint(body);
  }

  @Patch('delivery-constraints/:id')
  @RequirePermission('manage', 'logistics')
  public updateConstraint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDeliveryConstraintDto,
  ) {
    return this.pricing.updateConstraint(id, body);
  }
}
