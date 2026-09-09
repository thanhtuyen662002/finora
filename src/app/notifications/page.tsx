"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/finance/EmptyState';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Info,
  RefreshCw,
  WalletCards,
} from 'lucide-react';
import { getNotificationDigest } from '@/features/notifications';
import type {
  FinancialNotification,
  NotificationDigest,
} from '@/features/notifications';

function formatGeneratedDate(dateString: string): string {
  const [year, month, day] = dateString.split('-');
  if (!year || !month || !day) return dateString;
  return `${day}/${month}/${year}`;
}

function NotificationPageIcon({ item }: { item: FinancialNotification }) {
  if (item.kind === 'BUDGET_THRESHOLD') {
    return item.severity === 'critical' ? (
      <AlertTriangle className="h-5 w-5" />
    ) : (
      <WalletCards className="h-5 w-5" />
    );
  }

  return item.severity === 'warning' ? (
    <AlertTriangle className="h-5 w-5" />
  ) : (
    <CalendarClock className="h-5 w-5" />
  );
}

function notificationClasses(item: FinancialNotification): string {
  if (item.severity === 'critical') {
    return 'finora-notice-error border rounded-xl p-4';
  }
  if (item.severity === 'warning') {
    return 'finora-notice-warning border rounded-xl p-4';
  }
  return 'border border-border rounded-xl p-4 bg-card';
}

export default function NotificationsPage() {
  const router = useRouter();
  const [digest, setDigest] = useState<NotificationDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const nextDigest = await getNotificationDigest();
      setDigest(nextDigest);
    } catch (err: unknown) {
      setDigest(null);
      setError(err instanceof Error ? err.message : 'Không thể tải thông báo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const notificationCount = digest?.notifications.length ?? 0;

  return (
    <AppShell>
      <PageHeader
        title="Thông báo"
        subtitle="Cảnh báo ngân sách và nhắc khoản chi định kỳ trong ứng dụng."
      >
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-foreground">
                  Trung tâm thông báo
                </p>
                <p className="text-xs text-muted-foreground">
                  {loading
                    ? 'Đang kiểm tra dữ liệu tài chính...'
                    : `${notificationCount} thông báo đang cần chú ý`}
                </p>
              </div>
            </div>
            {digest && (
              <span className="text-xs text-muted-foreground">
                Cập nhật {formatGeneratedDate(digest.generated_on)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="finora-notice-error p-4 border rounded-xl text-sm" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Đang tải thông báo...
        </div>
      ) : digest && digest.notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Chưa có thông báo mới"
          description="Khi ngân sách đạt 80% hoặc khoản chi định kỳ còn tối đa 3 ngày, thông báo sẽ xuất hiện tại đây."
          actionLabel="Mở cài đặt thông báo"
          onAction={() => router.push('/settings')}
        />
      ) : (
        <div className="space-y-3">
          {digest?.notifications.map((item) => (
            <Card key={item.id} className={notificationClasses(item)}>
              <CardContent className="p-0">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0" aria-hidden="true">
                    <NotificationPageIcon item={item} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold">{item.title}</h2>
                      <span className="text-[11px] font-medium uppercase tracking-wide">
                        {item.kind === 'BUDGET_THRESHOLD' ? 'Ngân sách' : 'Định kỳ'}
                      </span>
                    </div>
                    <p className="text-sm leading-6">{item.message}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(item.href)}
                    >
                      {item.kind === 'BUDGET_THRESHOLD'
                        ? 'Mở ngân sách'
                        : 'Mở khoản định kỳ'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Thông báo được tạo theo yêu cầu từ dữ liệu hiện tại. Finora chưa gửi email/push và không tự động ghi nhận giao dịch.
      </p>
    </AppShell>
  );
}
