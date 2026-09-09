"use client";

import { createClient } from '@/lib/supabase/client';

export interface FinoraBackup {
  format: 'finora-backup';
  version: 1;
  exported_at: string;
  user_id: string;
  data: {
    profiles: unknown[];
    user_settings: unknown[];
    notification_preferences: unknown[];
    accounts: unknown[];
    categories: unknown[];
    transactions: unknown[];
    transfers: unknown[];
    transaction_fx_snapshots: unknown[];
    budgets: unknown[];
    goals: unknown[];
    recurring_items: unknown[];
    income_sources: unknown[];
    income_source_streams: unknown[];
    debts: unknown[];
    debt_payments: unknown[];
  };
}

export async function buildUserBackup(): Promise<FinoraBackup> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để xuất bản sao lưu.');
  }

  const [
    profilesResult,
    settingsResult,
    notificationPreferencesResult,
    accountsResult,
    categoriesResult,
    transactionsResult,
    transfersResult,
    snapshotsResult,
    budgetsResult,
    goalsResult,
    recurringItemsResult,
    incomeSourcesResult,
    incomeStreamsResult,
    debtsResult,
    debtPaymentsResult,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).limit(1),
    supabase.from('user_settings').select('*').eq('user_id', user.id).limit(1),
    supabase.from('notification_preferences').select('*').eq('user_id', user.id).limit(1),
    supabase.from('accounts').select('*').eq('user_id', user.id).limit(10000),
    supabase.from('categories').select('*').eq('user_id', user.id).limit(10000),
    supabase.from('transactions').select('*').eq('user_id', user.id).limit(10000),
    supabase.from('transfers').select('*').eq('user_id', user.id).limit(10000),
    supabase.from('transaction_fx_snapshots').select('*').eq('user_id', user.id).limit(10000),
    supabase.from('budgets').select('*').eq('user_id', user.id).limit(10000),
    supabase.from('goals').select('*').eq('user_id', user.id).limit(10000),
    supabase.from('recurring_items').select('*').eq('user_id', user.id).limit(10000),
    supabase.from('income_sources').select('*').eq('user_id', user.id).limit(10000),
    supabase.from('income_source_streams').select('*').eq('user_id', user.id).limit(10000),
    supabase.from('debts').select('*').eq('user_id', user.id).limit(10000),
    supabase.from('debt_payments').select('*').eq('user_id', user.id).limit(10000),
  ]);

  const results = [
    profilesResult,
    settingsResult,
    notificationPreferencesResult,
    accountsResult,
    categoriesResult,
    transactionsResult,
    transfersResult,
    snapshotsResult,
    budgetsResult,
    goalsResult,
    recurringItemsResult,
    incomeSourcesResult,
    incomeStreamsResult,
    debtsResult,
    debtPaymentsResult,
  ];

  const failedResult = results.find((result) => result.error);
  if (failedResult?.error) {
    throw new Error('Không thể đọc đầy đủ dữ liệu của tài khoản để tạo bản sao lưu.');
  }

  return {
    format: 'finora-backup',
    version: 1,
    exported_at: new Date().toISOString(),
    user_id: user.id,
    data: {
      profiles: profilesResult.data ?? [],
      user_settings: settingsResult.data ?? [],
      notification_preferences: notificationPreferencesResult.data ?? [],
      accounts: accountsResult.data ?? [],
      categories: categoriesResult.data ?? [],
      transactions: transactionsResult.data ?? [],
      transfers: transfersResult.data ?? [],
      transaction_fx_snapshots: snapshotsResult.data ?? [],
      budgets: budgetsResult.data ?? [],
      goals: goalsResult.data ?? [],
      recurring_items: recurringItemsResult.data ?? [],
      income_sources: incomeSourcesResult.data ?? [],
      income_source_streams: incomeStreamsResult.data ?? [],
      debts: debtsResult.data ?? [],
      debt_payments: debtPaymentsResult.data ?? [],
    },
  };
}

export function downloadBackupFile(backup: FinoraBackup): void {
  if (typeof window === 'undefined') {
    throw new Error('Tính năng tải bản sao lưu chỉ khả dụng trên trình duyệt.');
  }

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const exportDate = backup.exported_at.slice(0, 10);

  link.href = url;
  link.download = `finora-backup-${exportDate}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
