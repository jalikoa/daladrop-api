import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { IdentityModule } from '../identity/identity.module';
import { OperationsModule } from '../operations/operations.module';
import { AdminLogisticsController } from './interfaces/admin-logistics.controller';
import { CheckoutQuoteController } from './interfaces/checkout-quote.controller';
import {
  AdminProofOfDeliveryController,
  ProofOfDeliveryController,
} from './interfaces/proof-of-delivery.controller';
import { AdminPricingService } from './use-cases/admin-pricing.service';
import { DeliveryQuoteService } from './use-cases/delivery-quote.service';
import { ProofOfDeliveryService } from './use-cases/proof-of-delivery.service';
import { QuoteEngineService } from './use-cases/quote-engine.service';
import {
  RideEtaService,
  SurgePricingService,
} from './use-cases/surge-eta.service';

/**
 * Logistics owns delivery pricing (source of truth), quotes, and POD.
 * Surge/ETA live here so Transport can depend on Logistics one-way —
 * no module cycle.
 */
@Module({
  imports: [IdentityModule, AuthorizationModule, OperationsModule],
  controllers: [
    CheckoutQuoteController,
    AdminLogisticsController,
    ProofOfDeliveryController,
    AdminProofOfDeliveryController,
  ],
  providers: [
    DeliveryQuoteService,
    AdminPricingService,
    SurgePricingService,
    RideEtaService,
    QuoteEngineService,
    ProofOfDeliveryService,
  ],
  exports: [
    DeliveryQuoteService,
    QuoteEngineService,
    ProofOfDeliveryService,
    SurgePricingService,
    RideEtaService,
  ],
})
export class LogisticsModule {}
