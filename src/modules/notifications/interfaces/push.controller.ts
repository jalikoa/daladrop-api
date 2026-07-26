import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import {
  RegisterPushTokenDto,
  UnregisterPushTokenDto,
} from '../dto/notifications.dto';
import { PushTokenService } from '../use-cases/push-token.service';

@ApiTags('Push')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'push', version: '1' })
export class PushController {
  public constructor(private readonly pushTokens: PushTokenService) {}

  @Post('register')
  public register(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: RegisterPushTokenDto,
  ) {
    this.assertSelf(principal.id, body.userId);
    return this.pushTokens.register(body);
  }

  @Delete('register')
  public unregister(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: UnregisterPushTokenDto,
  ) {
    this.assertSelf(principal.id, body.userId);
    return this.pushTokens.unregister(body);
  }

  private assertSelf(actorId: string, userId: string): void {
    if (actorId !== userId) {
      throw new ForbiddenException('Cannot manage another user push tokens');
    }
  }
}
