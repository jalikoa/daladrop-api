import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigPricingService } from '../use-cases/config-pricing.service';

@ApiTags('Config')
@Controller({ path: 'config', version: '1' })
export class ConfigPricingController {
  public constructor(private readonly pricing: ConfigPricingService) {}

  @Get('pricing')
  public getPricing() {
    return this.pricing.getCustomerPricing();
  }
}
