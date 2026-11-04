// All money is stored as whole pence to avoid rounding errors.

export function formatPence(pence: number): string {
  const sign = pence < 0 ? '-' : '';
  const abs = Math.abs(pence);
  if (abs < 100) return `${sign}${abs}p`;
  const pounds = abs / 100;
  return `${sign}£${Number.isInteger(pounds) ? pounds : pounds.toFixed(2)}`;
}

// "1.50" or "£1.50" or "50p" -> pence. Returns null if it cannot be read.
export function parseToPence(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s/g, '');
  if (!s) return null;
  if (s.endsWith('p') && !s.startsWith('£')) {
    const n = Number(s.slice(0, -1));
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  }
  const n = Number(s.replace('£', ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export const quickAmounts = [10, 20, 50, 100, 200];
