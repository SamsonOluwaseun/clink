/*
 * Money is stored as whole minor units (pence, cents or kobo) to avoid rounding
 * errors. The family's currency only changes how amounts are shown and typed:
 * amounts are never converted between currencies.
 */

export type CurrencyCode = 'GBP' | 'USD' | 'CAD' | 'NGN';

export interface Currency {
  code: CurrencyCode;
  name: string;
  country: string;
  symbol: string;
  minor: string | null; // suffix for small amounts, e.g. 50p, 50¢
  quick: number[]; // reward amounts offered as chips, in minor units
  targets: number[]; // goal prices offered as chips, in minor units
  scale: number; // starter activity amounts, relative to the pound amounts
  example: string; // placeholder for typing an amount
  priceExample: string;
}

export const currencies: Record<CurrencyCode, Currency> = {
  GBP: {
    code: 'GBP', name: 'Pound sterling', country: 'United Kingdom', symbol: '£', minor: 'p',
    quick: [10, 20, 50, 100, 200], targets: [500, 1000, 1500, 2000, 3000], scale: 1,
    example: 'e.g. 75p or £1.25', priceExample: 'e.g. 12.99',
  },
  USD: {
    code: 'USD', name: 'US dollar', country: 'United States', symbol: '$', minor: '¢',
    quick: [10, 25, 50, 100, 200], targets: [500, 1000, 1500, 2000, 3000], scale: 1,
    example: 'e.g. 75¢ or $1.25', priceExample: 'e.g. 12.99',
  },
  CAD: {
    code: 'CAD', name: 'Canadian dollar', country: 'Canada', symbol: '$', minor: '¢',
    quick: [10, 25, 50, 100, 200], targets: [500, 1000, 1500, 2000, 3000], scale: 1,
    example: 'e.g. 75¢ or $1.25', priceExample: 'e.g. 12.99',
  },
  NGN: {
    code: 'NGN', name: 'Nigerian naira', country: 'Nigeria', symbol: '₦', minor: null,
    quick: [5000, 10000, 20000, 50000, 100000], targets: [500000, 1000000, 2000000, 3000000, 5000000], scale: 200,
    example: 'e.g. 250 or 1,500', priceExample: 'e.g. 15000',
  },
};

export const currencyList: Currency[] = [currencies.GBP, currencies.USD, currencies.CAD, currencies.NGN];

let current: Currency = currencies.GBP;

export function setActiveCurrency(code: CurrencyCode) {
  current = currencies[code] ?? currencies.GBP;
}

export function money(): Currency {
  return current;
}

export function isCurrencyCode(v: unknown): v is CurrencyCode {
  return v === 'GBP' || v === 'USD' || v === 'CAD' || v === 'NGN';
}

// Suggests a currency from the phone's region
export function currencyForRegion(region: string | null | undefined): CurrencyCode {
  switch ((region ?? '').toUpperCase()) {
    case 'US': return 'USD';
    case 'CA': return 'CAD';
    case 'NG': return 'NGN';
    default: return 'GBP';
  }
}

function group(n: number) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatMoney(minor: number, c: Currency = current): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minor));
  if (c.minor && abs < 100) return `${sign}${abs}${c.minor}`;
  const whole = Math.floor(abs / 100);
  const part = abs % 100;
  return `${sign}${c.symbol}${group(whole)}${part ? '.' + String(part).padStart(2, '0') : ''}`;
}

// "1.50", "£1.50", "50p", "75¢", "₦1,500" -> minor units. Returns null if unreadable.
export function parseMoney(input: string): number | null {
  let s = input.trim().toLowerCase().replace(/[\s,]/g, '');
  if (!s) return null;
  s = s.replace(/^(ngn|gbp|usd|cad|us\$|ca\$|c\$|[£$₦])/, '');
  const minorSuffix = /(p|¢|c|k|kobo)$/;
  if (minorSuffix.test(s)) {
    const n = Number(s.replace(minorSuffix, ''));
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

// Major units as typed in a price field, e.g. 1500 -> "15", 1299 -> "12.99"
export function toMajorText(minor: number) {
  return (minor / 100).toFixed(2).replace(/\.00$/, '');
}

// A tenth, rounded to something sensible to hand over
export function tithe(minor: number, c: Currency = current) {
  const raw = Math.max(0, minor) / 10;
  const step = c.code === 'NGN' ? 1000 : 5; // nearest ₦10, or nearest 5p / 5¢
  return Math.round(raw / step) * step;
}
