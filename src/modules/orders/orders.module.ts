import { Module, forwardRef } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { IdentityModule } from '../identity/identity.module';
import { LogisticsModule } from '../logistics/logistics.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersPaymentHelper } from './helpers/orders-payment.helper';
import { AdminOrdersController } from './interfaces/admin-orders.controller';
import { CustomerOrdersController } from './interfaces/customer-orders.controller';
import { MerchantOrdersController } from './interfaces/merchant-orders.controller';
import {
  FoodOrdersController,
  GasOrdersController,
  LiquorOrdersController,
  MarketOrdersController,
} from './interfaces/module-orders.controller';
import { OrdersCheckoutController } from './interfaces/orders-checkout.controller';
import { LegacyOrdersController } from './interfaces/legacy-orders.controller';
import { OrderPaymentListener } from './listeners/order-payment.listener';
import { OrderWorkflowOrchestrator } from './listeners/order-workflow.orchestrator';
import { AdminOrdersService } from './use-cases/admin-orders.service';
import { MerchantOrdersService } from './use-cases/merchant-orders.service';
import { ModuleOrdersService } from './use-cases/module-orders.service';
import { MultiCheckoutService } from './use-cases/multi-checkout.service';

@Module({
  imports: [
    IdentityModule,
    AuthorizationModule,
    LogisticsModule,
    PaymentsModule,
    ComplianceModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [
    OrdersCheckoutController,
    LegacyOrdersController,
    FoodOrdersController,
    MarketOrdersController,
    LiquorOrdersController,
    GasOrdersController,
    CustomerOrdersController,
    MerchantOrdersController,
    AdminOrdersController,
  ],
  providers: [
    OrdersPaymentHelper,
    MultiCheckoutService,
    ModuleOrdersService,
    MerchantOrdersService,
    AdminOrdersService,
    OrderPaymentListener,
    OrderWorkflowOrchestrator,
  ],
  exports: [MultiCheckoutService, ModuleOrdersService, MerchantOrdersService],
})
export class OrdersModule {}
