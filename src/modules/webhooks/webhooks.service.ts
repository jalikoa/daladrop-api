import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, MoreThan, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebhookLog } from './entities/webhook-log.entity';
import { WebhookSource, WebhookStatus } from './enums/webhook-source.enum';
import { IWebhookHandler } from './interfaces/webhook-handler.interface';
import { DarajaWebhookHandler } from './handlers/daraja-webhook.handler';
import { AfricaTalkingWebhookHandler } from './handlers/africastalking-webhook.handler';
import { WEBHOOK_CONSTANTS } from './constants/webhook.constants';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly handlers: Map<WebhookSource, IWebhookHandler>;

  constructor(
    @InjectRepository(WebhookLog) private readonly webhookRepo: Repository<WebhookLog>,
    private readonly eventEmitter: EventEmitter2,
    private readonly darajaHandler: DarajaWebhookHandler,
    private readonly africastalkingHandler: AfricaTalkingWebhookHandler,
  ) {
    // Explicitly type Map to use interface instead of concrete class
    this.handlers = new Map<WebhookSource, IWebhookHandler>([
      [WebhookSource.DARAJA, this.darajaHandler],
      [WebhookSource.AFRICASTALKING, this.africastalkingHandler],
    ]);
  }

  async receiveWebhook(
    source: WebhookSource,
    payload: unknown,
    headers: Record<string, string>,
    ip: string,
    userAgent?: string,
  ): Promise<{ success: boolean; webhookId: number }> {
    const handler = this.handlers.get(source);
    if (!handler) {
      throw new BadRequestException(`No handler configured for ${source}`);
    }

    const isValid = await handler.validate(payload, headers);
    if (!isValid) {
      this.logger.warn(`Invalid webhook from ${source}`);
      throw new BadRequestException('Invalid webhook payload or signature');
    }

    const idempotencyKey = handler.getIdempotencyKey(payload);
    if (idempotencyKey) {
      const existing = await this.checkIdempotency(source, idempotencyKey);
      if (existing) {
        this.logger.log(`Duplicate webhook detected: ${idempotencyKey}`);
        return { success: true, webhookId: existing.id };
      }
    }

    const eventType = handler.getEventType(payload);
    const log = await this.createWebhookLog({
      source,
      eventType,
      payload,
      ip,
      userAgent,
      idempotencyKey: idempotencyKey ?? undefined,
    });

    this.eventEmitter.emit(WEBHOOK_CONSTANTS.EVENTS.RECEIVED, {
      webhookId: log.id,
      source,
      eventType,
      ip,
      timestamp: new Date(),
    });

    const result = await handler.process(payload, log);

    await this.updateWebhookLog(log, result);

    this.eventEmitter.emit(WEBHOOK_CONSTANTS.EVENTS.PROCESSED, {
      webhookId: log.id,
      source,
      success: result.success,
      eventsEmitted: result.eventsEmitted,
      timestamp: new Date(),
    });

    return { success: result.success, webhookId: log.id };
  }

  private async checkIdempotency(source: WebhookSource, key: string): Promise<WebhookLog | null> {
    const windowHours = WEBHOOK_CONSTANTS.SECURITY.IDEMPOTENCY_WINDOW_HOURS;
    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const existing = await this.webhookRepo.findOne({
      where: { source, idempotency_key: key, received_at: MoreThan(windowStart) },
      order: { received_at: 'DESC' },
    });
    return existing || null;
  }

  private async createWebhookLog(data: {
    source: WebhookSource;
    eventType: string;
    payload: unknown;
    ip: string;
    userAgent?: string;
    idempotencyKey?: string;
  }): Promise<WebhookLog> {
    const log = this.webhookRepo.create({
      source: data.source,
      event_type: data.eventType,
      payload: data.payload as Record<string, unknown>,
      ip_address: data.ip,
      user_agent: data.userAgent,
      idempotency_key: data.idempotencyKey,
      status: WebhookStatus.RECEIVED,
    });

    return this.webhookRepo.save(log);
  }

  private async updateWebhookLog(
    log: WebhookLog,
    result: { success: boolean; error?: string; data?: any },
  ): Promise<void> {
    if (result.success) {
      log.markProcessed();
    } else {
      log.markFailed(result.error || 'Unknown error');
    }

    log.response_sent = result.data || null;

    await this.webhookRepo.save(log);
  }

  async getWebhookLogs(
    page = 1,
    limit = 10,
    source?: WebhookSource,
    status?: WebhookStatus,
  ): Promise<{ data: WebhookLog[]; total: number }> {
    const qb = this.webhookRepo.createQueryBuilder('log');
    if (source) qb.andWhere('log.source = :source', { source });
    if (status) qb.andWhere('log.status = :status', { status });
    const [data, total] = await qb
      .orderBy('log.received_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, total };
  }

  async getWebhookLog(id: number): Promise<WebhookLog | null> {
    return this.webhookRepo.findOne({ where: { id } });
  }
}