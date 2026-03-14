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
  Req,
} from '@nestjs/common';
import type { Request } from 'express'; // Type-only import for isolatedModules
import { NfcService } from './nfc.service';
import { CreateNfcTagDto } from './dto/create-nfc-tag.dto';
import { DecodeTokenDto } from './dto/decode-token.dto';
import { NfcTagResponseDto, DecodedTokenResponseDto } from './dto/nfc-tag-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { MerchantOwnerGuard } from '../merchants/guards/merchant-owner.guard';

@Controller('nfc')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class NfcController {
  constructor(private readonly nfcService: NfcService) {}

  @Post()
  @UseGuards(JwtAuthGuard, MerchantOwnerGuard)
  async createTag(
    @Body() dto: CreateNfcTagDto,
    @Query('merchant_id', ParseIntPipe) merchantId: number,
  ): Promise<NfcTagResponseDto> {
    return this.nfcService.createTag(merchantId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async findByMerchant(
    @Query('merchant_id', ParseIntPipe) merchantId: number,
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 10,
  ): Promise<{ data: NfcTagResponseDto[]; total: number }> {
    return this.nfcService.findByMerchant(merchantId, page, limit);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, MerchantOwnerGuard)
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<NfcTagResponseDto> {
    return this.nfcService.findOne(id);
  }

  @Get('decode')
  async decodeToken(
    @Query() dto: DecodeTokenDto,
    @Req() req: Request,
  ): Promise<DecodedTokenResponseDto> {
    return this.nfcService.decodeToken(dto, req.ip, req.get('user-agent'));
  }
}