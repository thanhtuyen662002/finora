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
import { createTransaction, updateTransaction, voidTransaction, restoreTransaction } from '@/features/transactions';

import { Plus, CheckCircle2 } from 'lucide-react';
import { AccountRow, CategoryRow, TransactionInsert, TransactionUpdate } from '@/types/database';
import { createTransaction, updateTransaction, ExtendedTransaction } from '@/features/transactions';

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialData?: ExtendedTransaction | null;
  accounts?: AccountRow[];
  categories?: CategoryRow[];
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
  initialData,
  accounts: propAccounts = [],
  categories: propCategories = [],
}) => {
  const [internalAccounts, setInternalAccounts] = useState<AccountRow[]>([]);
  const [internalCategories, setInternalCategories] = useState<CategoryRow[]>([]);
  const { getAccounts } = require('@/features/accounts/accounts');
  const { getCategories } = require('@/features/categories/categories');
  
  useEffect(() => {
    if (open && (!propAccounts.length || !propCategories.length)) {
      Promise.all([getAccounts(), getCategories()]).then(([accs, cats]) => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setInternalAccounts(accs);
        setInternalCategories(cats);
      }).catch(console.error);
    }
  }, [open, propAccounts.length, propCategories.length, getAccounts, getCategories]);

  const accounts = propAccounts.length > 0 ? propAccounts : internalAccounts;
  const categories = propCategories.length > 0 ? propCategories : internalCategories;

  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('VND');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().substring(0, 10));
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSubmitted(false);
      setErrorMsg('');
      if (initialData) {
        setType(initialData.type as 'EXPENSE' | 'INCOME');
        setAmount(initialData.amount.toString());
        setCurrency(initialData.currency_code);
        setAccountId(initialData.account_id);
        setCategoryId(initialData.category_id);
        setMerchant(initialData.merchant || '');
        setNote(initialData.note || '');
        setOccurredOn(initialData.occurred_on || new Date().toISOString().substring(0, 10));
      } else {
        setType('EXPENSE');
        setAmount('');
        setCurrency(accounts.length > 0 ? accounts[0].currency_code : 'VND');
        setAccountId(accounts.length > 0 ? accounts[0].id : '');
        setMerchant('');
        setNote('');
        setOccurredOn(new Date().toISOString().substring(0, 10));
        
        const expCats = categories.filter(c => c.type === 'EXPENSE');
        setCategoryId(expCats.length > 0 ? expCats[0].id : '');
      }
    }
  }, [open, initialData, accounts, categories]);

  // Update category when type changes if current category doesn't match
  useEffect(() => {
    if (!open) return;
    const cat = categories.find(c => c.id === categoryId);
    if (!cat || cat.type !== type) {
      const typeCats = categories.filter(c => c.type === type);
      if (typeCats.length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCategoryId(typeCats[0].id);
      }
      else setCategoryId('');
    }
  }, [type, categories, categoryId, open]);

  // Update currency when account changes
  useEffect(() => {
    if (!open) return;
    const acc = accounts.find(a => a.id === accountId);
    if (acc) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrency(acc.currency_code);
    }
  }, [accountId, accounts, open]);

  const filteredCategories = categories.filter((c) => c.type === type);

  
  const handleVoid = async () => {
    if (!initialData) return;
    try {
      setSubmitted(true);
      await voidTransaction(initialData.id);
      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi khi hủy giao dịch');
      setSubmitted(false);
    }
  };

  const handleRestore = async () => {
    if (!initialData) return;
    try {
      setSubmitted(true);
      await restoreTransaction(initialData.id);
      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi khi khôi phục giao dịch');
      setSubmitted(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0 || !accountId || !categoryId) {
      setErrorMsg('Vui lòng nhập đầy đủ thông tin bắt buộc.');
      return;
    }
    setErrorMsg('');
    setSubmitted(true);
    
    try {
      if (initialData) {
        await updateTransaction(initialData.id, {
          type,
          amount: amount,
          currency_code: currency,
          account_id: accountId,
          category_id: categoryId,
          merchant,
          note,
          occurred_on: occurredOn,
        });
      } else {
        await createTransaction({
          type,
          amount: amount,
          currency_code: currency,
          account_id: accountId,
          category_id: categoryId,
          merchant,
          note,
          occurred_on: occurredOn,
        });
      }
      
      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi khi lưu giao dịch');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSubmitted(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-lg">
            <Plus className="h-5 w-5 text-primary" />
            <span>{initialData ? 'Sửa giao dịch' : 'Thêm giao dịch mới'}</span>
          </DialogTitle>
          <DialogDescription>
            Ghi nhận thu chi.
          </DialogDescription>
        </DialogHeader>
        {errorMsg && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {errorMsg}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Transaction Type Tabs */}
          <div className="w-full">
            <Tabs
              value={type}
              onValueChange={(val) => {
                const newType = val as 'EXPENSE' | 'INCOME';
                setType(newType);
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="EXPENSE">Chi tiêu (-)</TabsTrigger>
                <TabsTrigger value="INCOME">Thu nhập (+)</TabsTrigger>
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
                placeholder={currency === 'VND' ? '50000' : '50.00'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="text-lg font-semibold"
                autoFocus
              />
              <Input
                value={currency}
                disabled
                className="w-24 font-mono font-semibold bg-muted"
              />
            </div>
          </div>

          {/* Merchant / Description */}
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
              required
            />
          </div>

          {/* Accounts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="account">Tài khoản</Label>
              <Select
                id="account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                options={accounts
                  .filter((a) => !a.is_archived || a.id === accountId)
                  .map((a) => ({
                  value: a.id,
                  label: `${a.name} (${a.currency_code})` + (a.is_archived ? ' (Đã lưu trữ)' : ''),
                }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category">Danh mục</Label>
              <Select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                options={filteredCategories
                  .filter((c) => !c.is_archived || c.id === categoryId)
                  .map((c) => ({
                  value: c.id,
                  label: c.name + (c.is_archived ? ' (Đã lưu trữ)' : ''),
                }))}
              />
            </div>
          </div>

          {/* Date & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="occurredOn">Ngày giao dịch</Label>
              <Input
                id="occurredOn"
                type="date"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
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

          <DialogFooter className="pt-3 flex justify-between w-full">
            <div className="flex gap-2">
              {initialData && !initialData.is_voided && (
                <Button type="button" variant="destructive" onClick={handleVoid} disabled={submitted}>
                  Hủy giao dịch
                </Button>
              )}
              {initialData && initialData.is_voided && (
                <Button type="button" variant="secondary" onClick={handleRestore} disabled={submitted}>
                  Khôi phục
                </Button>
              )}
            </div>
            <div className="flex gap-2">
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
          </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
