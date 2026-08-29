"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, AlertCircle } from 'lucide-react';
import { MoneyInput } from './MoneyInput';
import type { ExtendedGoal } from '@/features/goals';
import { toExactDecimal, isPositiveExactDecimal, addExactDecimals } from '@/lib/money';
import { formatExactMoney } from '@/lib/money/format';

interface ContributeGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: ExtendedGoal | null;
  onSuccess?: (id: string, contributionAmount: string) => Promise<void> | void;
}

export const ContributeGoalModal: React.FC<ContributeGoalModalProps> = ({
  open,
  onOpenChange,
  goal,
  onSuccess,
}) => {
  const [amount, setAmount] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (goal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAmount(goal.monthly_contribution !== '0.0000' ? goal.monthly_contribution : '');
      setError('');
    }
  }, [goal]);

  if (!goal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const exactAmount = toExactDecimal(amount);
      if (!isPositiveExactDecimal(exactAmount)) {
        setError('Số tiền nạp thêm phải lớn hơn 0');
        return;
      }

      setSubmitted(true);
      await onSuccess?.(goal.id, exactAmount);

      setSubmitted(false);
      onOpenChange(false);
      setAmount('');
    } catch (err: unknown) {
      setSubmitted(false);
      setError(err instanceof Error ? err.message : 'Lỗi khi nạp thêm');
    }
  };

  const projectedNewCurrent = (() => {
    try {
      const exact = toExactDecimal(amount || '0');
      return addExactDecimals(goal.current_amount, exact);
    } catch {
      return goal.current_amount;
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <PlusCircle className="h-5 w-5 text-emerald-600" />
            <span>Nạp thêm tiến độ: {goal.name}</span>
          </DialogTitle>
          <DialogDescription>
            Tăng số tiền đã tích lũy cho mục tiêu ({goal.currency_code}).
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="p-3 bg-muted/40 rounded-xl space-y-1 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Hiện có:</span>
              <span className="font-semibold text-foreground">
                {formatExactMoney(goal.current_amount, goal.currency_code)}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Mục tiêu:</span>
              <span className="font-semibold text-foreground">
                {formatExactMoney(goal.target_amount, goal.currency_code)}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground pt-1 border-t">
              <span>Dự kiến sau khi nạp:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {formatExactMoney(projectedNewCurrent, goal.currency_code)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contribAmount">Số tiền nạp thêm ({goal.currency_code})</Label>
            <MoneyInput
              id="contribAmount"
              currencyCode={goal.currency_code}
              placeholder={goal.currency_code === 'VND' ? '1.000.000' : '100.00'}
              value={amount}
              onChange={(val) => setAmount(val)}
              required
              autoFocus
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={submitted || !amount}>
              {submitted ? 'Đang nạp...' : 'Xác nhận nạp'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
