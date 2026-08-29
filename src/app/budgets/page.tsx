"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { BudgetProgress } from '@/components/finance/BudgetProgress';
import { AddBudgetModal } from '@/components/finance/AddBudgetModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/finance/EmptyState';
import { Plus, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  getBudgets,
  createBudget,
  computeBudgetSummary,
  ExtendedBudget,
} from '@/features/budgets';
import { getCategories } from '@/features/categories/categories';
import { formatExactMoney } from '@/lib/money/format';
import type { CategoryRow } from '@/types/database';

function getCurrentMonthString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export default function BudgetsPage() {
  const [currentPeriod, setCurrentPeriod] = useState(getCurrentMonthString());
  const [selectedCurrency, setSelectedCurrency] = useState('VND');
  const [budgets, setBudgets] = useState<ExtendedBudget[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [addBudgetOpen, setAddBudgetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [fetchedBudgets, fetchedCategories] = await Promise.all([
        getBudgets({ periodMonth: currentPeriod, currencyCode: selectedCurrency }),
        getCategories(),
      ]);
      setBudgets(fetchedBudgets);
      setCategories(fetchedCategories);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải ngân sách');
    } finally {
      setLoading(false);
    }
  }, [currentPeriod, selectedCurrency]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

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
        subtitle={`Kiểm soát hạn mức các danh mục trong ${periodLabel}.`}
      >
        <div className="flex items-center space-x-2">
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
          <Button size="sm" variant="outline" onClick={loadData}>Thử lại</Button>
        </div>
      )}

      {/* Overall Budget Status Card */}
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
              {summary.overBudgetCount > 0 ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
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
                summary.basisPoints > 10000 ? 'bg-red-500' : 'bg-slate-900 dark:bg-slate-100'
              }
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Đã sử dụng {summary.percentStr}% tổng định mức</span>
              <span>
                {summary.basisPoints <= 10000
                  ? `Còn lại ${formatExactMoney(summary.remaining, selectedCurrency)}`
                  : `Vượt ngân sách`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Categories Budget Grid or Empty State */}
      {loading && budgets.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Đang tải dữ liệu ngân sách...
        </div>
      ) : budgets.length === 0 ? (
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
              <BudgetProgress key={b.id} budget={b} />
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
    </AppShell>
  );
}
