import { Module, forwardRef } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { IdentityModule } from '../identity/identity.module';
import { LogisticsModule } from '../logistics/logistics.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OperationsModule } from '../operations/operations.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminRidesController } from './interfaces/admin-rides.controller';
import { AdminTransportCatalogController } from './interfaces/admin-transport-catalog.controller';
import {
  MpesaPaymentStatusController,
  MpesaPaymentStatusNeutralController,
} from './interfaces/mpesa-payment-status.controller';
import { RideController } from './interfaces/ride.controller';
import { RiderRidesController } from './interfaces/rider-rides.controller';
import { RidersController } from './interfaces/riders.controller';
import { RidesController } from './interfaces/rides.controller';
import { TransportCatalogController } from './interfaces/transport-catalog.controller';
import { RidePaymentListener } from './listeners/ride-payment.listener';
import { RideProviderResolver } from './listeners/ride-provider.resolver';
import { RideWorkflowOrchestrator } from './listeners/ride-workflow.orchestrator';
import { MpesaPaymentStatusService } from './use-cases/mpesa-payment-status.service';
import { RideDispatchService } from './use-cases/ride-dispatch.service';
import { RideQuoteService } from './use-cases/ride-quote.service';
import { RidersDiscoveryService } from './use-cases/riders-discovery.service';
import { RidesService } from './use-cases/rides.service';
import { TransportCatalogService } from './use-cases/transport-catalog.service';

/**
 * Transport depends one-way on Logistics (quotes, surge/ETA, POD) —
 * Logistics must never import Transport.
 */
@Module({
  imports: [
    IdentityModule,
    AuthorizationModule,
    OperationsModule,
    PaymentsModule,
    LogisticsModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [
    RideController,
    RidesController,
    RidersController,
    RiderRidesController,
    AdminRidesController,
    AdminTransportCatalogController,
    TransportCatalogController,
    MpesaPaymentStatusController,
    MpesaPaymentStatusNeutralController,
  ],
  providers: [
    RideQuoteService,
    RidesService,
    RidersDiscoveryService,
    RideDispatchService,
    TransportCatalogService,
    MpesaPaymentStatusService,
    RideProviderResolver,
    RidePaymentListener,
    // RideWorkflowOrchestrator owns realtime fan-out via RealtimeService.
    RideWorkflowOrchestrator,
  ],
  exports: [
    RidesService,
    RideQuoteService,
    RidersDiscoveryService,
    RideDispatchService,
    TransportCatalogService,
    MpesaPaymentStatusService,
  ],
})
export class TransportModule {}
