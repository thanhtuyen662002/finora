import React from 'react';
import type { IncomeSourceBreakdown } from '@/features/reports/types';
import { formatExactMoney } from '@/lib/money';
import { CurrencyBadge } from '@/components/finance/CurrencyBadge';
import { Video, Briefcase, Laptop, TrendingUp, ChevronRight, HelpCircle, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IncomeSourcesBreakdownProps {
  sources: IncomeSourceBreakdown[];
  currency: string;
}

export const IncomeSourcesBreakdown: React.FC<IncomeSourcesBreakdownProps> = ({
  sources,
  currency,
}) => {
  const getSourceIcon = (type: string | null) => {
    switch (type) {
      case 'YOUTUBE':
        return <Video className="h-4 w-4 text-red-500" />;
      case 'SALARY':
        return <Briefcase className="h-4 w-4 text-emerald-500" />;
      case 'FREELANCE':
        return <Laptop className="h-4 w-4 text-blue-500" />;
      case 'INVESTMENT':
        return <TrendingUp className="h-4 w-4 text-amber-500" />;
      default:
        return type ? <Briefcase className="h-4 w-4 text-slate-500" /> : <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSourceTypeLabel = (type: string | null) => {
    switch (type) {
      case 'SALARY': return 'Lương';
      case 'YOUTUBE': return 'YouTube';
      case 'FREELANCE': return 'Freelance';
      case 'INVESTMENT': return 'Đầu tư';
      case 'OTHER': return 'Khác';
      default: return 'Chưa phân loại';
    }
  };

  if (!sources || sources.length === 0) {
    return (
      <div className="py-8 text-center border rounded-xl bg-card">
        <Layers className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-sm font-medium text-muted-foreground">Chưa có dữ liệu thu nhập</p>
        <p className="text-xs text-muted-foreground/80 mt-1">
          Các khoản thu nhập được gán nguồn thu sẽ hiển thị cơ cấu tại đây.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sources.map((src) => {
        const hasStreams = src.streams && src.streams.length > 0;
        return (
          <div
            key={src.sourceId || '__unattributed__'}
            className="p-3.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                  {getSourceIcon(src.sourceType)}
                </div>
                <div className="min-w-0 truncate">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-semibold text-foreground truncate">
                      {src.sourceName}
                    </h4>
                    {currency !== 'VND' && currency !== 'BASE' && (
                      <CurrencyBadge currency={currency} />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    <span className="inline-block px-1.5 py-0.2 text-[10px] font-medium rounded bg-muted/80 text-muted-foreground">
                      {getSourceTypeLabel(src.sourceType)}
                    </span>
                    <span>&middot;</span>
                    <span>Đóng góp {src.percentageStr} ({src.transactionCount} giao dịch)</span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  +{formatExactMoney(src.amount, currency)}
                </p>
                <div className="w-20 bg-muted rounded-full h-1.5 mt-1 ml-auto overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(src.percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Nested Streams */}
            {hasStreams && (
              <div className="pl-6 pt-2 border-t border-border/60 space-y-1.5">
                {src.streams.map((sub) => (
                  <div
                    key={sub.streamId || '__default_stream__'}
                    className="flex items-center justify-between text-xs text-muted-foreground py-0.5"
                  >
                    <div className="flex items-center space-x-1.5 truncate pr-2">
                      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate font-medium text-foreground">{sub.streamName}</span>
                      <span className="text-[10px] text-muted-foreground">({sub.percentageStr})</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        +{formatExactMoney(sub.amount, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
