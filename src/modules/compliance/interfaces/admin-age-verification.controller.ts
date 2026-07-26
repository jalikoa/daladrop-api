import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { RequirePermission } from '../../authorization/decorators/require-permission.decorator';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import {
  ListAgeVerificationsQueryDto,
  ReviewAgeVerificationDto,
} from '../dto/age-verification.dto';
import { AgeVerificationService } from '../use-cases/age-verification.service';

@ApiTags('Admin Compliance')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin', version: '1' })
export class AdminAgeVerificationController {
  public constructor(
    private readonly ageVerification: AgeVerificationService,
  ) {}

  @Get('age-verifications')
  @RequirePermission('read', 'compliance')
  public list(@Query() query: ListAgeVerificationsQueryDto) {
    return this.ageVerification.listForAdmin(query.status);
  }

  @Post('age-verifications/:id/review')
  @RequirePermission('manage', 'compliance')
  public review(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewAgeVerificationDto,
  ) {
    return this.ageVerification.adminReview(principal.id, id, body);
  }
}
