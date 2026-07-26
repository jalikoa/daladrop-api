export interface NotificationView {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly createdAt: Date;
  readonly rideId: string | null;
  readonly orderId: string | null;
  readonly bookingId: string | null;
  readonly data: unknown;
  readonly read: boolean;
  readonly readAt: Date | null;
}

export interface CreateInAppNotificationInput {
  readonly userId: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly rideId?: string;
  readonly orderId?: string;
  readonly bookingId?: string;
  readonly data?: Record<string, unknown>;
}

/** Canonical in-app notification types used by event listeners. */
export const NotificationType = {
  RIDE_STATUS: 'RIDE_STATUS',
  RIDE_COMPLETED: 'RIDE_COMPLETED',
  FOOD_ORDER: 'FOOD_ORDER',
  ORDER_STATUS: 'ORDER_STATUS',
  EVENT_BOOKING: 'EVENT_BOOKING',
  SUPPORT_TICKET: 'SUPPORT_TICKET',
  BROADCAST: 'BROADCAST',
} as const;

export type NotificationTypeValue =
  (typeof NotificationType)[keyof typeof NotificationType];
