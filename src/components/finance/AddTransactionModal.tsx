import React, { useState, useEffect, useCallback } from 'react';
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
import { Plus, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { MoneyInput } from './MoneyInput';
import { AccountRow, CategoryRow } from '@/types/database';
import {
  createTransaction,
  updateTransaction,
  voidTransaction,
  restoreTransaction,
  buildTransactionUpdatePayload,
  ExtendedTransaction,
} from '@/features/transactions';
import { getAccounts } from '@/features/accounts/accounts';
import { getCategories } from '@/features/categories/categories';
import {
  getIncomeSourcesWithStreams,
  IncomeSourceWithStreams,
} from '@/features/income-sources';
import { isPositiveExactDecimal, toExactDecimal } from '@/lib/money';

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void | Promise<void>;
  initialData?: ExtendedTransaction | null;
  accounts?: AccountRow[];
  categories?: CategoryRow[];
  incomeSources?: IncomeSourceWithStreams[];
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
  initialData,
  accounts: propAccounts = [],
  categories: propCategories = [],
  incomeSources: propIncomeSources = [],
}) => {
  const [internalAccounts, setInternalAccounts] = useState<AccountRow[]>([]);
  const [internalCategories, setInternalCategories] = useState<CategoryRow[]>([]);
  const [internalIncomeSources, setInternalIncomeSources] = useState<IncomeSourceWithStreams[]>([]);
  const [incomeSourcesLoading, setIncomeSourcesLoading] = useState(false);
  const [incomeSourcesLoadError, setIncomeSourcesLoadError] = useState<string | null>(null);

  const loadIncomeSources = useCallback(async () => {
    if (propIncomeSources.length > 0) return;
    setIncomeSourcesLoading(true);
    setIncomeSourcesLoadError(null);
    try {
      const res = await getIncomeSourcesWithStreams({ includeArchived: true });
      setInternalIncomeSources(res);
    } catch (err: unknown) {
      console.error('Failed to load income sources for attribution:', err);
      setIncomeSourcesLoadError(
        'Không thể tải nguồn thu nhập. Bạn vẫn có thể lưu giao dịch không gán nguồn hoặc thử tải lại.'
      );
    } finally {
      setIncomeSourcesLoading(false);
    }
  }, [propIncomeSources.length]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    let active = true;
    if (open) {
      if (!propAccounts.length) {
        getAccounts()
          .then((res) => {
            if (active) setInternalAccounts(res);
          })
          .catch((err) => console.error(err));
      }
      if (!propCategories.length) {
        getCategories()
          .then((res) => {
            if (active) setInternalCategories(res);
          })
          .catch((err) => console.error(err));
      }
      if (!propIncomeSources.length) {
        void loadIncomeSources();
      }
    }
    return () => {
      active = false;
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, propAccounts.length, propCategories.length, propIncomeSources.length, loadIncomeSources]);

  const accounts = propAccounts.length > 0 ? propAccounts : internalAccounts;
  const categories = propCategories.length > 0 ? propCategories : internalCategories;
  const incomeSources = propIncomeSources.length > 0 ? propIncomeSources : internalIncomeSources;

  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('VND');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [incomeSourceId, setIncomeSourceId] = useState('');
  const [incomeSourceStreamId, setIncomeSourceStreamId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().substring(0, 10));
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!open) return;

    setSubmitted(false);
    setErrorMsg('');

    if (initialData) {
      setType(initialData.type);
      setAmount(initialData.amount);
      setCurrency(initialData.currency_code);
      setAccountId(initialData.account_id);
      setCategoryId(initialData.category_id);
      setIncomeSourceId(initialData.income_source_id || '');
      setIncomeSourceStreamId(initialData.income_source_stream_id || '');
      setMerchant(initialData.merchant || '');
      setNote(initialData.note || '');
      setOccurredOn(initialData.occurred_on || new Date().toISOString().substring(0, 10));
    } else {
      const defaultType = 'EXPENSE';
      const activeAccounts = accounts.filter((account) => !account.is_archived);
      const firstActiveAccount = activeAccounts[0];
      const activeCategories = categories.filter(
        (category) => !category.is_archived && category.type === defaultType
      );

      setType(defaultType);
      setAmount('');
      setCurrency(firstActiveAccount?.currency_code || 'VND');
      setAccountId(firstActiveAccount?.id || '');
      setCategoryId(activeCategories[0]?.id || '');
      setIncomeSourceId('');
      setIncomeSourceStreamId('');
      setMerchant('');
      setNote('');
      setOccurredOn(new Date().toISOString().substring(0, 10));
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, initialData, accounts, categories]);

  const handleTypeChange = (newTypeValue: string) => {
    const newType = newTypeValue as 'EXPENSE' | 'INCOME';
    setType(newType);

    const availableCategories = categories.filter(
      (category) =>
        category.type === newType &&
        (!category.is_archived || Boolean(initialData && category.id === initialData.category_id))
    );
    setCategoryId(availableCategories[0]?.id || '');

    if (newType === 'EXPENSE') {
      setIncomeSourceId('');
      setIncomeSourceStreamId('');
    }
  };

  const handleAccountChange = (newAccountId: string) => {
    setAccountId(newAccountId);
    const account = accounts.find((candidate) => candidate.id === newAccountId);
    if (account) setCurrency(account.currency_code);
  };

  const handleIncomeSourceChange = (newSourceId: string) => {
    setIncomeSourceId(newSourceId);
    setIncomeSourceStreamId('');
  };

  const accountOptions = accounts
    .filter(
      (account) =>
        !account.is_archived || Boolean(initialData && account.id === initialData.account_id)
    )
    .map((account) => ({
      value: account.id,
      label: `${account.name} (${account.currency_code})${
        account.is_archived ? ' (Đã lưu trữ)' : ''
      }`,
    }));

  const categoryOptions = categories
    .filter(
      (category) =>
        category.type === type &&
        (!category.is_archived || Boolean(initialData && category.id === initialData.category_id))
    )
    .map((category) => ({
      value: category.id,
      label: `${category.name}${category.is_archived ? ' (Đã lưu trữ)' : ''}`,
    }));

  const incomeSourceOptions = [
    { value: '', label: '-- Không gán nguồn thu --' },
    ...incomeSources
      .filter(
        (src) =>
          !src.is_archived ||
          Boolean(initialData && src.id === initialData.income_source_id)
      )
      .map((src) => {
        const typeLabel =
          src.type === 'SALARY'
            ? 'Lương'
            : src.type === 'YOUTUBE'
            ? 'YouTube'
            : src.type === 'FREELANCE'
            ? 'Freelance'
            : src.type === 'INVESTMENT'
            ? 'Đầu tư'
            : 'Khác';
        return {
          value: src.id,
          label: `${src.name} [${typeLabel}]${src.is_archived ? ' (Đã lưu trữ)' : ''}`,
        };
      }),
  ];

  const selectedSource = incomeSources.find((s) => s.id === incomeSourceId);
  const streamOptions = [
    { value: '', label: '-- Mặc định (Toàn nguồn) --' },
    ...(selectedSource?.streams || [])
      .filter(
        (st) =>
          !st.is_archived ||
          Boolean(initialData && st.id === initialData.income_source_stream_id)
      )
      .map((st) => ({
        value: st.id,
        label: `${st.name}${st.is_archived ? ' (Đã lưu trữ)' : ''}`,
      })),
  ];

  const handleVoid = async () => {
    if (!initialData) return;
    try {
      setSubmitted(true);
      setErrorMsg('');
      await voidTransaction(initialData.id);
      if (onSuccess) await onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      console.error(error);
      setErrorMsg(error instanceof Error ? error.message : 'Lỗi khi hủy giao dịch');
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
    } catch (error: unknown) {
      console.error(error);
      setErrorMsg(error instanceof Error ? error.message : 'Lỗi khi khôi phục giao dịch');
      setSubmitted(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!accountId) {
      setErrorMsg('Cần có ít nhất một tài khoản đang hoạt động để lưu giao dịch.');
      return;
    }
    if (!categoryId) {
      setErrorMsg('Cần có danh mục đang hoạt động phù hợp với loại giao dịch.');
      return;
    }
    if (!amount || !isPositiveExactDecimal(amount)) {
      setErrorMsg('Số tiền phải lớn hơn 0, tối đa 16 chữ số nguyên và 4 chữ số thập phân.');
      return;
    }
    if (!merchant.trim()) {
      setErrorMsg('Tên cửa hàng / nguồn tiền không được để trống.');
      return;
    }

    setErrorMsg('');
    setSubmitted(true);

    try {
      const exactAmount = toExactDecimal(amount);

      if (initialData) {
        const updatePayload = buildTransactionUpdatePayload(
          {
            id: initialData.id,
            type: initialData.type,
            amount: initialData.amount,
            currency_code: initialData.currency_code,
            account_id: initialData.account_id,
            category_id: initialData.category_id,
            merchant: initialData.merchant || '',
            note: initialData.note,
            occurred_on: initialData.occurred_on,
            income_source_id: initialData.income_source_id,
            income_source_stream_id: initialData.income_source_stream_id,
          },
          {
            type,
            amount: exactAmount,
            currency_code: currency,
            account_id: accountId,
            category_id: categoryId,
            merchant: merchant.trim(),
            note: note.trim() || null,
            occurred_on: occurredOn,
            income_source_id: type === 'INCOME' ? (incomeSourceId || null) : null,
            income_source_stream_id:
              type === 'INCOME' && incomeSourceId ? (incomeSourceStreamId || null) : null,
          }
        );
        await updateTransaction(initialData.id, updatePayload);
      } else {
        await createTransaction({
          type,
          amount: exactAmount,
          currency_code: currency,
          account_id: accountId,
          category_id: categoryId,
          income_source_id: type === 'INCOME' ? (incomeSourceId || null) : null,
          income_source_stream_id:
            type === 'INCOME' && incomeSourceId ? (incomeSourceStreamId || null) : null,
          merchant: merchant.trim(),
          note: note.trim() || null,
          occurred_on: occurredOn,
        });
      }

      if (onSuccess) await onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      console.error(error);
      setErrorMsg(error instanceof Error ? error.message : 'Lỗi khi lưu giao dịch');
      setSubmitted(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-lg">
            <Plus className="h-5 w-5 text-primary" />
            <span>{initialData ? 'Sửa giao dịch' : 'Thêm giao dịch mới'}</span>
          </DialogTitle>
          <DialogDescription>Ghi nhận thu chi và phân bổ nguồn thu.</DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {errorMsg}
          </div>
        )}

        {!initialData && accountOptions.length === 0 && (
          <div className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
            Chưa có tài khoản đang hoạt động. Hãy tạo hoặc khôi phục một tài khoản trước.
          </div>
        )}

        {!initialData && categoryOptions.length === 0 && (
          <div className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
            Chưa có danh mục đang hoạt động phù hợp với loại giao dịch này.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <Tabs value={type} onValueChange={handleTypeChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="EXPENSE">Chi tiêu (-)</TabsTrigger>
              <TabsTrigger value="INCOME">Thu nhập (+)</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-1.5">
            <Label htmlFor="amount">Số tiền ({currency})</Label>
            <div className="flex gap-2">
              <MoneyInput
                id="amount"
                currencyCode={currency}
                placeholder={currency === 'VND' ? '50.000' : '50.00'}
                value={amount}
                onChange={(val) => setAmount(val)}
                required
                className="text-lg font-semibold"
                autoFocus
              />
              <Input value={currency} disabled className="w-24 font-mono font-semibold bg-muted" />
            </div>
          </div>

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
              onChange={(event) => setMerchant(event.target.value)}
              maxLength={200}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="account">Tài khoản</Label>
              <Select
                id="account"
                value={accountId}
                onChange={(event) => handleAccountChange(event.target.value)}
                options={accountOptions}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category">Danh mục</Label>
              <Select
                id="category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                options={categoryOptions}
              />
            </div>
          </div>

          {/* Phase 9 Income Attribution Section - shown only for INCOME */}
          {type === 'INCOME' && (
            <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
              {incomeSourcesLoadError && (
                <div
                  className="flex items-start justify-between gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive"
                  role="alert"
                >
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{incomeSourcesLoadError}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[11px] shrink-0"
                    onClick={() => loadIncomeSources()}
                    disabled={incomeSourcesLoading}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${incomeSourcesLoading ? 'animate-spin' : ''}`} />
                    Thử lại
                  </Button>
                </div>
              )}

              {incomeSourcesLoading && !incomeSourcesLoadError && (
                <div className="flex items-center space-x-2 text-xs text-muted-foreground py-1">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>Đang tải danh sách nguồn thu nhập...</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="incomeSource" className="text-xs font-semibold text-foreground">
                  Nguồn thu nhập (Tùy chọn)
                </Label>
                <Select
                  id="incomeSource"
                  value={incomeSourceId}
                  onChange={(event) => handleIncomeSourceChange(event.target.value)}
                  options={incomeSourceOptions}
                  disabled={incomeSourcesLoading}
                />
              </div>

              {incomeSourceId && selectedSource && selectedSource.streams && selectedSource.streams.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="incomeStream" className="text-xs font-semibold text-foreground">
                    Kênh thu (Tùy chọn)
                  </Label>
                  <Select
                    id="incomeStream"
                    value={incomeSourceStreamId}
                    onChange={(event) => setIncomeSourceStreamId(event.target.value)}
                    options={streamOptions}
                    disabled={incomeSourcesLoading}
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="occurredOn">Ngày giao dịch</Label>
              <Input
                id="occurredOn"
                type="date"
                value={occurredOn}
                onChange={(event) => setOccurredOn(event.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note">Ghi chú (tùy chọn)</Label>
              <Input
                id="note"
                placeholder="Thêm chi tiết..."
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={1000}
              />
            </div>
          </div>

          <DialogFooter className="pt-3 flex justify-between w-full">
            <div className="flex gap-2">
              {initialData && !initialData.is_voided && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleVoid}
                  disabled={submitted}
                >
                  Hủy giao dịch
                </Button>
              )}
              {initialData && initialData.is_voided && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleRestore}
                  disabled={submitted}
                >
                  Khôi phục
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={submitted || !amount || !accountId || !categoryId}
              >
                {submitted ? (
                  <span className="flex items-center space-x-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Đang lưu</span>
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
