"use client";

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { BudgetProgress } from '@/components/finance/BudgetProgress';
import { AddBudgetModal } from '@/components/finance/AddBudgetModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { MOCK_BUDGETS } from '@/lib/mock/budgets';
import { MockBudget, MockBudgetInput } from '@/types/finance';
import { formatMoney } from '@/lib/money/format';
import { EmptyState } from '@/components/finance/EmptyState';
import { Plus, Target, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<MockBudget[]>(MOCK_BUDGETS);
  const [addBudgetOpen, setAddBudgetOpen] = useState(false);

  const totalLimit = budgets.reduce((sum, b) => sum + b.limit, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const overallPercent = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
  const remaining = totalLimit - totalSpent;

  const overBudgetCount = budgets.filter((b) => b.spent > b.limit).length;

  const handleAddBudget = (newB: MockBudgetInput & { categoryName?: string }) => {
    const created: MockBudget = {
      id: `bgt-${Date.now()}`,
      categoryId: newB.categoryId,
      categoryName: newB.categoryName || 'Danh mục',
      categoryIcon: 'ShoppingBag',
      categoryColor: '#6366f1',
      limit: newB.limit,
      spent: 0,
      currency: 'VND',
      period: (newB.period as 'MONTHLY' | 'WEEKLY' | 'YEARLY') || 'MONTHLY',
    };
    setBudgets([...budgets, created]);
  };

  return (
    <AppShell>
      <PageHeader
        title="Ngân sách chi tiêu"
        subtitle="Kiểm soát hạn mức các danh mục trong tháng 8/2026."
      >
        <Button size="sm" onClick={() => setAddBudgetOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Thiết lập ngân sách
        </Button>
      </PageHeader>

      {/* Overall Budget Status Card */}
      <Card className="border">
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tổng ngân sách tháng 8/2026
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
                  {formatMoney(totalSpent)}
                </span>
                <span className="text-sm text-muted-foreground font-medium">
                  / {formatMoney(totalLimit)}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {overBudgetCount > 0 ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                  <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                  {overBudgetCount} danh mục vượt ngân sách
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
              value={Math.min(overallPercent, 100)}
              className="h-3"
              indicatorClassName={
                overallPercent > 100 ? 'bg-red-500' : 'bg-slate-900 dark:bg-slate-100'
              }
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Đã sử dụng {overallPercent}% tổng định mức</span>
              <span>
                {remaining >= 0
                  ? `Còn lại ${formatMoney(remaining)}`
                  : `Vượt ${formatMoney(Math.abs(remaining))}`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Categories Budget Grid or Empty State */}
      {budgets.length === 0 ? (
        <EmptyState
          title="Chưa thiết lập ngân sách"
          description="Đặt hạn mức chi tiêu hàng tháng cho từng danh mục để kiểm soát tài chính."
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
        onSuccess={handleAddBudget}
      />
    </AppShell>
  );
}
