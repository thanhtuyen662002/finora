import { convertExactAmount, toExactRate } from '@/lib/exchange-rate/fx-math';
import {
  addExactDecimals,
  compareExactDecimals,
  isNonNegativeExactDecimal,
  isPositiveExactDecimal,
  toExactDecimal,
} from '@/lib/money';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type DebtPaymentCurrencyInput = {
  accountAmount: string;
  debtAmount: string;
  principalAmount: string;
  interestAmount: string;
  accountCurrencyCode: string;
  debtCurrencyCode: string;
  exchangeRate: string;
  exchangeRateSource: string;
  exchangeRateEffectiveDate: string;
  paidOn: string;
};

export type NormalizedDebtPaymentCurrency = {
  accountAmount: string;
  debtAmount: string;
  principalAmount: string;
  interestAmount: string;
  accountCurrencyCode: string;
  debtCurrencyCode: string;
  exchangeRate: string;
  exchangeRateSource: string;
  exchangeRateEffectiveDate: string;
  paidOn: string;
};

function normalizeCurrency(value: string, field: string): string {
  const normalized = (value || '').trim().toUpperCase();
  if (!/^[A-Z]{3,5}$/.test(normalized)) {
    throw new Error(field + ' không hợp lệ.');
  }
  return normalized;
}

function normalizeDate(value: string, field: string): string {
  const normalized = (value || '').trim();
  if (!ISO_DATE_PATTERN.test(normalized)) {
    throw new Error(field + ' không hợp lệ.');
  }
  return normalized;
}

/**
 * Normalizes and reconciles the two sides of a debt repayment without using
 * native floating-point arithmetic. The server RPC repeats this contract.
 */
export function normalizeDebtPaymentCurrency(
  input: DebtPaymentCurrencyInput
): NormalizedDebtPaymentCurrency {
  const accountAmount = toExactDecimal(input.accountAmount);
  const debtAmount = toExactDecimal(input.debtAmount);
  const principalAmount = toExactDecimal(input.principalAmount);
  const interestAmount = toExactDecimal(input.interestAmount);
  const accountCurrencyCode = normalizeCurrency(input.accountCurrencyCode, 'Tiền tệ tài khoản');
  const debtCurrencyCode = normalizeCurrency(input.debtCurrencyCode, 'Tiền tệ khoản nợ');
  const exchangeRate = toExactRate(input.exchangeRate);
  const exchangeRateSource = (input.exchangeRateSource || '').trim();
  const exchangeRateEffectiveDate = normalizeDate(
    input.exchangeRateEffectiveDate,
    'Ngày hiệu lực tỷ giá'
  );
  const paidOn = normalizeDate(input.paidOn, 'Ngày thanh toán');

  if (!isPositiveExactDecimal(accountAmount) || !isPositiveExactDecimal(debtAmount)) {
    throw new Error('Số tiền thanh toán phải lớn hơn 0.');
  }
  if (!isNonNegativeExactDecimal(principalAmount) || !isNonNegativeExactDecimal(interestAmount)) {
    throw new Error('Tiền gốc và tiền lãi không được âm.');
  }
  if (exchangeRateSource.length === 0 || exchangeRateSource.length > 100) {
    throw new Error('Nguồn tỷ giá là bắt buộc và tối đa 100 ký tự.');
  }
  if (exchangeRateEffectiveDate > paidOn) {
    throw new Error('Ngày hiệu lực tỷ giá không được sau ngày thanh toán.');
  }

  const expectedDebtAmount = addExactDecimals(principalAmount, interestAmount);
  if (debtAmount !== expectedDebtAmount) {
    throw new Error('Số tiền khoản nợ phải bằng tiền gốc cộng tiền lãi.');
  }

  if (accountCurrencyCode === debtCurrencyCode) {
    if (exchangeRate !== '1.000000000000' || accountAmount !== debtAmount) {
      throw new Error('Cùng tiền tệ phải dùng tỷ giá 1:1 và hai số tiền bằng nhau.');
    }
  } else if (convertExactAmount(accountAmount, exchangeRate) !== debtAmount) {
    throw new Error('Số tiền tài khoản, số tiền khoản nợ và tỷ giá chưa khớp.');
  }

  return {
    accountAmount,
    debtAmount,
    principalAmount,
    interestAmount,
    accountCurrencyCode,
    debtCurrencyCode,
    exchangeRate,
    exchangeRateSource,
    exchangeRateEffectiveDate,
    paidOn,
  };
}

export function assertPrincipalWithinOutstanding(
  principalAmount: string,
  outstandingAmount: string
): void {
  if (compareExactDecimals(principalAmount, outstandingAmount) > 0) {
    throw new Error('Tiền gốc thanh toán vượt quá dư nợ hiện tại.');
  }
}
