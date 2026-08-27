import React from 'react';
import { cn } from '@/lib/utils';

export type PeriodType = '1M' | '3M' | '6M' | '1Y' | 'ALL';

interface PeriodSelectorProps {
  selected: PeriodType;
  onChange: (period: PeriodType) => void;
  className?: string;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  selected,
  onChange,
  className,
}) => {
  const periods: { key: PeriodType; label: string }[] = [
    { key: '1M', label: '1 Tháng' },
    { key: '3M', label: '3 Tháng' },
    { key: '6M', label: '6 Tháng' },
    { key: '1Y', label: '1 Năm' },
    { key: 'ALL', label: 'Tất cả' },
  ];

  return (
    <div
      className={cn(
        'inline-flex items-center p-1 rounded-lg bg-muted text-muted-foreground',
        className
      )}
    >
      {periods.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className={cn(
            'px-2.5 py-1 text-xs font-medium rounded-md transition-all',
            selected === p.key
              ? 'bg-background text-foreground shadow-2xs font-semibold'
              : 'hover:text-foreground'
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
};
