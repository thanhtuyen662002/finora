import React from 'react';
import {
  ShieldCheck,
  Plane,
  Car,
  TrendingUp,
  Target,
  Calendar,
  Sparkles,
  Edit2,
  PlusCircle,
  Archive,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import type { ExtendedGoal } from '@/features/goals';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatExactMoney, formatDateVN } from '@/lib/money/format';
import { cn } from '@/lib/utils';

interface GoalCardProps {
  goal: ExtendedGoal;
  onClick?: () => void;
  onEdit?: (goal: ExtendedGoal) => void;
  onContribute?: (goal: ExtendedGoal) => void;
  onArchive?: (goal: ExtendedGoal) => void;
  onUnarchive?: (goal: ExtendedGoal) => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({
  goal,
  onClick,
  onEdit,
  onContribute,
  onArchive,
  onUnarchive,
}) => {
  const name = goal.name;
  const category = goal.category || 'Mục tiêu';
  const color = goal.color || '#10b981';
  const icon = goal.icon || 'Target';
  const targetDate = goal.target_date;
  const currency = goal.currency_code;

  const percent = Math.min(Math.floor(goal.basisPoints / 100), 100);
  const displayCurrent = formatExactMoney(goal.current_amount, currency);
  const displayTarget = formatExactMoney(goal.target_amount, currency);
  const displayMonthly = formatExactMoney(goal.monthly_contribution, currency);

  const getIcon = () => {
    switch (icon) {
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
      className={cn(
        'transition-all duration-200 border relative overflow-hidden group',
        goal.is_archived ? 'opacity-60 bg-muted/20 border-dashed' : 'bg-card hover:shadow-md'
      )}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: color }}
      />
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
              style={{ backgroundColor: color }}
            >
              {getIcon()}
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {category}
                </span>
                {goal.is_archived && (
                  <Badge variant="secondary" className="text-[10px] uppercase font-mono px-1 py-0">
                    Lưu trữ
                  </Badge>
                )}
                {goal.isCompleted && (
                  <Badge className="bg-emerald-500 text-white text-[10px] px-1 py-0 flex items-center space-x-0.5">
                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                    Đạt mục tiêu
                  </Badge>
                )}
              </div>
              <h4 className="font-bold text-foreground text-sm sm:text-base group-hover:text-primary transition-colors">
                {name}
              </h4>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-muted text-foreground">
              {percent}%
            </span>

            {(onEdit || onContribute || onArchive || onUnarchive) && (
              <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                {onContribute && !goal.is_archived && !goal.isCompleted && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                    onClick={() => onContribute(goal)}
                    title="Nạp thêm tiến độ"
                  >
                    <PlusCircle className="h-4 w-4" />
                  </Button>
                )}
                {onEdit && !goal.is_archived && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => onEdit(goal)}
                    title="Chỉnh sửa mục tiêu"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onArchive && !goal.is_archived && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-600"
                    onClick={() => onArchive(goal)}
                    title="Lưu trữ mục tiêu"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onUnarchive && goal.is_archived && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-600"
                    onClick={() => onUnarchive(goal)}
                    title="Khôi phục mục tiêu"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-foreground">
              {displayCurrent}
            </span>
            <span className="text-muted-foreground">
              Mục tiêu: {displayTarget}
            </span>
          </div>
          <Progress
            value={percent}
            className="h-2.5"
            indicatorClassName={
              goal.isCompleted
                ? 'bg-emerald-500'
                : percent >= 75
                ? 'bg-primary'
                : 'bg-slate-900 dark:bg-slate-100'
            }
          />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/60">
          <div className="flex items-center space-x-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>Hạn: {targetDate ? formatDateVN(targetDate) : 'Không có'}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>+{displayMonthly}/tháng</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
