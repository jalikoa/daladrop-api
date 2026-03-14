import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  UseGuards,
  DefaultValuePipe,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditLogResponseDto } from './dto/audit-log-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  async getLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('user_id', ParseIntPipe) userId?: number,
    @Query('action') action?: string,
  ): Promise<{ data: AuditLogResponseDto[]; total: number }> {
    const result = await this.auditService.getLogs(page, limit, { userId, action });
    return {
      data: result.data.map((log) => ({
        id: log.id,
        user_id: log.user_id,
        action: log.action,
        ip_address: log.ip_address,
        endpoint: log.endpoint,
        payload: log.payload,
        created_at: log.created_at,
      })),
      total: result.total,
    };
  }
}
