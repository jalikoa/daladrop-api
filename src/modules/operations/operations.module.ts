import { Module, forwardRef } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { IdentityModule } from '../identity/identity.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminFeatureFlagsController } from './interfaces/admin-feature-flags.controller';
import {
  AdminAnnouncementsController,
  AnnouncementsController,
} from './interfaces/announcements.controller';
import {
  AdminSupportTicketsController,
  MerchantSupportTicketsController,
  SupportTicketsController,
} from './interfaces/support-tickets.controller';
import { SupportTicketOrchestrator } from './listeners/support-ticket.orchestrator';
import { AnnouncementsService } from './use-cases/announcements.service';
import { AuditLogService } from './use-cases/audit-log.service';
import { FeatureFlagsService } from './use-cases/feature-flags.service';
import { SupportTicketsService } from './use-cases/support-tickets.service';

@Module({
  imports: [
    IdentityModule,
    AuthorizationModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [
    AdminFeatureFlagsController,
    SupportTicketsController,
    MerchantSupportTicketsController,
    AdminSupportTicketsController,
    AnnouncementsController,
    AdminAnnouncementsController,
  ],
  providers: [
    AuditLogService,
    FeatureFlagsService,
    SupportTicketsService,
    AnnouncementsService,
    SupportTicketOrchestrator,
  ],
  exports: [
    AuditLogService,
    FeatureFlagsService,
    SupportTicketsService,
    AnnouncementsService,
  ],
})
export class OperationsModule {}
