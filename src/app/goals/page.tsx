"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { GoalCard } from '@/components/finance/GoalCard';
import { AddGoalModal } from '@/components/finance/AddGoalModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/finance/EmptyState';
import { Plus, Target, TrendingUp, Sparkles, RefreshCw } from 'lucide-react';
import {
  getGoals,
  createGoal,
  computeGoalSummary,
  ExtendedGoal,
  GoalInsertInput,
} from '@/features/goals';
import { formatExactMoney } from '@/lib/money/format';

export default function GoalsPage() {
  const [selectedCurrency, setSelectedCurrency] = useState('VND');
  const [goals, setGoals] = useState<ExtendedGoal[]>([]);
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const fetchedGoals = await getGoals({ currencyCode: selectedCurrency });
      setGoals(fetchedGoals);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải mục tiêu');
    } finally {
      setLoading(false);
    }
  }, [selectedCurrency]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const summary = useMemo(() => {
    return computeGoalSummary(goals, selectedCurrency);
  }, [goals, selectedCurrency]);

  const handleAddGoal = async (newGoal: GoalInsertInput) => {
    await createGoal({
      ...newGoal,
      currency_code: selectedCurrency,
    });
    await loadData();
  };

  return (
    <AppShell>
      <PageHeader
        title="Mục tiêu tài chính"
        subtitle={`Lập kế hoạch tích lũy và theo dõi tiến độ các mục tiêu lớn (${selectedCurrency}).`}
      >
        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => setAddGoalOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Tạo mục tiêu mới
          </Button>
        </div>
      </PageHeader>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={loadData}>Thử lại</Button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <Card className="bg-card border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tổng đã tích lũy
              </span>
              <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                {formatExactMoney(summary.totalCurrent, selectedCurrency)}
              </p>
              <span className="text-xs text-muted-foreground">
                Đạt {summary.percentStr}% tổng các mục tiêu
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Target className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tổng giá trị mục tiêu
              </span>
              <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                {formatExactMoney(summary.totalTarget, selectedCurrency)}
              </p>
              <span className="text-xs text-muted-foreground">
                Bao gồm {summary.activeCount} mục tiêu dài hạn
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-slate-600 dark:text-slate-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Còn lại cần góp
              </span>
              <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                {formatExactMoney(summary.remaining, selectedCurrency)}
              </p>
              <span className="text-xs text-muted-foreground">
                Đã hoàn thành {summary.completedCount}/{summary.activeCount} mục tiêu
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Sparkles className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals Grid or Empty State */}
      {loading && goals.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Đang tải mục tiêu tài chính...
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          title="Chưa có mục tiêu tài chính"
          description={`Tạo mục tiêu tiết kiệm mới (mua nhà, du lịch, quỹ khẩn cấp) để theo dõi tiến độ bằng ${selectedCurrency}.`}
          actionLabel="+ Tạo mục tiêu mới"
          onAction={() => setAddGoalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </div>
      )}

      {/* Add Goal Modal */}
      <AddGoalModal
        open={addGoalOpen}
        onOpenChange={setAddGoalOpen}
        currencyCode={selectedCurrency}
        onSuccess={handleAddGoal}
      />
    </AppShell>
  );
}
