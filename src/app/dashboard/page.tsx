"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { SummaryCard } from '@/components/finance/SummaryCard';
import { AccountCard } from '@/components/finance/AccountCard';
import { TransactionList } from '@/components/finance/TransactionList';
import { BudgetProgress } from '@/components/finance/BudgetProgress';
import { GoalCard } from '@/components/finance/GoalCard';
import { CashFlowChart } from '@/components/charts/CashFlowChart';
import { AccountDetailModal } from '@/components/finance/AccountDetailModal';
import { AddTransactionModal } from '@/components/finance/AddTransactionModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MOCK_DASHBOARD_METRICS, MOCK_CASH_FLOW_6M } from '@/lib/mock/reports';
import { MOCK_ACCOUNTS } from '@/lib/mock/accounts';
import { MOCK_BUDGETS } from '@/lib/mock/budgets';
import { MOCK_GOALS } from '@/lib/mock/goals';
import { MockAccount } from '@/types/finance';
import { formatMoney } from '@/lib/money/format';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  PiggyBank,
  Plus,
  ArrowRight,
  ArrowRightLeft,
  PieChart,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

export default function DashboardPage() {
  const [selectedAccount, setSelectedAccount] = useState<MockAccount | null>(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [addTxOpen, setAddTxOpen] = useState(false);

  const metrics = MOCK_DASHBOARD_METRICS;
  const recentTransactions: any[] = [];
  const topBudgets = MOCK_BUDGETS.slice(0, 3);
  const activeGoals = MOCK_GOALS.slice(0, 2);

  const handleAccountClick = (acc: MockAccount) => {
    setSelectedAccount(acc);
    setAccountModalOpen(true);
  };

  return (
    <AppShell>
      {/* Top Header */}
      <PageHeader
        title="Tổng quan tài chính"
        subtitle="Theo dõi tài sản ròng, dòng tiền và ngân sách tháng 8/2026."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAddTxOpen(true)}
          className="hidden sm:inline-flex"
        >
          <ArrowRightLeft className="h-4 w-4 mr-1.5" />
          Chuyển khoản
        </Button>
        <Button size="sm" onClick={() => setAddTxOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Giao dịch mới
        </Button>
      </PageHeader>

      {/* 4 Core Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <SummaryCard
          title="Tài sản ròng"
          value={formatMoney(metrics.netWorthVND)}
          icon={TrendingUp}
          highlight={true}
          trend={{ value: '+4.2% so với tháng trước', isPositive: true }}
          subtext="Đã quy đổi đa tệ sang VND"
        />
        <SummaryCard
          title="Thu nhập tháng này"
          value={formatMoney(metrics.monthlyIncomeVND)}
          icon={ArrowDownLeft}
          trend={{ value: '+12.5%', isPositive: true }}
          subtext="Bao gồm YouTube (USD) & Lương"
        />
        <SummaryCard
          title="Chi tiêu tháng này"
          value={formatMoney(metrics.monthlyExpenseVND)}
          icon={ArrowUpRight}
          trend={{ value: '-3.1%', isPositive: true }}
          subtext="Trong hạn mức cho phép"
        />
        <SummaryCard
          title="Tiết kiệm & Tỷ lệ"
          value={formatMoney(metrics.monthlySavingsVND)}
          icon={PiggyBank}
          subtext={`Tỷ lệ tiết kiệm đạt ${metrics.savingRatePercent}%`}
        />
      </div>

      {/* Main Content 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Primary Section (7 Cols on desktop) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 6-Month Cash Flow Chart Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-semibold">
                  Xu hướng dòng tiền 6 tháng
                </CardTitle>
                <CardDescription>
                  So sánh thu nhập, chi tiêu và số dư tích lũy hàng tháng.
                </CardDescription>
              </div>
              <Link
                href="/reports"
                className="text-xs font-medium text-primary hover:underline flex items-center"
              >
                Báo cáo chi tiết
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </CardHeader>
            <CardContent>
              <CashFlowChart data={MOCK_CASH_FLOW_6M} />
            </CardContent>
          </Card>

          {/* Recent Transactions Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">
                  Giao dịch gần đây
                </CardTitle>
                <CardDescription>
                  Thu chi mới nhất từ tất cả các tài khoản.
                </CardDescription>
              </div>
              <Link
                href="/transactions"
                className="text-xs font-medium text-primary hover:underline flex items-center"
              >
                Xem tất cả ({0})
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </CardHeader>
            <CardContent>
              <TransactionList
                transactions={recentTransactions}
                showFilters={false}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Secondary Section (5 Cols on desktop) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Accounts & Wallets */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">
                  Tài khoản & Ví ({MOCK_ACCOUNTS.length})
                </CardTitle>
                <CardDescription>
                  Phân bổ tài sản VND và ngoại tệ USD.
                </CardDescription>
              </div>
              <Link
                href="/accounts"
                className="text-xs font-medium text-primary hover:underline flex items-center"
              >
                Quản lý
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {MOCK_ACCOUNTS.map((acc) => (
                <AccountCard
                  key={acc.id}
                  account={{ ...acc, user_id: 'mock', currency_code: acc.currency, opening_balance: acc.balance, is_archived: false, created_at: '', updated_at: '' } as any}
                  variant="compact"
                  onClick={() => handleAccountClick(acc)}
                />
              ))}
            </CardContent>
          </Card>

          {/* Budget Consumption */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">
                  Tiến độ ngân sách
                </CardTitle>
                <CardDescription>
                  Các danh mục chi tiêu chính trong tháng.
                </CardDescription>
              </div>
              <Link
                href="/budgets"
                className="text-xs font-medium text-primary hover:underline flex items-center"
              >
                Tất cả ({MOCK_BUDGETS.length})
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {topBudgets.map((b) => (
                <BudgetProgress key={b.id} budget={b} />
              ))}
            </CardContent>
          </Card>

          {/* Financial Goals */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">
                  Mục tiêu tài chính
                </CardTitle>
                <CardDescription>
                  Tiến độ tích lũy cho kế hoạch dài hạn.
                </CardDescription>
              </div>
              <Link
                href="/goals"
                className="text-xs font-medium text-primary hover:underline flex items-center"
              >
                Xem chi tiết
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeGoals.map((g) => (
                <GoalCard key={g.id} goal={g} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Account Detail Modal */}
      <AccountDetailModal
        account={selectedAccount}
        open={accountModalOpen}
        onOpenChange={setAccountModalOpen}
        onQuickAction={() => setAddTxOpen(true)}
      />

      {/* Global Add Transaction Modal */}
      <AddTransactionModal
        open={addTxOpen}
        onOpenChange={setAddTxOpen}
      />
    </AppShell>
  );
}
