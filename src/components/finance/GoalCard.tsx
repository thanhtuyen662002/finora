import React from 'react';
import {
  ShieldCheck,
  Plane,
  Car,
  TrendingUp,
  Target,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { MockGoal } from '@/types/finance';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { formatMoney, formatDateVN } from '@/lib/money/format';

interface GoalCardProps {
  goal: MockGoal;
  onClick?: () => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({ goal, onClick }) => {
  const percent = Math.min(
    Math.round((goal.currentAmount / goal.targetAmount) * 100),
    100
  );
  const remaining = goal.targetAmount - goal.currentAmount;

  const getIcon = () => {
    switch (goal.icon) {
      case 'ShieldCheck':
        return <ShieldCheck className="h-5 w-5" />;
      case 'Plane':
        return <Plane className="h-5 w-5" />;
      case 'Car':
        return <Car className="h-5 w-5" />;
      case 'TrendingUp':
        return <TrendingUp className="h-5 w-5" />;
      default:
        return <Target className="h-5 w-5" />;
    }
  };

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-slate-400/40 relative overflow-hidden group"
    >
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: goal.color }}
      />
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
              style={{ backgroundColor: goal.color }}
            >
              {getIcon()}
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {goal.category}
              </span>
              <h4 className="font-bold text-foreground text-sm sm:text-base group-hover:text-primary transition-colors">
                {goal.name}
              </h4>
            </div>
          </div>

          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-muted text-foreground">
            {percent}%
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-foreground">
              {formatMoney(goal.currentAmount, goal.currency)}
            </span>
            <span className="text-muted-foreground">
              Mục tiêu: {formatMoney(goal.targetAmount, goal.currency)}
            </span>
          </div>
          <Progress
            value={percent}
            className="h-2.5"
            indicatorClassName="bg-slate-900 dark:bg-slate-100"
          />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/60">
          <div className="flex items-center space-x-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>Hạn: {formatDateVN(goal.targetDate)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>+{formatMoney(goal.monthlyContribution, goal.currency)}/tháng</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
