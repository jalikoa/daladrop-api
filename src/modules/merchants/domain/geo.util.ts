const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const DAY_MAP = [
  'SUN',
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
] as const;

export function currentDayOfWeek(now = new Date()): (typeof DAY_MAP)[number] {
  return DAY_MAP[now.getUTCDay()]!;
}

/** Compare HH:mm strings in local wall time approximation (Africa/Nairobi = UTC+3). */
export function isWithinOpeningHours(
  hours: readonly {
    readonly day: string;
    readonly openTime: string | null;
    readonly closeTime: string | null;
    readonly isClosed: boolean;
  }[],
  now = new Date(),
): boolean {
  const nairobiMs = now.getTime() + 3 * 60 * 60 * 1000;
  const local = new Date(nairobiMs);
  const day = DAY_MAP[local.getUTCDay()]!;
  const row = hours.find((h) => h.day === day);
  if (!row || row.isClosed || !row.openTime || !row.closeTime) return false;
  const minutes =
    local.getUTCHours() * 60 + local.getUTCMinutes();
  const [oh, om] = row.openTime.split(':').map(Number);
  const [ch, cm] = row.closeTime.split(':').map(Number);
  const open = (oh ?? 0) * 60 + (om ?? 0);
  const close = (ch ?? 0) * 60 + (cm ?? 0);
  if (close < open) {
    return minutes >= open || minutes <= close;
  }
  return minutes >= open && minutes <= close;
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
