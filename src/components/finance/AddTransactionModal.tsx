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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MOCK_ACCOUNTS } from '@/lib/mock/accounts';
import { MOCK_CATEGORIES } from '@/lib/mock/transactions';
import { MOCK_INCOME_SOURCES } from '@/lib/mock/reports';
import { TransactionType, CurrencyCode } from '@/types/finance';
import { CheckCircle2, ArrowRightLeft, Plus } from 'lucide-react';

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (txData: any) => void;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('VND');
  const [accountId, setAccountId] = useState(MOCK_ACCOUNTS[0]?.id || '');
  const [toAccountId, setToAccountId] = useState(MOCK_ACCOUNTS[1]?.id || '');
  const [categoryId, setCategoryId] = useState('cat-food');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [occurredAt, setOccurredAt] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [incomeSourceId, setIncomeSourceId] = useState('inc-sal');
  const [submitted, setSubmitted] = useState(false);

  const filteredCategories = MOCK_CATEGORIES.filter((c) =>
    type === 'INCOME' ? c.type === 'INCOME' : c.type === 'EXPENSE'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    setSubmitted(true);
    setTimeout(() => {
      onSuccess?.({
        type,
        amount: parseFloat(amount),
        currency,
        accountId,
        toAccountId: type === 'TRANSFER' ? toAccountId : undefined,
        categoryId,
        merchant: merchant || (type === 'TRANSFER' ? 'Chuyển tiền nội bộ' : 'Giao dịch mới'),
        note,
        occurredAt,
        incomeSourceId: type === 'INCOME' ? incomeSourceId : undefined,
      });
      setSubmitted(false);
      onOpenChange(false);
      // Reset form
      setAmount('');
      setMerchant('');
      setNote('');
    }, 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-lg">
            <Plus className="h-5 w-5 text-primary" />
            <span>Thêm giao dịch mới</span>
          </DialogTitle>
          <DialogDescription>
            Ghi nhận thu chi hoặc chuyển tiền giữa các tài khoản.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Transaction Type Tabs */}
          <div className="w-full">
            <Tabs
              value={type}
              onValueChange={(val) => {
                const newType = val as TransactionType;
                setType(newType);
                if (newType === 'INCOME') setCategoryId('cat-salary');
                if (newType === 'EXPENSE') setCategoryId('cat-food');
                if (newType === 'TRANSFER') setCategoryId('cat-transfer');
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="EXPENSE">Chi tiêu (-)</TabsTrigger>
                <TabsTrigger value="INCOME">Thu nhập (+)</TabsTrigger>
                <TabsTrigger value="TRANSFER">Chuyển tiền</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Amount & Currency */}
          <div className="space-y-1.5">
            <Label htmlFor="amount">Số tiền</Label>
            <div className="flex gap-2">
              <Input
                id="amount"
                type="number"
                step="any"
                placeholder={currency === 'VND' ? '50.000' : '50.00'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="text-lg font-semibold"
                autoFocus
              />
              <Select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-24 font-mono font-semibold"
                options={[
                  { value: 'VND', label: 'VND' },
                  { value: 'USD', label: 'USD' },
                  { value: 'EUR', label: 'EUR' },
                  { value: 'JPY', label: 'JPY' },
                  { value: 'CNY', label: 'CNY' },
                  { value: 'KRW', label: 'KRW' },
                ]}
              />
            </div>
          </div>

          {/* Merchant / Description */}
          {type !== 'TRANSFER' && (
            <div className="space-y-1.5">
              <Label htmlFor="merchant">Tên cửa hàng / Nguồn tiền</Label>
              <Input
                id="merchant"
                placeholder={
                  type === 'EXPENSE'
                    ? 'Ví dụ: Highlands Coffee, Grab, Tiền điện...'
                    : 'Ví dụ: Lương công ty, Google AdSense...'
                }
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
              />
            </div>
          )}

          {/* Accounts */}
          {type === 'TRANSFER' ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="fromAccount">Từ tài khoản</Label>
                <Select
                  id="fromAccount"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  options={MOCK_ACCOUNTS.map((a) => ({
                    value: a.id,
                    label: `${a.name} (${a.currency})`,
                  }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="toAccount">Đến tài khoản</Label>
                <Select
                  id="toAccount"
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  options={MOCK_ACCOUNTS.filter((a) => a.id !== accountId).map(
                    (a) => ({
                      value: a.id,
                      label: `${a.name} (${a.currency})`,
                    })
                  )}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="account">Tài khoản</Label>
                <Select
                  id="account"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  options={MOCK_ACCOUNTS.map((a) => ({
                    value: a.id,
                    label: `${a.name} (${a.currency})`,
                  }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="category">Danh mục</Label>
                <Select
                  id="category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  options={filteredCategories.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                />
              </div>
            </div>
          )}

          {/* Income Source (If Income) */}
          {type === 'INCOME' && (
            <div className="space-y-1.5">
              <Label htmlFor="incomeSource">Nguồn thu nhập chi tiết</Label>
              <Select
                id="incomeSource"
                value={incomeSourceId}
                onChange={(e) => setIncomeSourceId(e.target.value)}
                options={MOCK_INCOME_SOURCES.map((s) => ({
                  value: s.id,
                  label: s.name,
                }))}
              />
            </div>
          )}

          {/* Date & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="occurredAt">Ngày giao dịch</Label>
              <Input
                id="occurredAt"
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note">Ghi chú (tùy chọn)</Label>
              <Input
                id="note"
                placeholder="Thêm chi tiết..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={submitted || !amount}>
              {submitted ? (
                <span className="flex items-center space-x-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Đã lưu</span>
                </span>
              ) : (
                'Lưu giao dịch'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
