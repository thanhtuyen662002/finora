"use client";

import React, { useState } from 'react';
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
import { Sparkles, AlertCircle } from 'lucide-react';
import type { GoalInsertInput } from '@/features/goals';
import { toExactDecimal, isPositiveExactDecimal, isNonNegativeExactDecimal } from '@/lib/money';
import { isValidISODateString } from '@/features/recurring/engine';

interface AddGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currencyCode?: string;
  onSuccess?: (goalData: GoalInsertInput) => Promise<void> | void;
}

export const AddGoalModal: React.FC<AddGoalModalProps> = ({
  open,
  onOpenChange,
  currencyCode = 'VND',
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [category, setCategory] = useState('Tiết kiệm');
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

      const exactInitial = initialAmount.trim() ? toExactDecimal(initialAmount) : '0.0000';
      if (!isNonNegativeExactDecimal(exactInitial)) {
        setError('Số tiền hiện có không được âm');
        return;
      }

      const exactMonthly = monthlyContribution.trim() ? toExactDecimal(monthlyContribution) : '0.0000';
      if (!isNonNegativeExactDecimal(exactMonthly)) {
        setError('Đóng góp hàng tháng không được âm');
        return;
      }

      if (targetDate.trim() && !isValidISODateString(targetDate.trim())) {
        setError('Ngày dự kiến hoàn thành không hợp lệ (định dạng YYYY-MM-DD)');
        return;
      }

      setSubmitted(true);
      await onSuccess?.({
        name: trimmedName,
        target_amount: exactTarget,
        current_amount: exactInitial,
        currency_code: currencyCode,
        target_date: targetDate.trim() || null,
        monthly_contribution: exactMonthly,
        color,
        category,
        icon: 'Target',
      });

      setSubmitted(false);
      onOpenChange(false);
      setName('');
      setTargetAmount('');
      setInitialAmount('');
      setTargetDate('');
      setMonthlyContribution('');
    } catch (err: unknown) {
      setSubmitted(false);
      setError(err instanceof Error ? err.message : 'Lỗi khi tạo mục tiêu');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>Tạo mục tiêu tài chính mới</span>
          </DialogTitle>
          <DialogDescription>
            Thiết lập kế hoạch tiết kiệm hoặc đầu tư cho các dự định lớn ({currencyCode}).
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
            <Label htmlFor="goalName">Tên mục tiêu</Label>
            <Input
              id="goalName"
              placeholder="Ví dụ: Quỹ du lịch Châu Âu, Mua nhà, Học phí..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="targetAmount">Số tiền mục tiêu ({currencyCode})</Label>
              <Input
                id="targetAmount"
                type="text"
                inputMode="decimal"
                placeholder="100000000"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="initialAmount">Đã tích lũy ban đầu</Label>
              <Input
                id="initialAmount"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={initialAmount}
                onChange={(e) => setInitialAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="targetDate">Hạn hoàn thành (Tùy chọn)</Label>
              <Input
                id="targetDate"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="monthlyContrib">Đóng góp hàng tháng</Label>
              <Input
                id="monthlyContrib"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="goalCat">Phân loại</Label>
              <Select
                id="goalCat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={[
                  { value: 'Tiết kiệm', label: 'Tiết kiệm' },
                  { value: 'Mua sắm', label: 'Mua sắm' },
                  { value: 'Đầu tư', label: 'Đầu tư' },
                  { value: 'Khẩn cấp', label: 'Khẩn cấp' },
                  { value: 'Du lịch', label: 'Du lịch' },
                  { value: 'Khác', label: 'Khác' },
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Màu sắc</Label>
              <div className="flex items-center space-x-1.5 pt-1.5">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`h-6 w-6 rounded-full border transition-transform ${
                      color === c ? 'scale-110 ring-2 ring-primary ring-offset-1' : 'opacity-80'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
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
              {submitted ? 'Đang tạo...' : 'Tạo mục tiêu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
