"use client";

import React from 'react';
import { formatMoney } from '@/lib/money/format';

interface CategoryDonutChartProps {
  data: {
    category: string;
    amountVND: number;
    percentage: number;
    color: string;
  }[];
}

export const CategoryDonutChart: React.FC<CategoryDonutChartProps> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.amountVND, 0);

  // Calculate SVG stroke dashes for donut
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  // Pre-calculate slices purely with immutable reduction
  const slices = data.map((item, index) => {
    const priorPercent = data
      .slice(0, index)
      .reduce((sum, prev) => sum + prev.percentage, 0);
    const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((priorPercent / 100) * circumference);
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
              key={slice.category}
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke={slice.color}
              strokeWidth="16"
              strokeDasharray={slice.strokeDasharray}
              strokeDashoffset={slice.strokeDashoffset}
              className="transition-all duration-500 ease-out hover:opacity-80"
            />
          ))}
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground">Tổng chi</span>
          <span className="text-xs font-bold text-foreground">{formatMoney(total)}</span>
        </div>
      </div>

      {/* Legend list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full flex-1">
        {data.map((item) => (
          <div key={item.category} className="flex items-center justify-between p-2 rounded-lg border bg-muted/20 text-xs">
            <div className="flex items-center space-x-2 truncate">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="font-medium text-foreground truncate">{item.category}</span>
            </div>
            <div className="text-right shrink-0 pl-2">
              <span className="font-semibold text-foreground">{item.percentage}%</span>
              <span className="text-[10px] text-muted-foreground block">
                {formatMoney(item.amountVND)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
