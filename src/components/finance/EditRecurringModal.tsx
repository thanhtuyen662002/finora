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
import { Edit2, AlertCircle } from 'lucide-react';
import type { AccountRow, CategoryRow } from '@/types/database';
import type {
  ExtendedRecurringItem,
  RecurringItemUpdateInput,
  RecurringFrequency,
} from '@/features/recurring';
import { toExactDecimal, isPositiveExactDecimal } from '@/lib/money';
import { isValidISODateString } from '@/features/recurring/engine';

interface EditRecurringModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ExtendedRecurringItem | null;
  accounts: AccountRow[];
  categories: CategoryRow[];
  onSuccess?: (id: string, updates: RecurringItemUpdateInput) => Promise<void> | void;
}

export const EditRecurringModal: React.FC<EditRecurringModalProps> = ({
  open,
  onOpenChange,
  item,
  accounts,
  categories,
  onSuccess,
}) => {
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('MONTHLY');
  const [anchorDate, setAnchorDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (item) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setType(item.transaction_type);
      setName(item.name);
      setAmount(item.amount);
      setAccountId(item.account_id);
      setCategoryId(item.category_id);
      setFrequency(item.frequency);
      setAnchorDate(item.anchor_date);
      setEndDate(item.end_date || '');
      setNote(item.note || '');
      setError('');
    }
  }, [item]);

  if (!item) return null;

  const matchingCategories = categories.filter(
    (c) => (c.type === type && !c.is_archived) || c.id === item.category_id
  );
  const matchingAccounts = accounts.filter(
    (a) => (!a.is_archived && a.currency_code === item.currency_code) || a.id === item.account_id
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Vui lòng nhập tên khoản định kỳ');
      return;
    }

    if (!accountId) {
      setError('Vui lòng chọn tài khoản');
      return;
    }

    if (!categoryId) {
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

      setSubmitted(true);
      await onSuccess?.(item.id, {
        account_id: accountId,
        category_id: categoryId,
        transaction_type: type,
        name: trimmedName,
        amount: exactAmount,
        frequency,
        anchor_date: anchorDate,
        end_date: endDate || null,
        note: note.trim() || null,
      });

      setSubmitted(false);
      onOpenChange(false);
    } catch (err: unknown) {
      setSubmitted(false);
      setError(err instanceof Error ? err.message : 'Lỗi khi cập nhật khoản định kỳ');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Edit2 className="h-5 w-5 text-primary" />
            <span>Chỉnh sửa khoản định kỳ</span>
          </DialogTitle>
          <DialogDescription>
            Cập nhật cấu hình lịch thu/chi định kỳ ({item.currency_code}).
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
              const newType = val as 'EXPENSE' | 'INCOME';
              setType(newType);
              const validCats = categories.filter(
                (c) => (c.type === newType && !c.is_archived) || (c.id === item.category_id && c.type === newType)
              );
              if (!validCats.some((c) => c.id === categoryId)) {
                setCategoryId(validCats[0]?.id || '');
              }
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="EXPENSE">Chi phí định kỳ</TabsTrigger>
              <TabsTrigger value="INCOME">Thu nhập định kỳ</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-1.5">
            <Label htmlFor="editRecName">Tên khoản định kỳ</Label>
            <Input
              id="editRecName"
              placeholder="Ví dụ: Tiền thuê nhà, Tiền điện, Lương tháng..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="editRecAmount">Số tiền ({item.currency_code})</Label>
              <Input
                id="editRecAmount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editRecFreq">Chu kỳ lặp lại</Label>
              <Select
                id="editRecFreq"
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
              <Label htmlFor="editRecAccount">Tài khoản thanh toán</Label>
              <Select
                id="editRecAccount"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                options={matchingAccounts.map((a) => ({
                  value: a.id,
                  label: `${a.name} (${a.currency_code})`,
                }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editRecCategory">Danh mục</Label>
              <Select
                id="editRecCategory"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                options={matchingCategories.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="editAnchorDate">Ngày bắt đầu</Label>
              <Input
                id="editAnchorDate"
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editEndDate">Ngày kết thúc (Tùy chọn)</Label>
              <Input
                id="editEndDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="editRecNote">Ghi chú (Tùy chọn)</Label>
            <Input
              id="editRecNote"
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
              {submitted ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
