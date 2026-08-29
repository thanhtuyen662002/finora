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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Repeat, AlertCircle } from 'lucide-react';
import type { AccountRow, CategoryRow } from '@/types/database';
import type { RecurringItemInsertInput, RecurringFrequency } from '@/features/recurring';
import { toExactDecimal, isPositiveExactDecimal } from '@/lib/money';
import { isValidISODateString } from '@/features/recurring/engine';

interface AddRecurringModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountRow[];
  categories: CategoryRow[];
  currencyCode?: string;
  defaultAnchorDate?: string;
  onSuccess?: (itemData: RecurringItemInsertInput) => Promise<void> | void;
}

export const AddRecurringModal: React.FC<AddRecurringModalProps> = ({
  open,
  onOpenChange,
  accounts,
  categories,
  currencyCode = 'VND',
  defaultAnchorDate = '',
  onSuccess,
}) => {
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('MONTHLY');
  const [anchorDate, setAnchorDate] = useState(defaultAnchorDate);
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && defaultAnchorDate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnchorDate(defaultAnchorDate);
    }
  }, [open, defaultAnchorDate]);

  // Filter active categories matching the selected transaction type
  const matchingCategories = categories.filter((c) => !c.is_archived && c.type === type);
  // Filter active accounts matching currency if specified
  const matchingAccounts = accounts.filter(
    (a) => !a.is_archived && (!currencyCode || a.currency_code === currencyCode)
  );

  const effectiveAccountId = selectedAccountId || matchingAccounts[0]?.id || '';
  const effectiveCategoryId = selectedCategoryId || matchingCategories[0]?.id || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Vui lòng nhập tên khoản định kỳ');
      return;
    }

    if (!effectiveAccountId) {
      setError('Vui lòng chọn tài khoản thanh toán');
      return;
    }

    if (!effectiveCategoryId) {
      setError('Vui lòng chọn danh mục');
      return;
    }

    try {
      const exactAmount = toExactDecimal(amount);
      if (!isPositiveExactDecimal(exactAmount)) {
        setError('Số tiền phải lớn hơn 0');
        return;
      }

      if (!isValidISODateString(anchorDate)) {
        setError('Ngày bắt đầu không hợp lệ (định dạng YYYY-MM-DD)');
        return;
      }

      if (endDate) {
        if (!isValidISODateString(endDate)) {
          setError('Ngày kết thúc không hợp lệ (định dạng YYYY-MM-DD)');
          return;
        }
        if (endDate < anchorDate) {
          setError('Ngày kết thúc không thể trước ngày bắt đầu');
          return;
        }
      }

      const selectedAcc = accounts.find((a) => a.id === effectiveAccountId);
      const accCurrency = selectedAcc?.currency_code || currencyCode;

      setSubmitted(true);
      await onSuccess?.({
        account_id: effectiveAccountId,
        category_id: effectiveCategoryId,
        transaction_type: type,
        name: trimmedName,
        amount: exactAmount,
        currency_code: accCurrency,
        frequency,
        anchor_date: anchorDate,
        end_date: endDate || null,
        note: note.trim() || null,
      });

      setSubmitted(false);
      onOpenChange(false);
      setName('');
      setAmount('');
      setNote('');
      setEndDate('');
      setSelectedAccountId('');
      setSelectedCategoryId('');
    } catch (err: unknown) {
      setSubmitted(false);
      setError(err instanceof Error ? err.message : 'Lỗi khi tạo khoản định kỳ');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Repeat className="h-5 w-5 text-primary" />
            <span>Thêm khoản định kỳ mới</span>
          </DialogTitle>
          <DialogDescription>
            Thiết lập lịch thu/chi định kỳ để tự động theo dõi kế hoạch tài chính.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <Tabs
            value={type}
            onValueChange={(val) => {
              setType(val as 'EXPENSE' | 'INCOME');
              setSelectedCategoryId('');
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="EXPENSE">Chi phí định kỳ</TabsTrigger>
              <TabsTrigger value="INCOME">Thu nhập định kỳ</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-1.5">
            <Label htmlFor="recName">Tên khoản định kỳ</Label>
            <Input
              id="recName"
              placeholder="Ví dụ: Tiền thuê nhà, Tiền điện, Lương tháng..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="recAmount">Số tiền ({currencyCode})</Label>
              <Input
                id="recAmount"
                type="text"
                inputMode="decimal"
                placeholder="5000000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="recFreq">Chu kỳ lặp lại</Label>
              <Select
                id="recFreq"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                options={[
                  { value: 'MONTHLY', label: 'Hàng tháng' },
                  { value: 'WEEKLY', label: 'Hàng tuần' },
                  { value: 'YEARLY', label: 'Hàng năm' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="recAccount">Tài khoản thanh toán</Label>
              <Select
                id="recAccount"
                value={effectiveAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                options={matchingAccounts.map((a) => ({
                  value: a.id,
                  label: `${a.name} (${a.currency_code})`,
                }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="recCategory">Danh mục</Label>
              <Select
                id="recCategory"
                value={effectiveCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                options={matchingCategories.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="anchorDate">Ngày bắt đầu</Label>
              <Input
                id="anchorDate"
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="endDate">Ngày kết thúc (Tùy chọn)</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recNote">Ghi chú (Tùy chọn)</Label>
            <Input
              id="recNote"
              placeholder="Thông tin thêm về khoản định kỳ..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
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
            <Button type="submit" disabled={submitted || !name || !amount}>
              {submitted ? 'Đang tạo...' : 'Tạo khoản định kỳ'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
