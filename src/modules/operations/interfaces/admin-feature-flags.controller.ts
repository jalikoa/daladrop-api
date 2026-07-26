import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { RequirePermission } from '../../authorization/decorators/require-permission.decorator';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { UpsertFeatureFlagDto } from '../dto/operations.dto';
import { FeatureFlagsService } from '../use-cases/feature-flags.service';

@ApiTags('Admin Feature Flags')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin/feature-flags', version: '1' })
export class AdminFeatureFlagsController {
  public constructor(private readonly flags: FeatureFlagsService) {}

  @Get()
  @RequirePermission('read', 'ops')
  public list() {
    return this.flags.list();
  }

  @Get(':key')
  @RequirePermission('read', 'ops')
  public get(@Param('key') key: string) {
    return this.flags.get(key);
  }

  @Put()
  @RequirePermission('manage', 'ops')
  public upsert(@Body() body: UpsertFeatureFlagDto) {
    return this.flags.upsert(body);
  }

  @Delete(':key')
  @RequirePermission('manage', 'ops')
  public remove(@Param('key') key: string) {
    return this.flags.remove(key);
  }
}
