import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { RealtimeGatewayHandler } from './realtime.gateway';

/**
 * Nest Socket.IO gateway bound to the platform {@link RealtimeGatewayHandler}.
 * Business modules must never import Socket.IO — they use RealtimeService only.
 *
 * Transports: websocket primary, polling fallback only.
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class PlatformSocketIoGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(PlatformSocketIoGateway.name);

  @WebSocketServer()
  public server!: Server;

  public constructor(private readonly handler: RealtimeGatewayHandler) {}

  public async handleConnection(client: Socket): Promise<void> {
    const authToken =
      typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token
        : undefined;
    const authHeader =
      (typeof client.handshake.headers.authorization === 'string'
        ? client.handshake.headers.authorization
        : undefined) ?? (authToken ? `Bearer ${authToken}` : undefined);

    const result = await this.handler.handleConnect(
      {
        id: client.id,
        send: async (eventType, payload) => {
          client.emit(eventType, payload);
        },
        close: async () => {
          client.disconnect(true);
        },
      },
      {
        credentials: authToken,
        headers: {
          ...Object.fromEntries(
            Object.entries(client.handshake.headers).map(([k, v]) => [
              k,
              Array.isArray(v) ? v.join(',') : String(v ?? ''),
            ]),
          ),
          ...(authHeader ? { authorization: authHeader } : {}),
        },
        query: Object.fromEntries(
          Object.entries(client.handshake.query).map(([k, v]) => [
            k,
            Array.isArray(v) ? v.join(',') : String(v ?? ''),
          ]),
        ),
      },
    );

    if (!result.accepted || !result.connectionId) {
      this.logger.debug(`Realtime connect rejected: ${result.reason ?? 'unknown'}`);
      client.emit('error', { reason: result.reason ?? 'unauthorized' });
      client.disconnect(true);
      return;
    }

    client.data.connectionId = result.connectionId;
    client.data.userId = result.identity?.userId;
    client.emit('connected', {
      connectionId: result.connectionId,
      userId: result.identity?.userId ?? null,
    });

    // Auto-join personal room when authenticated.
    if (result.identity?.userId) {
      await this.handler.handleJoin(
        result.connectionId,
        `user:${result.identity.userId}`,
      );
      await client.join(`user:${result.identity.userId}`);
    }
  }

  public async handleDisconnect(client: Socket): Promise<void> {
    const connectionId =
      typeof client.data.connectionId === 'string'
        ? client.data.connectionId
        : client.id;
    await this.handler.handleDisconnect(connectionId, 'client-disconnect');
  }

  @SubscribeMessage('join')
  public async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { readonly room?: string },
  ): Promise<{ ok: boolean; room?: string }> {
    const connectionId = this.connectionId(client);
    const room = body?.room?.trim();
    if (!connectionId || !room) return { ok: false };
    const ok = await this.handler.handleJoin(connectionId, room);
    if (ok) await client.join(room);
    return { ok, room };
  }

  /** Frontend alias — joins `ride:{rideId}` room. */
  @SubscribeMessage('joinRide')
  public async onJoinRide(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { readonly rideId?: string; readonly room?: string },
  ): Promise<{ ok: boolean; room?: string }> {
    const rideId = body?.rideId?.trim();
    const room =
      body?.room?.trim() || (rideId ? `ride:${rideId}` : undefined);
    return this.onJoin(client, { room });
  }

  @SubscribeMessage('leave')
  public async onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { readonly room?: string },
  ): Promise<{ ok: boolean; room?: string }> {
    const connectionId = this.connectionId(client);
    const room = body?.room?.trim();
    if (!connectionId || !room) return { ok: false };
    const ok = await this.handler.handleLeave(connectionId, room);
    if (ok) await client.leave(room);
    return { ok, room };
  }

  /** Frontend alias — leaves `ride:{rideId}` room (cancel is HTTP-only). */
  @SubscribeMessage('cancelRide')
  public async onCancelRide(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { readonly rideId?: string; readonly room?: string },
  ): Promise<{ ok: boolean; room?: string }> {
    const rideId = body?.rideId?.trim();
    const room =
      body?.room?.trim() || (rideId ? `ride:${rideId}` : undefined);
    return this.onLeave(client, { room });
  }

  @SubscribeMessage('heartbeat')
  public onHeartbeat(@ConnectedSocket() client: Socket): { ok: boolean } {
    const connectionId = this.connectionId(client);
    if (!connectionId) return { ok: false };
    return { ok: this.handler.handleHeartbeat(connectionId) };
  }

  private connectionId(client: Socket): string | null {
    return typeof client.data.connectionId === 'string'
      ? client.data.connectionId
      : null;
  }
}
