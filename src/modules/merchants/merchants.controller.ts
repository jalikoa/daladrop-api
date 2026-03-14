import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  UsePipes,
  ValidationPipe,
  DefaultValuePipe,
  Request,
} from '@nestjs/common';
import { MerchantsService } from './merchants.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { MerchantResponseDto } from './dto/merchant-response.dto';
import { PaymentLinkResponseDto } from './dto/payment-link.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { MerchantOwnerGuard } from './guards/merchant-owner.guard';
import { MerchantStatus } from './enums/merchant-status.enum';

@Controller('merchants')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async create(
    @Body() dto: CreateMerchantDto,
    @Query('user_id', ParseIntPipe) userId: number,
  ): Promise<MerchantResponseDto> {
    return this.merchantsService.create(userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: MerchantStatus,
  ): Promise<{ data: MerchantResponseDto[]; total: number }> {
    return this.merchantsService.findAll(page, limit);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, MerchantOwnerGuard)
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<MerchantResponseDto> {
    return this.merchantsService.findOne(id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async findMyMerchant(@Request() req): Promise<MerchantResponseDto> {
    return this.merchantsService.findByUserId(req.user.id);
  }

  @Get(':id/payment-link')
  @UseGuards(JwtAuthGuard, MerchantOwnerGuard)
  async generatePaymentLink(
    @Param('id', ParseIntPipe) id: number,
    @Query('qr', new DefaultValuePipe('true')) includeQr: string,
  ): Promise<PaymentLinkResponseDto> {
    return this.merchantsService.generatePaymentLink(id, includeQr === 'true');
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, MerchantOwnerGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMerchantDto,
  ): Promise<MerchantResponseDto> {
    return this.merchantsService.update(id, dto);
  }

  @Get(':id/cards')
  @UseGuards(JwtAuthGuard, MerchantOwnerGuard)
  async getMerchantCards(@Param('id', ParseIntPipe) id: number) {
    return { cards: [] };
  }
}
