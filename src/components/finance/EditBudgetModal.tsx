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
import { Target, AlertCircle } from 'lucide-react';
import { MoneyInput } from './MoneyInput';
import type { ExtendedBudget } from '@/features/budgets';
import { toExactDecimal, isPositiveExactDecimal } from '@/lib/money';

interface EditBudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: ExtendedBudget | null;
  onSuccess?: (id: string, updates: { limitAmount: string }) => Promise<void> | void;
}

export const EditBudgetModal: React.FC<EditBudgetModalProps> = ({
  open,
  onOpenChange,
  budget,
  onSuccess,
}) => {
  const [limit, setLimit] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (budget) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLimit(budget.limit_amount);
      setError('');
    }
  }, [budget]);

  if (!budget) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const exactLimit = toExactDecimal(limit);
      if (!isPositiveExactDecimal(exactLimit)) {
        setError('Hạn mức ngân sách phải lớn hơn 0');
        return;
      }

      setSubmitted(true);
      await onSuccess?.(budget.id, {
        limitAmount: exactLimit,
      });

      setSubmitted(false);
      onOpenChange(false);
    } catch (err: unknown) {
      setSubmitted(false);
      setError(err instanceof Error ? err.message : 'Lỗi khi cập nhật ngân sách');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-primary" />
            <span>Chỉnh sửa ngân sách: {budget.categoryName}</span>
          </DialogTitle>
          <DialogDescription>
            Cập nhật hạn mức chi tiêu cho danh mục này ({budget.currency_code}).
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
            <Label htmlFor="editBgtLimit">Hạn mức chi tiêu mới ({budget.currency_code})</Label>
            <MoneyInput
              id="editBgtLimit"
              currencyCode={budget.currency_code}
              placeholder={budget.currency_code === 'VND' ? '5.000.000' : '500.00'}
              value={limit}
              onChange={(val) => setLimit(val)}
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
            <Button type="submit" disabled={submitted || !limit}>
              {submitted ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
