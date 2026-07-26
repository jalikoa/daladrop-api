import {
  isPastCutoff,
  nextScheduledFor,
  parseCutoffTime,
  type SettlementPolicyLike,
} from '../domain/settlement-policy';

const RIDER_FRIDAY_POLICY: SettlementPolicyLike = {
  frequency: 'WEEKLY',
  cutoffDay: 5, // Friday
  cutoffTime: '16:30:00',
  timezone: 'Africa/Nairobi',
};

const DAILY_POLICY: SettlementPolicyLike = {
  frequency: 'DAILY',
  cutoffTime: '09:00',
  timezone: 'Africa/Nairobi',
};

const MANUAL_POLICY: SettlementPolicyLike = {
  frequency: 'MANUAL',
  cutoffTime: '00:00',
  timezone: 'UTC',
};

describe('parseCutoffTime', () => {
  it('parses HH:mm:ss', () => {
    expect(parseCutoffTime('16:30:00')).toEqual({ hours: 16, minutes: 30, seconds: 0 });
  });

  it('parses HH:mm (defaults seconds to 0)', () => {
    expect(parseCutoffTime('09:05')).toEqual({ hours: 9, minutes: 5, seconds: 0 });
  });

  it('rejects malformed input', () => {
    expect(() => parseCutoffTime('not-a-time')).toThrow(/Invalid cutoff time/);
  });

  it('rejects out-of-range hours/minutes/seconds', () => {
    expect(() => parseCutoffTime('24:00:00')).toThrow(/Invalid cutoff hours/);
    expect(() => parseCutoffTime('10:60:00')).toThrow(/Invalid cutoff minutes/);
    expect(() => parseCutoffTime('10:00:60')).toThrow(/Invalid cutoff seconds/);
  });
});

describe('isPastCutoff', () => {
  it('is always past cutoff for MANUAL policies', () => {
    expect(isPastCutoff(MANUAL_POLICY, new Date('2026-01-01T00:00:00Z'))).toBe(true);
  });

  it('is false on the cutoff weekday before the cutoff time (WEEKLY)', () => {
    // 2026-07-24 is a Friday. 16:00 Nairobi (UTC+3) = 13:00Z, before 16:30 local.
    const before = new Date('2026-07-24T13:00:00Z');
    expect(isPastCutoff(RIDER_FRIDAY_POLICY, before)).toBe(false);
  });

  it('is true on the cutoff weekday at/after the cutoff time (WEEKLY)', () => {
    // 16:30 Nairobi (UTC+3) = 13:30Z on the same Friday.
    const atCutoff = new Date('2026-07-24T13:30:00Z');
    expect(isPastCutoff(RIDER_FRIDAY_POLICY, atCutoff)).toBe(true);
  });

  it('is false on a non-cutoff weekday (WEEKLY)', () => {
    // 2026-07-25 is a Saturday.
    const saturday = new Date('2026-07-25T13:30:00Z');
    expect(isPastCutoff(RIDER_FRIDAY_POLICY, saturday)).toBe(false);
  });

  it('throws when WEEKLY policy has no cutoffDay', () => {
    const invalid = { ...RIDER_FRIDAY_POLICY, cutoffDay: null };
    expect(() => isPastCutoff(invalid, new Date())).toThrow(/cutoffDay is required/);
  });

  it('gates DAILY policies on time-of-day only', () => {
    // 08:00 Nairobi = 05:00Z, before 09:00 local cutoff.
    expect(isPastCutoff(DAILY_POLICY, new Date('2026-07-24T05:00:00Z'))).toBe(false);
    // 09:00 Nairobi = 06:00Z, at cutoff.
    expect(isPastCutoff(DAILY_POLICY, new Date('2026-07-24T06:00:00Z'))).toBe(true);
  });
});

describe('nextScheduledFor', () => {
  it('returns `from` immediately for MANUAL policies', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    expect(nextScheduledFor(MANUAL_POLICY, from)).toEqual(from);
  });

  it('finds the next Friday 16:30 Africa/Nairobi instant for WEEKLY policies', () => {
    // Monday 2026-07-20 — next Friday is 2026-07-24.
    const monday = new Date('2026-07-20T05:00:00Z');
    const next = nextScheduledFor(RIDER_FRIDAY_POLICY, monday);
    // 16:30 Nairobi (UTC+3) == 13:30Z.
    expect(next.toISOString()).toBe('2026-07-24T13:30:00.000Z');
  });

  it('rolls over to the following week when already past this cutoff', () => {
    // Just after this Friday's cutoff — expect next week's Friday.
    const justAfter = new Date('2026-07-24T13:31:00Z');
    const next = nextScheduledFor(RIDER_FRIDAY_POLICY, justAfter);
    expect(next.toISOString()).toBe('2026-07-31T13:30:00.000Z');
  });

  it('returns today for DAILY when cutoff has not yet passed', () => {
    const before = new Date('2026-07-24T05:00:00Z'); // 08:00 Nairobi
    const next = nextScheduledFor(DAILY_POLICY, before);
    expect(next.toISOString()).toBe('2026-07-24T06:00:00.000Z'); // 09:00 Nairobi
  });

  it('returns tomorrow for DAILY when cutoff already passed today', () => {
    const after = new Date('2026-07-24T07:00:00Z'); // 10:00 Nairobi
    const next = nextScheduledFor(DAILY_POLICY, after);
    expect(next.toISOString()).toBe('2026-07-25T06:00:00.000Z');
  });

  it('never hardcodes Friday/16:30 — a different policy schedules differently', () => {
    const mondayNoonPolicy: SettlementPolicyLike = {
      frequency: 'WEEKLY',
      cutoffDay: 1, // Monday
      cutoffTime: '12:00:00',
      timezone: 'Africa/Nairobi',
    };
    const from = new Date('2026-07-20T05:00:00Z'); // Monday, before noon local
    const next = nextScheduledFor(mondayNoonPolicy, from);
    expect(next.toISOString()).toBe('2026-07-20T09:00:00.000Z'); // 12:00 Nairobi same day
  });
});
