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
import { MockGoalInput } from '@/types/finance';
import { Sparkles, Check } from 'lucide-react';

interface AddGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (goalData: MockGoalInput) => void;
}

export const AddGoalModal: React.FC<AddGoalModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [targetDate, setTargetDate] = useState('2027-12-31');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [category, setCategory] = useState('An toàn tài chính');
  const [color, setColor] = useState('#10b981');
  const [submitted, setSubmitted] = useState(false);

  const colors = [
    '#10b981', // Emerald
    '#0ea5e9', // Sky Blue
    '#8b5cf6', // Violet
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#ef4444', // Red
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetAmount) return;

    setSubmitted(true);
    setTimeout(() => {
      onSuccess?.({
        name,
        targetAmount: parseFloat(targetAmount),
        currentAmount: parseFloat(initialAmount) || 0,
        currency: 'VND',
        targetDate,
        monthlyContribution: parseFloat(monthlyContribution) || 0,
        color,
        category,
        icon: 'Target',
      });
      setSubmitted(false);
      onOpenChange(false);
      setName('');
      setTargetAmount('');
      setInitialAmount('');
    }, 400);
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
            Thiết lập kế hoạch tiết kiệm hoặc đầu tư cho các dự định lớn.
          </DialogDescription>
        </DialogHeader>

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
              <Label htmlFor="targetAmt">Số tiền mục tiêu (VND)</Label>
              <Input
                id="targetAmt"
                type="number"
                step="any"
                placeholder="100.000.000"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="initAmt">Đã có sẵn (VND)</Label>
              <Input
                id="initAmt"
                type="number"
                step="any"
                placeholder="0"
                value={initialAmount}
                onChange={(e) => setInitialAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tDate">Ngày dự kiến hoàn thành</Label>
              <Input
                id="tDate"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mContrib">Góp đều hàng tháng (VND)</Label>
              <Input
                id="mContrib"
                type="number"
                step="any"
                placeholder="5.000.000"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goalCat">Phân loại</Label>
            <Select
              id="goalCat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={[
                { value: 'An toàn tài chính', label: 'An toàn tài chính' },
                { value: 'Trải nghiệm cuộc sống', label: 'Trải nghiệm cuộc sống' },
                { value: 'Tài sản lớn', label: 'Tài sản lớn' },
                { value: 'Đầu tư & Tự do', label: 'Đầu tư & Tự do' },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Màu đại diện</Label>
            <div className="flex gap-2 pt-1">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="h-4 w-4 text-white" />}
                </button>
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
              {submitted ? 'Đang tạo...' : 'Tạo mục tiêu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
