import type { NotificationPreferenceRow } from '@/types/database';

export type NotificationPreferences = NotificationPreferenceRow;

export type NotificationPreferencesUpdate = Pick<
  NotificationPreferenceRow,
  'budget_alerts_enabled' | 'recurring_reminders_enabled'
>;

export type NotificationKind = 'BUDGET_THRESHOLD' | 'RECURRING_REMINDER';
export type NotificationSeverity = 'info' | 'warning' | 'critical';

export type FinancialNotification = {
  id: string;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  message: string;
  href: '/budgets' | '/recurring';
  currency_code?: string;
  due_date?: string;
};

export type NotificationDigest = {
  generated_on: string;
  preferences: NotificationPreferences;
  notifications: FinancialNotification[];
};
