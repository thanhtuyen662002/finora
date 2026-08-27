"use client";

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { PeriodSelector, PeriodType } from '@/components/finance/PeriodSelector';
import { CashFlowChart } from '@/components/charts/CashFlowChart';
import { CategoryDonutChart } from '@/components/charts/CategoryDonutChart';
import { IncomeSourcesBreakdown } from '@/components/charts/IncomeSourcesBreakdown';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  MOCK_CASH_FLOW_6M,
  MOCK_CATEGORY_EXPENSES,
  MOCK_INCOME_SOURCES,
  MOCK_DASHBOARD_METRICS,
} from '@/lib/mock/reports';
import { formatMoney } from '@/lib/money/format';
import { Download, PieChart, TrendingUp, DollarSign, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReportsPage() {
  const [period, setPeriod] = useState<PeriodType>('6M');

  return (
    <AppShell>
      <PageHeader
        title="Báo cáo thông minh"
        subtitle="Phân tích chuyên sâu dòng tiền, cơ cấu chi tiêu và nguồn thu ngoại tệ."
      >
        <PeriodSelector selected={period} onChange={setPeriod} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => alert('Xuất báo cáo tài chính PDF/Excel')}
          className="hidden sm:inline-flex"
        >
          <Download className="h-4 w-4 mr-1.5" />
          Xuất báo cáo
        </Button>
      </PageHeader>

      {/* Analytics High Level Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <Card className="bg-card border">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tổng thu nhập kỳ này
            </span>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {formatMoney(247500000)}
            </p>
            <span className="text-xs text-muted-foreground">
              Trung bình 41.250.000 ₫/tháng
            </span>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tổng chi tiêu kỳ này
            </span>
            <p className="text-2xl font-bold text-foreground mt-1">
              {formatMoney(111450000)}
            </p>
            <span className="text-xs text-muted-foreground">
              Trung bình 18.575.000 ₫/tháng
            </span>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tổng tích lũy ròng
            </span>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              +{formatMoney(136050000)}
            </p>
            <span className="text-xs text-muted-foreground">
              Tỷ lệ tiết kiệm trung bình 55%
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Full Width Cash Flow Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Biểu đồ dòng tiền lịch sử (6 tháng gần nhất)
          </CardTitle>
          <CardDescription>
            Định lượng độ lệch giữa thu nhập và chi tiêu qua từng chu kỳ tháng.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CashFlowChart data={MOCK_CASH_FLOW_6M} />
        </CardContent>
      </Card>

      {/* 2-Column Section: Expense Donut + Multi-currency Income breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Category Expense Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Cơ cấu chi tiêu theo danh mục
            </CardTitle>
            <CardDescription>
              Tỷ trọng chi tiêu tháng 8/2026 (Tổng chi: {formatMoney(MOCK_DASHBOARD_METRICS.monthlyExpenseVND)})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryDonutChart data={MOCK_CATEGORY_EXPENSES} />
          </CardContent>
        </Card>

        {/* Multi-Currency Income Sources Breakdown (YouTube Channels + Salary) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Phân rã đa nguồn thu nhập (Multi-Currency)
            </CardTitle>
            <CardDescription>
              Bao gồm Lương VND, YouTube Channels (USD) và dự án Freelance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <IncomeSourcesBreakdown sources={MOCK_INCOME_SOURCES} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
