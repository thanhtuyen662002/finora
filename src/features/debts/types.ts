import type {
  DebtDetailRow,
  DebtPaymentDetailRow,
  DebtPaymentFrequency,
  DebtType,
} from '@/types/database';

export type { DebtPaymentFrequency, DebtType };

export type DebtCreateInput = {
  name: string;
  lender_name?: string | null;
  debt_type: DebtType;
  principal_amount: string;
  currency_code: string;
  interest_rate?: string;
  minimum_payment?: string | null;
  payment_frequency: DebtPaymentFrequency;
  first_due_date?: string | null;
  due_day?: number | null;
  note?: string | null;
};

export type DebtUpdateInput = Partial<Omit<DebtCreateInput, 'principal_amount'>> & {
  is_archived?: boolean;
};

export type DebtPaymentInput = {
  debt_id: string;
  account_id: string;
  category_id: string;
  account_amount: string;
  account_currency_code: string;
  debt_amount: string;
  principal_amount: string;
  interest_amount: string;
  exchange_rate: string;
  exchange_rate_source: string;
  exchange_rate_effective_date: string;
  paid_on: string;
  note?: string | null;
};

export type Debt = DebtDetailRow;
export type DebtPayment = DebtPaymentDetailRow;

export const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  PERSONAL_LOAN: 'Vay cá nhân',
  CREDIT_CARD: 'Thẻ tín dụng',
  MORTGAGE: 'Vay mua nhà',
  INSTALLMENT: 'Trả góp',
  BORROWED_FROM_PERSON: 'Mượn người thân',
  OTHER: 'Khác',
};

export const DEBT_FREQUENCY_LABELS: Record<DebtPaymentFrequency, string> = {
  ONE_TIME: 'Một lần',
  WEEKLY: 'Hàng tuần',
  MONTHLY: 'Hàng tháng',
  QUARTERLY: 'Hàng quý',
  YEARLY: 'Hàng năm',
};
