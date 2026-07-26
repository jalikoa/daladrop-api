import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../use-cases/auth.service';
import { AuthTokenGuard } from '../guards/auth-token.guard';
import { CurrentAuth } from '../decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../domain/auth.contracts';
import { UpdatePhoneDto } from '../dto/update-phone.dto';

@ApiTags('User')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'user', version: '1' })
export class UserAuthController {
  public constructor(private readonly auth: AuthService) {}

  @Put('me')
  public updatePhone(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() input: UpdatePhoneDto,
  ) {
    return this.auth.updatePhone(principal.id, input.phone);
  }
}

@ApiTags('Legal')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'legal', version: '1' })
export class LegalAcceptancesController {
  public constructor(private readonly auth: AuthService) {}

  @Get('acceptances')
  public list(@CurrentAuth() principal: AuthPrincipalView) {
    return this.auth.legalAcceptances(principal.id);
  }
}
