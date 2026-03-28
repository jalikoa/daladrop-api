import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AuditLog } from './entities/audit-log.entity';
import { AuditRepository } from './repositories/audit.repository';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditLoggingInterceptor } from './interceptors/audit-logging.interceptor';
import { AuditQueue } from './queues/audit.queue';
import { AuditProcessor } from './processors/audit.processor';
import { AuditBatchService } from './services/audit-batch.service';
import { AUDIT_CONSTANTS } from './constants/audit.constants';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
    BullModule.registerQueue({
      name: AUDIT_CONSTANTS.QUEUE.NAME,
      defaultJobOptions: {
        attempts: AUDIT_CONSTANTS.RETRY.MAX_ATTEMPTS,
        backoff: {
          type: 'fixed',
          delay: AUDIT_CONSTANTS.RETRY.BACKOFF_DELAY_MS,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    }),
  ],
  providers: [
    AuditRepository,
    AuditService,
    AuditQueue,
    AuditProcessor,
    AuditBatchService,
    AuditLoggingInterceptor,
  ],
  controllers: [AuditController],
  exports: [AuditService, AuditLoggingInterceptor],
})
export class AuditModule {}
