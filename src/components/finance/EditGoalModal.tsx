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
import { Select } from '@/components/ui/select';
import { Target, AlertCircle } from 'lucide-react';
import type { ExtendedGoal, GoalUpdateInput } from '@/features/goals';
import { toExactDecimal, isPositiveExactDecimal, isNonNegativeExactDecimal } from '@/lib/money';

interface EditGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: ExtendedGoal | null;
  onSuccess?: (id: string, updates: GoalUpdateInput) => Promise<void> | void;
}

export const EditGoalModal: React.FC<EditGoalModalProps> = ({
  open,
  onOpenChange,
  goal,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [category, setCategory] = useState('An toàn tài chính');
  const [color, setColor] = useState('#10b981');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const colors = [
    '#10b981', // Emerald
    '#0ea5e9', // Sky Blue
    '#8b5cf6', // Violet
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#ef4444', // Red
  ];

  useEffect(() => {
    if (goal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(goal.name);
      setTargetAmount(goal.target_amount);
      setCurrentAmount(goal.current_amount);
      setTargetDate(goal.target_date || '');
      setMonthlyContribution(goal.monthly_contribution);
      setCategory(goal.category || 'An toàn tài chính');
      setColor(goal.color || '#10b981');
      setError('');
    }
  }, [goal]);

  if (!goal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Vui lòng nhập tên mục tiêu');
      return;
    }

    try {
      const exactTarget = toExactDecimal(targetAmount);
      if (!isPositiveExactDecimal(exactTarget)) {
        setError('Số tiền mục tiêu phải lớn hơn 0');
        return;
      }

      const exactCurrent = currentAmount.trim() ? toExactDecimal(currentAmount) : '0.0000';
      if (!isNonNegativeExactDecimal(exactCurrent)) {
        setError('Số tiền hiện có không được âm');
        return;
      }

      const exactMonthly = monthlyContribution.trim() ? toExactDecimal(monthlyContribution) : '0.0000';
      if (!isNonNegativeExactDecimal(exactMonthly)) {
        setError('Đóng góp hàng tháng không được âm');
        return;
      }

      setSubmitted(true);
      await onSuccess?.(goal.id, {
        name: trimmedName,
        target_amount: exactTarget,
        current_amount: exactCurrent,
        target_date: targetDate || null,
        monthly_contribution: exactMonthly,
        color,
        category,
      });

      setSubmitted(false);
      onOpenChange(false);
    } catch (err: unknown) {
      setSubmitted(false);
      setError(err instanceof Error ? err.message : 'Lỗi khi cập nhật mục tiêu');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-primary" />
            <span>Chỉnh sửa mục tiêu: {goal.name}</span>
          </DialogTitle>
          <DialogDescription>
            Cập nhật thông tin chi tiết mục tiêu tài chính ({goal.currency_code}).
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="editGoalName">Tên mục tiêu</Label>
            <Input
              id="editGoalName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="editTargetAmount">Số tiền mục tiêu ({goal.currency_code})</Label>
              <Input
                id="editTargetAmount"
                type="text"
                inputMode="decimal"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editCurrentAmount">Đã tích lũy ({goal.currency_code})</Label>
              <Input
                id="editCurrentAmount"
                type="text"
                inputMode="decimal"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="editTargetDate">Hạn hoàn thành</Label>
              <Input
                id="editTargetDate"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editMonthlyContrib">Góp mỗi tháng ({goal.currency_code})</Label>
              <Input
                id="editMonthlyContrib"
                type="text"
                inputMode="decimal"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="editGoalCategory">Nhóm mục tiêu</Label>
            <Select
              id="editGoalCategory"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={[
                { value: 'An toàn tài chính', label: 'An toàn tài chính' },
                { value: 'Mua sắm lớn', label: 'Mua sắm lớn' },
                { value: 'Nghỉ dưỡng & Du lịch', label: 'Nghỉ dưỡng & Du lịch' },
                { value: 'Đầu tư phát triển', label: 'Đầu tư phát triển' },
                { value: 'Khác', label: 'Khác' },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Màu sắc nhận diện</Label>
            <div className="flex items-center space-x-2 pt-1">
              {colors.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`h-7 w-7 rounded-full transition-transform ${
                    color === c ? 'scale-110 ring-2 ring-offset-2 ring-primary' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={submitted || !name || !targetAmount}>
              {submitted ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
