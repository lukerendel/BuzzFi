export type DateRange = {
  from: string;
  to: string;
  label: string;
};

export type RangeView = "month" | "quarter" | "year" | "custom";

export function parseDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;

  let match = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (match) return validIso(match[1], match[2], match[3]);

  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (match) return validIso(match[3], match[1], match[2]);

  match = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(v);
  if (match) {
    const yy = Number(match[3]);
    const year = String(yy >= 70 ? 1900 + yy : 2000 + yy);
    return validIso(year, match[1], match[2]);
  }

  return null;
}

function validIso(year: string, month: string, day: string): string | null {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 1970 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(ym: string): DateRange {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: `${ym}-01`,
    to: `${ym}-${String(last).padStart(2, "0")}`,
    label: formatMonth(ym),
  };
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function quarterRange(year: number, quarter: number): DateRange {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const last = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  const from = `${year}-${String(startMonth).padStart(2, "0")}-01`;
  const to = `${year}-${String(endMonth).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to, label: `Q${quarter} ${year}` };
}

export function yearRange(year: number): DateRange {
  return { from: `${year}-01-01`, to: `${year}-12-31`, label: String(year) };
}

export function inclusiveDays(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1;
  return Math.round((b - a) / 86_400_000) + 1;
}

export function previousRange(range: DateRange, view: RangeView): DateRange {
  if (view === "month") return monthRange(shiftMonth(range.from.slice(0, 7), -1));
  if (view === "quarter") {
    const year = Number(range.from.slice(0, 4));
    const month = Number(range.from.slice(5, 7));
    const quarter = Math.floor((month - 1) / 3) + 1;
    if (quarter === 1) return quarterRange(year - 1, 4);
    return quarterRange(year, quarter - 1);
  }
  if (view === "year") return yearRange(Number(range.from.slice(0, 4)) - 1);
  const days = inclusiveDays(range.from, range.to);
  const start = new Date(`${range.from}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days);
  const end = new Date(`${range.from}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  const from = start.toISOString().slice(0, 10);
  const to = end.toISOString().slice(0, 10);
  return { from, to, label: `${formatDay(from)} – ${formatDay(to)}` };
}

export function yearAgoRange(range: DateRange): DateRange {
  const shift = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y - 1, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) {
      return new Date(Date.UTC(y - 1, m, 0)).toISOString().slice(0, 10);
    }
    return dt.toISOString().slice(0, 10);
  };
  const from = shift(range.from);
  const to = shift(range.to);
  const label =
    range.from.slice(0, 7) === range.to.slice(0, 7) &&
    range.from.endsWith("-01") &&
    range.to === monthRange(range.from.slice(0, 7)).to
      ? formatMonth(from.slice(0, 7))
      : `${formatDay(from)} – ${formatDay(to)}`;
  return { from, to, label };
}

export function compareRange(
  range: DateRange,
  view: RangeView,
  mode: "previous" | "year",
): DateRange {
  return mode === "year" ? yearAgoRange(range) : previousRange(range, view);
}

export function monthPace(now: Date) {
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = now.getDate();
  return { day, days, timeRatio: day / days };
}

export function inRange(iso: string, range: DateRange): boolean {
  return iso >= range.from && iso <= range.to;
}
