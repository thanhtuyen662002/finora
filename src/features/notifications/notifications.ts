import { createClient } from '@/lib/supabase/client';
import { getCurrentUserSettings } from '@/lib/auth';
import { getCalendarDateInTimezone } from '@/features/reports/engine';
import { getBudgets } from '@/features/budgets/budgets';
import { getRecurringItems } from '@/features/recurring/recurring';
import { formatExactMoney } from '@/lib/money/format';
import type { NotificationPreferenceRow } from '@/types/database';
import type {
  FinancialNotification,
  NotificationDigest,
  NotificationPreferences,
  NotificationPreferencesUpdate,
} from './types';

async function getAuthenticatedUser() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Unauthorized');
  }

  return { supabase, user };
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { supabase, user } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as NotificationPreferenceRow;

  const { data: created, error: createError } = await supabase
    .from('notification_preferences')
    .insert({ user_id: user.id })
    .select('*')
    .single();

  if (!createError && created) {
    return created as NotificationPreferenceRow;
  }

  // A concurrent first load may have created the row between SELECT and INSERT.
  if (createError?.code === '23505') {
    const { data: retried, error: retryError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!retryError && retried) {
      return retried as NotificationPreferenceRow;
    }
  }

  throw createError || new Error('Unable to initialize notification preferences');
}

export async function updateNotificationPreferences(
  updates: NotificationPreferencesUpdate
): Promise<NotificationPreferences> {
  const { supabase, user } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: user.id,
        budget_alerts_enabled: Boolean(updates.budget_alerts_enabled),
        recurring_reminders_enabled: Boolean(updates.recurring_reminders_enabled),
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single();

  if (error) throw error;
  return data as NotificationPreferenceRow;
}

function resolveTodayForUser(timezone: string | undefined): string {
  try {
    return getCalendarDateInTimezone(timezone || 'Asia/Ho_Chi_Minh').dateString;
  } catch {
    return getCalendarDateInTimezone('Asia/Ho_Chi_Minh').dateString;
  }
}

async function getUserToday(): Promise<string> {
  const { data: settings } = await getCurrentUserSettings();
  return resolveTodayForUser(settings?.timezone);
}

function formatBudgetPercent(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = basisPoints % 100;
  if (fraction === 0) return String(whole);
  return \`\${whole}.\${String(fraction).padStart(2, '0').replace(/0+$/, '')}\`;
}

function severityRank(severity: FinancialNotification['severity']): number {
  if (severity === 'critical') return 0;
  if (severity === 'warning') return 1;
  return 2;
}

export async function getNotificationDigest(): Promise<NotificationDigest> {
  const preferences = await getNotificationPreferences();
  const today = await getUserToday();
  const periodMonth = \`\${today.slice(0, 7)}-01\`;

  const [budgets, recurringItems] = await Promise.all([
    preferences.budget_alerts_enabled
      ? getBudgets({ periodMonth, includeArchived: false })
      : Promise.resolve([]),
    preferences.recurring_reminders_enabled
      ? getRecurringItems({
          includeArchived: false,
          includePaused: false,
          asOfDate: today,
        })
      : Promise.resolve([]),
  ]);

  const notifications: FinancialNotification[] = [];

  for (const budget of budgets) {
    if (budget.basisPoints < 8000) continue;

    const percentage = formatBudgetPercent(budget.basisPoints);
    const spent = formatExactMoney(budget.spent_amount, budget.currency_code);
    const limit = formatExactMoney(budget.limit_amount, budget.currency_code);

    notifications.push({
      id: \`budget:\${budget.id}:\${budget.period_month}:80\`,
      kind: 'BUDGET_THRESHOLD',
      severity: budget.isOverBudget ? 'critical' : 'warning',
      title: \`Ngân sách \${budget.categoryName}\`,
      message: \`Đã dùng \${percentage}% (\${spent} / \${limit}).\`,
      href: '/budgets',
      currency_code: budget.currency_code,
    });
  }

  for (const item of recurringItems) {
    if (
      item.transaction_type !== 'EXPENSE' ||
      item.nextDueDate === null ||
      item.daysUntilDue === null ||
      item.daysUntilDue < 0 ||
      item.daysUntilDue > 3
    ) {
      continue;
    }

    const dueLabel =
      item.daysUntilDue === 0 ? 'hôm nay' : \`còn \${item.daysUntilDue} ngày\`;
    notifications.push({
      id: \`recurring:\${item.id}:\${item.nextDueDate}\`,
      kind: 'RECURRING_REMINDER',
      severity: item.daysUntilDue === 0 ? 'warning' : 'info',
      title: \`Sắp đến hạn: \${item.name}\`,
      message: \`\${formatExactMoney(item.amount, item.currency_code)} · \${dueLabel} (\${item.nextDueDate}).\`,
      href: '/recurring',
      currency_code: item.currency_code,
      due_date: item.nextDueDate,
    });
  }

  notifications.sort((a, b) => {
    const severityDifference = severityRank(a.severity) - severityRank(b.severity);
    if (severityDifference !== 0) return severityDifference;
    return a.title.localeCompare(b.title, 'vi');
  });

  return {
    generated_on: today,
    preferences,
    notifications,
  };
}
