import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AuthTokenGuard } from '../identity/guards/auth-token.guard';
import { CurrentAuth } from '../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../identity/domain/auth.contracts';
import {
  RuntimeConfigService,
  type RuntimeConfigSnapshot,
} from './config.service';

@ApiTags('Config')
@Controller('config')
export class RuntimeConfigController {
  public constructor(private readonly configService: RuntimeConfigService) {}

  @Public()
  @Get('public')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Public non-secret runtime configuration',
  })
  public getPublic(): RuntimeConfigSnapshot {
    return this.configService.getPublicSnapshot();
  }

  @ApiBearerAuth()
  @UseGuards(AuthTokenGuard)
  @Get('masked')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Operator snapshot with secrets masked (admin/support only)',
  })
  public getMasked(
    @CurrentAuth() principal: AuthPrincipalView,
  ): Readonly<Record<string, unknown>> {
    const allowed = principal.roles.some((role) =>
      ['ADMIN', 'SUPPORT', 'FINANCE', 'SYSTEM'].includes(role),
    );
    if (!allowed) {
      throw new ForbiddenException('Operator role required');
    }
    return this.configService.getMaskedInternalSnapshot();
  }
}
