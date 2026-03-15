import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditRepository } from './repositories/audit.repository';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditLoggingInterceptor } from './interceptors/audit-logging.interceptor';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditRepository, AuditService, AuditLoggingInterceptor],
  controllers: [AuditController],
  exports: [AuditService, AuditLoggingInterceptor],
})
export class AuditModule {}
