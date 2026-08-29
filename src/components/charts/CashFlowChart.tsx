"use client";

import React, { useState } from 'react';
import type { MonthlyCashFlowPoint } from '@/features/reports';
import { formatExactMoney } from '@/lib/money';

interface CashFlowChartProps {
  data: MonthlyCashFlowPoint[];
  currency?: string;
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({ data, currency = 'VND' }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
        Chưa có dữ liệu dòng tiền cho đơn vị tiền tệ này.
      </div>
    );
  }

  const chartHeight = 150;

  return (
    <div className="w-full space-y-4">
      {/* Legend */}
      <div className="flex items-center justify-end space-x-4 text-xs">
        <div className="flex items-center space-x-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" />
          <span className="text-muted-foreground font-medium">Thu nhập</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-slate-400 dark:bg-slate-600" />
          <span className="text-muted-foreground font-medium">Chi tiêu</span>
        </div>
      </div>

      {/* SVG / CSS Bar Chart */}
      <div className="relative pt-6 pb-2">
        <div
          className="grid gap-2 sm:gap-4 items-end h-[160px]"
          style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
        >
          {data.map((item, idx) => {
            const incomeHeight = Math.round((item.incomeBasisPoints / 10000) * chartHeight);
            const expenseHeight = Math.round((item.expenseBasisPoints / 10000) * chartHeight);
            const isHovered = hoveredIdx === idx;

            return (
              <div
                key={item.monthKey}
                className="flex flex-col items-center h-full justify-end group cursor-pointer relative"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Tooltip on hover */}
                {isHovered && (
                  <div className="absolute -top-14 z-20 bg-slate-900 text-white text-[11px] p-2.5 rounded-md shadow-lg pointer-events-none whitespace-nowrap min-w-[130px]">
                    <p className="font-semibold text-slate-200">{item.fullLabel}</p>
                    <p className="text-emerald-400">Thu: {formatExactMoney(item.income, currency)}</p>
                    <p className="text-slate-300">Chi: {formatExactMoney(item.expense, currency)}</p>
                    <p className="text-blue-300 font-medium">
                      Tích lũy: {formatExactMoney(item.savings, currency, { showSign: true })}
                    </p>
                  </div>
                )}

                {/* Bars */}
                <div className="flex items-end space-x-1 sm:space-x-1.5 w-full justify-center">
                  {/* Income bar */}
                  <div
                    className="w-2.5 sm:w-4 bg-emerald-500/90 rounded-t-sm transition-all duration-300 group-hover:bg-emerald-500"
                    style={{ height: `${Math.max(incomeHeight, 3)}px` }}
                  />
                  {/* Expense bar */}
                  <div
                    className="w-2.5 sm:w-4 bg-slate-400/80 dark:bg-slate-600 rounded-t-sm transition-all duration-300 group-hover:bg-slate-700 dark:group-hover:bg-slate-400"
                    style={{ height: `${Math.max(expenseHeight, 3)}px` }}
                  />
                </div>

                {/* Month label */}
                <span className="text-[11px] font-medium text-muted-foreground mt-2 truncate">
                  {item.monthLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
