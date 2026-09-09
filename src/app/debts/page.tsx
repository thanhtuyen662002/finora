"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { EmptyState } from '@/components/finance/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/finance/MoneyInput';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { getAccounts } from '@/features/accounts/accounts';
import { getCategories } from '@/features/categories/categories';
import {
  archiveDebt,
  createDebt,
  getDebtPayments,
  getDebts,
  recordDebtPayment,
  updateDebt,
} from '@/features/debts';
import {
  DEBT_FREQUENCY_LABELS,
  DEBT_TYPE_LABELS,
  type Debt,
  type DebtCreateInput,
  type DebtPayment,
  type DebtPaymentFrequency,
  type DebtPaymentInput,
  type DebtType,
  type DebtUpdateInput,
} from '@/features/debts/types';
import { addExactDecimals, compareExactDecimals, computeBasisPoints, formatExactMoney, formatExactDecimal } from '@/lib/money';
import type { AccountRow, CategoryRow } from '@/types/database';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Edit3,
  History,
  Plus,
  RefreshCw,
  WalletCards,
} from 'lucide-react';

type DebtFormState = {
  name: string;
  lender_name: string;
  debt_type: DebtType;
  principal_amount: string;
  currency_code: string;
  interest_rate: string;
  minimum_payment: string;
  payment_frequency: DebtPaymentFrequency;
  first_due_date: string;
  due_day: string;
  note: string;
};

