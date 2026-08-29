import React from 'react';
import { ArrowRightLeft, ArrowRight } from 'lucide-react';
import { ExtendedTransfer } from '@/features/transfers';
import { formatMoney, formatDateVN } from '@/lib/money/format';
import { CurrencyBadge } from './CurrencyBadge';
import { cn } from '@/lib/utils';

interface TransferItemProps {
  transfer: ExtendedTransfer;
  onClick?: () => void;
  compact?: boolean;
}

export const TransferItem: React.FC<TransferItemProps> = ({
  transfer,
  onClick,
  compact = false,
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-center justify-between p-3 sm:p-3.5 rounded-lg border bg-card hover:bg-muted/40 transition-colors cursor-pointer',
        compact ? 'py-2 px-2.5' : '',
        transfer.is_voided && 'opacity-50 grayscale'
      )}
    >
      <div className="flex items-center space-x-3 min-w-0 pr-2">
        <div
          className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-2xs bg-indigo-600"
        >
          <ArrowRightLeft className="h-4 w-4" />
        </div>
        <div className="min-w-0 truncate">
          <div className="flex items-center space-x-1.5 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate max-w-[140px] sm:max-w-[200px]">
              {transfer.fromAccountName || 'Tài khoản nguồn'}
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate max-w-[140px] sm:max-w-[200px]">
              {transfer.toAccountName || 'Tài khoản đích'}
            </span>
            {transfer.is_voided && (
              <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-md ml-2 font-semibold">
                ĐÃ HỦY
              </span>
            )}
            {transfer.currency_code !== 'VND' && (
              <CurrencyBadge currency={transfer.currency_code} />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {transfer.note ? transfer.note : 'Chuyển tiền nội bộ'}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="flex items-center justify-end space-x-1">
          <span className="text-sm sm:text-base font-semibold text-indigo-600 dark:text-indigo-400">
            {formatMoney(transfer.amount, transfer.currency_code)}
          </span>
        </div>
        <div className="flex items-center justify-end space-x-1.5 mt-0.5">
          <span className="text-[11px] text-muted-foreground">
            {formatDateVN(transfer.occurred_on)}
          </span>
        </div>
      </div>
    </div>
  );
};
