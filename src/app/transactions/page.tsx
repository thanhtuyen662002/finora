"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { TransactionList } from '@/components/finance/TransactionList';
import { AddTransactionModal } from '@/components/finance/AddTransactionModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Download, ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Check } from 'lucide-react';
import { getTransactions, ExtendedTransaction } from '@/features/transactions';
import { getAccounts } from '@/features/accounts/accounts';
import { getCategories } from '@/features/categories/categories';
import { addExactDecimals, subExactDecimals, formatExactDecimal, toExactDecimal } from '@/lib/money';
import { AccountRow, CategoryRow } from '@/types/database';

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<ExtendedTransaction[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [addTxOpen, setAddTxOpen] = useState(false);
  const [editTx, setEditTx] = useState<ExtendedTransaction | null>(null);
  const [exported, setExported] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [txs, accs, cats] = await Promise.all([
        getTransactions(),
        getAccounts(),
        getCategories(),
      ]);

      const accMap = new Map(accs.map((a) => [a.id, a]));
      const catMap = new Map(cats.map((c) => [c.id, c]));

      const extended: ExtendedTransaction[] = txs.map((tx) => {
        const acc = accMap.get(tx.account_id);
        const cat = catMap.get(tx.category_id);
        return {
          ...tx,
          accountName: tx.accountName || acc?.name || 'Tài khoản ẩn',
          categoryName: tx.categoryName || cat?.name || 'Danh mục ẩn',
          categoryIcon: tx.categoryIcon || cat?.icon,
          categoryColor: tx.categoryColor || cat?.color,
        };
      });

      setTransactions(extended);
      setAccounts(accs);
      setCategories(cats);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const handleExportCSV = () => {
    if (transactions.length === 0) return;
    const headers = [
      'Ngày',
      'Loại',
      'Danh mục',
      'Tài khoản',
      'Số tiền',
      'Tiền tệ',
      'Cửa hàng/Mô tả',
      'Ghi chú',
      'Trạng thái',
    ];

    const rows = transactions.map((t) => [
      escapeCSV(t.occurred_on),
      escapeCSV(t.type === 'INCOME' ? 'Thu' : 'Chi'),
      escapeCSV(t.categoryName || ''),
      escapeCSV(t.accountName || ''),
      escapeCSV(t.amount),
      escapeCSV(t.currency_code),
      escapeCSV(t.merchant),
      escapeCSV(t.note || ''),
      escapeCSV(t.is_voided ? 'Đã hủy' : 'Hoạt động'),
    ].join(','));

    const csvContent = [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `finora-transactions-${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  };

  // Group active transactions in the ACTUAL current calendar month by currency code
  const { summaryByCurrency, currentMonthLabel } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `${year}-${month}`;
    const label = `Tháng ${now.getMonth() + 1}/${year}`;

    const activeMonthTxs = transactions.filter(
      (t) => !t.is_voided && t.occurred_on.startsWith(prefix)
    );

    const summary = activeMonthTxs.reduce((acc, tx) => {
      if (!acc[tx.currency_code]) {
        acc[tx.currency_code] = { income: '0.0000', expense: '0.0000' };
      }
      const val = toExactDecimal(tx.amount);
      if (tx.type === 'INCOME') {
        acc[tx.currency_code].income = addExactDecimals(acc[tx.currency_code].income, val);
      } else if (tx.type === 'EXPENSE') {
        acc[tx.currency_code].expense = addExactDecimals(acc[tx.currency_code].expense, val);
      }
      return acc;
    }, {} as Record<string, { income: string; expense: string }>);

    return {
      currentMonthPrefix: prefix,
      summaryByCurrency: summary,
      currentMonthLabel: label,
    };
  }, [transactions]);

  return (
    <AppShell>
      <PageHeader
        title="Sổ giao dịch"
        subtitle="Toàn bộ lịch sử thu chi."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          className="hidden sm:inline-flex"
          disabled={transactions.length === 0}
        >
          {exported ? (
            <>
              <Check className="h-4 w-4 mr-1.5 text-emerald-600" />
              Đã xuất CSV
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-1.5" />
              Xuất CSV
            </>
          )}
        </Button>
        <Button size="sm" onClick={() => { setEditTx(null); setAddTxOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm giao dịch
        </Button>
      </PageHeader>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      {/* Monthly Summaries (Actual Current Calendar Month) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <Card className="bg-card border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tổng thu nhập ({currentMonthLabel})
              </span>
              <div className="mt-1 flex flex-col gap-1">
                {Object.keys(summaryByCurrency).length === 0 ? (
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">+0 ₫</p>
                ) : (
                  Object.entries(summaryByCurrency).map(([curr, vals]) => (
                    <p key={curr} className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatExactDecimal(vals.income)} {curr}
                    </p>
                  ))
                )}
              </div>
            </div>
            <div className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ArrowDownLeft className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tổng chi tiêu ({currentMonthLabel})
              </span>
              <div className="mt-1 flex flex-col gap-1">
                {Object.keys(summaryByCurrency).length === 0 ? (
                  <p className="text-xl font-bold text-foreground">-0 ₫</p>
                ) : (
                  Object.entries(summaryByCurrency).map(([curr, vals]) => (
                    <p key={curr} className="text-xl font-bold text-foreground">
                      -{formatExactDecimal(vals.expense)} {curr}
                    </p>
                  ))
                )}
              </div>
            </div>
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-slate-600 dark:text-slate-400">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Chênh lệch thu - chi ({currentMonthLabel})
              </span>
              <div className="mt-1 flex flex-col gap-1">
                {Object.keys(summaryByCurrency).length === 0 ? (
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">+0 ₫</p>
                ) : (
                  Object.entries(summaryByCurrency).map(([curr, vals]) => {
                    const diffStr = subExactDecimals(vals.income, vals.expense);
                    const isPositive = !diffStr.startsWith('-') && diffStr !== '0.0000';
                    return (
                      <p
                        key={curr}
                        className={`text-xl font-bold ${
                          !diffStr.startsWith('-')
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-foreground'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {formatExactDecimal(diffStr)} {curr}
                      </p>
                    );
                  })
                )}
              </div>
            </div>
            <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Đang tải giao dịch...</div>
          ) : (
            <TransactionList 
              transactions={transactions} 
              accounts={accounts} 
              categories={categories} 
              onSelectTransaction={(tx) => { setEditTx(tx); setAddTxOpen(true); }}
            />
          )}
        </CardContent>
      </Card>

      <AddTransactionModal
        open={addTxOpen}
        onOpenChange={(open) => { setAddTxOpen(open); if (!open) setEditTx(null); }}
        onSuccess={loadData}
        initialData={editTx}
        accounts={accounts}
        categories={categories}
      />
    </AppShell>
  );
}
