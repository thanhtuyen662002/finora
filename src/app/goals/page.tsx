"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { GoalCard } from '@/components/finance/GoalCard';
import { AddGoalModal } from '@/components/finance/AddGoalModal';
import { EditGoalModal } from '@/components/finance/EditGoalModal';
import { ContributeGoalModal } from '@/components/finance/ContributeGoalModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/finance/EmptyState';
import { Select } from '@/components/ui/select';
import {
  Plus,
  Target,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Archive,
} from 'lucide-react';
import {
  getGoals,
  createGoal,
  updateGoal,
  contributeToGoal,
  archiveGoal,
  unarchiveGoal,
  computeGoalSummary,
  ExtendedGoal,
  GoalInsertInput,
  GoalUpdateInput,
} from '@/features/goals';
import { getAccounts } from '@/features/accounts/accounts';
import { getCurrentUserSettings } from '@/lib/auth';
import { formatExactMoney } from '@/lib/money/format';

const COMMON_CURRENCIES = ['VND', 'USD', 'EUR', 'JPY', 'CNY', 'KRW'];

export default function GoalsPage() {
  const [selectedCurrency, setSelectedCurrency] = useState('VND');
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>(COMMON_CURRENCIES);
  const [showArchived, setShowArchived] = useState(false);
  const [goals, setGoals] = useState<ExtendedGoal[]>([]);
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ExtendedGoal | null>(null);
  const [contributingGoal, setContributingGoal] = useState<ExtendedGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function initSettings() {
      try {
        const { data: settings, error: sErr } = await getCurrentUserSettings();
        if (sErr) throw sErr;
        const baseCurr = settings?.base_currency?.toUpperCase() || 'VND';
        setSelectedCurrency(baseCurr);

        const accs = await getAccounts().catch(() => []);
        const currs = Array.from(
          new Set([baseCurr, ...COMMON_CURRENCIES, ...accs.map((a) => a.currency_code)])
        );
        setAvailableCurrencies(currs);
        setInitialized(true);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Không thể tải cài đặt người dùng');
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
      const fetchedGoals = await getGoals({
        currencyCode: selectedCurrency,
        includeArchived: showArchived,
      });
      setGoals(fetchedGoals);
    } catch (err: unknown) {
      setGoals([]);
      setError(err instanceof Error ? err.message : 'Không thể tải mục tiêu');
    } finally {
      setLoading(false);
    }
  }, [initialized, selectedCurrency, showArchived]);

  useEffect(() => {
    if (initialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [initialized, loadData]);

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

  const handleEditGoal = async (id: string, updates: GoalUpdateInput) => {
    await updateGoal(id, updates);
    await loadData();
  };

  const handleContribute = async (id: string, amount: string) => {
    await contributeToGoal(id, amount);
    await loadData();
  };

  const handleArchiveGoal = async (g: ExtendedGoal) => {
    if (confirm(`Bạn có chắc chắn muốn lưu trữ mục tiêu "${g.name}"?`)) {
      await archiveGoal(g.id);
      await loadData();
    }
  };

  const handleUnarchiveGoal = async (g: ExtendedGoal) => {
    await unarchiveGoal(g.id);
    await loadData();
  };

  return (
    <AppShell>
      <PageHeader
        title="Mục tiêu tài chính"
        subtitle={`Lập kế hoạch tích lũy và theo dõi tiến độ các mục tiêu lớn (${selectedCurrency}).`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-28">
            <Select
              id="goalCurrencySelect"
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              options={availableCurrencies.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <Button
            size="sm"
            variant={showArchived ? 'secondary' : 'outline'}
            onClick={() => setShowArchived(!showArchived)}
            title="Hiện/ẩn mục tiêu đã lưu trữ"
          >
            <Archive className="h-4 w-4 mr-1.5" />
            {showArchived ? 'Đang hiện lưu trữ' : 'Đã lưu trữ'}
          </Button>

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
          <Button size="sm" variant="outline" onClick={loadData}>
            Thử lại
          </Button>
        </div>
      )}

      {/* Overview Stat Cards (hidden on error) */}
      {!error && (
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
                  Tổng đích đến
                </span>
                <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                  {formatExactMoney(summary.totalTarget, selectedCurrency)}
                </p>
                <span className="text-xs text-muted-foreground">
                  {summary.activeCount} mục tiêu đang theo đuổi
                </span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Mục tiêu hoàn thành
                </span>
                <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                  {summary.completedCount} / {summary.activeCount}
                </p>
                <span className="text-xs text-muted-foreground">
                  Còn thiếu {formatExactMoney(summary.remaining, selectedCurrency)}
                </span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Sparkles className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Goal Cards Grid or Empty State */}
      {loading && goals.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Đang tải danh sách mục tiêu...
        </div>
      ) : goals.length === 0 && !error ? (
        <EmptyState
          title="Chưa có mục tiêu tài chính"
          description="Thiết lập các mục tiêu tiết kiệm, mua nhà, du lịch hay quỹ dự phòng để có lộ trình rõ ràng."
          actionLabel="+ Tạo mục tiêu mới"
          onAction={() => setAddGoalOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-foreground">
            Danh sách mục tiêu ({goals.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                onEdit={(item) => setEditingGoal(item)}
                onContribute={(item) => setContributingGoal(item)}
                onArchive={handleArchiveGoal}
                onUnarchive={handleUnarchiveGoal}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      <AddGoalModal
        open={addGoalOpen}
        onOpenChange={setAddGoalOpen}
        currencyCode={selectedCurrency}
        onSuccess={handleAddGoal}
      />

      {/* Edit Goal Modal */}
      <EditGoalModal
        open={!!editingGoal}
        onOpenChange={(open) => {
          if (!open) setEditingGoal(null);
        }}
        goal={editingGoal}
        onSuccess={handleEditGoal}
      />

      {/* Contribute Goal Modal */}
      <ContributeGoalModal
        open={!!contributingGoal}
        onOpenChange={(open) => {
          if (!open) setContributingGoal(null);
        }}
        goal={contributingGoal}
        onSuccess={handleContribute}
      />
    </AppShell>
  );
}
