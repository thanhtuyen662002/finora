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
import { Plus, CheckCircle2 } from 'lucide-react';
import { AccountRow, CategoryRow } from '@/types/database';
import {
  createTransaction,
  updateTransaction,
  voidTransaction,
  restoreTransaction,
  ExtendedTransaction,
} from '@/features/transactions';
import { getAccounts } from '@/features/accounts/accounts';
import { getCategories } from '@/features/categories/categories';
import { isPositiveExactDecimal, toExactDecimal } from '@/lib/money';

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void | Promise<void>;
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
  
  useEffect(() => {
    let active = true;
    if (open && (!propAccounts.length || !propCategories.length)) {
      Promise.all([getAccounts(), getCategories()])
        .then(([accs, cats]) => {
          if (active) {
            setInternalAccounts(accs);
            setInternalCategories(cats);
          }
        })
        .catch(console.error);
    }
    return () => {
      active = false;
    };
  }, [open, propAccounts.length, propCategories.length]);

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

  // Reset form when dialog opens
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!open) return;

    if (initialData) {
      setType(initialData.type);
      setAmount(initialData.amount);
      setCurrency(initialData.currency_code);
      setAccountId(initialData.account_id);
      setCategoryId(initialData.category_id);
      setMerchant(initialData.merchant || '');
      setNote(initialData.note || '');
      setOccurredOn(initialData.occurred_on || new Date().toISOString().substring(0, 10));
    } else {
      const defaultType = 'EXPENSE';
      setType(defaultType);
      setAmount('');
      
      const activeAccs = accounts.filter((a) => !a.is_archived);
      const firstAcc = activeAccs.length > 0 ? activeAccs[0] : accounts[0];
      setCurrency(firstAcc ? firstAcc.currency_code : 'VND');
      setAccountId(firstAcc ? firstAcc.id : '');
      
      setMerchant('');
      setNote('');
      setOccurredOn(new Date().toISOString().substring(0, 10));
      
      const activeCats = categories.filter((c) => !c.is_archived && c.type === defaultType);
      setCategoryId(activeCats.length > 0 ? activeCats[0].id : '');
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, initialData, accounts, categories]);

  const handleTypeChange = (newTypeVal: string) => {
    const newType = newTypeVal as 'EXPENSE' | 'INCOME';
    setType(newType);
    const availableCats = categories.filter(
      (c) => c.type === newType && (!c.is_archived || (initialData && c.id === initialData.category_id))
    );
    if (availableCats.length > 0) {
      setCategoryId(availableCats[0].id);
    } else {
      setCategoryId('');
    }
  };

  const handleAccountChange = (newAccId: string) => {
    setAccountId(newAccId);
    const acc = accounts.find((a) => a.id === newAccId);
    if (acc) {
      setCurrency(acc.currency_code);
    }
  };

  // Filtered account options: only active, plus currently selected historical account if editing
  const accountOptions = accounts
    .filter((a) => !a.is_archived || (initialData && a.id === initialData.account_id))
    .map((a) => ({
      value: a.id,
      label: `${a.name} (${a.currency_code})` + (a.is_archived ? ' (Đã lưu trữ)' : ''),
    }));

  // Filtered category options: only active of current type, plus currently selected historical category if editing
  const categoryOptions = categories
    .filter(
      (c) => c.type === type && (!c.is_archived || (initialData && c.id === initialData.category_id))
    )
    .map((c) => ({
      value: c.id,
      label: c.name + (c.is_archived ? ' (Đã lưu trữ)' : ''),
    }));

  const handleVoid = async () => {
    if (!initialData) return;
    try {
      setSubmitted(true);
      setErrorMsg('');
      await voidTransaction(initialData.id);
      if (onSuccess) await onSuccess();
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
      setErrorMsg('');
      await restoreTransaction(initialData.id);
      if (onSuccess) await onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi khi khôi phục giao dịch');
      setSubmitted(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !isPositiveExactDecimal(amount) || !accountId || !categoryId) {
      setErrorMsg('Vui lòng nhập đầy đủ thông tin bắt buộc và số tiền hợp lệ (> 0).');
      return;
    }
    setErrorMsg('');
    setSubmitted(true);
    
    try {
      const exactAmountStr = toExactDecimal(amount);
      if (initialData) {
        await updateTransaction(initialData.id, {
          type,
          amount: exactAmountStr,
          currency_code: currency,
          account_id: accountId,
          category_id: categoryId,
          merchant: merchant.trim(),
          note: note.trim() || null,
          occurred_on: occurredOn,
        });
      } else {
        await createTransaction({
          type,
          amount: exactAmountStr,
          currency_code: currency,
          account_id: accountId,
          category_id: categoryId,
          merchant: merchant.trim(),
          note: note.trim() || null,
          occurred_on: occurredOn,
        });
      }
      
      if (onSuccess) await onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi khi lưu giao dịch');
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
              onValueChange={handleTypeChange}
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
                type="text"
                inputMode="decimal"
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

          {/* Accounts & Categories */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="account">Tài khoản</Label>
              <Select
                id="account"
                value={accountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                options={accountOptions}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category">Danh mục</Label>
              <Select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                options={categoryOptions}
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
