"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { BudgetProgress } from '@/components/finance/BudgetProgress';
import { AddBudgetModal } from '@/components/finance/AddBudgetModal';
import { EditBudgetModal } from '@/components/finance/EditBudgetModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/finance/EmptyState';
import { Select } from '@/components/ui/select';
import {
  Plus,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Archive,
} from 'lucide-react';
import {
  getBudgets,
  createBudget,
  updateBudget,
  archiveBudget,
  unarchiveBudget,
  computeBudgetSummary,
  ExtendedBudget,
} from '@/features/budgets';
import { getCategories } from '@/features/categories/categories';
import { getAccounts } from '@/features/accounts/accounts';
import { getCurrentUserSettings } from '@/lib/auth';
import { validateAndResolveTimezone, getCalendarDateInTimezone } from '@/features/reports/engine';
import { formatExactMoney } from '@/lib/money/format';
import type { CategoryRow } from '@/types/database';

function getDefaultPeriodMonth(timeZone: string): string {
  const today = getCalendarDateInTimezone(timeZone);
  return `${today.monthPrefix}-01`;
}

function getAdjacentMonth(currentPeriod: string, offset: -1 | 1): string {
  const parts = currentPeriod.split('-');
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10) + offset;
  if (month < 1) {
    month = 12;
    year -= 1;
  } else if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

const COMMON_CURRENCIES = ['VND', 'USD', 'EUR', 'JPY', 'CNY', 'KRW'];

