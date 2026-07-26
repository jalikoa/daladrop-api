import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { OperationsModule } from '../operations/operations.module';
import { PaymentsModule } from '../payments/payments.module';
import { EventsController } from './interfaces/events.controller';
import { AdminEventsController } from './interfaces/admin-events.controller';
import { EventsDiscoveryService } from './use-cases/events-discovery.service';
import { EventBookingService } from './use-cases/event-booking.service';
import { AdminEventsService } from './use-cases/admin-events.service';
import {
  EventBookingPaymentListener,
  EventBookingProviderResolver,
} from './listeners/event-booking-payment.listener';

@Module({
  imports: [
    IdentityModule,
    AuthorizationModule,
    OperationsModule,
    PaymentsModule,
  ],
  controllers: [EventsController, AdminEventsController],
  providers: [
    EventsDiscoveryService,
    EventBookingService,
    AdminEventsService,
    EventBookingProviderResolver,
    EventBookingPaymentListener,
  ],
  exports: [EventsDiscoveryService, EventBookingService],
})
export class EventsModule {}
