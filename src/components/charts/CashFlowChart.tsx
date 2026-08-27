"use client";

import React, { useState } from 'react';
import { MockCashFlowMonth } from '@/types/finance';
import { formatMoney } from '@/lib/money/format';

interface CashFlowChartProps {
  data: MockCashFlowMonth[];
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({ data }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => Math.max(d.income, d.expense))) * 1.15;
  const chartHeight = 160;

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

      {/* SVG Bar Chart */}
      <div className="relative pt-6 pb-2">
        <div className="grid grid-cols-6 gap-2 sm:gap-4 items-end h-[160px]">
          {data.map((item, idx) => {
            const incomeHeight = Math.round((item.income / maxVal) * chartHeight);
            const expenseHeight = Math.round((item.expense / maxVal) * chartHeight);
            const isHovered = hoveredIdx === idx;

            return (
              <div
                key={item.month}
                className="flex flex-col items-center h-full justify-end group cursor-pointer relative"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Tooltip on hover */}
                {isHovered && (
                  <div className="absolute -top-12 z-20 bg-slate-900 text-white text-[11px] p-2 rounded-md shadow-lg pointer-events-none whitespace-nowrap">
                    <p className="font-semibold">{item.month}/2026</p>
                    <p className="text-emerald-400">Thu: {formatMoney(item.income)}</p>
                    <p className="text-slate-300">Chi: {formatMoney(item.expense)}</p>
                    <p className="text-blue-300 font-medium">Tiết kiệm: {formatMoney(item.savings)}</p>
                  </div>
                )}

                {/* Bars */}
                <div className="flex items-end space-x-1 sm:space-x-1.5 w-full justify-center">
                  {/* Income bar */}
                  <div
                    className="w-3 sm:w-5 bg-emerald-500/90 rounded-t-sm transition-all duration-300 group-hover:bg-emerald-500"
                    style={{ height: `${Math.max(incomeHeight, 4)}px` }}
                  />
                  {/* Expense bar */}
                  <div
                    className="w-3 sm:w-5 bg-slate-400/80 dark:bg-slate-600 rounded-t-sm transition-all duration-300 group-hover:bg-slate-700 dark:group-hover:bg-slate-400"
                    style={{ height: `${Math.max(expenseHeight, 4)}px` }}
                  />
                </div>

                {/* Month label */}
                <span className="text-[11px] font-medium text-muted-foreground mt-2">
                  {item.month}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
