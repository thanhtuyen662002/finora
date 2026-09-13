"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { EmptyState } from '@/components/finance/EmptyState';
import { MoneyInput } from '@/components/finance/MoneyInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { getAccounts, getAccountBalances } from '@/features/accounts/accounts';
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
import type { AccountRow } from '@/types/database';
import { addExactDecimals, compareExactDecimals, computeBasisPoints, formatExactDecimal, formatExactMoney } from '@/lib/money';
import { AlertCircle, CalendarClock, CheckCircle2, Edit3, HandCoins, History, Plus, RefreshCw, UserRound, WalletCards } from 'lucide-react';

type ReceivableFormState = {
  name: string;
  borrower_name: string;
  principal_amount: string;
  currency_code: string;
  funding_account_id: string;
  interest_rate: string;
  expected_payment: string;
  payment_frequency: ReceivablePaymentFrequency;
  first_due_date: string;
  due_day: string;
  note: string;
};

type PaymentFormState = {
  receiving_account_id: string;
  amount: string;
  principal_amount: string;
  interest_amount: string;
  paid_on: string;
  note: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): ReceivableFormState => ({
  name: '',
  borrower_name: '',
  principal_amount: '',
  currency_code: 'VND',
  funding_account_id: '',
  interest_rate: '0',
  expected_payment: '',
  payment_frequency: 'ONE_TIME',
  first_due_date: '',
  due_day: '',
  note: '',
});

