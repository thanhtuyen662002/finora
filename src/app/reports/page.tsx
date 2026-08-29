"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { PeriodSelector } from '@/components/finance/PeriodSelector';
import { CashFlowChart } from '@/components/charts/CashFlowChart';
import { CategoryDonutChart } from '@/components/charts/CategoryDonutChart';
import { TransactionList } from '@/components/finance/TransactionList';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatExactMoney } from '@/lib/money';
import {
  getDetailedReportData,
  exportTransactionsToCSV,
  type DetailedReportData,
  type ReportPeriod,
} from '@/features/reports';
import {
  Download,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  PiggyBank,
  Layers,
  AlertCircle,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>('6M');
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [data, setData] = useState<DetailedReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

  const loadReport = useCallback(async () => {
    const reqId = ++requestSeqRef.current;
    try {
      setLoading(true);
      setError(null);
      setData(null);
      const res = await getDetailedReportData(period, selectedCurrency || undefined);
      if (reqId === requestSeqRef.current) {
        setData(res);
        setSelectedCurrency(res.selectedCurrency);
      }
    } catch (err: any) {
      if (reqId === requestSeqRef.current) {
        setError(err?.message || 'Không thể tải báo cáo tài chính');
        setData(null);
      }
    } finally {
      if (reqId === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [period, selectedCurrency]);

  useEffect(() => {
    let ignore = false;
    const reqId = ++requestSeqRef.current;
    async function fetchReport() {
      try {
        setLoading(true);
        setError(null);
        setData(null);
        const res = await getDetailedReportData(period, selectedCurrency || undefined);
        if (!ignore && reqId === requestSeqRef.current) {
          setData(res);
          setSelectedCurrency(res.selectedCurrency);
        }
      } catch (err: any) {
        if (!ignore && reqId === requestSeqRef.current) {
          setError(err?.message || 'Không thể tải báo cáo tài chính');
          setData(null);
        }
      } finally {
        if (!ignore && reqId === requestSeqRef.current) {
          setLoading(false);
        }
      }
    }
    fetchReport();
    return () => {
      ignore = true;
    };
  }, [period, selectedCurrency]);

  const handleExportCSV = () => {
    if (!data) return;
    try {
      const { filename, csvContent } = exportTransactionsToCSV(
        data.transactions,
        data.selectedCurrency,
        data.dateRangeLabel,
        data.timezone
      );

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('CSV Export Error:', err);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6 animate-pulse">
          <div className="h-10 bg-muted/60 rounded-md w-1/3" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 bg-muted/50 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-muted/40 rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-72 bg-muted/40 rounded-xl" />
            <div className="h-72 bg-muted/40 rounded-xl" />
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
            <h3 className="font-semibold text-foreground">Không thể tải báo cáo tài chính</h3>
            <p className="text-xs text-muted-foreground mt-1">{error || 'Lỗi không xác định'}</p>
          </div>
          <Button size="sm" variant="outline" onClick={loadReport}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Thử lại
          </Button>
        </div>
      </AppShell>
    );
  }

  const currency = data.selectedCurrency;
  const summary = data.summary;

  return (
    <AppShell>
      <PageHeader
        title="Báo cáo tài chính"
        subtitle={`Phân tích dòng tiền, cơ cấu chi tiêu và lịch sử tài chính (${data.dateRangeLabel}).`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector selected={period} onChange={setPeriod} />

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={data.transactions.length === 0}
            className="whitespace-nowrap"
            title="Xuất dữ liệu giao dịch ra file CSV UTF-8"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Xuất CSV
          </Button>
        </div>
      </PageHeader>

      {/* Currency Selector if multiple currencies available */}
      {data.availableCurrencies.length > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <Layers className="h-4 w-4 text-primary" />
            <span className="font-medium">Đơn vị tiền tệ báo cáo:</span>
          </div>
          <div className="flex items-center gap-1.5">
            {data.availableCurrencies.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCurrency(c)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  currency === c
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-card text-muted-foreground hover:bg-muted border'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Analytics High Level Cards for selected currency */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <Card className="bg-card border">
          <CardContent className="p-4 sm:p-5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tổng thu nhập kỳ này
              </span>
              <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatExactMoney(summary.totalIncome, currency)}
            </p>
            <span className="text-xs text-muted-foreground block">
              {data.dateRangeLabel} ({summary.transactionCount} giao dịch)
            </span>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardContent className="p-4 sm:p-5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tổng chi tiêu kỳ này
              </span>
              <ArrowUpRight className="h-4 w-4 text-slate-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {formatExactMoney(summary.totalExpense, currency)}
            </p>
            <span className="text-xs text-muted-foreground block">
              {data.dateRangeLabel}
            </span>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardContent className="p-4 sm:p-5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tổng tích lũy ròng
              </span>
              <PiggyBank className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatExactMoney(summary.netSavings, currency, { showSign: true })}
            </p>
            <span className="text-xs text-muted-foreground block">
              {summary.savingRatePercent
                ? `Tỷ lệ tiết kiệm đạt ${summary.savingRatePercent}%`
                : 'Không có thu nhập trong kỳ'}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Full Width Cash Flow Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Biểu đồ dòng tiền thực tế ({currency})
              </CardTitle>
              <CardDescription>
                So sánh thu nhập và chi tiêu qua các chu kỳ tháng trong khoảng thời gian đã chọn.
              </CardDescription>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-muted text-foreground">
              {data.dateRangeLabel}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <CashFlowChart data={data.cashFlow} currency={currency} />
        </CardContent>
      </Card>

      {/* 2-Column Section: Expense Donut + Accounts in currency */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Category Expense Breakdown (7 Cols) */}
        <div className="lg:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Cơ cấu chi tiêu theo danh mục
              </CardTitle>
              <CardDescription>
                Phân bổ chi tiêu thực tế trong kỳ ({formatExactMoney(summary.totalExpense, currency)}).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryDonutChart
                data={data.categoryBreakdown}
                currency={currency}
                totalExpense={summary.totalExpense}
              />
            </CardContent>
          </Card>
        </div>

        {/* Currency & Account Position Summary (5 Cols) */}
        <div className="lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center space-x-2">
                <Wallet className="h-4 w-4 text-primary" />
                <span>Tài khoản ({currency})</span>
              </CardTitle>
              <CardDescription>
                Tổng số dư các tài khoản nắm giữ {currency}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3.5 rounded-lg border bg-muted/30 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Tổng số dư {currency}:</span>
                <span className="text-base font-bold text-foreground">
                  {formatExactMoney(data.totalAccountBalance, currency)}
                </span>
              </div>

              {data.accountsInCurrency && data.accountsInCurrency.length > 0 ? (
                <div className="space-y-2 pt-1">
                  {data.accountsInCurrency.map((acc) => (
                    <div
                      key={acc.accountId}
                      className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: acc.color }}
                        />
                        <div className="truncate">
                          <p className="font-medium text-foreground truncate">{acc.name}</p>
                          <p className="text-[10px] text-muted-foreground">{acc.institution || acc.type}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-semibold text-foreground">
                        {formatExactMoney(acc.currentBalance, acc.currency)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                  Không có tài khoản nào sử dụng {currency}.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transaction Details in Selected Period & Currency */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Chi tiết giao dịch trong kỳ ({data.transactions.length})
            </CardTitle>
            <CardDescription>
              Các khoản thu/chi thực tế {currency} thuộc {data.dateRangeLabel}.
            </CardDescription>
          </div>
          {data.transactions.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportCSV}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
              Tải CSV
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <TransactionList
            transactions={data.transactions}
            showFilters={true}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
