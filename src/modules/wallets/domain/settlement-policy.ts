/**
 * Pure settlement scheduling helpers. Nothing here hardcodes a specific
 * weekday, time, or amount — every value is driven by {@link SettlementPolicyLike}
 * fields (seeded per-policy, e.g. rider Friday 16:30 Africa/Nairobi).
 */

export type SettlementFrequencyLike = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'MANUAL';

export interface SettlementPolicyLike {
  readonly frequency: SettlementFrequencyLike | string;
  /** ISO weekday 1=Monday..7=Sunday. Required for WEEKLY/BIWEEKLY. */
  readonly cutoffDay?: number | null;
  /** `HH:mm` or `HH:mm:ss`, interpreted in {@link timezone}. */
  readonly cutoffTime: string;
  readonly timezone: string;
}

export interface ParsedCutoffTime {
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const CUTOFF_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/** Parses `HH:mm[:ss]` into numeric parts, validating ranges. */
export function parseCutoffTime(cutoffTime: string): ParsedCutoffTime {
  const match = CUTOFF_PATTERN.exec(cutoffTime.trim());
  if (!match) {
    throw new Error(`Invalid cutoff time "${cutoffTime}" (expected HH:mm[:ss])`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  if (hours < 0 || hours > 23) {
    throw new Error(`Invalid cutoff hours in "${cutoffTime}"`);
  }
  if (minutes < 0 || minutes > 59) {
    throw new Error(`Invalid cutoff minutes in "${cutoffTime}"`);
  }
  if (seconds < 0 || seconds > 59) {
    throw new Error(`Invalid cutoff seconds in "${cutoffTime}"`);
  }
  return { hours, minutes, seconds };
}

interface ZonedParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  /** ISO weekday 1=Monday..7=Sunday. */
  readonly weekday: number;
}

const WEEKDAY_MAP: Readonly<Record<string, number>> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const map: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    map[part.type] = part.value;
  }
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAY_MAP[map.weekday] ?? 1,
  };
}

/** Offset (minutes) such that `localTime = instant + offset`. */
function timezoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** Converts a local wall-clock date/time in `timeZone` to a UTC instant. */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number,
  timeZone: string,
): Date {
  const guessUtcMs = Date.UTC(year, month - 1, day, hours, minutes, seconds);
  const offsetMinutes = timezoneOffsetMinutes(new Date(guessUtcMs), timeZone);
  return new Date(guessUtcMs - offsetMinutes * 60_000);
}

/**
 * Whether `now` (interpreted in the policy timezone) is at/after the current
 * period's cutoff moment. MANUAL policies are always past cutoff (no
 * schedule gate); DAILY/MONTHLY gate on time-of-day only (schema has no
 * day-of-month field); WEEKLY/BIWEEKLY additionally require `cutoffDay`.
 */
export function isPastCutoff(policy: SettlementPolicyLike, now: Date): boolean {
  if (policy.frequency === 'MANUAL') return true;

  const cutoff = parseCutoffTime(policy.cutoffTime);
  const parts = zonedParts(now, policy.timezone);
  const timeReached =
    parts.hour > cutoff.hours ||
    (parts.hour === cutoff.hours && parts.minute > cutoff.minutes) ||
    (parts.hour === cutoff.hours &&
      parts.minute === cutoff.minutes &&
      parts.second >= cutoff.seconds);

  if (policy.frequency === 'WEEKLY' || policy.frequency === 'BIWEEKLY') {
    if (policy.cutoffDay == null) {
      throw new Error(`cutoffDay is required for ${policy.frequency} policies`);
    }
    return parts.weekday === policy.cutoffDay && timeReached;
  }

  return timeReached;
}

/**
 * The next UTC instant (at/after `from`) at which the policy's cutoff will
 * occur (or is currently occurring).
 */
export function nextScheduledFor(policy: SettlementPolicyLike, from: Date): Date {
  const cutoff = parseCutoffTime(policy.cutoffTime);

  if (policy.frequency === 'MANUAL') {
    return from;
  }

  if (policy.frequency === 'WEEKLY' || policy.frequency === 'BIWEEKLY') {
    if (policy.cutoffDay == null) {
      throw new Error(`cutoffDay is required for ${policy.frequency} policies`);
    }
    for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
      const probe = new Date(from.getTime() + dayOffset * DAY_MS);
      const parts = zonedParts(probe, policy.timezone);
      if (parts.weekday !== policy.cutoffDay) continue;
      const candidate = zonedTimeToUtc(
        parts.year,
        parts.month,
        parts.day,
        cutoff.hours,
        cutoff.minutes,
        cutoff.seconds,
        policy.timezone,
      );
      if (candidate.getTime() >= from.getTime()) return candidate;
    }
    throw new Error('Unable to compute next scheduled settlement date');
  }

  const todayParts = zonedParts(from, policy.timezone);
  const todayCandidate = zonedTimeToUtc(
    todayParts.year,
    todayParts.month,
    todayParts.day,
    cutoff.hours,
    cutoff.minutes,
    cutoff.seconds,
    policy.timezone,
  );
  if (todayCandidate.getTime() >= from.getTime()) return todayCandidate;

  const tomorrow = new Date(todayCandidate.getTime() + DAY_MS);
  const tomorrowParts = zonedParts(tomorrow, policy.timezone);
  return zonedTimeToUtc(
    tomorrowParts.year,
    tomorrowParts.month,
    tomorrowParts.day,
    cutoff.hours,
    cutoff.minutes,
    cutoff.seconds,
    policy.timezone,
  );
}
