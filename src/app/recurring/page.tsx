"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/finance/EmptyState';
import { AddRecurringModal } from '@/components/finance/AddRecurringModal';
import { EditRecurringModal } from '@/components/finance/EditRecurringModal';
import { formatExactMoney, formatDateVN } from '@/lib/money/format';
import {
  Repeat,
  Calendar,
  Plus,
  Play,
  Pause,
  Layers,
  RefreshCw,
  Edit2,
  Archive,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getRecurringItems,
  createRecurringItem,
  updateRecurringItem,
  pauseRecurringItem,
  resumeRecurringItem,
  archiveRecurringItem,
  unarchiveRecurringItem,
  computeRecurringSummary,
  ExtendedRecurringItem,
  RecurringItemInsertInput,
  RecurringItemUpdateInput,
} from '@/features/recurring';
import { getAccounts } from '@/features/accounts/accounts';
import { getCategories } from '@/features/categories/categories';
import { getCurrentUserSettings } from '@/lib/auth';
import { getCalendarDateInTimezone, validateAndResolveTimezone } from '@/features/reports/engine';
import type { AccountRow, CategoryRow } from '@/types/database';

export default function RecurringPage() {
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>([]);
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
  const [showArchived, setShowArchived] = useState(false);
  const [recurringList, setRecurringList] = useState<ExtendedRecurringItem[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExtendedRecurringItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function initSettings() {
      try {
        setLoading(true);
        setError('');
        const { data: settings, error: sErr } = await getCurrentUserSettings();
        if (sErr) throw sErr;

        const tz = validateAndResolveTimezone(settings?.timezone || 'Asia/Ho_Chi_Minh');
        setTimezone(tz);

        const [accs, cats] = await Promise.all([
          getAccounts(),
          getCategories(),
        ]);
        setAccounts(accs);
        setCategories(cats);

        const realCurrencies = Array.from(
          new Set(accs.map((a) => a.currency_code).filter(Boolean))
        ).sort();

        const baseCurr = settings?.base_currency?.toUpperCase() || 'VND';
        let initialCurrency = baseCurr;

        if (realCurrencies.length > 0) {
          if (realCurrencies.includes(baseCurr)) {
            initialCurrency = baseCurr;
          } else {
            initialCurrency = realCurrencies[0];
          }
          setAvailableCurrencies(realCurrencies);
        } else {
          setAvailableCurrencies([baseCurr]);
        }

        setSelectedCurrency(initialCurrency);
        setInitialized(true);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Không thể tải cài đặt');
        setLoading(false);
      }
    }
    initSettings();
  }, []);

  const loadData = useCallback(async () => {
    if (!initialized || !selectedCurrency) return;
    try {
      setLoading(true);
      setError('');
      const asOfDate = getCalendarDateInTimezone(timezone).dateString;
      const [items, accs, cats] = await Promise.all([
        getRecurringItems({
          currencyCode: selectedCurrency,
          asOfDate,
          includeArchived: showArchived,
        }),
        getAccounts(),
        getCategories(),
      ]);
      setRecurringList(items);
      setAccounts(accs);
      setCategories(cats);
    } catch (err: unknown) {
      setRecurringList([]);
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách định kỳ');
    } finally {
      setLoading(false);
    }
  }, [initialized, selectedCurrency, timezone, showArchived]);

  useEffect(() => {
    if (initialized && selectedCurrency) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [initialized, selectedCurrency, timezone, showArchived, loadData]);

  const summary = useMemo(() => {
    return computeRecurringSummary(recurringList, selectedCurrency);
  }, [recurringList, selectedCurrency]);

  const handleCurrencyChange = (newCurrency: string) => {
    if (newCurrency === selectedCurrency) return;
    setRecurringList([]);
    setLoading(true);
    setSelectedCurrency(newCurrency);
  };

  const handleToggleArchived = () => {
    setRecurringList([]);
    setLoading(true);
    setShowArchived((prev) => !prev);
  };

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

  const handleArchive = async (item: ExtendedRecurringItem) => {
    if (confirm(`Bạn có chắc chắn muốn lưu trữ khoản định kỳ "${item.name}"?`)) {
      try {
        await archiveRecurringItem(item.id);
        await loadData();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Không thể lưu trữ khoản định kỳ');
      }
    }
  };

  const handleUnarchive = async (item: ExtendedRecurringItem) => {
    try {
      await unarchiveRecurringItem(item.id);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể khôi phục khoản định kỳ');
    }
  };

  const handleAddSubmit = async (data: RecurringItemInsertInput) => {
    await createRecurringItem(data);
    await loadData();
  };

  const handleEditSubmit = async (id: string, updates: RecurringItemUpdateInput) => {
    await updateRecurringItem(id, updates);
    await loadData();
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'WEEKLY':
        return 'Hàng tuần';
      case 'MONTHLY':
        return 'Hàng tháng';
      case 'YEARLY':
        return 'Hàng năm';
      default:
        return freq;
    }
  };

  const defaultAnchorDate = useMemo(() => {
    return getCalendarDateInTimezone(timezone).dateString;
  }, [timezone]);

  return (
    <AppShell>
      <PageHeader
        title="Giao dịch định kỳ"
        subtitle={`Quản lý và dự báo các khoản thu chi lặp lại theo chu kỳ (${selectedCurrency || 'Đang tải'}, ${timezone}).`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {availableCurrencies.length > 0 && (
            <div className="w-28">
              <Select
                id="recurringCurrencySelect"
                value={selectedCurrency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                options={availableCurrencies.map((c) => ({ value: c, label: c }))}
              />
            </div>
          )}

          <Button
            size="sm"
            variant={showArchived ? 'secondary' : 'outline'}
            onClick={handleToggleArchived}
            title="Hiện/ẩn các mục đã lưu trữ"
          >
            <Archive className="h-4 w-4 mr-1.5" />
            {showArchived ? 'Đang hiện lưu trữ' : 'Đã lưu trữ'}
          </Button>

          <Button size="sm" variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button size="sm" onClick={() => setAddModalOpen(true)} disabled={!initialized}>
            <Plus className="h-4 w-4 mr-1.5" />
            Thêm khoản định kỳ
          </Button>
        </div>
      </PageHeader>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={loadData}>
            Thử lại
          </Button>
        </div>
      )}

      {/* Monthly Projections Summary Card */}
      {!error && !loading && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border">
              <CardContent className="p-5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Thu định kỳ dự tính (Quy đổi tháng)
                </span>
                <div className="text-xl font-bold mt-2 text-emerald-600 dark:text-emerald-400">
                  +{formatExactMoney(summary.monthlyIncomeProjected, selectedCurrency)}
                </div>
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  {summary.activeCount} khoản đang hoạt động
                </span>
              </CardContent>
            </Card>

            <Card className="border">
              <CardContent className="p-5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Chi định kỳ dự tính (Quy đổi tháng)
                </span>
                <div className="text-xl font-bold mt-2 text-red-600 dark:text-red-400">
                  -{formatExactMoney(summary.monthlyExpenseProjected, selectedCurrency)}
                </div>
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  {summary.pausedCount} khoản đang tạm dừng
                </span>
              </CardContent>
            </Card>

            <Card className="border">
              <CardContent className="p-5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Dòng tiền ròng dự tính (Quy đổi tháng)
                </span>
                <div
                  className={cn(
                    'text-xl font-bold mt-2',
                    summary.netMonthlyProjected.startsWith('-')
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-foreground'
                  )}
                >
                  {formatExactMoney(summary.netMonthlyProjected, selectedCurrency)}
                </div>
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Dự báo dòng tiền tháng quy đổi
                </span>
              </CardContent>
            </Card>
          </div>
          <p className="text-[11px] text-muted-foreground italic px-1">
            * Các khoản định kỳ là mẫu dự báo lập kế hoạch (Hàng tuần * 52 / 12, Hàng năm / 12). Hệ thống không tự động ghi nhận giao dịch vào số dư tài khoản.
          </p>
        </div>
      )}

      {/* Recurring Items List or Empty State */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Đang tải danh sách định kỳ...
        </div>
      ) : recurringList.length === 0 && !error ? (
        <EmptyState
          title="Chưa có khoản định kỳ nào"
          description={`Tạo các khoản thu nhập hoặc chi phí định kỳ (tiền thuê, lương, hóa đơn...) để theo dõi (${selectedCurrency}).`}
          actionLabel="+ Thêm khoản định kỳ"
          onAction={() => setAddModalOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">
              Danh sách khoản định kỳ ({recurringList.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recurringList.map((item) => (
              <Card
                key={item.id}
                className={cn(
                  'border transition-all duration-200 hover:shadow-xs',
                  item.is_archived
                    ? 'opacity-60 bg-muted/20 border-dashed'
                    : item.is_paused
                    ? 'opacity-75 bg-muted/10'
                    : ''
                )}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-semibold text-base text-foreground">
                          {item.name}
                        </h4>
                        {item.is_archived && (
                          <Badge variant="secondary" className="text-[10px] uppercase font-mono px-1 py-0">
                            Lưu trữ
                          </Badge>
                        )}
                        {item.is_paused && !item.is_archived && (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                            Tạm dừng
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-[10px]">
                          {getFrequencyLabel(item.frequency)}
                        </Badge>
                        <span>•</span>
                        <span>{item.categoryName}</span>
                        <span>•</span>
                        <span>{item.accountName}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={cn(
                          'text-base font-bold',
                          item.transaction_type === 'INCOME'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-foreground'
                        )}
                      >
                        {item.transaction_type === 'INCOME' ? '+' : '-'}
                        {formatExactMoney(item.amount, item.currency_code)}
                      </div>
                    </div>
                  </div>

                  {/* Due Date Indicator */}
                  {!item.is_archived && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                      <div className="flex items-center space-x-1.5 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          Kỳ tiếp theo:{' '}
                          {item.nextDueDate
                            ? formatDateVN(item.nextDueDate)
                            : item.is_paused
                            ? 'Đang tạm dừng'
                            : 'Đã hết hạn'}
                        </span>
                      </div>

                      {item.nextDueDate && (
                        <div>
                          {item.isOverdue ? (
                            <span className="font-semibold text-red-600 dark:text-red-400">
                              Quá hạn {Math.abs(item.daysUntilDue || 0)} ngày
                            </span>
                          ) : item.daysUntilDue === 0 ? (
                            <span className="font-semibold text-amber-600 dark:text-amber-400">
                              Đến hạn hôm nay
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              Còn {item.daysUntilDue} ngày
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end space-x-1 pt-1">
                    {!item.is_archived && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => handleToggleStatus(item)}
                          title={item.is_paused ? 'Tiếp tục chu kỳ' : 'Tạm dừng chu kỳ'}
                        >
                          {item.is_paused ? (
                            <>
                              <Play className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                              Tiếp tục
                            </>
                          ) : (
                            <>
                              <Pause className="h-3.5 w-3.5 mr-1 text-amber-600" />
                              Tạm dừng
                            </>
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setEditingItem(item)}
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" />
                          Sửa
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-muted-foreground hover:text-amber-600"
                          onClick={() => handleArchive(item)}
                          title="Lưu trữ"
                        >
                          <Archive className="h-3.5 w-3.5 mr-1" />
                          Lưu trữ
                        </Button>
                      </>
                    )}

                    {item.is_archived && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-emerald-600"
                        onClick={() => handleUnarchive(item)}
                        title="Khôi phục"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Khôi phục
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Add Recurring Modal */}
      {selectedCurrency && (
        <AddRecurringModal
          open={addModalOpen}
          onOpenChange={setAddModalOpen}
          accounts={accounts}
          categories={categories}
          currencyCode={selectedCurrency}
          defaultAnchorDate={defaultAnchorDate}
          onSuccess={handleAddSubmit}
        />
      )}

      {/* Edit Recurring Modal */}
      <EditRecurringModal
        open={!!editingItem}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
        item={editingItem}
        accounts={accounts}
        categories={categories}
        onSuccess={handleEditSubmit}
      />
    </AppShell>
  );
}
