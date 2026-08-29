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
import { Target, AlertCircle } from 'lucide-react';
import { MoneyInput } from './MoneyInput';
import type { CategoryRow } from '@/types/database';
import { toExactDecimal, isPositiveExactDecimal } from '@/lib/money';

interface AddBudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryRow[];
  currencyCode?: string;
  periodMonth?: string;
  onSuccess?: (data: { categoryId: string; limitAmount: string }) => Promise<void> | void;
}

export const AddBudgetModal: React.FC<AddBudgetModalProps> = ({
  open,
  onOpenChange,
  categories,
  currencyCode = 'VND',
  periodMonth: _periodMonth,
  onSuccess,
}) => {
  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE' && !c.is_archived);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [limit, setLimit] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const effectiveCategoryId = selectedCategoryId || expenseCategories[0]?.id || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!effectiveCategoryId) {
      setError('Vui lòng chọn danh mục chi tiêu');
      return;
    }

    try {
      const exactLimit = toExactDecimal(limit);
      if (!isPositiveExactDecimal(exactLimit)) {
        setError('Hạn mức ngân sách phải lớn hơn 0');
        return;
      }

      setSubmitted(true);
      await onSuccess?.({
        categoryId: effectiveCategoryId,
        limitAmount: exactLimit,
      });

      setSubmitted(false);
      onOpenChange(false);
      setLimit('');
      setSelectedCategoryId('');
    } catch (err: unknown) {
      setSubmitted(false);
      setError(err instanceof Error ? err.message : 'Lỗi khi lưu ngân sách');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-primary" />
            <span>Thiết lập hạn mức ngân sách</span>
          </DialogTitle>
          <DialogDescription>
            Đặt ngân sách chi tiêu hàng tháng cho từng danh mục ({currencyCode}).
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
            <Label htmlFor="bgtCat">Danh mục chi tiêu</Label>
            <Select
              id="bgtCat"
              value={effectiveCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              options={expenseCategories.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bgtLimit">Hạn mức chi tiêu tháng ({currencyCode})</Label>
            <MoneyInput
              id="bgtLimit"
              currencyCode={currencyCode}
              placeholder={currencyCode === 'VND' ? '5.000.000' : '500.00'}
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
              {submitted ? 'Đang lưu...' : 'Lưu ngân sách'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
