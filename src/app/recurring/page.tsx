"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/finance/EmptyState';
import { AddRecurringModal } from '@/components/finance/AddRecurringModal';
import { formatExactMoney, formatDateVN } from '@/lib/money/format';
import {
  Repeat,
  Calendar,
  Plus,
  Play,
  Pause,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getRecurringItems,
  createRecurringItem,
  pauseRecurringItem,
  resumeRecurringItem,
  computeRecurringSummary,
  ExtendedRecurringItem,
  RecurringItemInsertInput,
} from '@/features/recurring';
import { getAccounts } from '@/features/accounts/accounts';
import { getCategories } from '@/features/categories/categories';
import type { AccountRow, CategoryRow } from '@/types/database';

export default function RecurringPage() {
  const [selectedCurrency, setSelectedCurrency] = useState('VND');
  const [recurringList, setRecurringList] = useState<ExtendedRecurringItem[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [items, accs, cats] = await Promise.all([
        getRecurringItems({ currencyCode: selectedCurrency }),
        getAccounts(),
        getCategories(),
      ]);
      setRecurringList(items);
      setAccounts(accs);
      setCategories(cats);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách định kỳ');
    } finally {
      setLoading(false);
    }
  }, [selectedCurrency]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const summary = useMemo(() => {
    return computeRecurringSummary(recurringList, selectedCurrency);
  }, [recurringList, selectedCurrency]);

  const handleToggleStatus = async (item: ExtendedRecurringItem) => {
    try {
      if (item.is_paused) {
        await resumeRecurringItem(item.id);
      } else {
        await pauseRecurringItem(item.id);
      }
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái');
    }
  };

  const handleAddRecurring = async (newItem: RecurringItemInsertInput) => {
    await createRecurringItem(newItem);
    await loadData();
  };

  const formatFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'WEEKLY':
        return 'Hàng tuần';
      case 'YEARLY':
        return 'Hàng năm';
      default:
        return 'Hàng tháng';
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Định kỳ & Hóa đơn"
        subtitle={`Quản lý các gói đăng ký, hóa đơn dịch vụ và thu nhập lặp lại (${selectedCurrency}).`}
      >
        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Thêm khoản định kỳ
          </Button>
        </div>
      </PageHeader>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={loadData}>Thử lại</Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-card border">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tổng hóa đơn cố định hàng tháng
              </span>
              <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                -{formatExactMoney(summary.monthlyExpenseProjected, selectedCurrency)}
              </p>
              <span className="text-xs text-muted-foreground">
                {summary.activeCount} khoản đang kích hoạt ({summary.pausedCount} tạm ngưng)
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-slate-600 dark:text-slate-400">
              <Repeat className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Thu nhập định kỳ hàng tháng
              </span>
              <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                +{formatExactMoney(summary.monthlyIncomeProjected, selectedCurrency)}
              </p>
              <span className="text-xs text-muted-foreground">
                Dòng tiền ròng định kỳ: {formatExactMoney(summary.netMonthlyProjected, selectedCurrency)}/tháng
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Calendar className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recurring Items List */}
      {loading && recurringList.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Đang tải danh sách định kỳ...
        </div>
      ) : recurringList.length === 0 ? (
        <EmptyState
          title="Chưa có khoản định kỳ"
          description="Thiết lập các khoản thu hoặc chi lặp lại (Netflix, Spotify, tiền nhà, lương...) để quản lý dự báo."
          actionLabel="+ Thêm khoản định kỳ"
          onAction={() => setAddModalOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-foreground">
            Danh sách dịch vụ & hóa đơn ({recurringList.length})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {recurringList.map((item) => {
              const isIncome = item.transaction_type === 'INCOME';
              const isActive = !item.is_paused;

              return (
                <Card
                  key={item.id}
                  className={cn(
                    'transition-all duration-200 border',
                    !isActive ? 'opacity-60 bg-muted/20' : 'bg-card'
                  )}
                >
                  <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                    <div className="flex items-center space-x-3 min-w-0 pr-2">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-2xs"
                        style={{ backgroundColor: item.categoryColor || '#64748b' }}
                      >
                        <Layers className="h-4 w-4" />
                      </div>
                      <div className="truncate">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-semibold text-foreground truncate">
                            {item.name}
                          </h4>
                          <Badge
                            variant={isActive ? 'default' : 'secondary'}
                            className="text-[10px] uppercase font-mono px-1.5 py-0"
                          >
                            {isActive ? 'Đang chạy' : 'Tạm dừng'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {item.accountName} · {formatFrequencyLabel(item.frequency)} · {item.categoryName}
                        </p>
                        {item.nextDueDate && (
                          <div className="flex items-center space-x-1 text-[11px] text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              Kỳ tới: {formatDateVN(item.nextDueDate)}
                              {item.daysUntilDue !== null && item.daysUntilDue >= 0
                                ? ` (sau ${item.daysUntilDue} ngày)`
                                : item.daysUntilDue !== null && item.daysUntilDue < 0
                                ? ` (đã qua hạn ${Math.abs(item.daysUntilDue)} ngày)`
                                : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end space-y-2">
                      <span
                        className={cn(
                          'text-sm sm:text-base font-bold',
                          isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
                        )}
                      >
                        {isIncome ? '+' : '-'}
                        {formatExactMoney(item.amount, item.currency_code)}
                      </span>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(item)}
                        className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                      >
                        {isActive ? (
                          <>
                            <Pause className="h-3.5 w-3.5 mr-1 text-amber-500" />
                            Tạm ngưng
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                            Kích hoạt
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Recurring Modal */}
      <AddRecurringModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        accounts={accounts}
        categories={categories}
        currencyCode={selectedCurrency}
        onSuccess={handleAddRecurring}
      />
    </AppShell>
  );
}
