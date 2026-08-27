import React from 'react';
import { MockIncomeSource } from '@/types/finance';
import { formatMoney, formatConverted } from '@/lib/money/format';
import { CurrencyBadge } from '@/components/finance/CurrencyBadge';
import { Video, Briefcase, Laptop, TrendingUp, ChevronRight } from 'lucide-react';

interface IncomeSourcesBreakdownProps {
  sources: MockIncomeSource[];
}

export const IncomeSourcesBreakdown: React.FC<IncomeSourcesBreakdownProps> = ({
  sources,
}) => {
  const totalBaseVND = sources.reduce(
    (sum, src) => sum + src.totalBaseAmountVND,
    0
  );

  const getSourceIcon = (type: string) => {
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
        return <Briefcase className="h-4 w-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-3">
      {sources.map((src) => {
        const percent = Math.round((src.totalBaseAmountVND / totalBaseVND) * 100);

        return (
          <div
            key={src.id}
            className="p-3.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  {getSourceIcon(src.type)}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-semibold text-foreground">
                      {src.name}
                    </h4>
                    {src.currency !== 'VND' && (
                      <CurrencyBadge currency={src.currency} />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Đóng góp {percent}% tổng thu nhập
                  </span>
                </div>
              </div>

              <div className="text-right">
                {src.currency !== 'VND' && src.originalAmount ? (
                  <>
                    <p className="text-sm font-bold text-foreground">
                      {formatMoney(src.originalAmount, src.currency)}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      {formatConverted(src.totalBaseAmountVND)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-bold text-foreground">
                    {formatMoney(src.totalBaseAmountVND, 'VND')}
                  </p>
                )}
              </div>
            </div>

            {/* Sub-sources for YouTube channels */}
            {src.subSources && src.subSources.length > 0 && (
              <div className="pl-6 pt-1 border-t border-border/60 space-y-1.5">
                {src.subSources.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between text-xs text-muted-foreground py-0.5"
                  >
                    <div className="flex items-center space-x-1.5 truncate">
                      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{sub.name}</span>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <span className="font-semibold text-foreground">
                        {formatMoney(sub.amount, sub.currency)}
                      </span>{' '}
                      <span className="text-[10px]">({formatConverted(sub.baseAmountVND)})</span>
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