export default function BudgetsPage() {
  const [resolvedTimezone, setResolvedTimezone] = useState('Asia/Ho_Chi_Minh');
  const [selectedCurrency, setSelectedCurrency] = useState('VND');
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>(COMMON_CURRENCIES);
  const [currentPeriod, setCurrentPeriod] = useState<string>('2026-08-01');
  const [showArchived, setShowArchived] = useState(false);
  const [budgets, setBudgets] = useState<ExtendedBudget[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [addBudgetOpen, setAddBudgetOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<ExtendedBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);

  // 1. Initial settings load
  useEffect(() => {
    async function initSettings() {
      try {
        const { data: settings, error: sErr } = await getCurrentUserSettings();
        if (sErr) throw sErr;
        const tz = validateAndResolveTimezone(settings?.timezone);
        setResolvedTimezone(tz);
        const baseCurr = settings?.base_currency?.toUpperCase() || 'VND';
        setSelectedCurrency(baseCurr);
        setCurrentPeriod(getDefaultPeriodMonth(tz));

        const accs = await getAccounts().catch(() => []);
        const currs = Array.from(
          new Set([baseCurr, ...COMMON_CURRENCIES, ...accs.map((a) => a.currency_code)])
        );
        setAvailableCurrencies(currs);
        setInitialized(true);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Không thể khởi tạo cài đặt người dùng');
        setLoading(false);
      }
    }
    initSettings();
  }, []);

  const loadData = useCallback(async () => {
    if (!initialized) return;
    try {
      setLoading(true);
      setError('');
      const [fetchedBudgets, fetchedCategories] = await Promise.all([
        getBudgets({
          periodMonth: currentPeriod,
          currencyCode: selectedCurrency,
          includeArchived: showArchived,
        }),
        getCategories(),
      ]);
      setBudgets(fetchedBudgets);
      setCategories(fetchedCategories);
    } catch (err: unknown) {
      setBudgets([]);
      setError(err instanceof Error ? err.message : 'Không thể tải ngân sách');
    } finally {
      setLoading(false);
    }
  }, [initialized, currentPeriod, selectedCurrency, showArchived]);

  useEffect(() => {
    if (initialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [initialized, loadData]);

  const summary = useMemo(() => {
    return computeBudgetSummary(budgets, selectedCurrency);
  }, [budgets, selectedCurrency]);

  const handleAddBudget = async (data: { categoryId: string; limitAmount: string }) => {
    await createBudget({
      category_id: data.categoryId,
      limit_amount: data.limitAmount,
      currency_code: selectedCurrency,
      period_month: currentPeriod,
    });
    await loadData();
  };

  const handleEditBudget = async (id: string, updates: { limitAmount: string }) => {
    await updateBudget(id, {
      limit_amount: updates.limitAmount,
    });
    await loadData();
  };

  const handleArchiveBudget = async (b: ExtendedBudget) => {
    if (confirm(`Bạn có chắc chắn muốn lưu trữ ngân sách danh mục "${b.categoryName}"?`)) {
      await archiveBudget(b.id);
      await loadData();
    }
  };

  const handleUnarchiveBudget = async (b: ExtendedBudget) => {
    await unarchiveBudget(b.id);
    await loadData();
  };

  const periodLabel = useMemo(() => {
    const parts = currentPeriod.split('-');
    if (parts.length >= 2) {
      return `Tháng ${parseInt(parts[1], 10)}/${parts[0]}`;
    }
    return currentPeriod;
  }, [currentPeriod]);

  return (
    <AppShell>
      <PageHeader
        title="Ngân sách chi tiêu"
        subtitle={`Kiểm soát hạn mức các danh mục trong ${periodLabel} (${resolvedTimezone}).`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1 border rounded-lg p-0.5 bg-card">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentPeriod((p) => getAdjacentMonth(p, -1))}
              title="Tháng trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-semibold px-2 min-w-[90px] text-center">
              {periodLabel}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentPeriod((p) => getAdjacentMonth(p, 1))}
              title="Tháng sau"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="w-28">
            <Select
              id="budgetCurrencySelect"
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              options={availableCurrencies.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <Button
            size="sm"
            variant={showArchived ? 'secondary' : 'outline'}
            onClick={() => setShowArchived(!showArchived)}
            title="Hiện/ẩn danh mục đã lưu trữ"
          >
            <Archive className="h-4 w-4 mr-1.5" />
            {showArchived ? 'Đang hiện lưu trữ' : 'Đã lưu trữ'}
          </Button>

          <Button size="sm" variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button size="sm" onClick={() => setAddBudgetOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Thiết lập ngân sách
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

      {/* Overall Budget Status Card (hidden or blanked on error) */}
      {!error && (
        <Card className="border">
          <CardContent className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tổng ngân sách {periodLabel}
                </span>
                <div className="flex items-baseline space-x-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
                    {formatExactMoney(summary.totalSpent, selectedCurrency)}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">
                    / {formatExactMoney(summary.totalLimit, selectedCurrency)}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {summary.isOverBudget ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                    <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                    Tổng chi tiêu vượt ngân sách ({formatExactMoney(summary.overage, selectedCurrency)})
                  </span>
                ) : summary.overBudgetCount > 0 ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                    {summary.overBudgetCount} danh mục vượt ngân sách
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Chi tiêu trong tầm kiểm soát
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Progress
                value={Math.min(Math.floor(summary.basisPoints / 100), 100)}
                className="h-3"
                indicatorClassName={
                  summary.isOverBudget ? 'bg-red-500' : 'bg-slate-900 dark:bg-slate-100'
                }
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Đã sử dụng {summary.percentStr}% tổng định mức</span>
                <span className={summary.isOverBudget ? 'text-red-600 font-semibold' : ''}>
                  {summary.isOverBudget
                    ? `Vượt ${formatExactMoney(summary.overage, selectedCurrency)}`
                    : `Còn lại ${formatExactMoney(summary.remaining, selectedCurrency)}`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual Categories Budget Grid or Empty State */}
      {loading && budgets.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Đang tải dữ liệu ngân sách...
        </div>
      ) : budgets.length === 0 && !error ? (
        <EmptyState
          title="Chưa thiết lập ngân sách"
          description={`Đặt hạn mức chi tiêu hàng tháng cho từng danh mục để kiểm soát tài chính trong ${periodLabel}.`}
          actionLabel="+ Thiết lập ngân sách"
          onAction={() => setAddBudgetOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-foreground">
            Chi tiết danh mục ({budgets.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {budgets.map((b) => (
              <BudgetProgress
                key={b.id}
                budget={b}
                onEdit={(item) => setEditingBudget(item)}
                onArchive={handleArchiveBudget}
                onUnarchive={handleUnarchiveBudget}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add Budget Modal */}
      <AddBudgetModal
        open={addBudgetOpen}
        onOpenChange={setAddBudgetOpen}
        categories={categories}
        currencyCode={selectedCurrency}
        periodMonth={currentPeriod}
        onSuccess={handleAddBudget}
      />

      {/* Edit Budget Modal */}
      <EditBudgetModal
        open={!!editingBudget}
        onOpenChange={(open) => {
          if (!open) setEditingBudget(null);
        }}
        budget={editingBudget}
        onSuccess={handleEditBudget}
      />
    </AppShell>
  );
}
