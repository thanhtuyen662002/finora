"use client";

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { GoalCard } from '@/components/finance/GoalCard';
import { AddGoalModal } from '@/components/finance/AddGoalModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MOCK_GOALS } from '@/lib/mock/goals';
import { MockGoal } from '@/types/finance';
import { formatMoney } from '@/lib/money/format';
import { Plus, Target, TrendingUp, Sparkles } from 'lucide-react';

export default function GoalsPage() {
  const [goals, setGoals] = useState<MockGoal[]>(MOCK_GOALS);
  const [addGoalOpen, setAddGoalOpen] = useState(false);

  const totalTargetVND = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalSavedVND = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalMonthlyPace = goals.reduce((sum, g) => sum + g.monthlyContribution, 0);
  const averageProgress = Math.round((totalSavedVND / totalTargetVND) * 100);

  const handleAddGoal = (newG: any) => {
    const created: MockGoal = {
      id: `goal-${Date.now()}`,
      userId: 'user-demo-1',
      name: newG.name,
      targetAmount: newG.targetAmount,
      currentAmount: newG.currentAmount,
      currency: 'VND',
      targetDate: newG.targetDate,
      color: newG.color,
      icon: newG.icon,
      category: newG.category,
      monthlyContribution: newG.monthlyContribution,
    };
    setGoals([...goals, created]);
  };

  return (
    <AppShell>
      <PageHeader
        title="Mục tiêu tài chính"
        subtitle="Lập kế hoạch tích lũy và theo dõi tiến độ các mục tiêu lớn."
      >
        <Button size="sm" onClick={() => setAddGoalOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tạo mục tiêu mới
        </Button>
      </PageHeader>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <Card className="bg-card border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tổng đã tích lũy
              </span>
              <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                {formatMoney(totalSavedVND)}
              </p>
              <span className="text-xs text-muted-foreground">
                Đạt {averageProgress}% tổng các mục tiêu
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
                {formatMoney(totalTargetVND)}
              </p>
              <span className="text-xs text-muted-foreground">
                Bao gồm {goals.length} mục tiêu dài hạn
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
                Tốc độ góp hàng tháng
              </span>
              <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                +{formatMoney(totalMonthlyPace)}
              </p>
              <span className="text-xs text-muted-foreground">
                Dự kiến hoàn thành đúng tiến độ
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Sparkles className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map((g) => (
          <GoalCard key={g.id} goal={g} />
        ))}
      </div>

      {/* Add Goal Modal */}
      <AddGoalModal
        open={addGoalOpen}
        onOpenChange={setAddGoalOpen}
        onSuccess={handleAddGoal}
      />
    </AppShell>
  );
}
