import {
  InMemoryTransportAdapter,
  type InMemoryTransportLimits,
} from '../adapters/in-memory-transport.adapter';
import type { RealtimeSerializer } from '../contracts/realtime-serializer.interface';

/**
 * Socket.IO provider for the platform realtime layer (`src/platform/realtime`).
 *
 * Business modules must never import Socket.IO directly — they inject
 * {@link RealtimeService} and publish via rooms/users. This provider is the
 * in-process Socket.IO-compatible transport; clients connect through
 * {@link RealtimeGatewayHandler} with websocket primary and polling fallback.
 */
export class SocketIOProvider extends InMemoryTransportAdapter {
  public constructor(
    limits: InMemoryTransportLimits = {},
    serializer?: RealtimeSerializer,
  ) {
    super('socketio', limits, serializer);
  }
}
