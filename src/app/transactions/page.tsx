"use client";

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { TransactionList } from '@/components/finance/TransactionList';
import { AddTransactionModal } from '@/components/finance/AddTransactionModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatMoney } from '@/lib/money/format';
import { Plus, Download, ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Check } from 'lucide-react';
import { getTransactions, ExtendedTransaction } from '@/features/transactions';
import { getAccounts } from '@/features/accounts/accounts';
import { getCategories } from '@/features/categories/categories';
import { addExactDecimals, subExactDecimals, formatExactDecimal } from '@/lib/money';
import { AccountRow, CategoryRow, TransactionRow } from '@/types/database';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<ExtendedTransaction[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [addTxOpen, setAddTxOpen] = useState(false);
  const [editTx, setEditTx] = useState<ExtendedTransaction | null>(null);
  const [exported, setExported] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [txs, accs, cats] = await Promise.all([
        getTransactions(),
        getAccounts(),
        getCategories(),
      ]);

      const accMap = new Map(accs.map(a => [a.id, a]));
      const catMap = new Map(cats.map(c => [c.id, c]));

      const extended: ExtendedTransaction[] = txs.map(tx => {
        const acc = accMap.get(tx.account_id);
        const cat = catMap.get(tx.category_id);
        return {
          ...tx,
          accountName: acc?.name || 'Tài khoản ẩn',
          categoryName: cat?.name || 'Danh mục ẩn',
          categoryIcon: cat?.icon,
          categoryColor: cat?.color,
        };
      });

      setTransactions(extended);
      setAccounts(accs);
      setCategories(cats);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  const handleExportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Ngày,Loại,Danh mục,Tài khoản,Số tiền,Tiền tệ,Đơn vị,Ghi chú,Trạng thái\n"
      + transactions.map(t => [
          t.occurred_on,
          t.type === 'INCOME' ? 'Thu' : 'Chi',
          `"${t.categoryName}"`,
          `"${t.accountName}"`,
          t.amount,
          t.currency_code,
          `"${t.merchant}"`,
          `"${t.note || ''}"`,
          t.is_voided ? 'Đã hủy' : 'Hoạt động'
        ].join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'finora-transactions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Group active transactions by currency for truthful summaries
  const activeTxs = transactions.filter(t => !t.is_voided);
  
  // Build a summary string. For simplicity, just show VND or multiple.
  const summaryByCurrency = activeTxs.reduce((acc, tx) => {
    if (!acc[tx.currency_code]) {
      acc[tx.currency_code] = { income: '0', expense: '0' };
    }
    const val = String(tx.amount);
    if (tx.type === 'INCOME') acc[tx.currency_code].income = addExactDecimals(acc[tx.currency_code].income, val);
    else if (tx.type === 'EXPENSE') acc[tx.currency_code].expense = addExactDecimals(acc[tx.currency_code].expense, val);
    return acc;
  }, {} as Record<string, { income: string, expense: string }>);

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

      {/* Mini Cash Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <Card className="bg-card border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tổng thu nhập
              </span>
              <div className="mt-1 flex flex-col gap-1">
                {Object.keys(summaryByCurrency).length === 0 ? (
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">+0 ₫</p>
                ) : (
                  Object.entries(summaryByCurrency).map(([curr, v]) => {
                  const vals = v;
                  return (
                    <p key={curr} className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatExactDecimal(vals.income)} {curr}
                    </p>
                  );
                })
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
                Tổng chi tiêu
              </span>
              <div className="mt-1 flex flex-col gap-1">
                {Object.keys(summaryByCurrency).length === 0 ? (
                  <p className="text-xl font-bold text-foreground">-0 ₫</p>
                ) : (
                  Object.entries(summaryByCurrency).map(([curr, v]) => {
                  const vals = v;
                  return (
                    <p key={curr} className="text-xl font-bold text-foreground">
                      -{formatExactDecimal(vals.expense)} {curr}
                    </p>
                  );
                })
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
                Chênh lệch thu - chi
              </span>
              <div className="mt-1 flex flex-col gap-1">
                {Object.keys(summaryByCurrency).length === 0 ? (
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">+0 ₫</p>
                ) : (
                  Object.entries(summaryByCurrency).map(([curr, v]) => {
                  const vals = v;
                    const diffStr = subExactDecimals(vals.income, vals.expense);
                    const isPositive = !diffStr.startsWith('-') && diffStr !== '0.0000';
                    return (
                      <p key={curr} className={`text-xl font-bold ${!diffStr.startsWith('-') ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                        {isPositive ? '+' : ''}{formatExactDecimal(diffStr)} {curr}
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
