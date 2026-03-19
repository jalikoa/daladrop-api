import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  UsePipes,
  ValidationPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InitiateStkDto } from './dto/initiate-stk.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { PaymentOwnerGuard } from './guards/payment-owner.guard';
import { PaymentStatus } from './enums/payment-status.enum';

@Controller('payments')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('stk')
  async initiateStk(@Body() dto: InitiateStkDto): Promise<any> {
    const session = await this.paymentsService.initiateStk(dto as any);
    return { success: true, payload: { checkout_request_id: session.session_uuid, response_code: '0', response_description: 'STK push sent', merchant_request_id: session.session_uuid, session_uuid: session.session_uuid }, timestamp: new Date() };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async findAll(@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number, @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number, @Query('status') status?: PaymentStatus, @Query('merchant_id') merchantId?: number) {
    if (merchantId) return this.paymentsService.findByMerchant(+merchantId, page, limit, status);
    return this.paymentsService.findAll(page, limit, status);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PaymentOwnerGuard)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.findOne(id);
  }

  @Get('session/:uuid')
  async findByUuid(@Param('uuid') uuid: string) {
    return this.paymentsService.findByUuid(uuid);
  }

  @Get('merchant/:merchantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async getMerchantPayments(@Param('merchantId', ParseIntPipe) merchantId: number, @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number, @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number, @Query('status') status?: PaymentStatus) {
    return this.paymentsService.findByMerchant(merchantId, page, limit, status);
  }

  @Get('merchant/:merchantId/statistics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async getStatistics(@Param('merchantId', ParseIntPipe) merchantId: number, @Query('from') from?: string, @Query('to') to?: string) {
    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = to ? new Date(to) : new Date();
    return this.paymentsService.getStatistics(merchantId, startDate, endDate);
  }
}
