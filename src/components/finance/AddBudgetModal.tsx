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
import { MOCK_CATEGORIES } from '@/lib/mock/transactions';
import { Target } from 'lucide-react';

interface AddBudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (budgetData: any) => void;
}

export const AddBudgetModal: React.FC<AddBudgetModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [categoryId, setCategoryId] = useState('cat-food');
  const [limit, setLimit] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const expenseCategories = MOCK_CATEGORIES.filter((c) => c.type === 'EXPENSE');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!limit) return;

    setSubmitted(true);
    setTimeout(() => {
      const cat = expenseCategories.find((c) => c.id === categoryId);
      onSuccess?.({
        categoryId,
        categoryName: cat?.name || 'Danh mục',
        limit: parseFloat(limit),
        spent: 0,
      });
      setSubmitted(false);
      onOpenChange(false);
      setLimit('');
    }, 400);
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
            Đặt ngân sách chi tiêu hàng tháng cho từng danh mục.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="bgtCat">Danh mục chi tiêu</Label>
            <Select
              id="bgtCat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={expenseCategories.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bgtLimit">Hạn mức chi tiêu tháng (VND)</Label>
            <Input
              id="bgtLimit"
              type="number"
              step="any"
              placeholder="5.000.000"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
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
