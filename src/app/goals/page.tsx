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

export default function GoalsPage() {
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [goals, setGoals] = useState<ExtendedGoal[]>([]);
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ExtendedGoal | null>(null);
  const [contributingGoal, setContributingGoal] = useState<ExtendedGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);

  // 1. Initial settings and real financial currency resolution (fail-closed)
  useEffect(() => {
    async function initSettings() {
      try {
        setLoading(true);
        setError('');
        const { data: settings, error: sErr } = await getCurrentUserSettings();
        if (sErr) throw sErr;

        const [accs, allGoals] = await Promise.all([
          getAccounts(),
          getGoals({ includeArchived: true }),
        ]);

        const realCurrencies = Array.from(
          new Set([
            ...accs.map((a) => a.currency_code),
            ...allGoals.map((g) => g.currency_code),
          ].filter(Boolean))
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
        setError(err instanceof Error ? err.message : 'Không thể tải cài đặt người dùng');
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
    if (initialized && selectedCurrency) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [initialized, selectedCurrency, showArchived, loadData]);

  const summary = useMemo(() => {
    return computeGoalSummary(goals, selectedCurrency);
  }, [goals, selectedCurrency]);

  const handleCurrencyChange = (newCurrency: string) => {
    if (newCurrency === selectedCurrency) return;
    setGoals([]);
    setLoading(true);
    setSelectedCurrency(newCurrency);
  };

  const handleToggleArchived = () => {
    setGoals([]);
    setLoading(true);
    setShowArchived((prev) => !prev);
  };

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
        subtitle={`Lập kế hoạch tích lũy và theo dõi tiến độ các mục tiêu lớn (${selectedCurrency || 'Đang tải'}).`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {availableCurrencies.length > 0 && (
            <div className="w-28">
              <Select
                id="goalCurrencySelect"
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
            title="Hiện/ẩn mục tiêu đã lưu trữ"
          >
            <Archive className="h-4 w-4 mr-1.5" />
            {showArchived ? 'Đang hiện lưu trữ' : 'Đã lưu trữ'}
          </Button>

          <Button size="sm" variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button size="sm" onClick={() => setAddGoalOpen(true)} disabled={!initialized}>
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

      {/* Summary KPI Cards */}
      {!error && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Tổng đã tích lũy
                </span>
                <Target className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-xl font-bold mt-2 text-foreground">
                {formatExactMoney(summary.totalCurrent, selectedCurrency)}
              </div>
              <span className="text-xs text-muted-foreground mt-1 block">
                Tiến độ: {summary.percentStr}%
              </span>
            </CardContent>
          </Card>

          <Card className="border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Tổng mục tiêu
                </span>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div className="text-xl font-bold mt-2 text-foreground">
                {formatExactMoney(summary.totalTarget, selectedCurrency)}
              </div>
              <span className="text-xs text-muted-foreground mt-1 block">
                Còn lại: {formatExactMoney(summary.totalRemaining, selectedCurrency)}
              </span>
            </CardContent>
          </Card>

          <Card className="border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Đóng góp hàng tháng
                </span>
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-xl font-bold mt-2 text-foreground">
                {formatExactMoney(summary.totalMonthlyContribution, selectedCurrency)}
              </div>
              <span className="text-xs text-muted-foreground mt-1 block">
                {summary.activeCount} mục tiêu đang hoạt động
              </span>
            </CardContent>
          </Card>

          <Card className="border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Mục tiêu hoàn thành
                </span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
                  {summary.completedCount} / {goals.length}
                </span>
              </div>
              <div className="text-xl font-bold mt-2 text-foreground">
                {summary.completedCount} mục tiêu
              </div>
              <span className="text-xs text-muted-foreground mt-1 block">
                Đã đạt hoặc vượt 100%
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Goal Cards Grid or Empty State */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Đang tải danh sách mục tiêu...
        </div>
      ) : goals.length === 0 && !error ? (
        <EmptyState
          title="Chưa có mục tiêu tài chính nào"
          description={`Tạo mục tiêu để theo dõi kế hoạch tiết kiệm (${selectedCurrency}).`}
          actionLabel="+ Tạo mục tiêu mới"
          onAction={() => setAddGoalOpen(true)}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">
              Danh sách mục tiêu ({goals.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onContribute={(g) => setContributingGoal(g)}
                onEdit={(g) => setEditingGoal(g)}
                onArchive={handleArchiveGoal}
                onUnarchive={handleUnarchiveGoal}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {selectedCurrency && (
        <AddGoalModal
          open={addGoalOpen}
          onOpenChange={setAddGoalOpen}
          currencyCode={selectedCurrency}
          onSuccess={handleAddGoal}
        />
      )}

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
