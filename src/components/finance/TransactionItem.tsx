import React from 'react';
import {
  Utensils, Car, ShoppingBag, Home, Film, HeartPulse, MoreHorizontal,
  Briefcase, Video, Laptop, TrendingUp, ArrowRightLeft, ArrowDownLeft, ArrowUpRight,
} from 'lucide-react';
import { ExtendedTransaction } from '@/features/transactions';
import { formatMoney, formatDateVN } from '@/lib/money/format';
import { CurrencyBadge } from './CurrencyBadge';
import { cn } from '@/lib/utils';

interface TransactionItemProps {
  transaction: ExtendedTransaction;
  onClick?: () => void;
  compact?: boolean;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  onClick,
  compact = false,
}) => {
  const getCategoryIcon = () => {
    switch (transaction.categoryIcon) {
      case 'Utensils': return <Utensils className="h-4 w-4" />;
      case 'Car': return <Car className="h-4 w-4" />;
      case 'ShoppingBag': return <ShoppingBag className="h-4 w-4" />;
      case 'Home': return <Home className="h-4 w-4" />;
      case 'Film': return <Film className="h-4 w-4" />;
      case 'HeartPulse': return <HeartPulse className="h-4 w-4" />;
      case 'Briefcase': return <Briefcase className="h-4 w-4" />;
      case 'Video': return <Video className="h-4 w-4" />;
      case 'Laptop': return <Laptop className="h-4 w-4" />;
      case 'TrendingUp': return <TrendingUp className="h-4 w-4" />;
      case 'ArrowRightLeft': return <ArrowRightLeft className="h-4 w-4" />;
      default: return <MoreHorizontal className="h-4 w-4" />;
    }
  };

  const isIncome = transaction.type === 'INCOME';
  const isExpense = transaction.type === 'EXPENSE';

  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-center justify-between p-3 sm:p-3.5 rounded-lg border bg-card hover:bg-muted/40 transition-colors cursor-pointer',
        compact ? 'py-2 px-2.5' : '',
        transaction.is_voided && 'opacity-50 grayscale'
      )}
    >
      <div className="flex items-center space-x-3 min-w-0 pr-2">
        <div
          className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-2xs"
          style={{ backgroundColor: transaction.categoryColor || '#64748b' }}
        >
          {getCategoryIcon()}
        </div>
        <div className="min-w-0 truncate">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-semibold text-foreground truncate">
              {transaction.merchant}
            </p>
            {transaction.is_voided && (
              <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-md ml-2 font-semibold">ĐÃ HỦY</span>
            )}
            {transaction.currency_code !== 'VND' && (
              <CurrencyBadge currency={transaction.currency_code} />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1.5">
            <span>{transaction.categoryName} &middot; {transaction.accountName}</span>
            {transaction.incomeSourceName && (
              <>
                <span>&middot;</span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 text-[10px] font-medium border border-emerald-200 dark:border-emerald-800/40">
                  {transaction.incomeSourceName}
                  {transaction.incomeSourceStreamName ? ` / ${transaction.incomeSourceStreamName}` : ''}
                </span>
              </>
            )}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="flex items-center justify-end space-x-1">
          {isIncome ? (
            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : isExpense ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-500" />
          ) : null}
          <span
            className={cn(
              'text-sm sm:text-base font-semibold',
              isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'
            )}
          >
            {isIncome ? '+' : '-'}
            {formatMoney(transaction.amount, transaction.currency_code)}
          </span>
        </div>
        <div className="flex items-center justify-end space-x-1.5 mt-0.5">
          <span className="text-[11px] text-muted-foreground">
            {formatDateVN(transaction.occurred_on)}
          </span>
        </div>
      </div>
    </div>
  );
};
