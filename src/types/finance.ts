export type CurrencyCode = 'VND' | 'USD' | 'EUR' | 'JPY' | 'CNY' | 'KRW';

export type AccountType =
  | 'CASH'
  | 'BANK'
  | 'EWALLET'
  | 'SAVINGS'
  | 'CREDIT_CARD'
  | 'INVESTMENT'
  | 'OTHER';

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export type RecurringStatus = 'ACTIVE' | 'UPCOMING' | 'PAID' | 'OVERDUE' | 'PAUSED';

export interface MockAccount {
  id: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  balance: number;
  convertedBalanceVND: number;
  institution?: string;
  accountNumberMasked?: string;
  color: string;
  icon?: string;
  isDefault?: boolean;
  isArchived?: boolean;
  monthlyInflow?: number;
  monthlyOutflow?: number;
}

export interface MockTransaction {
  id: string;
  userId?: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  exchangeRate?: number;
  baseAmountVND: number;
  baseCurrency?: CurrencyCode;
  accountId: string;
  accountName: string;
  toAccountId?: string;
  toAccountName?: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  merchant: string;
  note?: string;
  occurredAt: string; // ISO format: YYYY-MM-DD
  incomeSourceId?: string;
  incomeSourceName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MockCategory {
  id: string;
  name: string;
  type: 'EXPENSE' | 'INCOME';
  icon: string;
  color: string;
}

export interface MockBudget {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  limit: number;
  spent: number;
  currency: CurrencyCode;
  period: string; // e.g. "08/2026"
}

export interface MockGoal {
  id: string;
  userId?: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: CurrencyCode;
  targetDate: string;
  monthlyContribution: number;
  icon: string;
  color: string;
  category: string;
}

export interface MockRecurringItem {
  id: string;
  name: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  frequency: 'MONTHLY' | 'WEEKLY' | 'YEARLY';
  dayOfMonth: number;
  nextDueDate: string;
  accountId: string;
  accountName: string;
  categoryId: string;
  categoryName: string;
  status: RecurringStatus;
  icon?: string;
  color?: string;
  isAutoDeduct?: boolean;
  note?: string;
}

export interface MockIncomeSource {
  id: string;
  name: string;
  type: 'SALARY' | 'YOUTUBE' | 'FREELANCE' | 'INVESTMENT' | 'OTHER';
  totalBaseAmountVND: number;
  currency: CurrencyCode;
  originalAmount?: number;
  subSources?: {
    id: string;
    name: string;
    amount: number;
    currency: CurrencyCode;
    baseAmountVND: number;
  }[];
}

export interface MockCashFlowMonth {
  month: string; // e.g. "Th03", "Th04"
  income: number;
  expense: number;
  savings: number;
}

export interface MockUserAdmin {
  id: string;
  name: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE' | 'INVITED';
  baseCurrency: CurrencyCode;
  aiCredentialSource: 'SYSTEM' | 'ADMIN_ASSIGNED' | 'PERSONAL';
  lastActive: string;
  avatarUrl?: string;
}

export interface MockAIModelConfig {
  task: string;
  taskLabel: string;
  configuredModel: string;
  provider: string;
  status: 'READY' | 'MAINTENANCE';
}

export interface MockFeatureFlag {
  key: string;
  title: string;
  description: string;
  enabled: boolean;
  category: 'AI' | 'FINANCE' | 'SYSTEM';
}

// Presentation input models for Phase 1 mock creation flows
export interface MockAccountInput {
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  balance: number;
  institution?: string;
  color: string;
}

export interface MockTransactionInput {
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  accountId: string;
  toAccountId?: string;
  categoryId: string;
  merchant: string;
  note?: string;
  occurredAt: string;
  incomeSourceId?: string;
}

export interface MockGoalInput {
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency?: CurrencyCode;
  targetDate: string;
  color: string;
  icon: string;
  category: string;
  monthlyContribution: number;
}

export interface MockBudgetInput {
  categoryId: string;
  categoryName?: string;
  limit: number;
  period?: string;
}

