import type { Socket } from 'socket.io';
import { PlatformSocketIoGateway } from '../gateways/platform-socketio.gateway';
import type {
  GatewayConnectResult,
  GatewaySocketAdapter,
  RealtimeGatewayHandler,
} from '../gateways/realtime.gateway';

interface HandlerMock {
  handleConnect: jest.Mock<Promise<GatewayConnectResult>, [GatewaySocketAdapter, unknown]>;
  handleDisconnect: jest.Mock;
  handleJoin: jest.Mock;
  handleLeave: jest.Mock;
  handleHeartbeat: jest.Mock;
}

function buildHandler(): HandlerMock {
  return {
    handleConnect: jest.fn(),
    handleDisconnect: jest.fn().mockResolvedValue(undefined),
    handleJoin: jest.fn().mockResolvedValue(true),
    handleLeave: jest.fn().mockResolvedValue(true),
    handleHeartbeat: jest.fn().mockReturnValue(true),
  };
}

function buildSocket(overrides: Partial<Record<string, unknown>> = {}): Socket {
  return {
    id: 'sock-1',
    handshake: { auth: {}, headers: {}, query: {} },
    data: {},
    emit: jest.fn(),
    disconnect: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Socket;
}

function gateway(handler: HandlerMock): PlatformSocketIoGateway {
  return new PlatformSocketIoGateway(
    handler as unknown as RealtimeGatewayHandler,
  );
}

describe('PlatformSocketIoGateway', () => {
  describe('handleConnection', () => {
    it('accepts an authenticated connection and auto-joins the user room', async () => {
      const handler = buildHandler();
      handler.handleConnect.mockResolvedValue({
        accepted: true,
        connectionId: 'conn-1',
        identity: { userId: 'u1' },
      });
      const client = buildSocket({
        handshake: {
          auth: { token: 'jwt-token' },
          headers: { 'x-forwarded-for': ['1.1.1.1', '2.2.2.2'] },
          query: { v: ['1', '2'], device: 'ios' },
        },
      });

      await gateway(handler).handleConnection(client);

      const [transport, context] = handler.handleConnect.mock.calls[0] as [
        GatewaySocketAdapter,
        {
          credentials?: string;
          headers: Record<string, string>;
          query: Record<string, string>;
        },
      ];
      expect(context.credentials).toBe('jwt-token');
      expect(context.headers.authorization).toBe('Bearer jwt-token');
      expect(context.headers['x-forwarded-for']).toBe('1.1.1.1,2.2.2.2');
      expect(context.query).toEqual({ v: '1,2', device: 'ios' });

      // Transport adapter callbacks delegate to the socket.
      await transport.send('ping', { a: 1 });
      expect(client.emit).toHaveBeenCalledWith('ping', { a: 1 });
      await transport.close();
      expect(client.disconnect).toHaveBeenCalledWith(true);

      expect((client.data as Record<string, unknown>).connectionId).toBe('conn-1');
      expect(client.emit).toHaveBeenCalledWith('connected', {
        connectionId: 'conn-1',
        userId: 'u1',
      });
      expect(handler.handleJoin).toHaveBeenCalledWith('conn-1', 'user:u1');
      expect(client.join).toHaveBeenCalledWith('user:u1');
    });

    it('uses the authorization header when no auth token is provided', async () => {
      const handler = buildHandler();
      handler.handleConnect.mockResolvedValue({
        accepted: true,
        connectionId: 'conn-2',
      });
      const client = buildSocket({
        handshake: {
          auth: {},
          headers: { authorization: 'Bearer header-token' },
          query: {},
        },
      });

      await gateway(handler).handleConnection(client);

      const [, context] = handler.handleConnect.mock.calls[0] as [
        GatewaySocketAdapter,
        { credentials?: string; headers: Record<string, string> },
      ];
      expect(context.credentials).toBeUndefined();
      expect(context.headers.authorization).toBe('Bearer header-token');
      // Anonymous identity: connected but no user room joined.
      expect(client.emit).toHaveBeenCalledWith('connected', {
        connectionId: 'conn-2',
        userId: null,
      });
      expect(handler.handleJoin).not.toHaveBeenCalled();
    });

    it('rejects and disconnects when the handler refuses the connection', async () => {
      const handler = buildHandler();
      handler.handleConnect.mockResolvedValue({
        accepted: false,
        reason: 'unauthorized',
      });
      const client = buildSocket();

      await gateway(handler).handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('error', {
        reason: 'unauthorized',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('reports a generic reason when the handler gives none', async () => {
      const handler = buildHandler();
      handler.handleConnect.mockResolvedValue({ accepted: false });
      const client = buildSocket();

      await gateway(handler).handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('error', {
        reason: 'unauthorized',
      });
    });

    it('tolerates missing auth object and undefined header/query values', async () => {
      const handler = buildHandler();
      handler.handleConnect.mockResolvedValue({ accepted: false });
      const client = buildSocket({
        handshake: {
          auth: undefined,
          headers: { 'x-empty': undefined },
          query: { q: undefined },
        },
      });

      await gateway(handler).handleConnection(client);

      const [, context] = handler.handleConnect.mock.calls[0] as [
        GatewaySocketAdapter,
        { headers: Record<string, string>; query: Record<string, string> },
      ];
      expect(context.headers['x-empty']).toBe('');
      expect(context.query.q).toBe('');
      expect(context.headers.authorization).toBeUndefined();
    });
  });

  describe('handleDisconnect', () => {
    it('uses the registered connection id when available', async () => {
      const handler = buildHandler();
      const client = buildSocket({ data: { connectionId: 'conn-9' } });
      await gateway(handler).handleDisconnect(client);
      expect(handler.handleDisconnect).toHaveBeenCalledWith(
        'conn-9',
        'client-disconnect',
      );
    });

    it('falls back to the socket id when never registered', async () => {
      const handler = buildHandler();
      const client = buildSocket();
      await gateway(handler).handleDisconnect(client);
      expect(handler.handleDisconnect).toHaveBeenCalledWith(
        'sock-1',
        'client-disconnect',
      );
    });
  });

  describe('rooms', () => {
    it('joins a room when registered', async () => {
      const handler = buildHandler();
      const client = buildSocket({ data: { connectionId: 'conn-1' } });
      const result = await gateway(handler).onJoin(client, { room: ' orders ' });
      expect(result).toEqual({ ok: true, room: 'orders' });
      expect(handler.handleJoin).toHaveBeenCalledWith('conn-1', 'orders');
      expect(client.join).toHaveBeenCalledWith('orders');
    });

    it('rejects join without a room or registration', async () => {
      const handler = buildHandler();
      const registered = buildSocket({ data: { connectionId: 'conn-1' } });
      expect(await gateway(handler).onJoin(registered, {})).toEqual({ ok: false });
      const unregistered = buildSocket();
      expect(
        await gateway(handler).onJoin(unregistered, { room: 'orders' }),
      ).toEqual({ ok: false });
      expect(handler.handleJoin).not.toHaveBeenCalled();
    });

    it('does not join the socket room when the handler refuses', async () => {
      const handler = buildHandler();
      handler.handleJoin.mockResolvedValue(false);
      const client = buildSocket({ data: { connectionId: 'conn-1' } });
      const result = await gateway(handler).onJoin(client, { room: 'orders' });
      expect(result).toEqual({ ok: false, room: 'orders' });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('maps joinRide/cancelRide aliases to ride rooms', async () => {
      const handler = buildHandler();
      const client = buildSocket({ data: { connectionId: 'conn-1' } });
      const gw = gateway(handler);

      expect(await gw.onJoinRide(client, { rideId: 'r1' })).toEqual({
        ok: true,
        room: 'ride:r1',
      });
      expect(await gw.onJoinRide(client, { room: 'custom' })).toEqual({
        ok: true,
        room: 'custom',
      });
      expect(await gw.onJoinRide(client, {})).toEqual({ ok: false });

      expect(await gw.onCancelRide(client, { rideId: 'r1' })).toEqual({
        ok: true,
        room: 'ride:r1',
      });
      expect(await gw.onCancelRide(client, {})).toEqual({ ok: false });
      expect(handler.handleLeave).toHaveBeenCalledWith('conn-1', 'ride:r1');
    });

    it('handles entirely missing message bodies', async () => {
      const handler = buildHandler();
      const client = buildSocket({ data: { connectionId: 'conn-1' } });
      const gw = gateway(handler);
      const noBody = undefined as unknown as { room?: string };

      expect(await gw.onJoin(client, noBody)).toEqual({ ok: false });
      expect(await gw.onLeave(client, noBody)).toEqual({ ok: false });
      expect(await gw.onJoinRide(client, noBody)).toEqual({ ok: false });
      expect(await gw.onCancelRide(client, noBody)).toEqual({ ok: false });
    });

    it('leaves a room and skips socket leave when the handler refuses', async () => {
      const handler = buildHandler();
      const client = buildSocket({ data: { connectionId: 'conn-1' } });
      const gw = gateway(handler);

      expect(await gw.onLeave(client, { room: 'orders' })).toEqual({
        ok: true,
        room: 'orders',
      });
      expect(client.leave).toHaveBeenCalledWith('orders');

      handler.handleLeave.mockResolvedValue(false);
      expect(await gw.onLeave(client, { room: 'orders' })).toEqual({
        ok: false,
        room: 'orders',
      });

      expect(await gw.onLeave(client, {})).toEqual({ ok: false });
      expect(await gw.onLeave(buildSocket(), { room: 'x' })).toEqual({
        ok: false,
      });
    });
  });

  describe('heartbeat', () => {
    it('acknowledges heartbeats for registered connections only', () => {
      const handler = buildHandler();
      const gw = gateway(handler);
      const client = buildSocket({ data: { connectionId: 'conn-1' } });
      expect(gw.onHeartbeat(client)).toEqual({ ok: true });
      expect(handler.handleHeartbeat).toHaveBeenCalledWith('conn-1');
      expect(gw.onHeartbeat(buildSocket())).toEqual({ ok: false });
    });
  });
});
