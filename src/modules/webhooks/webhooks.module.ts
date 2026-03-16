// import { Module } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { EventEmitterModule } from '@nestjs/event-emitter';
// import { WebhookLog } from './entities/webhook-log.entity';
// import { WebhooksService } from './webhooks.service';
// import { WebhooksController } from './webhooks.controller';
// import { DarajaWebhookHandler } from './handlers/daraja-webhook.handler';
// import { AfricaTalkingWebhookHandler } from './handlers/africastalking-webhook.handler';
// import { DarajaSignatureValidator } from './validators/daraja-signature.validator';
// import { IpWhitelistValidator } from './validators/ip-whitelist.validator';
// import { WebhookAuthGuard } from './guards/webhook-auth.guard';
// import { PaymentsModule } from '../payments/payments.module';

// @Module({
// 	imports: [
// 		TypeOrmModule.forFeature([WebhookLog]),
// 		EventEmitterModule.forRoot(),
// 		PaymentsModule, // For payment event handling
// 	],
// 	providers: [
// 		WebhooksService,
// 		DarajaWebhookHandler,
// 		AfricaTalkingWebhookHandler,
// 		DarajaSignatureValidator,
// 		IpWhitelistValidator,
// 		WebhookAuthGuard,
// 	],
// 	controllers: [WebhooksController],
// 	exports: [WebhooksService],
// })
// export class WebhooksModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { WebhookLog } from './entities/webhook-log.entity';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { DarajaWebhookHandler } from './handlers/daraja-webhook.handler';
import { AfricaTalkingWebhookHandler } from './handlers/africastalking-webhook.handler';
import { DarajaSignatureValidator } from './validators/daraja-signature.validator';
import { IpWhitelistValidator } from './validators/ip-whitelist.validator';
import { WebhookAuthGuard } from './guards/webhook-auth.guard';
import { HandleCallbackUseCase } from '../payments/use-cases/handle-callback.usecase';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookLog]),
    EventEmitterModule.forRoot(),
    PaymentsModule,           // exposes HandleCallbackUseCase + IPaymentRepository
  ],
  providers: [
    WebhooksService,
    DarajaWebhookHandler,
    AfricaTalkingWebhookHandler,
    DarajaSignatureValidator,
    IpWhitelistValidator,
    WebhookAuthGuard,
    HandleCallbackUseCase,    // explicitly listed so NestJS resolves it for DarajaWebhookHandler
  ],
  controllers: [WebhooksController],
  exports: [WebhooksService],
})
export class WebhooksModule {}
