import { compareExactDecimals, toExactDecimal } from '@/lib/money';
import { convertExactAmount, toExactRate } from '@/lib/exchange-rate/fx-math';

export type AccountDomainInfo = {
  id: string;
  currency_code: string;
  is_archived?: boolean;
};

export type NormalizedTransferData = {
  source_currency_code: string;
  destination_currency_code: string;
  currency_code: string;
  amount: string;
  exchange_rate: string;
  destination_amount: string;
};

export function validateAndNormalizeTransferAmount(amount: string): string {
  if (typeof amount !== 'string' || !amount.trim()) {
    throw new Error('Transfer amount must be a non-empty string');
  }
  const normalized = toExactDecimal(amount);
  if (compareExactDecimals(normalized, '0.0000') <= 0) {
    throw new Error('Transfer amount must be strictly greater than zero');
  }
  return normalized;
}

export function validateTransferAccounts(
  fromAccount: AccountDomainInfo,
  toAccount: AccountDomainInfo,
  isUpdate = false,
  changedFrom = false,
  changedTo = false
): void {
  if (fromAccount.id === toAccount.id) {
    throw new Error('Source and destination accounts must be different');
  }

  if (!isUpdate || changedFrom) {
    if (fromAccount.is_archived) {
      throw new Error('Cannot create transfer from an archived account');
    }
  }

  if (!isUpdate || changedTo) {
    if (toAccount.is_archived) {
      throw new Error('Cannot create transfer to an archived account');
    }
  }
}

export function computeNormalizedTransferData(
  fromAccount: AccountDomainInfo,
  toAccount: AccountDomainInfo,
  amount: string,
  rawExchangeRate?: string
): NormalizedTransferData {
  validateTransferAccounts(fromAccount, toAccount);
  const normalizedAmount = validateAndNormalizeTransferAmount(amount);
  const sourceCurrency = fromAccount.currency_code.toUpperCase().trim();
  const destCurrency = toAccount.currency_code.toUpperCase().trim();

  let destAmount: string;
  let exRate: string;

  if (sourceCurrency === destCurrency) {
    destAmount = normalizedAmount;
    exRate = '1.000000000000';
  } else {
    if (!rawExchangeRate || !rawExchangeRate.trim()) {
      throw new Error('Cross-currency transfer requires an explicit exchange rate');
    }
    exRate = toExactRate(rawExchangeRate);
    destAmount = convertExactAmount(normalizedAmount, exRate);
  }

  return {
    source_currency_code: sourceCurrency,
    destination_currency_code: destCurrency,
    currency_code: sourceCurrency,
    amount: normalizedAmount,
    exchange_rate: exRate,
    destination_amount: destAmount,
  };
}
