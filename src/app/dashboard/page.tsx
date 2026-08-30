"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { SummaryCard } from '@/components/finance/SummaryCard';
import { AccountCard } from '@/components/finance/AccountCard';
import { TransactionList } from '@/components/finance/TransactionList';
import { CashFlowChart } from '@/components/charts/CashFlowChart';
import { AccountDetailModal } from '@/components/finance/AccountDetailModal';
import { AddTransactionModal } from '@/components/finance/AddTransactionModal';
import { AddTransferModal } from '@/components/finance/AddTransferModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatExactMoney, formatExactDecimal } from '@/lib/money';
import {
  getDashboardReportData,
  type DashboardReportData,
  type AccountBalanceSnapshot,
} from '@/features/reports';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  PiggyBank,
  Plus,
  ArrowRight,
  ArrowRightLeft,
  Target,
  PieChart,
  Layers,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCurrency, setActiveCurrency] = useState<string | null>(null);

  const [selectedAccount, setSelectedAccount] = useState<AccountBalanceSnapshot | null>(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [addTxOpen, setAddTxOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getDashboardReportData();
      setData(res);
      setActiveCurrency((prev) => {
        if (prev && res.availableCurrencies.includes(prev)) return prev;
        return res.defaultCurrency || res.availableCurrencies[0];
      });
    } catch (err: any) {
      setError(err?.message || 'Không thể tải dữ liệu tổng quan tài chính');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        setLoading(true);
        setError(null);
        const res = await getDashboardReportData();
        if (!ignore) {
          setData(res);
          setActiveCurrency((prev) => {
            if (prev && res.availableCurrencies.includes(prev)) return prev;
            return res.defaultCurrency || res.availableCurrencies[0];
          });
        }
      } catch (err: any) {
        if (!ignore) {
          setError(err?.message || 'Không thể tải dữ liệu tổng quan tài chính');
          setData(null);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, []);

  const handleAccountClick = (acc: AccountBalanceSnapshot) => {
    setSelectedAccount(acc);
    setAccountModalOpen(true);
  };

  const handleQuickAction = (action: 'ADD_TX' | 'TRANSFER') => {
    if (action === 'ADD_TX') {
      setAddTxOpen(true);
    } else if (action === 'TRANSFER') {
      setTransferOpen(true);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6 animate-pulse">
          <div className="h-10 bg-muted/60 rounded-md w-1/3" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-muted/50 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 h-80 bg-muted/40 rounded-xl" />
            <div className="lg:col-span-5 h-80 bg-muted/40 rounded-xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-destructive/20 bg-destructive/5 text-center space-y-4 max-w-md mx-auto my-12">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div>
            <h3 className="font-semibold text-foreground">Không thể tải dữ liệu tài chính</h3>
            <p className="text-xs text-muted-foreground mt-1">{error || 'Lỗi không xác định'}</p>
          </div>
          <Button size="sm" variant="outline" onClick={loadDashboard}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Thử lại
          </Button>
        </div>
      </AppShell>
    );
  }

  const effectiveCurrency =
    activeCurrency && data.availableCurrencies.includes(activeCurrency)
      ? activeCurrency
      : data.defaultCurrency || data.availableCurrencies[0] || 'VND';
  const displayCurrency = effectiveCurrency === 'BASE' ? data.baseCurrency : effectiveCurrency;

  const activeSummary = data.currentMonthSummaries[effectiveCurrency] || {
    currency: effectiveCurrency,
    totalIncome: '0.0000',
    totalExpense: '0.0000',
    netSavings: '0.0000',
    savingRateBasisPoints: null,
    savingRatePercent: null,
    transactionCount: 0,
  };

  const activeAccountGroup = data.accountBalancesByCurrency[effectiveCurrency] || {
    currency: effectiveCurrency,
    totalBalance: '0.0000',
    accounts: [],
  };

  // Flatten active non-archived accounts for the account preview display (max 6)
  const allAccounts: AccountBalanceSnapshot[] = [];
  data.availableCurrencies.filter(c => c !== 'BASE').forEach((c) => {
    if (data.accountBalancesByCurrency[c]) {
      const active = data.accountBalancesByCurrency[c].accounts.filter(acc => !acc.isArchived);
      allAccounts.push(...active);
    }
  });
  const previewAccounts = allAccounts.slice(0, 6);

  return (
    <AppShell>
      {/* Top Header */}
      <PageHeader
        title="Tổng quan tài chính"
        subtitle={`Theo dõi tài sản, dòng tiền và giao dịch thực tế (${data.currentMonthLabel}).`}
      >
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
            <ArrowRightLeft className="h-4 w-4 mr-1.5" />
            Chuyển khoản
          </Button>
          <Button size="sm" onClick={() => setAddTxOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Giao dịch mới
          </Button>
        </div>
      </PageHeader>

      {/* Currency View Selector if multiple currencies exist */}
      {data.availableCurrencies.length > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <Layers className="h-4 w-4 text-primary" />
            <span className="font-medium">Đơn vị tiền tệ hiển thị:</span>
          </div>
          <div className="flex items-center gap-1.5">
            {data.availableCurrencies.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCurrency(c)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  effectiveCurrency === c
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-card text-muted-foreground hover:bg-muted border'
                }`}
              >
                {c === 'BASE' ? `Tổng hợp (${data.baseCurrency})` : c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4 Core Financial Summary Cards for active currency */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {effectiveCurrency === 'BASE' && data.baseValuation.status !== 'AVAILABLE' ? (
          <div className="flex flex-col p-4 bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-5 h-5 text-slate-400" />
              <h3 className="text-sm font-medium text-slate-500">Tài sản ({displayCurrency})</h3>
            </div>
            <div className="text-xl font-semibold text-slate-400 mb-1">— (Không khả dụng)</div>
            <p className="text-xs text-amber-600 mb-2">Thiếu tỷ giá hiện tại.</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="w-fit h-7 text-xs">Thử lại</Button>
          </div>
        ) : (
          <SummaryCard
            title={`Tài sản (${displayCurrency})`}
            value={formatExactMoney(activeAccountGroup.totalBalance, displayCurrency)}
            icon={Wallet}
            highlight={true}
            subtext={`${activeAccountGroup.accounts.length} tài khoản ${displayCurrency}`}
          />
        )}
        <SummaryCard
          title="Thu nhập tháng này"
          value={formatExactMoney(activeSummary.totalIncome, displayCurrency)}
          icon={ArrowDownLeft}
          subtext={data.currentMonthLabel}
        />
        <SummaryCard
          title="Chi tiêu tháng này"
          value={formatExactMoney(activeSummary.totalExpense, displayCurrency)}
          icon={ArrowUpRight}
          subtext={data.currentMonthLabel}
        />
        <SummaryCard
          title="Tiết kiệm & Tỷ lệ"
          value={formatExactMoney(activeSummary.netSavings, displayCurrency, { showSign: true })}
          icon={PiggyBank}
          subtext={
            activeSummary.savingRatePercent
              ? `Tỷ lệ tiết kiệm đạt ${activeSummary.savingRatePercent}%`
              : 'Chưa có thu nhập tháng này'
          }
        />
      </div>

      {/* Multi-Currency Balances Notification if user holds foreign currency */}
      {data.availableCurrencies.length > 1 && (
        <div className="p-3.5 rounded-lg border bg-card/80 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Tổng số dư theo từng loại tiền tệ:</span>
            <span className="text-[11px] text-muted-foreground italic">
              Đã bao gồm tỷ giá quy đổi tài sản tự động.
            </span>
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            {data.availableCurrencies.map((c) => {
              const group = data.accountBalancesByCurrency[c];
              return (
                <div key={c} className="flex items-center space-x-1.5 bg-muted/40 px-2.5 py-1 rounded-md border">
                  <span className="font-bold text-foreground">{c === 'BASE' ? `Tổng hợp (${data.baseCurrency})` : c}:</span>
                  <span className="font-medium text-foreground">
                    {formatExactMoney(group?.totalBalance || '0.0000', c === 'BASE' ? data.baseCurrency : c)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    ({group?.accounts.length || 0} TK)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Primary Section (7 Cols on desktop) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 6-Month Cash Flow Chart Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <div className="flex items-center space-x-2">
                  <CardTitle className="text-base font-semibold">
                    Xu hướng dòng tiền 6 tháng
                  </CardTitle>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-sm bg-muted text-muted-foreground">
                    {displayCurrency}
                  </span>
                </div>
                <CardDescription>
                  So sánh thu nhập, chi tiêu và số dư tích lũy hàng tháng ({displayCurrency}).
                </CardDescription>
              </div>
              <Link
                href="/reports"
                className="text-xs font-medium text-primary hover:underline flex items-center shrink-0"
              >
                Báo cáo chi tiết
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </CardHeader>
            <CardContent>
              <CashFlowChart
                data={data.sixMonthCashFlowByCurrency[effectiveCurrency] || []}
                currency={displayCurrency}
              />
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
                className="text-xs font-medium text-primary hover:underline flex items-center shrink-0"
              >
                Xem tất cả ({data.recentTransactions.length})
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </CardHeader>
            <CardContent>
              <TransactionList
                transactions={data.recentTransactions}
                showFilters={false}
                onSelectTransaction={() => {}}
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
                  Tài khoản & Ví ({allAccounts.length})
                </CardTitle>
                <CardDescription>
                  Số dư thực tế từ cơ sở dữ liệu.
                </CardDescription>
              </div>
              <Link
                href="/accounts"
                className="text-xs font-medium text-primary hover:underline flex items-center shrink-0"
              >
                Quản lý
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {previewAccounts.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                  Chưa có tài khoản nào. Hãy thêm tài khoản mới.
                </div>
              ) : (
                previewAccounts.map((acc) => (
                  <AccountCard
                    key={acc.accountId}
                    account={{
                      id: acc.accountId,
                      user_id: '',
                      name: acc.name,
                      type: acc.type,
                      currency_code: acc.currency,
                      opening_balance: 0,
                      institution: acc.institution,
                      color: acc.color,
                      is_archived: acc.isArchived,
                      created_at: '',
                      updated_at: '',
                    }}
                    currentBalance={acc.currentBalance}
                    variant="compact"
                    onClick={() => handleAccountClick(acc)}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Phase 7 Financial Planning Module */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center space-x-2">
                <Target className="h-4 w-4 text-primary" />
                <span>Kế hoạch tài chính</span>
              </CardTitle>
              <CardDescription>
                Ngân sách chi tiêu và mục tiêu tích lũy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3.5 rounded-lg border bg-muted/20 space-y-2 text-xs">
                <div className="flex items-center justify-between font-medium">
                  <span className="flex items-center space-x-1.5 text-foreground">
                    <PieChart className="h-3.5 w-3.5 text-primary" />
                    <span>Ngân sách định mức</span>
                  </span>
                  <Link href="/budgets" className="text-primary hover:underline flex items-center">
                    Cấu hình
                    <ArrowRight className="h-3 w-3 ml-0.5" />
                  </Link>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Thiết lập hạn mức chi tiêu theo danh mục để kiểm soát tài chính chủ động.
                </p>
              </div>

              <div className="p-3.5 rounded-lg border bg-muted/20 space-y-2 text-xs">
                <div className="flex items-center justify-between font-medium">
                  <span className="flex items-center space-x-1.5 text-foreground">
                    <Target className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Mục tiêu tích lũy</span>
                  </span>
                  <Link href="/goals" className="text-primary hover:underline flex items-center">
                    Xem mục tiêu
                    <ArrowRight className="h-3 w-3 ml-0.5" />
                  </Link>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Theo dõi tiến độ tiết kiệm cho các quỹ dự phòng, mua sắm lớn hoặc đầu tư dài hạn.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Account Detail Modal */}
      <AccountDetailModal
        account={selectedAccount}
        open={accountModalOpen}
        onOpenChange={setAccountModalOpen}
        onQuickAction={handleQuickAction}
      />

      {/* Global Add Transaction Modal */}
      <AddTransactionModal
        open={addTxOpen}
        onOpenChange={setAddTxOpen}
        onSuccess={loadDashboard}
      />

      {/* Global Transfer Modal */}
      <AddTransferModal
        open={transferOpen}
        onOpenChange={setTransferOpen}
        onSuccess={loadDashboard}
      />
    </AppShell>
  );
}