type PaymentFormState = {
  account_id: string;
  category_id: string;
  amount: string;
  principal_amount: string;
  interest_amount: string;
  paid_on: string;
  note: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function emptyDebtForm(currency = 'VND'): DebtFormState {
  return {
    name: '',
    lender_name: '',
    debt_type: 'PERSONAL_LOAN',
    principal_amount: '',
    currency_code: currency,
    interest_rate: '0',
    minimum_payment: '',
    payment_frequency: 'MONTHLY',
    first_due_date: '',
    due_day: '',
    note: '',
  };
}

function formatDate(value: string | null): string {
  if (!value) return 'Chưa đặt';
  const parsed = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const due = new Date(value + 'T00:00:00Z').getTime();
  const now = new Date(today() + 'T00:00:00Z').getTime();
  return Math.ceil((due - now) / 86400000);
}

function debtProgress(debt: Debt): number {
  const paid = computeBasisPoints(debt.paid_principal_amount, debt.principal_amount);
  return Math.max(0, Math.min(100, paid / 100));
}

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');

  const [debtDialogOpen, setDebtDialogOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [debtForm, setDebtForm] = useState<DebtFormState>(emptyDebtForm());
  const [debtFormError, setDebtFormError] = useState('');
  const [debtSubmitting, setDebtSubmitting] = useState(false);

  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>({
    account_id: '',
    category_id: '',
    amount: '',
    principal_amount: '',
    interest_amount: '0',
    paid_on: today(),
    note: '',
  });
  const [paymentError, setPaymentError] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);
  const [paymentsByDebt, setPaymentsByDebt] = useState<Record<string, DebtPayment[]>>({});
  const [paymentsLoading, setPaymentsLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const [debtRows, accountRows, categoryRows] = await Promise.all([
        getDebts({ includeArchived }),
        getAccounts(),
        getCategories(),
      ]);
      setDebts(debtRows);
      setAccounts(accountRows);
      setCategories(categoryRows);
    } catch (error: unknown) {
      console.error('Failed to load debts', error);
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tải danh sách khoản nợ.');
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeDebts = useMemo(
    () => debts.filter((debt) => !debt.is_archived),
    [debts]
  );

  const currencyTotals = useMemo(() => {
    const totals: Record<string, string> = {};
    for (const debt of activeDebts) {
      totals[debt.currency_code] = addExactDecimals(
        totals[debt.currency_code] || '0.0000',
        debt.outstanding_amount
      );
    }
    return totals;
  }, [activeDebts]);

  const dueSoonCount = useMemo(
    () =>
      activeDebts.filter((debt) => {
        const days = daysUntil(debt.first_due_date);
        return days !== null && days >= 0 && days <= 30 && compareExactDecimals(debt.outstanding_amount, '0.0000') > 0;
      }).length,
    [activeDebts]
  );

  const openCreateDialog = () => {
    setEditingDebt(null);
    setDebtForm(emptyDebtForm(accounts.find((account) => !account.is_archived)?.currency_code || 'VND'));
    setDebtFormError('');
    setDebtDialogOpen(true);
  };

  const openEditDialog = (debt: Debt) => {
    setEditingDebt(debt);
    setDebtForm({
      name: debt.name,
      lender_name: debt.lender_name || '',
      debt_type: debt.debt_type,
      principal_amount: debt.principal_amount,
      currency_code: debt.currency_code,
      interest_rate: debt.interest_rate,
      minimum_payment: debt.minimum_payment || '',
      payment_frequency: debt.payment_frequency,
      first_due_date: debt.first_due_date || '',
      due_day: debt.due_day ? String(debt.due_day) : '',
      note: debt.note || '',
    });
    setDebtFormError('');
    setDebtDialogOpen(true);
  };

  const handleDebtSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setDebtFormError('');
    setDebtSubmitting(true);

    try {
      if (editingDebt) {
        const updates: DebtUpdateInput = {
          name: debtForm.name,
          lender_name: debtForm.lender_name || null,
          debt_type: debtForm.debt_type,
          interest_rate: debtForm.interest_rate,
          minimum_payment: debtForm.minimum_payment || null,
          payment_frequency: debtForm.payment_frequency,
          first_due_date: debtForm.first_due_date || null,
          due_day: debtForm.due_day ? Number(debtForm.due_day) : null,
          note: debtForm.note || null,
        };
        await updateDebt(editingDebt.id, updates);
        setNoticeMessage('Đã cập nhật thông tin khoản nợ.');
      } else {
        const input: DebtCreateInput = {
          name: debtForm.name,
          lender_name: debtForm.lender_name || null,
          debt_type: debtForm.debt_type,
          principal_amount: debtForm.principal_amount,
          currency_code: debtForm.currency_code,
          interest_rate: debtForm.interest_rate,
          minimum_payment: debtForm.minimum_payment || null,
          payment_frequency: debtForm.payment_frequency,
          first_due_date: debtForm.first_due_date || null,
          due_day: debtForm.due_day ? Number(debtForm.due_day) : null,
          note: debtForm.note || null,
        };
        await createDebt(input);
        setNoticeMessage('Đã thêm khoản nợ mới.');
      }
      setDebtDialogOpen(false);
      await loadData();
    } catch (error: unknown) {
      console.error('Failed to save debt', error);
      setDebtFormError(error instanceof Error ? error.message : 'Không thể lưu khoản nợ.');
    } finally {
      setDebtSubmitting(false);
    }
  };

  const handleArchive = async (debt: Debt) => {
    const nextArchived = !debt.is_archived;
    const message = nextArchived
      ? 'Lưu trữ khoản nợ này? Dữ liệu thanh toán vẫn được giữ nguyên.'
      : 'Khôi phục khoản nợ này?';
    if (!window.confirm(message)) return;

    try {
      setErrorMessage('');
      await archiveDebt(debt.id, nextArchived);
      setNoticeMessage(nextArchived ? 'Đã lưu trữ khoản nợ.' : 'Đã khôi phục khoản nợ.');
      await loadData();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể cập nhật khoản nợ.');
    }
  };

  const openPaymentDialog = (debt: Debt) => {
    const firstAccount = accounts.find(
      (account) => !account.is_archived && account.currency_code === debt.currency_code
    );
    const firstCategory = categories.find(
      (category) => !category.is_archived && category.type === 'EXPENSE'
    );
    setPaymentDebt(debt);
    setPaymentForm({
      account_id: firstAccount?.id || '',
      category_id: firstCategory?.id || '',
      amount: '',
      principal_amount: '',
      interest_amount: '0',
      paid_on: today(),
      note: '',
    });
    setPaymentError('');
  };

  const handlePaymentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentDebt) return;
    setPaymentError('');
    setPaymentSubmitting(true);

    const input: DebtPaymentInput = {
      debt_id: paymentDebt.id,
      account_id: paymentForm.account_id,
      category_id: paymentForm.category_id,
      amount: paymentForm.amount,
      principal_amount: paymentForm.principal_amount,
      interest_amount: paymentForm.interest_amount,
      paid_on: paymentForm.paid_on,
      note: paymentForm.note || null,
    };

    try {
      await recordDebtPayment(input);
      setPaymentDebt(null);
      setNoticeMessage('Đã ghi nhận thanh toán và cập nhật dư nợ.');
      await loadData();
    } catch (error: unknown) {
      console.error('Failed to record debt payment', error);
      setPaymentError(error instanceof Error ? error.message : 'Không thể ghi nhận thanh toán.');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const togglePayments = async (debtId: string) => {
    if (expandedDebtId === debtId) {
      setExpandedDebtId(null);
      return;
    }

    setExpandedDebtId(debtId);
    if (paymentsByDebt[debtId]) return;

    try {
      setPaymentsLoading(debtId);
      const rows = await getDebtPayments(debtId);
      setPaymentsByDebt((current) => ({ ...current, [debtId]: rows }));
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tải lịch sử thanh toán.');
    } finally {
      setPaymentsLoading(null);
    }
  };

  const paymentAccounts = paymentDebt
    ? accounts.filter(
        (account) =>
          !account.is_archived && account.currency_code === paymentDebt.currency_code
      )
    : [];
  const expenseCategories = categories.filter(
    (category) => !category.is_archived && category.type === 'EXPENSE'
  );

  return (
    <AppShell>
      <PageHeader
        title="Khoản nợ"
        subtitle="Theo dõi dư nợ, hạn thanh toán và lịch sử trả nợ theo từng loại tiền."
      >
        <Button variant="outline" size="sm" onClick={() => void loadData()}>
          <RefreshCw className="h-4 w-4" />
          Làm mới
        </Button>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          Thêm khoản nợ
        </Button>
      </PageHeader>

      {errorMessage && (
        <div className="finora-notice-error rounded-lg border px-4 py-3 text-sm" role="alert">
          {errorMessage}
        </div>
      )}
      {noticeMessage && (
        <div className="finora-notice-success rounded-lg border px-4 py-3 text-sm" role="status">
          {noticeMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <CreditCard className="h-4 w-4 text-rose-500" />
              <span>Khoản nợ đang theo dõi</span>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-foreground">{activeDebts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <WalletCards className="h-4 w-4 text-primary" />
              <span>Tổng dư nợ hiện tại</span>
            </div>
            <div className="mt-2 space-y-1">
              {Object.keys(currencyTotals).length === 0 ? (
                <p className="text-2xl font-extrabold text-foreground">0</p>
              ) : (
                Object.entries(currencyTotals).map(([currency, total]) => (
                  <p key={currency} className="text-xl font-extrabold text-foreground">
                    {formatExactMoney(total, currency)}
                  </p>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <CalendarClock className="h-4 w-4 text-amber-500" />
              <span>Đến hạn trong 30 ngày</span>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-foreground">{dueSoonCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {includeArchived ? 'Đang hiển thị cả khoản nợ đã lưu trữ.' : 'Chỉ hiển thị khoản nợ đang theo dõi.'}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIncludeArchived((current) => !current)}
        >
          {includeArchived ? 'Ẩn khoản đã lưu trữ' : 'Hiện khoản đã lưu trữ'}
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Đang tải khoản nợ...</div>
      ) : debts.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Chưa có khoản nợ nào"
          description="Thêm khoản vay, thẻ tín dụng hoặc khoản mượn để theo dõi dư nợ và lịch trả."
          actionLabel="Thêm khoản nợ"
          onAction={openCreateDialog}
        />
      ) : (
        <div className="space-y-4">
          {debts.map((debt) => {
            const progress = debtProgress(debt);
            const days = daysUntil(debt.first_due_date);
            const payments = paymentsByDebt[debt.id] || [];
            const isPaidOff = compareExactDecimals(debt.outstanding_amount, '0.0000') === 0;
            return (
              <Card key={debt.id} className={debt.is_archived ? 'opacity-70' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <CreditCard className="h-5 w-5 shrink-0 text-rose-500" />
                        <span className="truncate">{debt.name}</span>
                        {isPaidOff && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Đã trả hết
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {debt.lender_name || 'Chưa ghi chủ nợ'} · {DEBT_TYPE_LABELS[debt.debt_type]}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!debt.is_archived && !isPaidOff && (
                        <Button size="sm" onClick={() => openPaymentDialog(debt)}>
                          Trả nợ
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(debt)}>
                        <Edit3 className="h-3.5 w-3.5" />
                        Sửa
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void handleArchive(debt)}>
                        {debt.is_archived ? 'Khôi phục' : 'Lưu trữ'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Dư nợ hiện tại</p>
                      <p className="mt-1 text-lg font-bold text-foreground">
                        {formatExactMoney(debt.outstanding_amount, debt.currency_code)}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Gốc ban đầu</p>
                      <p className="mt-1 text-lg font-bold text-foreground">
                        {formatExactMoney(debt.principal_amount, debt.currency_code)}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Lãi suất / kỳ trả</p>
                      <p className="mt-1 text-lg font-bold text-foreground">
                        {formatExactDecimal(debt.interest_rate)}% · {DEBT_FREQUENCY_LABELS[debt.payment_frequency]}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Đã trả gốc {formatExactMoney(debt.paid_principal_amount, debt.currency_code)}</span>
                      <span>{progress.toFixed(2)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: progress + '%' }} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                    <span>
                      Hạn trả: <strong className="font-semibold text-foreground">{formatDate(debt.first_due_date)}</strong>
                    </span>
                    {days !== null && (
                      <span className={days < 0 ? 'font-semibold text-red-600 dark:text-red-300' : ''}>
                        {days < 0 ? 'Quá hạn ' + Math.abs(days) + ' ngày' : 'Còn ' + days + ' ngày'}
                      </span>
                    )}
                    {debt.minimum_payment && compareExactDecimals(debt.minimum_payment, '0.0000') > 0 && (
                      <span>
                        Tối thiểu: <strong className="font-semibold text-foreground">
                          {formatExactMoney(debt.minimum_payment, debt.currency_code)}
                        </strong>
                      </span>
                    )}
                  </div>

                  <div className="border-t pt-3">
                    <Button variant="ghost" size="sm" onClick={() => void togglePayments(debt.id)}>
                      <History className="h-4 w-4" />
                      {expandedDebtId === debt.id ? 'Ẩn lịch sử' : 'Lịch sử thanh toán'} ({debt.payment_count})
                    </Button>
                    {expandedDebtId === debt.id && (
                      <div className="mt-2 space-y-2">
                        {paymentsLoading === debt.id ? (
                          <p className="text-sm text-muted-foreground">Đang tải lịch sử...</p>
                        ) : payments.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Chưa có lần thanh toán nào.</p>
                        ) : (
                          payments.map((payment) => (
                            <div key={payment.id} className="flex flex-col gap-1 rounded-lg border bg-muted/20 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-medium text-foreground">{formatDate(payment.paid_on)} · {payment.account_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Gốc {formatExactMoney(payment.principal_amount, payment.currency_code)} · Lãi {formatExactMoney(payment.interest_amount, payment.currency_code)}
                                </p>
                              </div>
                              <p className="font-semibold text-foreground">{formatExactMoney(payment.amount, payment.currency_code)}</p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={debtDialogOpen} onOpenChange={setDebtDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editingDebt ? 'Sửa khoản nợ' : 'Thêm khoản nợ'}</DialogTitle>
            <DialogDescription>
              Dư nợ chỉ được giảm qua nghiệp vụ ghi nhận thanh toán.
            </DialogDescription>
          </DialogHeader>
          {debtFormError && (
            <div className="finora-notice-error rounded-lg border px-3 py-2 text-sm" role="alert">
              {debtFormError}
            </div>
          )}
          <form className="space-y-4" onSubmit={handleDebtSubmit}>
            <div className="space-y-2">
              <Label htmlFor="debt-name">Tên khoản nợ</Label>
              <Input id="debt-name" value={debtForm.name} onChange={(event) => setDebtForm({ ...debtForm, name: event.target.value })} placeholder="Ví dụ: Vay mua xe" required />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="debt-lender">Chủ nợ / tổ chức</Label>
                <Input id="debt-lender" value={debtForm.lender_name} onChange={(event) => setDebtForm({ ...debtForm, lender_name: event.target.value })} placeholder="Ví dụ: Ngân hàng..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="debt-type">Loại khoản nợ</Label>
                <Select id="debt-type" value={debtForm.debt_type} onChange={(event) => setDebtForm({ ...debtForm, debt_type: event.target.value as DebtType })} options={Object.entries(DEBT_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="debt-principal">Số tiền gốc ({debtForm.currency_code})</Label>
                <MoneyInput
                  id="debt-principal"
                  currencyCode={debtForm.currency_code}
                  value={debtForm.principal_amount}
                  onChange={(value) => setDebtForm({ ...debtForm, principal_amount: value })}
                  placeholder={debtForm.currency_code === 'VND' ? '0' : '0.00'}
                  disabled={Boolean(editingDebt)}
                  required={!editingDebt}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="debt-currency">Tiền tệ</Label>
                <Input id="debt-currency" value={debtForm.currency_code} onChange={(event) => setDebtForm({ ...debtForm, currency_code: event.target.value.toUpperCase() })} maxLength={5} disabled={Boolean(editingDebt)} required />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="debt-interest">Lãi suất (%/năm)</Label>
                <Input id="debt-interest" inputMode="decimal" value={debtForm.interest_rate} onChange={(event) => setDebtForm({ ...debtForm, interest_rate: event.target.value })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="debt-minimum">Trả tối thiểu</Label>
                <MoneyInput
                  id="debt-minimum"
                  currencyCode={debtForm.currency_code}
                  value={debtForm.minimum_payment}
                  onChange={(value) => setDebtForm({ ...debtForm, minimum_payment: value })}
                  placeholder={debtForm.currency_code === 'VND' ? 'Không bắt buộc' : '0.00'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="debt-frequency">Chu kỳ trả</Label>
                <Select id="debt-frequency" value={debtForm.payment_frequency} onChange={(event) => setDebtForm({ ...debtForm, payment_frequency: event.target.value as DebtPaymentFrequency })} options={Object.entries(DEBT_FREQUENCY_LABELS).map(([value, label]) => ({ value, label }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="debt-due-date">Ngày đến hạn đầu tiên</Label>
                <Input id="debt-due-date" type="date" value={debtForm.first_due_date} onChange={(event) => setDebtForm({ ...debtForm, first_due_date: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="debt-due-day">Ngày trả hàng tháng</Label>
                <Input id="debt-due-day" type="number" min="1" max="31" value={debtForm.due_day} onChange={(event) => setDebtForm({ ...debtForm, due_day: event.target.value })} placeholder="Ví dụ: 15" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-note">Ghi chú</Label>
              <Input id="debt-note" value={debtForm.note} onChange={(event) => setDebtForm({ ...debtForm, note: event.target.value })} placeholder="Điều khoản, tài sản bảo đảm..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDebtDialogOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={debtSubmitting}>
                {debtSubmitting ? 'Đang lưu...' : editingDebt ? 'Lưu thay đổi' : 'Thêm khoản nợ'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(paymentDebt)} onOpenChange={(open) => { if (!open) setPaymentDebt(null); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Ghi nhận trả nợ</DialogTitle>
            <DialogDescription>
              {paymentDebt ? paymentDebt.name + ' · Dư nợ ' + formatExactMoney(paymentDebt.outstanding_amount, paymentDebt.currency_code) : ''}
            </DialogDescription>
          </DialogHeader>
          {paymentError && (
            <div className="finora-notice-error rounded-lg border px-3 py-2 text-sm" role="alert">
              {paymentError}
            </div>
          )}
          {paymentDebt && paymentAccounts.length === 0 && (
            <div className="finora-notice-warning rounded-lg border px-3 py-2 text-sm" role="alert">
              Chưa có tài khoản đang hoạt động cùng tiền tệ {paymentDebt.currency_code}. Hãy tạo hoặc khôi phục tài khoản phù hợp trước khi trả nợ.
            </div>
          )}
          <form className="space-y-4" onSubmit={handlePaymentSubmit}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="payment-account">Tài khoản thanh toán</Label>
                <Select id="payment-account" value={paymentForm.account_id} onChange={(event) => setPaymentForm({ ...paymentForm, account_id: event.target.value })} options={[{ value: '', label: 'Chọn tài khoản' }, ...paymentAccounts.map((account) => ({ value: account.id, label: account.name + ' (' + account.currency_code + ')' }))]} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-category">Danh mục chi</Label>
                <Select id="payment-category" value={paymentForm.category_id} onChange={(event) => setPaymentForm({ ...paymentForm, category_id: event.target.value })} options={[{ value: '', label: 'Chọn danh mục' }, ...expenseCategories.map((category) => ({ value: category.id, label: category.name }))]} required />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="payment-amount">Tổng thanh toán</Label>
                <MoneyInput
                  id="payment-amount"
                  currencyCode={paymentDebt?.currency_code || 'VND'}
                  value={paymentForm.amount}
                  onChange={(value) => setPaymentForm({ ...paymentForm, amount: value })}
                  placeholder={paymentDebt?.currency_code === 'VND' ? '0' : '0.00'}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-principal">Tiền gốc</Label>
                <MoneyInput
                  id="payment-principal"
                  currencyCode={paymentDebt?.currency_code || 'VND'}
                  value={paymentForm.principal_amount}
                  onChange={(value) => setPaymentForm({ ...paymentForm, principal_amount: value })}
                  placeholder={paymentDebt?.currency_code === 'VND' ? '0' : '0.00'}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-interest">Tiền lãi</Label>
                <MoneyInput
                  id="payment-interest"
                  currencyCode={paymentDebt?.currency_code || 'VND'}
                  value={paymentForm.interest_amount}
                  onChange={(value) => setPaymentForm({ ...paymentForm, interest_amount: value })}
                  placeholder={paymentDebt?.currency_code === 'VND' ? '0' : '0.00'}
                  required
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Tổng thanh toán phải bằng tiền gốc cộng tiền lãi. Khoản gốc sẽ được trừ khỏi dư nợ.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="payment-date">Ngày thanh toán</Label>
                <Input id="payment-date" type="date" value={paymentForm.paid_on} onChange={(event) => setPaymentForm({ ...paymentForm, paid_on: event.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-note">Ghi chú</Label>
                <Input id="payment-note" value={paymentForm.note} onChange={(event) => setPaymentForm({ ...paymentForm, note: event.target.value })} placeholder="Tuỳ chọn" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPaymentDebt(null)}>Hủy</Button>
              <Button type="submit" disabled={paymentSubmitting || paymentAccounts.length === 0 || expenseCategories.length === 0}>
                {paymentSubmitting ? 'Đang ghi nhận...' : 'Xác nhận trả nợ'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
