import { BadRequestException } from '@nestjs/common';
import { SupportTicketStatus } from '@prisma/client';

/**
 * Canonical support ticket lifecycle graph. Terminal states
 * (`CLOSED` / `CANCELLED`) only reopen to `OPEN`.
 */
export const SUPPORT_TICKET_TRANSITIONS: Readonly<
  Record<SupportTicketStatus, readonly SupportTicketStatus[]>
> = {
  [SupportTicketStatus.OPEN]: [
    SupportTicketStatus.PENDING,
    SupportTicketStatus.ASSIGNED,
    SupportTicketStatus.IN_PROGRESS,
    SupportTicketStatus.WAITING_CUSTOMER,
    SupportTicketStatus.WAITING_MERCHANT,
    SupportTicketStatus.ESCALATED,
    SupportTicketStatus.RESOLVED,
    SupportTicketStatus.CLOSED,
    SupportTicketStatus.CANCELLED,
  ],
  [SupportTicketStatus.PENDING]: [
    SupportTicketStatus.OPEN,
    SupportTicketStatus.ASSIGNED,
    SupportTicketStatus.IN_PROGRESS,
    SupportTicketStatus.WAITING_CUSTOMER,
    SupportTicketStatus.WAITING_MERCHANT,
    SupportTicketStatus.ESCALATED,
    SupportTicketStatus.RESOLVED,
    SupportTicketStatus.CLOSED,
    SupportTicketStatus.CANCELLED,
  ],
  [SupportTicketStatus.ASSIGNED]: [
    SupportTicketStatus.IN_PROGRESS,
    SupportTicketStatus.WAITING_CUSTOMER,
    SupportTicketStatus.WAITING_MERCHANT,
    SupportTicketStatus.PENDING,
    SupportTicketStatus.ESCALATED,
    SupportTicketStatus.RESOLVED,
    SupportTicketStatus.CLOSED,
    SupportTicketStatus.CANCELLED,
  ],
  [SupportTicketStatus.IN_PROGRESS]: [
    SupportTicketStatus.WAITING_CUSTOMER,
    SupportTicketStatus.WAITING_MERCHANT,
    SupportTicketStatus.PENDING,
    SupportTicketStatus.ESCALATED,
    SupportTicketStatus.RESOLVED,
    SupportTicketStatus.CLOSED,
    SupportTicketStatus.CANCELLED,
  ],
  [SupportTicketStatus.WAITING_CUSTOMER]: [
    SupportTicketStatus.IN_PROGRESS,
    SupportTicketStatus.PENDING,
    SupportTicketStatus.ESCALATED,
    SupportTicketStatus.RESOLVED,
    SupportTicketStatus.CLOSED,
    SupportTicketStatus.CANCELLED,
  ],
  [SupportTicketStatus.WAITING_MERCHANT]: [
    SupportTicketStatus.IN_PROGRESS,
    SupportTicketStatus.PENDING,
    SupportTicketStatus.ESCALATED,
    SupportTicketStatus.RESOLVED,
    SupportTicketStatus.CLOSED,
    SupportTicketStatus.CANCELLED,
  ],
  [SupportTicketStatus.ESCALATED]: [
    SupportTicketStatus.IN_PROGRESS,
    SupportTicketStatus.ASSIGNED,
    SupportTicketStatus.RESOLVED,
    SupportTicketStatus.CLOSED,
    SupportTicketStatus.CANCELLED,
  ],
  [SupportTicketStatus.RESOLVED]: [
    SupportTicketStatus.CLOSED,
    SupportTicketStatus.OPEN,
    SupportTicketStatus.IN_PROGRESS,
  ],
  [SupportTicketStatus.CLOSED]: [SupportTicketStatus.OPEN],
  [SupportTicketStatus.CANCELLED]: [SupportTicketStatus.OPEN],
};

export function isAllowedSupportTransition(
  from: SupportTicketStatus,
  to: SupportTicketStatus,
): boolean {
  if (from === to) return true;
  return SUPPORT_TICKET_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertSupportTransition(
  from: SupportTicketStatus,
  to: SupportTicketStatus,
): void {
  if (!isAllowedSupportTransition(from, to)) {
    throw new BadRequestException(
      `Cannot transition support ticket from ${from} to ${to}`,
    );
  }
}
