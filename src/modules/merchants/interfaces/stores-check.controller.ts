import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { MerchantSelfService } from '../use-cases/merchant-self.service';

const ADMIN_ROLES = new Set(['ADMIN', 'SUPPORT', 'FINANCE']);

/**
 * Legacy seller-onboarding probes (Uidocs 22 / OpenAPI prep):
 * - `GET /v1/stores/check/:userId`  — does this user own a merchant/stores?
 * - `GET /v1/user/:userId/merchants` — merchants owned by the user.
 * Self or admin only — probing other accounts is an information leak.
 */
@ApiTags('Merchants')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ version: '1' })
export class StoresCheckController {
  public constructor(private readonly merchants: MerchantSelfService) {}

  @Get('stores/check/:userId')
  @ApiOperation({ summary: 'Check whether a user has a merchant profile / stores' })
  public check(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    this.assertSelfOrAdmin(principal, userId);
    return this.merchants.checkStores(userId);
  }

  @Get('user/:userId/merchants')
  @ApiOperation({ summary: 'List merchants owned by a user' })
  public listUserMerchants(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    this.assertSelfOrAdmin(principal, userId);
    return this.merchants.listOwnedMerchants(userId);
  }

  private assertSelfOrAdmin(
    principal: AuthPrincipalView,
    userId: string,
  ): void {
    const isAdmin = principal.roles.some((role) => ADMIN_ROLES.has(role));
    if (principal.id !== userId && !isAdmin) {
      throw new ForbiddenException('Cannot inspect another user account');
    }
  }
}
