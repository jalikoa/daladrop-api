import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  Headers,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ParseIntPipe,
  DefaultValuePipe,
  Req,
  HttpCode,
  HttpStatus,
  SetMetadata,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { WebhooksService } from '../webhooks.service';
import { DarajaCallbackDto } from '../dto/daraja-callback.dto';
import { WebhookResponseDto, WebhookLogResponseDto } from '../dto/webhook-response.dto';
import { WebhookSource, WebhookStatus } from '../enums/webhook-source.enum';
import { WebhookAuthGuard } from '../guards/webhook-auth.guard';
import { UserRole } from 'src/modules/users/enums/user-role.enum';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';

export const WebhookSourceDecorator = (source: WebhookSource) =>
  SetMetadata('webhook_source', source);

@Controller('webhooks')
@UsePipes(new ValidationPipe({ transform: true, whitelist: false }))
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('daraja/stk')
  @UseGuards(WebhookAuthGuard)
  @WebhookSourceDecorator(WebhookSource.DARAJA)
  @HttpCode(HttpStatus.OK)
  async handleDarajaCallback(
    @Body() dto: DarajaCallbackDto,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ): Promise<WebhookResponseDto> {
    const clientIp = this.getClientIp(req);
    
    const result = await this.webhooksService.receiveWebhook(
      WebhookSource.DARAJA,
      dto,
      headers,
      clientIp,
      req.get('user-agent'),
    );
    
    const log = await this.webhooksService.getWebhookLog(result.webhookId);
    const callbackData = (log?.payload as any)?.Body?.stkCallback;

    return {
      success: result.success,
      message: result.success ? 'Callback processed' : 'Callback failed',
      meta: {
        webhook_id: result.webhookId,
        source: WebhookSource.DARAJA,
        status: log?.status || WebhookStatus.RECEIVED,
        processed_at: log?.processed_at || null,
        // resultCode: callbackData?.ResultCode,
        // resultDesc: callbackData?.ResultDesc,
      },
      received_at: log?.received_at || new Date(),
    };
  }

  @Post('africastalking/sms')
  @UseGuards(WebhookAuthGuard)
  @WebhookSourceDecorator(WebhookSource.AFRICASTALKING)
  @HttpCode(HttpStatus.OK)
  async handleAfricaTalkingCallback(
    @Body() dto: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ): Promise<WebhookResponseDto> {
    const clientIp = this.getClientIp(req);
    
    const result = await this.webhooksService.receiveWebhook(
      WebhookSource.AFRICASTALKING,
      dto,
      headers,
      clientIp,
      req.get('user-agent'),
    );
    
    const log = await this.webhooksService.getWebhookLog(result.webhookId);

    return {
      success: result.success,
      message: result.success ? 'Callback processed' : 'Callback failed',
      meta: {
        webhook_id: result.webhookId,
        source: WebhookSource.AFRICASTALKING,
        status: log?.status || WebhookStatus.RECEIVED,
        processed_at: log?.processed_at || null,
      },
      received_at: log?.received_at || new Date(),
    };
  }

  @Get('logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getWebhookLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('source') source?: WebhookSource,
    @Query('status') status?: WebhookStatus,
  ): Promise<{ data: WebhookLogResponseDto[]; total: number }> {
    const result = await this.webhooksService.getWebhookLogs(
      page,
      limit,
      source,
      status,
    );
    return {
      data: result.data.map((log) => this.mapToResponseDto(log)),
      total: result.total,
    };
  }

  @Get('logs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getWebhookLog(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<WebhookLogResponseDto> {
    const log = await this.webhooksService.getWebhookLog(id);
    if (!log) {
      throw new NotFoundException('Webhook log not found');
    }
    return this.mapToResponseDto(log);
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return Array.isArray(forwarded)
        ? forwarded[0]
        : forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  private mapToResponseDto(log: any): WebhookLogResponseDto {
    return {
      id: log.id,
      source: log.source,
      event_type: log.event_type,
      status: log.status,
      ip_address: log.ip_address,
      payload: log.payload,
      response_sent: log.response_sent,
      error_message: log.error_message,
      received_at: log.received_at,
      processed_at: log.processed_at,
    };
  }
}