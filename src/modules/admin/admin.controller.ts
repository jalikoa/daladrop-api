import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminDashboardStatsDto, RecentPaymentDto, MerchantOverviewDto } from './dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  async getDashboardStats(): Promise<AdminDashboardStatsDto> {
    return this.adminService.getDashboardStats();
  }

  @Get('recent/payments')
  @ApiOperation({ summary: 'Get recent payments for admin dashboard' })
  async getRecentPayments(
    @Query('limit') limit?: number,
  ): Promise<RecentPaymentDto[]> {
    return this.adminService.getRecentPayments(limit || 5);
  }

  @Get('merchants/overview')
  @ApiOperation({ summary: 'Get merchant overview for admin dashboard' })
  async getMerchantOverview(): Promise<MerchantOverviewDto[]> {
    return this.adminService.getMerchantOverview();
  }
}
