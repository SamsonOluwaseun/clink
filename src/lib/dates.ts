// Calendar dates as 'YYYY-MM-DD' in the phone's own time zone

export function localDay(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseDay(s);
  d.setDate(d.getDate() + n);
  return localDay(d);
}

// Weeks run Monday to Sunday
export function weekStart(s: string = localDay()): string {
  const d = parseDay(s);
  const back = (d.getDay() + 6) % 7;
  return addDays(s, -back);
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function shortDay(s: string) {
  return DAYS[parseDay(s).getDay()];
}

export function dayLabel(s: string): string {
  const today = localDay();
  if (s === today) return 'Today';
  if (s === addDays(today, -1)) return 'Yesterday';
  const d = parseDay(s);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function rangeLabel(from: string, to: string): string {
  const a = parseDay(from);
  const b = parseDay(to);
  const sameMonth = a.getMonth() === b.getMonth();
  return sameMonth
    ? `${a.getDate()} to ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`
    : `${a.getDate()} ${MONTHS[a.getMonth()]} to ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}
