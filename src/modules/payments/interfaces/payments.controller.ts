import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { RequirePermission } from '../../authorization/decorators/require-permission.decorator';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import {
  CreatePaymentDto,
  ListPaymentsDto,
  PaymentMutationDto,
  RefundPaymentDto,
} from '../dto/payment.dto';
import type { PublicPaymentStatus } from '../domain/payment';
import { PaymentsService } from '../use-cases/payments.service';

const PAYMENT_EXAMPLE = {
  id: 'be6f46b7-84ad-4ce7-af17-d101eb1b34dd',
  amount: '2500',
  currency: 'KES',
  providerCode: 'MANUAL',
  lifecycle: 'AWAITING_CUSTOMER',
  status: 'PROCESSING',
};

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  public constructor(private readonly payments: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create and initiate a provider-neutral payment' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, example: 'pay-order-10001' })
  @ApiResponse({ status: 201, schema: { example: PAYMENT_EXAMPLE } })
  public create(
    @CurrentAuth() principal: AuthPrincipalView,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: CreatePaymentDto,
  ) {
    return this.payments.createAndInitiate({
      customerId: principal.id,
      amount: BigInt(body.amount),
      currency: body.currency,
      purpose: body.purpose,
      providerCode: body.providerCode,
      payerIdentifier: body.payerIdentifier,
      description: body.description,
      idempotencyKey,
    });
  }

  @Get(':id')
  @ApiResponse({ status: 200, schema: { example: PAYMENT_EXAMPLE } })
  public get(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.getForCustomer(id, principal.id);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Query the provider and synchronize payment state' })
  public sync(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.queryAndSync(id, principal.id);
  }

  @Post(':id/retry')
  @ApiBody({ type: PaymentMutationDto })
  public retry(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PaymentMutationDto,
  ) {
    return this.payments.retry(id, principal.id, body.idempotencyKey);
  }

  @Post(':id/cancel')
  public cancel(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PaymentMutationDto,
  ) {
    return this.payments.cancel(id, principal.id, body.idempotencyKey);
  }
}

@ApiTags('Payment Provider Callbacks')
@Controller({ path: 'payment-providers', version: '1' })
export class PaymentProviderCallbacksController {
  public constructor(private readonly payments: PaymentsService) {}

  @Post(':providerCode/webhook')
  @ApiOperation({ summary: 'Receive a signed provider webhook' })
  @ApiResponse({ status: 201, schema: { example: { accepted: true, duplicate: false } } })
  public webhook(
    @Param('providerCode') providerCode: string,
    @Req() request: Request & { rawBody?: Buffer },
    @Query('token') callbackToken: string | undefined,
    @Body() body: unknown,
  ) {
    const existingHeader =
      request.headers['x-callback-token'] ??
      request.headers['X-Callback-Token'];
    // Prefer explicit header; query token is legacy fallback (avoid logging URLs with secrets).
    const headerToken =
      (Array.isArray(existingHeader) ? existingHeader[0] : existingHeader) ||
      callbackToken;
    return this.payments.handleWebhook(providerCode, {
      headers: {
        ...request.headers,
        ...(headerToken ? { 'x-callback-token': headerToken } : {}),
      },
      body,
      rawBody: request.rawBody,
      receivedAt: new Date(),
    });
  }

  @Post(':providerCode/callback')
  @ApiOperation({ summary: 'Receive a provider callback' })
  public callback(
    @Param('providerCode') providerCode: string,
    @Req() request: Request & { rawBody?: Buffer },
    @Query('token') callbackToken: string | undefined,
    @Body() body: unknown,
  ) {
    return this.webhook(providerCode, request, callbackToken, body);
  }
}

@ApiTags('Admin Payments')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin/payments', version: '1' })
export class AdminPaymentsController {
  public constructor(private readonly payments: PaymentsService) {}

  @Get()
  @RequirePermission('read', 'payments')
  public list(@Query() query: ListPaymentsDto) {
    return this.payments.listAdmin({
      status: query.status as PublicPaymentStatus | undefined,
      providerCode: query.providerCode,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get(':id')
  @RequirePermission('read', 'payments')
  public get(@Param('id', ParseUUIDPipe) id: string) {
    return this.payments.getAdmin(id);
  }

  @Post(':id/manual-approve')
  @RequirePermission('manage', 'payments')
  public approve(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PaymentMutationDto,
  ) {
    return this.payments.manualApprove(id, principal.id, body.idempotencyKey);
  }

  @Post(':id/reverse')
  @RequirePermission('manage', 'payments')
  public reverse(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PaymentMutationDto,
  ) {
    return this.payments.reverse(id, principal.id, body.idempotencyKey, body.reason);
  }

  @Post(':id/refund')
  @RequirePermission('manage', 'payments')
  public refund(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RefundPaymentDto,
  ) {
    return this.payments.refund(
      id,
      principal.id,
      body.idempotencyKey,
      BigInt(body.amount),
      body.reason,
    );
  }

  @Get(':id/refunds')
  @RequirePermission('read', 'payments')
  public listRefunds(@Param('id', ParseUUIDPipe) id: string) {
    return this.payments.listRefunds(id);
  }

  @Get('refunds/:refundId')
  @RequirePermission('read', 'payments')
  public getRefund(@Param('refundId', ParseUUIDPipe) refundId: string) {
    return this.payments.getRefund(refundId);
  }
}
