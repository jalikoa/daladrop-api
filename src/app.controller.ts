import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Root')
@Controller({ path: '', version: VERSION_NEUTRAL })
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Root endpoint — API metadata and operational status.
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'API root metadata' })
  getApiInfo() {
    return this.appService.getApiInfo();
  }
}
