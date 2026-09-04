import { CurrencyCode } from '@/types/finance';
import { formatExactMoney, formatMoneyWithCode } from './index';

export { formatExactMoney, formatMoneyWithCode };

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  VND: '₫',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  CNY: '¥',
  KRW: '₩',
};

export const MOCK_EXCHANGE_RATES: Record<CurrencyCode, number> = {
  VND: 1,
  USD: 26200,
  EUR: 28400,
  JPY: 175,
  CNY: 3650,
  KRW: 19.5,
};

export function getMockExchangeRate(currency: CurrencyCode): number {
  return MOCK_EXCHANGE_RATES[currency] ?? 1;
}

export function convertMockToBase(
  amount: number,
  fromCurrency: CurrencyCode = 'VND',
  toCurrency: CurrencyCode = 'VND'
): number {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = MOCK_EXCHANGE_RATES[fromCurrency] ?? 1;
  const toRate = MOCK_EXCHANGE_RATES[toCurrency] ?? 1;
  const amountInVND = amount * fromRate;
  return Math.round((amountInVND / toRate) * 100) / 100;
}

export function formatMoney(
  amount: number | string,
  currency: string = 'VND',
  options?: {
    showSign?: boolean;
    compact?: boolean;
  }
): string {
  return formatExactMoney(String(amount), currency, options);
}

export function formatConverted(
  baseAmountVND: number | string,
  baseCurrency: string = 'VND'
): string {
  return `≈ ${formatMoney(baseAmountVND, baseCurrency)}`;
}

export function formatDateVN(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - compareDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Hôm qua';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day} Th${month}, ${year}`;
}
