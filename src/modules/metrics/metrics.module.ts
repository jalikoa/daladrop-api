import { Global, Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { PaymentMetricsListener } from './listeners/payment-metrics.listener';
import { NfcMetricsListener, WebhookMetricsListener, NotificationMetricsListener } from './listeners/domain-metrics.listeners';
import { AuthMetricsListener } from './listeners/auth-metrics.listener';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    PaymentMetricsListener,
    NfcMetricsListener,
    WebhookMetricsListener,
    NotificationMetricsListener,
    AuthMetricsListener,
  ],
  exports: [MetricsService],
})
export class MetricsModule {}