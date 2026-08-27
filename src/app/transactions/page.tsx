"use client";

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { TransactionList } from '@/components/finance/TransactionList';
import { AddTransactionModal } from '@/components/finance/AddTransactionModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MOCK_TRANSACTIONS } from '@/lib/mock/transactions';
import { MockTransaction, MockTransactionInput } from '@/types/finance';
import { formatMoney, convertMockToBase, getMockExchangeRate } from '@/lib/money/format';
import { MOCK_ACCOUNTS } from '@/lib/mock/accounts';
import { MOCK_CATEGORIES } from '@/lib/mock/transactions';
import { Plus, Download, ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Check } from 'lucide-react';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<MockTransaction[]>(MOCK_TRANSACTIONS);
  const [addTxOpen, setAddTxOpen] = useState(false);
  const [exported, setExported] = useState(false);

  const totalIncomeVND = transactions
    .filter((t) => t.type === 'INCOME')
    .reduce((sum, t) => sum + (t.baseAmountVND || t.amount), 0);

  const totalExpenseVND = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + (t.baseAmountVND || t.amount), 0);

  const handleAddTransaction = (newTx: MockTransactionInput) => {
    const acc = MOCK_ACCOUNTS.find((a) => a.id === newTx.accountId);
    const cat = MOCK_CATEGORIES.find((c) => c.id === newTx.categoryId);

    const created: MockTransaction = {
      id: `tx-${Date.now()}`,
      userId: 'user-demo-1',
      accountId: newTx.accountId,
      accountName: acc?.name || 'Tài khoản chính',
      categoryId: newTx.categoryId,
      categoryName: cat?.name || (newTx.type === 'INCOME' ? 'Thu nhập khác' : 'Ăn uống & Cà phê'),
      categoryIcon: cat?.icon || (newTx.type === 'INCOME' ? 'Briefcase' : 'Utensils'),
      categoryColor: cat?.color || (newTx.type === 'INCOME' ? '#10b981' : '#f59e0b'),
      type: newTx.type,
      amount: newTx.amount,
      currency: newTx.currency,
      exchangeRate: getMockExchangeRate(newTx.currency),
      baseAmountVND: convertMockToBase(newTx.amount, newTx.currency, 'VND'),
      baseCurrency: 'VND',
      merchant: newTx.merchant,
      occurredAt: newTx.occurredAt,
      note: newTx.note,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTransactions([created, ...transactions]);
  };

  const handleExportCSV = () => {
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  return (
    <AppShell>
      <PageHeader
        title="Sổ giao dịch"
        subtitle="Toàn bộ lịch sử thu chi, chuyển khoản và quy đổi ngoại tệ."
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
        <Button size="sm" onClick={() => setAddTxOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm giao dịch
        </Button>
      </PageHeader>

      {/* Mini Cash Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <Card className="bg-card border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tổng thu nhập (Tháng 8)
              </span>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                +{formatMoney(totalIncomeVND)}
              </p>
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
                Tổng chi tiêu (Tháng 8)
              </span>
              <p className="text-xl font-bold text-foreground mt-1">
                -{formatMoney(totalExpenseVND)}
              </p>
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
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                +{formatMoney(totalIncomeVND - totalExpenseVND)}
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Transaction List with filters & date grouping */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <TransactionList transactions={transactions} />
        </CardContent>
      </Card>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        open={addTxOpen}
        onOpenChange={setAddTxOpen}
        onSuccess={handleAddTransaction}
      />
    </AppShell>
  );
}
