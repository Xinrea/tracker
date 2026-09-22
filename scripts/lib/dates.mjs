export function parseISODate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}

export function addDays(iso, days) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dayIndex(iso, weekStart) {
  const [year, month, day] = iso.split("-").map(Number);
  const sunday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekStart === "monday" ? (sunday + 6) % 7 : sunday;
}

export function weekStartOf(iso, weekStart) {
  return addDays(iso, -dayIndex(iso, weekStart));
}

export function eachDate(start, end) {
  const dates = [];
  if (!start || !end || start > end) return dates;
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function todayInTimeZone(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function formatChineseDate(iso) {
  const [year, month, day] = iso.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function isValidTimeZone(timeZone) {
  try {
    Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeDate(value) {
  if (typeof value === "string") return parseISODate(value.trim());
  if (value instanceof Date) {
    if (typeof value.isDate === "function" && !value.isDate()) return null;
    if (Number.isNaN(value.getTime())) return null;
    return parseISODate(value.toISOString().slice(0, 10));
  }
  return null;
}
