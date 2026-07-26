import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { SubmitAgeVerificationDto } from '../dto/age-verification.dto';
import { AgeVerificationService } from '../use-cases/age-verification.service';

@ApiTags('Compliance')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'customer', version: '1' })
export class AgeVerificationController {
  public constructor(
    private readonly ageVerification: AgeVerificationService,
  ) {}

  @Get(':uid/age-verification')
  public getStatus(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('uid', ParseUUIDPipe) uid: string,
  ) {
    this.assertSelf(principal.id, uid);
    return this.ageVerification.getStatus(uid);
  }

  @Post(':uid/age-verification')
  public submit(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('uid', ParseUUIDPipe) uid: string,
    @Body() body: SubmitAgeVerificationDto,
  ) {
    this.assertSelf(principal.id, uid);
    return this.ageVerification.submit(principal.id, uid, body);
  }

  private assertSelf(actorId: string, uid: string): void {
    if (actorId !== uid) {
      throw new ForbiddenException(
        'Cannot access another user age verification',
      );
    }
  }
}
