export type ReceivablePaymentFrequency =
  | 'ONE_TIME'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'YEARLY';

export type Receivable = {
  id: string;
  user_id: string;
  name: string;
  borrower_name: string;
  principal_amount: string;
  outstanding_amount: string;
  currency_code: string;
  interest_rate: string;
  expected_payment: string | null;
  payment_frequency: ReceivablePaymentFrequency;
  first_due_date: string | null;
  due_day: number | null;
  note: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  funding_account_id: string | null;
  funding_account_name: string | null;
  funding_account_type: string | null;
  received_principal_amount: string;
  received_interest_amount: string;
  payment_count: number;
};

export type ReceivablePayment = {
  id: string;
  user_id: string;
  receivable_id: string;
  amount: string;
  principal_amount: string;
  interest_amount: string;
  paid_on: string;
  note: string | null;
  created_at: string;
  receiving_account_id: string | null;
  receiving_account_name: string | null;
  interest_transaction_id: string | null;
  receivable_name: string;
  borrower_name: string;
  currency_code: string;
};

export type ReceivableCreateInput = {
  name: string;
  borrower_name: string;
  principal_amount: string;
  currency_code: string;
  funding_account_id: string;
  interest_rate?: string;
  expected_payment?: string | null;
  payment_frequency: ReceivablePaymentFrequency;
  first_due_date?: string | null;
  due_day?: number | null;
  note?: string | null;
};

export type ReceivableUpdateInput = Partial<
  Omit<ReceivableCreateInput, 'principal_amount' | 'currency_code' | 'funding_account_id'>
> & {
  funding_account_id?: string;
  is_archived?: boolean;
};

export type ReceivablePaymentInput = {
  receivable_id: string;
  receiving_account_id: string;
  amount: string;
  principal_amount: string;
  interest_amount: string;
  paid_on: string;
  note?: string | null;
};

export const RECEIVABLE_FREQUENCY_LABELS: Record<ReceivablePaymentFrequency, string> = {
  ONE_TIME: 'Một lần',
  WEEKLY: 'Hàng tuần',
  MONTHLY: 'Hàng tháng',
  QUARTERLY: 'Hàng quý',
  YEARLY: 'Hàng năm',
};
