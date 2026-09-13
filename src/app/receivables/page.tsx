"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { EmptyState } from '@/components/finance/EmptyState';
import { MoneyInput } from '@/components/finance/MoneyInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  archiveReceivable,
  createReceivable,
  getReceivablePayments,
  getReceivables,
  recordReceivablePayment,
  updateReceivable,
  RECEIVABLE_FREQUENCY_LABELS,
  type Receivable,
  type ReceivableCreateInput,
  type ReceivablePayment,
  type ReceivablePaymentFrequency,
  type ReceivablePaymentInput,
  type ReceivableUpdateInput,
} from '@/features/receivables';
import {
  addExactDecimals,
  compareExactDecimals,
  computeBasisPoints,
  formatExactDecimal,
  formatExactMoney,
} from '@/lib/money';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Edit3,
  HandCoins,
  History,
  Plus,
  RefreshCw,
  UserRound,
  WalletCards,
} from 'lucide-react';

type ReceivableFormState = {
  name: string;
  borrower_name: string;
  principal_amount: string;
  currency_code: string;
  interest_rate: string;
  expected_payment: string;
  payment_frequency: ReceivablePaymentFrequency;
  first_due_date: string;
  due_day: string;
  note: string;
};

type PaymentFormState = {
  amount: string;
  principal_amount: string;
  interest_amount: string;
  paid_on: string;
  note: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function emptyReceivableForm(currency = 'VND'): ReceivableFormState {
  return {
    name: '',
    borrower_name: '',
    principal_amount: '',
    currency_code: currency,
    interest_rate: '0',
    expected_payment: '',
    payment_frequency: 'ONE_TIME',
    first_due_date: '',
    due_day: '',
    note: '',
  };
}

function formatDate(value: string | null): string {
  if (!value) return 'Chưa đặt';
  const parsed = new Date(`${value}T00:00:00Z`);
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
  const due = new Date(`${value}T00:00:00Z`).getTime();
  const now = new Date(`${today()}T00:00:00Z`).getTime();
  return Math.ceil((due - now) / 86400000);
}

function collectionProgress(receivable: Receivable): number {
  const basisPoints = computeBasisPoints(
    receivable.received_principal_amount,
    receivable.principal_amount
  );
  return Math.max(0, Math.min(100, basisPoints / 100));
}

export default function ReceivablesPage() {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');

  const [receivableDialogOpen, setReceivableDialogOpen] = useState(false);
  const [editingReceivable, setEditingReceivable] = useState<Receivable | null>(null);
  const [form, setForm] = useState<ReceivableFormState>(emptyReceivableForm());
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [paymentReceivable, setPaymentReceivable] = useState<Receivable | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>({
    amount: '',
    principal_amount: '',
    interest_amount: '0',
    paid_on: today(),
    note: '',
  });
  const [paymentError, setPaymentError] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paymentsByReceivable, setPaymentsByReceivable] = useState<
    Record<string, ReceivablePayment[]>
  >({});
  const [paymentsLoading, setPaymentsLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const rows = await getReceivables({ includeArchived });
      setReceivables(rows);
    } catch (error: unknown) {
      console.error('Failed to load receivables', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Không thể tải danh sách khoản phải thu.'
      );
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  const activeReceivables = useMemo(
    () => receivables.filter((item) => !item.is_archived),
    [receivables]
  );

  const currencyTotals = useMemo(() => {
    const totals: Record<string, string> = {};
    for (const item of activeReceivables) {
      totals[item.currency_code] = addExactDecimals(
        totals[item.currency_code] || '0.0000',
        item.outstanding_amount
      );
    }
    return totals;
  }, [activeReceivables]);

  const dueSoonCount = useMemo(
    () =>
      activeReceivables.filter((item) => {
        const days = daysUntil(item.first_due_date);
        return (
          days !== null &&
          days >= 0 &&
          days <= 30 &&
          compareExactDecimals(item.outstanding_amount, '0.0000') > 0
        );
      }).length,
    [activeReceivables]
  );

  const overdueCount = useMemo(
    () =>
      activeReceivables.filter((item) => {
        const days = daysUntil(item.first_due_date);
        return (
          days !== null &&
          days < 0 &&
          compareExactDecimals(item.outstanding_amount, '0.0000') > 0
        );
      }).length,
    [activeReceivables]
  );

  const openCreateDialog = () => {
    setEditingReceivable(null);
    setForm(emptyReceivableForm());
    setFormError('');
    setReceivableDialogOpen(true);
  };

  const openEditDialog = (receivable: Receivable) => {
    setEditingReceivable(receivable);
    setForm({
      name: receivable.name,
      borrower_name: receivable.borrower_name,
      principal_amount: receivable.principal_amount,
      currency_code: receivable.currency_code,
      interest_rate: receivable.interest_rate,
      expected_payment: receivable.expected_payment || '',
      payment_frequency: receivable.payment_frequency,
      first_due_date: receivable.first_due_date || '',
      due_day: receivable.due_day ? String(receivable.due_day) : '',
      note: receivable.note || '',
    });
    setFormError('');
    setReceivableDialogOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      if (editingReceivable) {
        const input: ReceivableUpdateInput = {
          name: form.name,
          borrower_name: form.borrower_name,
          interest_rate: form.interest_rate,
          expected_payment: form.expected_payment || null,
          payment_frequency: form.payment_frequency,
          first_due_date: form.first_due_date || null,
          due_day: form.due_day ? Number(form.due_day) : null,
          note: form.note || null,
        };
        await updateReceivable(editingReceivable.id, input);
        setNoticeMessage('Đã cập nhật khoản phải thu.');
      } else {
        const input: ReceivableCreateInput = {
          name: form.name,
          borrower_name: form.borrower_name,
          principal_amount: form.principal_amount,
          currency_code: form.currency_code,
          interest_rate: form.interest_rate,
          expected_payment: form.expected_payment || null,
          payment_frequency: form.payment_frequency,
          first_due_date: form.first_due_date || null,
          due_day: form.due_day ? Number(form.due_day) : null,
          note: form.note || null,
        };
        await createReceivable(input);
        setNoticeMessage('Đã thêm khoản phải thu mới.');
      }

      setReceivableDialogOpen(false);
      await loadData();
    } catch (error: unknown) {
      console.error('Failed to save receivable', error);
      setFormError(error instanceof Error ? error.message : 'Không thể lưu khoản phải thu.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleArchive = async (receivable: Receivable) => {
    const archived = !receivable.is_archived;
    const confirmed = window.confirm(
      archived
        ? 'Lưu trữ khoản phải thu này? Lịch sử thu tiền vẫn được giữ nguyên.'
        : 'Khôi phục khoản phải thu này?'
    );
    if (!confirmed) return;

    try {
      await archiveReceivable(receivable.id, archived);
      setNoticeMessage(archived ? 'Đã lưu trữ khoản phải thu.' : 'Đã khôi phục khoản phải thu.');
      await loadData();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể cập nhật khoản phải thu.');
    }
  };

  const openPaymentDialog = (receivable: Receivable) => {
    setPaymentReceivable(receivable);
    setPaymentForm({
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
    if (!paymentReceivable) return;

    setPaymentSubmitting(true);
    setPaymentError('');

    const input: ReceivablePaymentInput = {
      receivable_id: paymentReceivable.id,
      amount: paymentForm.amount,
      principal_amount: paymentForm.principal_amount,
      interest_amount: paymentForm.interest_amount,
      paid_on: paymentForm.paid_on,
      note: paymentForm.note || null,
    };

    try {
      await recordReceivablePayment(input);
      setPaymentReceivable(null);
      setNoticeMessage('Đã ghi nhận người vay trả tiền và cập nhật dư còn phải thu.');
      setPaymentsByReceivable((current) => {
        const next = { ...current };
        delete next[input.receivable_id];
        return next;
      });
      await loadData();
    } catch (error: unknown) {
      console.error('Failed to record receivable payment', error);
      setPaymentError(error instanceof Error ? error.message : 'Không thể ghi nhận khoản đã thu.');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const togglePayments = async (receivableId: string) => {
    if (expandedId === receivableId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(receivableId);
    if (paymentsByReceivable[receivableId]) return;

    try {
      setPaymentsLoading(receivableId);
      const rows = await getReceivablePayments(receivableId);
      setPaymentsByReceivable((current) => ({ ...current, [receivableId]: rows }));
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tải lịch sử thu tiền.');
    } finally {
      setPaymentsLoading(null);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Khoản phải thu"
        subtitle="Theo dõi tiền người khác đang nợ bạn, hạn trả và lịch sử thu hồi gốc/lãi."
      >
        <Button variant="outline" size="sm" onClick={() => void loadData()}>
          <RefreshCw className="h-4 w-4" />
          Làm mới
        </Button>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          Thêm khoản phải thu
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Đang theo dõi</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <UserRound className="h-5 w-5 text-primary" />
              {activeReceivables.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Khoản chưa lưu trữ</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sắp đến hạn</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <CalendarClock className="h-5 w-5 text-amber-500" />
              {dueSoonCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Trong 30 ngày tới</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Quá hạn</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {overdueCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Còn dư phải thu</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tổng còn phải thu</CardDescription>
            <CardTitle className="text-base">{Object.keys(currencyTotals).length || 0} loại tiền</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {Object.entries(currencyTotals).length === 0 ? (
              <span className="text-xs text-muted-foreground">Chưa có dữ liệu</span>
            ) : (
              Object.entries(currencyTotals).map(([currency, amount]) => (
                <div key={currency} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{currency}</span>
                  <span className="font-semibold">{formatExactMoney(amount, currency)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Danh sách khoản phải thu</h2>
          <p className="text-sm text-muted-foreground">Dư gốc là số tiền người vay còn phải hoàn lại cho bạn.</p>
        </div>
        <Button
          variant={includeArchived ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIncludeArchived((current) => !current)}
        >
          {includeArchived ? 'Đang hiện đã lưu trữ' : 'Hiện đã lưu trữ'}
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Đang tải khoản phải thu...
          </CardContent>
        </Card>
      ) : receivables.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="Chưa có khoản phải thu"
          description="Thêm khoản đầu tiên khi có người mượn tiền bạn để theo dõi dư còn phải thu và lịch sử hoàn trả."
          actionLabel="Thêm khoản phải thu"
          onAction={openCreateDialog}
        />
      ) : (
        <div className="space-y-4">
          {receivables.map((receivable) => {
            const progress = collectionProgress(receivable);
            const dueDays = daysUntil(receivable.first_due_date);
            const settled = compareExactDecimals(receivable.outstanding_amount, '0.0000') === 0;
            const payments = paymentsByReceivable[receivable.id] || [];

            return (
              <Card key={receivable.id} className={receivable.is_archived ? 'opacity-70' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base sm:text-lg">{receivable.name}</CardTitle>
                        {settled && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Đã thu đủ gốc
                          </span>
                        )}
                        {receivable.is_archived && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                            Đã lưu trữ
                          </span>
                        )}
                      </div>
                      <CardDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>Người vay: <strong className="text-foreground">{receivable.borrower_name}</strong></span>
                        <span>{RECEIVABLE_FREQUENCY_LABELS[receivable.payment_frequency]}</span>
                        <span>Hạn: {formatDate(receivable.first_due_date)}</span>
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!receivable.is_archived && !settled && (
                        <Button size="sm" onClick={() => openPaymentDialog(receivable)}>
                          <HandCoins className="h-4 w-4" />
                          Ghi nhận trả tiền
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(receivable)}>
                        <Edit3 className="h-4 w-4" />
                        Sửa
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleArchive(receivable)}
                      >
                        {receivable.is_archived ? 'Khôi phục' : 'Lưu trữ'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground">Dư còn phải thu</div>
                      <div className="mt-1 text-base font-bold">
                        {formatExactMoney(receivable.outstanding_amount, receivable.currency_code)}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground">Gốc ban đầu</div>
                      <div className="mt-1 font-semibold">
                        {formatExactMoney(receivable.principal_amount, receivable.currency_code)}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground">Đã thu gốc</div>
                      <div className="mt-1 font-semibold">
                        {formatExactMoney(receivable.received_principal_amount, receivable.currency_code)}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground">Đã thu lãi</div>
                      <div className="mt-1 font-semibold">
                        {formatExactMoney(receivable.received_interest_amount, receivable.currency_code)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Tiến độ thu hồi gốc</span>
                      <span>{formatExactDecimal(String(progress), 2)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span>Lãi suất: {formatExactDecimal(receivable.interest_rate, 4)}%</span>
                      {receivable.expected_payment && (
                        <span>
                          Dự kiến thu/kỳ: {formatExactMoney(receivable.expected_payment, receivable.currency_code)}
                        </span>
                      )}
                      {dueDays !== null && !settled && (
                        <span className={dueDays < 0 ? 'font-semibold text-destructive' : ''}>
                          {dueDays < 0
                            ? `Quá hạn ${Math.abs(dueDays)} ngày`
                            : dueDays === 0
                              ? 'Đến hạn hôm nay'
                              : `Còn ${dueDays} ngày`}
                        </span>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => void togglePayments(receivable.id)}>
                      <History className="h-4 w-4" />
                      {expandedId === receivable.id ? 'Ẩn lịch sử' : `Lịch sử (${receivable.payment_count})`}
                    </Button>
                  </div>

                  {receivable.note && (
                    <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                      {receivable.note}
                    </div>
                  )}

                  {expandedId === receivable.id && (
                    <div className="rounded-lg border bg-muted/10 p-3">
                      <div className="mb-2 text-sm font-semibold">Lịch sử người vay trả tiền</div>
                      {paymentsLoading === receivable.id ? (
                        <div className="py-4 text-center text-xs text-muted-foreground">Đang tải...</div>
                      ) : payments.length === 0 ? (
                        <div className="py-4 text-center text-xs text-muted-foreground">Chưa có lần trả tiền nào.</div>
                      ) : (
                        <div className="space-y-2">
                          {payments.map((payment) => (
                            <div
                              key={payment.id}
                              className="flex flex-col gap-1 rounded-md border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <div className="text-sm font-medium">{formatDate(payment.paid_on)}</div>
                                <div className="text-xs text-muted-foreground">
                                  Gốc {formatExactMoney(payment.principal_amount, payment.currency_code)} · Lãi {formatExactMoney(payment.interest_amount, payment.currency_code)}
                                </div>
                              </div>
                              <div className="text-sm font-bold">
                                {formatExactMoney(payment.amount, payment.currency_code)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={receivableDialogOpen} onOpenChange={setReceivableDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editingReceivable ? 'Sửa khoản phải thu' : 'Thêm khoản phải thu'}</DialogTitle>
            <DialogDescription>
              Ghi lại tiền người khác đang nợ bạn. Số dư gốc sẽ giảm khi bạn ghi nhận họ trả tiền.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="finora-notice-error rounded-lg border px-3 py-2 text-sm" role="alert">
                {formError}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="receivableName">Tên khoản</Label>
                <Input
                  id="receivableName"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ví dụ: Tùng mượn tiền tháng 9"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="borrowerName">Người vay</Label>
                <Input
                  id="borrowerName"
                  value={form.borrower_name}
                  onChange={(event) => setForm((current) => ({ ...current, borrower_name: event.target.value }))}
                  placeholder="Tên người đang nợ bạn"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="receivablePrincipal">Số tiền gốc ({form.currency_code || 'VND'})</Label>
                <MoneyInput
                  id="receivablePrincipal"
                  value={form.principal_amount}
                  onChange={(value) => setForm((current) => ({ ...current, principal_amount: value }))}
                  currencyCode={form.currency_code || 'VND'}
                  placeholder="0"
                  disabled={Boolean(editingReceivable)}
                />
                {editingReceivable && (
                  <p className="text-xs text-muted-foreground">Gốc ban đầu không đổi sau khi tạo để giữ đúng lịch sử.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="receivableCurrency">Tiền tệ</Label>
                <Input
                  id="receivableCurrency"
                  value={form.currency_code}
                  onChange={(event) => setForm((current) => ({ ...current, currency_code: event.target.value.toUpperCase() }))}
                  maxLength={5}
                  disabled={Boolean(editingReceivable)}
                  className="uppercase"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="receivableInterest">Lãi suất (%)</Label>
                <Input
                  id="receivableInterest"
                  inputMode="decimal"
                  value={form.interest_rate}
                  onChange={(event) => setForm((current) => ({ ...current, interest_rate: event.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expectedPayment">Dự kiến thu mỗi kỳ</Label>
                <MoneyInput
                  id="expectedPayment"
                  value={form.expected_payment}
                  onChange={(value) => setForm((current) => ({ ...current, expected_payment: value }))}
                  currencyCode={form.currency_code || 'VND'}
                  placeholder="Tùy chọn"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="receivableFrequency">Chu kỳ trả</Label>
                <Select
                  id="receivableFrequency"
                  value={form.payment_frequency}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    payment_frequency: event.target.value as ReceivablePaymentFrequency,
                  }))}
                  options={Object.entries(RECEIVABLE_FREQUENCY_LABELS).map(([value, label]) => ({ value, label }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="receivableDueDate">Ngày đến hạn đầu</Label>
                <Input
                  id="receivableDueDate"
                  type="date"
                  value={form.first_due_date}
                  onChange={(event) => setForm((current) => ({ ...current, first_due_date: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="receivableDueDay">Ngày trong tháng</Label>
                <Input
                  id="receivableDueDay"
                  type="number"
                  min={1}
                  max={31}
                  value={form.due_day}
                  onChange={(event) => setForm((current) => ({ ...current, due_day: event.target.value }))}
                  placeholder="1-31"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="receivableNote">Ghi chú</Label>
              <textarea
                id="receivableNote"
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                rows={3}
                maxLength={1000}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Thỏa thuận, lý do mượn, cách trả..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReceivableDialogOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={formSubmitting}>
                {formSubmitting ? 'Đang lưu...' : editingReceivable ? 'Lưu thay đổi' : 'Tạo khoản phải thu'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(paymentReceivable)} onOpenChange={(open) => !open && setPaymentReceivable(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Ghi nhận người vay trả tiền</DialogTitle>
            <DialogDescription>
              {paymentReceivable
                ? `${paymentReceivable.borrower_name} · còn phải thu ${formatExactMoney(paymentReceivable.outstanding_amount, paymentReceivable.currency_code)}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            {paymentError && (
              <div className="finora-notice-error rounded-lg border px-3 py-2 text-sm" role="alert">
                {paymentError}
              </div>
            )}

            <div className="finora-notice-warning rounded-lg border px-3 py-2 text-xs" role="status">
              Bản này cập nhật sổ khoản phải thu và tách gốc/lãi. Chưa tự tạo giao dịch thu tiền vào ví/ngân hàng để tránh tính tiền gốc hoàn lại thành thu nhập.
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="paymentAmount">Tổng nhận</Label>
                <MoneyInput
                  id="paymentAmount"
                  value={paymentForm.amount}
                  onChange={(value) => setPaymentForm((current) => ({ ...current, amount: value }))}
                  currencyCode={paymentReceivable?.currency_code || 'VND'}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paymentPrincipal">Tiền gốc</Label>
                <MoneyInput
                  id="paymentPrincipal"
                  value={paymentForm.principal_amount}
                  onChange={(value) => setPaymentForm((current) => ({ ...current, principal_amount: value }))}
                  currencyCode={paymentReceivable?.currency_code || 'VND'}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paymentInterest">Tiền lãi</Label>
                <MoneyInput
                  id="paymentInterest"
                  value={paymentForm.interest_amount}
                  onChange={(value) => setPaymentForm((current) => ({ ...current, interest_amount: value }))}
                  currencyCode={paymentReceivable?.currency_code || 'VND'}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="paymentDate">Ngày nhận tiền</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentForm.paid_on}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, paid_on: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paymentNote">Ghi chú</Label>
                <Input
                  id="paymentNote"
                  value={paymentForm.note}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="Ví dụ: chuyển khoản đợt 1"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPaymentReceivable(null)}>
                Hủy
              </Button>
              <Button type="submit" disabled={paymentSubmitting}>
                {paymentSubmitting ? 'Đang ghi nhận...' : 'Xác nhận đã nhận tiền'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
