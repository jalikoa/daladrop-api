import { assertSupportTransition } from '../domain/support-ticket-lifecycle';
import { SupportTicketStatus } from '@prisma/client';

describe('support ticket lifecycle', () => {
  it('allows OPEN → ASSIGNED → RESOLVED → CLOSED', () => {
    expect(() =>
      assertSupportTransition(
        SupportTicketStatus.OPEN,
        SupportTicketStatus.ASSIGNED,
      ),
    ).not.toThrow();
    expect(() =>
      assertSupportTransition(
        SupportTicketStatus.ASSIGNED,
        SupportTicketStatus.RESOLVED,
      ),
    ).not.toThrow();
    expect(() =>
      assertSupportTransition(
        SupportTicketStatus.RESOLVED,
        SupportTicketStatus.CLOSED,
      ),
    ).not.toThrow();
  });

  it('rejects CLOSED → ASSIGNED', () => {
    expect(() =>
      assertSupportTransition(
        SupportTicketStatus.CLOSED,
        SupportTicketStatus.ASSIGNED,
      ),
    ).toThrow(/Cannot transition/);
  });

  it('allows reopen CLOSED → OPEN', () => {
    expect(() =>
      assertSupportTransition(
        SupportTicketStatus.CLOSED,
        SupportTicketStatus.OPEN,
      ),
    ).not.toThrow();
  });
});
