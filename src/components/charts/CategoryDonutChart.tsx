"use client";

import React from 'react';
import type { CategoryExpenseBreakdown } from '@/features/reports';
import { formatExactMoney } from '@/lib/money';

interface CategoryDonutChartProps {
  data: CategoryExpenseBreakdown[];
  currency?: string;
  totalExpense?: string;
}

export const CategoryDonutChart: React.FC<CategoryDonutChartProps> = ({
  data,
  currency = 'VND',
  totalExpense = '0.0000',
}) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-lg border border-dashed text-center text-xs text-muted-foreground space-y-2">
        <div className="h-20 w-20 rounded-full border-4 border-muted flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground font-semibold">0%</span>
        </div>
        <p>Chưa có chi tiêu trong kỳ đã chọn.</p>
      </div>
    );
  }

  // Pre-calculate slices with basisPoints fractions immutably
  const slices = data.map((item, index) => {
    const priorBps = data.slice(0, index).reduce((sum, d) => sum + d.basisPoints, 0);
    const strokeDasharray = `${(item.basisPoints / 10000) * circumference} ${circumference}`;
    const strokeDashoffset = -((priorBps / 10000) * circumference);

    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-2">
      {/* Donut SVG */}
      <div className="relative h-40 w-40 shrink-0 flex items-center justify-center">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="16"
            className="text-muted/30"
          />
          {slices.map((slice) => (
            <circle
              key={slice.categoryId}
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke={slice.categoryColor || '#94a3b8'}
              strokeWidth="16"
              strokeDasharray={slice.strokeDasharray}
              strokeDashoffset={slice.strokeDashoffset}
              className="transition-all duration-500 ease-out hover:opacity-80"
            />
          ))}
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center px-2">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground">Tổng chi</span>
          <span className="text-xs font-bold text-foreground truncate max-w-[90px]">
            {formatExactMoney(totalExpense, currency)}
          </span>
        </div>
      </div>

      {/* Legend list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full flex-1">
        {data.map((item) => (
          <div
            key={item.categoryId}
            className="flex items-center justify-between p-2 rounded-lg border bg-muted/20 text-xs"
          >
            <div className="flex items-center space-x-2 truncate min-w-0 pr-2">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.categoryColor || '#94a3b8' }}
              />
              <span className="font-medium text-foreground truncate">{item.categoryName}</span>
            </div>
            <div className="text-right shrink-0">
              <span className="font-semibold text-foreground">{item.percentageStr}</span>
              <span className="text-[10px] text-muted-foreground block">
                {formatExactMoney(item.amount, currency)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