function formatDate(value: string | null) {
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

function daysUntil(value: string | null) {
  if (!value) return null;
  const due = new Date(`${value}T00:00:00Z`).getTime();
  const now = new Date(`${today()}T00:00:00Z`).getTime();
  return Math.ceil((due - now) / 86400000);
}

function progressPercent(item: Receivable) {
  return Math.max(0, Math.min(100, computeBasisPoints(item.received_principal_amount, item.principal_amount) / 100));
}

function SummaryCard({ label, value, detail, icon }: { label: string; value: React.ReactNode; detail: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="flex items-center gap-2 text-2xl">{icon}{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{detail}</CardContent>
    </Card>
  );
}

export default function ReceivablesPage() {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [accountBalances, setAccountBalances] = useState<Record<string, string>>({});
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Receivable | null>(null);
  const [form, setForm] = useState<ReceivableFormState>(emptyForm());
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [paymentTarget, setPaymentTarget] = useState<Receivable | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>({
    receiving_account_id: '',
    amount: '',
    principal_amount: '',
    interest_amount: '0',
    paid_on: today(),
    note: '',
  });
  const [paymentError, setPaymentError] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Record<string, ReceivablePayment[]>>({});
  const [paymentsLoading, setPaymentsLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const [receivableRows, accountRows, balances] = await Promise.all([
        getReceivables({ includeArchived }),
        getAccounts(),
        getAccountBalances(),
      ]);
      setReceivables(receivableRows);
      setAccounts(accountRows);
      setAccountBalances(balances);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tải dữ liệu khoản phải thu.');
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const active = useMemo(() => receivables.filter((item) => !item.is_archived), [receivables]);
  const eligibleAccounts = useMemo(
    () => accounts.filter((account) => !account.is_archived && account.type !== 'CREDIT_CARD'),
    [accounts]
  );
  const totals = useMemo(() => {
    const result: Record<string, string> = {};
    for (const item of active) {
      result[item.currency_code] = addExactDecimals(result[item.currency_code] || '0.0000', item.outstanding_amount);
    }
    return result;
  }, [active]);
  const dueSoon = useMemo(() => active.filter((item) => {
    const days = daysUntil(item.first_due_date);
    return days !== null && days >= 0 && days <= 30 && compareExactDecimals(item.outstanding_amount, '0.0000') > 0;
  }).length, [active]);
  const overdue = useMemo(() => active.filter((item) => {
    const days = daysUntil(item.first_due_date);
    return days !== null && days < 0 && compareExactDecimals(item.outstanding_amount, '0.0000') > 0;
  }).length, [active]);

  const accountOptions = (currency?: string) => eligibleAccounts
    .filter((account) => !currency || account.currency_code === currency)
    .map((account) => ({
      value: account.id,
      label: `${account.name} · ${formatExactMoney(accountBalances[account.id] || '0', account.currency_code)}`,
    }));

  const openCreate = () => {
    setEditing(null);
    const firstAccount = eligibleAccounts[0];
    setForm({
      ...emptyForm(),
      funding_account_id: firstAccount?.id || '',
      currency_code: firstAccount?.currency_code || 'VND',
    });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (item: Receivable) => {
    setEditing(item);
    setForm({
      name: item.name,
      borrower_name: item.borrower_name,
      principal_amount: item.principal_amount,
      currency_code: item.currency_code,
      funding_account_id: item.funding_account_id || '',
      interest_rate: item.interest_rate,
      expected_payment: item.expected_payment || '',
      payment_frequency: item.payment_frequency,
      first_due_date: item.first_due_date || '',
      due_day: item.due_day ? String(item.due_day) : '',
      note: item.note || '',
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleFundingAccountChange = (accountId: string) => {
    const account = eligibleAccounts.find((item) => item.id === accountId);
    setForm((current) => ({
      ...current,
      funding_account_id: accountId,
      currency_code: account?.currency_code || current.currency_code,
    }));
  };

  const saveReceivable = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormSubmitting(true);
    setFormError('');
    try {
      if (!form.funding_account_id) throw new Error('Bạn cần chọn nguồn tiền cho vay.');
      if (editing) {
        const input: ReceivableUpdateInput = {
          name: form.name,
          borrower_name: form.borrower_name,
          funding_account_id: form.funding_account_id,
          interest_rate: form.interest_rate,
          expected_payment: form.expected_payment || null,
          payment_frequency: form.payment_frequency,
          first_due_date: form.first_due_date || null,
          due_day: form.due_day ? Number(form.due_day) : null,
          note: form.note || null,
        };
        await updateReceivable(editing.id, input);
        setNoticeMessage('Đã cập nhật khoản phải thu.');
      } else {
        const input: ReceivableCreateInput = {
          name: form.name,
          borrower_name: form.borrower_name,
          principal_amount: form.principal_amount,
          currency_code: form.currency_code,
          funding_account_id: form.funding_account_id,
          interest_rate: form.interest_rate,
          expected_payment: form.expected_payment || null,
          payment_frequency: form.payment_frequency,
          first_due_date: form.first_due_date || null,
          due_day: form.due_day ? Number(form.due_day) : null,
          note: form.note || null,
        };
        await createReceivable(input);
        setNoticeMessage('Đã tạo khoản phải thu và trừ tiền khỏi tài khoản nguồn.');
      }
      setFormOpen(false);
      await loadData();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'Không thể lưu khoản phải thu.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const toggleArchive = async (item: Receivable) => {
    const next = !item.is_archived;
    if (!window.confirm(next ? 'Lưu trữ khoản phải thu này? Lịch sử vẫn được giữ nguyên.' : 'Khôi phục khoản phải thu này?')) return;
    try {
      await archiveReceivable(item.id, next);
      setNoticeMessage(next ? 'Đã lưu trữ khoản phải thu.' : 'Đã khôi phục khoản phải thu.');
      await loadData();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể cập nhật khoản phải thu.');
    }
  };

  const openPayment = (item: Receivable) => {
    const firstReceiving = eligibleAccounts.find((account) => account.currency_code === item.currency_code);
    setPaymentTarget(item);
    setPaymentForm({
      receiving_account_id: firstReceiving?.id || '',
      amount: '',
      principal_amount: '',
      interest_amount: '0',
      paid_on: today(),
      note: '',
    });
    setPaymentError('');
  };

  const savePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentTarget) return;
    setPaymentSubmitting(true);
    setPaymentError('');
    const input: ReceivablePaymentInput = {
      receivable_id: paymentTarget.id,
      receiving_account_id: paymentForm.receiving_account_id,
      amount: paymentForm.amount,
      principal_amount: paymentForm.principal_amount,
      interest_amount: paymentForm.interest_amount,
      paid_on: paymentForm.paid_on,
      note: paymentForm.note || null,
    };
    try {
      await recordReceivablePayment(input);
      setPaymentTarget(null);
      setNoticeMessage('Đã thu tiền: gốc hoàn về tài khoản, phần lãi được ghi nhận là thu nhập.');
      setPayments((current) => {
        const next = { ...current };
        delete next[input.receivable_id];
        return next;
      });
      await loadData();
    } catch (error: unknown) {
      setPaymentError(error instanceof Error ? error.message : 'Không thể ghi nhận khoản đã thu.');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const toggleHistory = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (payments[id]) return;
    try {
      setPaymentsLoading(id);
      const rows = await getReceivablePayments(id);
      setPayments((current) => ({ ...current, [id]: rows }));
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tải lịch sử thu tiền.');
    } finally {
      setPaymentsLoading(null);
    }
  };

  return (
    <AppShell>
      <PageHeader title="Khoản phải thu" subtitle="Theo dõi tiền người khác đang nợ bạn và dòng tiền thực tế giữa khoản phải thu với ví/tài khoản.">
        <Button variant="outline" size="sm" onClick={() => void loadData()}><RefreshCw className="h-4 w-4" />Làm mới</Button>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Thêm khoản phải thu</Button>
      </PageHeader>

      {errorMessage && <div className="finora-notice-error rounded-lg border px-4 py-3 text-sm" role="alert">{errorMessage}</div>}
      {noticeMessage && <div className="finora-notice-success rounded-lg border px-4 py-3 text-sm" role="status">{noticeMessage}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Đang theo dõi" value={active.length} detail="Khoản chưa lưu trữ" icon={<UserRound className="h-5 w-5 text-primary" />} />
        <SummaryCard label="Sắp đến hạn" value={dueSoon} detail="Trong 30 ngày tới" icon={<CalendarClock className="h-5 w-5 text-amber-500" />} />
        <SummaryCard label="Quá hạn" value={overdue} detail="Còn dư phải thu" icon={<AlertCircle className="h-5 w-5 text-destructive" />} />
        <Card>
          <CardHeader className="pb-2"><CardDescription>Tổng còn phải thu</CardDescription><CardTitle className="text-base">{Object.keys(totals).length} loại tiền</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {Object.entries(totals).length === 0 ? <span className="text-xs text-muted-foreground">Chưa có dữ liệu</span> : Object.entries(totals).map(([currency, amount]) => (
              <div key={currency} className="flex justify-between text-sm"><span className="text-muted-foreground">{currency}</span><strong>{formatExactMoney(amount, currency)}</strong></div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="finora-notice-warning rounded-lg border px-4 py-3 text-sm">
        <strong>Nguyên tắc dòng tiền:</strong> cho vay chỉ chuyển tài sản từ ví/tài khoản sang khoản phải thu nên không tính là chi tiêu. Khi thu nợ, tiền gốc quay lại tài khoản và chỉ phần lãi được tính là thu nhập.
      </div>

      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Danh sách khoản phải thu</h2><p className="text-sm text-muted-foreground">Mỗi khoản mới phải chọn nguồn tiền thực tế dùng để cho vay.</p></div>
        <Button variant={includeArchived ? 'default' : 'outline'} size="sm" onClick={() => setIncludeArchived((value) => !value)}>{includeArchived ? 'Đang hiện đã lưu trữ' : 'Hiện đã lưu trữ'}</Button>
      </div>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Đang tải khoản phải thu...</CardContent></Card>
      ) : receivables.length === 0 ? (
        <EmptyState icon={HandCoins} title="Chưa có khoản phải thu" description="Thêm khoản đầu tiên và chọn ví/tài khoản đã dùng để đưa tiền cho người vay." actionLabel="Thêm khoản phải thu" onAction={openCreate} />
      ) : (
        <div className="space-y-4">
          {receivables.map((item) => {
            const settled = compareExactDecimals(item.outstanding_amount, '0.0000') === 0;
            const progress = progressPercent(item);
            const dueDays = daysUntil(item.first_due_date);
            const history = payments[item.id] || [];
            return (
              <Card key={item.id} className={item.is_archived ? 'opacity-70' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-lg">{item.name}</CardTitle>
                        {settled && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600"><CheckCircle2 className="h-3 w-3" />Đã thu đủ gốc</span>}
                        {item.is_archived && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">Đã lưu trữ</span>}
                      </div>
                      <CardDescription className="mt-1">Người vay: <strong className="text-foreground">{item.borrower_name}</strong> · {RECEIVABLE_FREQUENCY_LABELS[item.payment_frequency]} · Hạn {formatDate(item.first_due_date)}</CardDescription>
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><WalletCards className="h-3.5 w-3.5" />Nguồn cho vay: <strong className="text-foreground">{item.funding_account_name || 'Chưa gắn tài khoản nguồn'}</strong></div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!item.is_archived && !settled && <Button size="sm" onClick={() => openPayment(item)}><HandCoins className="h-4 w-4" />Ghi nhận trả tiền</Button>}
                      <Button variant="outline" size="sm" onClick={() => openEdit(item)}><Edit3 className="h-4 w-4" />Sửa</Button>
                      <Button variant="outline" size="sm" onClick={() => void toggleArchive(item)}>{item.is_archived ? 'Khôi phục' : 'Lưu trữ'}</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ['Dư còn phải thu', item.outstanding_amount],
                      ['Gốc ban đầu', item.principal_amount],
                      ['Đã thu gốc', item.received_principal_amount],
                      ['Đã thu lãi', item.received_interest_amount],
                    ].map(([label, amount]) => <div key={label} className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-semibold">{formatExactMoney(amount, item.currency_code)}</div></div>)}
                  </div>
                  <div><div className="mb-1.5 flex justify-between text-xs text-muted-foreground"><span>Tiến độ thu hồi gốc</span><span>{formatExactDecimal(String(progress))}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div></div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex flex-wrap gap-x-4 gap-y-1"><span>Lãi suất: {formatExactDecimal(item.interest_rate)}%</span>{item.expected_payment && <span>Dự kiến thu/kỳ: {formatExactMoney(item.expected_payment, item.currency_code)}</span>}{dueDays !== null && !settled && <span className={dueDays < 0 ? 'font-semibold text-destructive' : ''}>{dueDays < 0 ? `Quá hạn ${Math.abs(dueDays)} ngày` : dueDays === 0 ? 'Đến hạn hôm nay' : `Còn ${dueDays} ngày`}</span>}</div>
                    <Button variant="ghost" size="sm" onClick={() => void toggleHistory(item.id)}><History className="h-4 w-4" />{expandedId === item.id ? 'Ẩn lịch sử' : `Lịch sử (${item.payment_count})`}</Button>
                  </div>
                  {item.note && <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">{item.note}</div>}
                  {expandedId === item.id && <div className="rounded-lg border bg-muted/10 p-3"><div className="mb-2 text-sm font-semibold">Lịch sử người vay trả tiền</div>{paymentsLoading === item.id ? <div className="py-3 text-center text-xs text-muted-foreground">Đang tải...</div> : history.length === 0 ? <div className="py-3 text-center text-xs text-muted-foreground">Chưa có lần trả tiền nào.</div> : <div className="space-y-2">{history.map((payment) => <div key={payment.id} className="flex flex-col gap-1 rounded-md border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-medium">{formatDate(payment.paid_on)} · {payment.receiving_account_name || 'Khoản cũ chưa gắn tài khoản nhận'}</div><div className="text-xs text-muted-foreground">Gốc {formatExactMoney(payment.principal_amount, payment.currency_code)} · Lãi {formatExactMoney(payment.interest_amount, payment.currency_code)}</div></div><strong className="text-sm">{formatExactMoney(payment.amount, payment.currency_code)}</strong></div>)}</div>}</div>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[580px]">
          <DialogHeader><DialogTitle>{editing ? 'Sửa khoản phải thu' : 'Thêm khoản phải thu'}</DialogTitle><DialogDescription>Chọn đúng ví/tài khoản thực tế đã dùng để đưa tiền cho người vay.</DialogDescription></DialogHeader>
          <form onSubmit={saveReceivable} className="space-y-4">
            {formError && <div className="finora-notice-error rounded-lg border px-3 py-2 text-sm">{formError}</div>}
            <div className="space-y-1.5"><Label htmlFor="rFunding">Nguồn tiền cho vay</Label><Select id="rFunding" value={form.funding_account_id} onChange={(e) => handleFundingAccountChange(e.target.value)} disabled={Boolean(editing?.funding_account_id)} required options={[{ value: '', label: 'Chọn ví / tài khoản' }, ...accountOptions(editing ? form.currency_code : undefined)]} />{editing?.funding_account_id ? <p className="text-xs text-muted-foreground">Nguồn tiền đã phát sinh nên được khóa để bảo toàn lịch sử.</p> : editing ? <p className="text-xs text-amber-600">Khoản cũ chưa có nguồn tiền. Chọn một tài khoản để Finora trừ gốc cho vay vào số dư.</p> : null}</div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="rName">Tên khoản</Label><Input id="rName" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} required /></div><div className="space-y-1.5"><Label htmlFor="rBorrower">Người vay</Label><Input id="rBorrower" value={form.borrower_name} onChange={(e) => setForm((v) => ({ ...v, borrower_name: e.target.value }))} required /></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="rPrincipal">Số tiền gốc ({form.currency_code})</Label><MoneyInput id="rPrincipal" value={form.principal_amount} onChange={(value) => setForm((v) => ({ ...v, principal_amount: value }))} currencyCode={form.currency_code} disabled={Boolean(editing)} required /></div><div className="space-y-1.5"><Label>Tiền tệ</Label><Input value={form.currency_code} disabled /></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="rInterest">Lãi suất (%)</Label><Input id="rInterest" inputMode="decimal" value={form.interest_rate} onChange={(e) => setForm((v) => ({ ...v, interest_rate: e.target.value }))} /></div><div className="space-y-1.5"><Label htmlFor="rExpected">Dự kiến thu mỗi kỳ</Label><MoneyInput id="rExpected" value={form.expected_payment} onChange={(value) => setForm((v) => ({ ...v, expected_payment: value }))} currencyCode={form.currency_code} /></div></div>
            <div className="grid gap-4 sm:grid-cols-3"><div className="space-y-1.5"><Label htmlFor="rFrequency">Chu kỳ trả</Label><Select id="rFrequency" value={form.payment_frequency} onChange={(e) => setForm((v) => ({ ...v, payment_frequency: e.target.value as ReceivablePaymentFrequency }))} options={Object.entries(RECEIVABLE_FREQUENCY_LABELS).map(([value, label]) => ({ value, label }))} /></div><div className="space-y-1.5"><Label htmlFor="rDue">Ngày đến hạn đầu</Label><Input id="rDue" type="date" value={form.first_due_date} onChange={(e) => setForm((v) => ({ ...v, first_due_date: e.target.value }))} /></div><div className="space-y-1.5"><Label htmlFor="rDueDay">Ngày trong tháng</Label><Input id="rDueDay" type="number" min={1} max={31} value={form.due_day} onChange={(e) => setForm((v) => ({ ...v, due_day: e.target.value }))} /></div></div>
            <div className="space-y-1.5"><Label htmlFor="rNote">Ghi chú</Label><textarea id="rNote" value={form.note} onChange={(e) => setForm((v) => ({ ...v, note: e.target.value }))} rows={3} maxLength={1000} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Hủy</Button><Button type="submit" disabled={formSubmitting}>{formSubmitting ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo khoản phải thu'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(paymentTarget)} onOpenChange={(open) => !open && setPaymentTarget(null)}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader><DialogTitle>Ghi nhận người vay trả tiền</DialogTitle><DialogDescription>{paymentTarget ? `${paymentTarget.borrower_name} · còn phải thu ${formatExactMoney(paymentTarget.outstanding_amount, paymentTarget.currency_code)}` : ''}</DialogDescription></DialogHeader>
          <form onSubmit={savePayment} className="space-y-4">
            {paymentError && <div className="finora-notice-error rounded-lg border px-3 py-2 text-sm">{paymentError}</div>}
            <div className="space-y-1.5"><Label htmlFor="pAccount">Tài khoản nhận tiền</Label><Select id="pAccount" value={paymentForm.receiving_account_id} onChange={(e) => setPaymentForm((v) => ({ ...v, receiving_account_id: e.target.value }))} required options={[{ value: '', label: 'Chọn ví / tài khoản nhận' }, ...accountOptions(paymentTarget?.currency_code)]} /></div>
            <div className="finora-notice-warning rounded-lg border px-3 py-2 text-xs">Tiền gốc sẽ cộng lại vào số dư tài khoản nhận nhưng không tính là thu nhập. Chỉ phần tiền lãi được tạo thành giao dịch thu nhập.</div>
            <div className="grid gap-4 sm:grid-cols-3"><div className="space-y-1.5"><Label htmlFor="pTotal">Tổng nhận</Label><MoneyInput id="pTotal" value={paymentForm.amount} onChange={(value) => setPaymentForm((v) => ({ ...v, amount: value }))} currencyCode={paymentTarget?.currency_code || 'VND'} required /></div><div className="space-y-1.5"><Label htmlFor="pPrincipal">Tiền gốc</Label><MoneyInput id="pPrincipal" value={paymentForm.principal_amount} onChange={(value) => setPaymentForm((v) => ({ ...v, principal_amount: value }))} currencyCode={paymentTarget?.currency_code || 'VND'} required /></div><div className="space-y-1.5"><Label htmlFor="pInterest">Tiền lãi</Label><MoneyInput id="pInterest" value={paymentForm.interest_amount} onChange={(value) => setPaymentForm((v) => ({ ...v, interest_amount: value }))} currencyCode={paymentTarget?.currency_code || 'VND'} /></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="pDate">Ngày nhận tiền</Label><Input id="pDate" type="date" value={paymentForm.paid_on} onChange={(e) => setPaymentForm((v) => ({ ...v, paid_on: e.target.value }))} required /></div><div className="space-y-1.5"><Label htmlFor="pNote">Ghi chú</Label><Input id="pNote" value={paymentForm.note} onChange={(e) => setPaymentForm((v) => ({ ...v, note: e.target.value }))} /></div></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setPaymentTarget(null)}>Hủy</Button><Button type="submit" disabled={paymentSubmitting}>{paymentSubmitting ? 'Đang ghi nhận...' : 'Xác nhận đã nhận tiền'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
