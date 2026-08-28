import React from 'react';
import {
  Building2,
  Wallet,
  Smartphone,
  PiggyBank,
  CreditCard,
  TrendingUp,
  Globe,
  MoreVertical,
} from 'lucide-react';
import type { AccountRow } from '@/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { CurrencyBadge } from './CurrencyBadge';
import { formatMoney, formatConverted } from '@/lib/money/format';

interface AccountCardProps {
  account: AccountRow;
  onClick?: () => void;
  variant?: 'compact' | 'detailed';
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  BANK: 'Ngân hàng',
  CASH: 'Tiền mặt',
  EWALLET: 'Ví điện tử',
  SAVINGS: 'Sổ tiết kiệm',
  CREDIT_CARD: 'Thẻ tín dụng',
  INVESTMENT: 'Đầu tư',
  OTHER: 'Khác',
};

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  onClick,
  variant = 'detailed',
}) => {
  const getIcon = () => {
    switch (account.type) {
      case 'BANK':
        return account.currency_code === 'USD' ? <Globe className="h-4 w-4" /> : <Building2 className="h-4 w-4" />;
      case 'CASH':
        return <Wallet className="h-4 w-4" />;
      case 'EWALLET':
        return <Smartphone className="h-4 w-4" />;
      case 'SAVINGS':
        return <PiggyBank className="h-4 w-4" />;
      case 'CREDIT_CARD':
        return <CreditCard className="h-4 w-4" />;
      case 'INVESTMENT':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Wallet className="h-4 w-4" />;
    }
  };

  if (variant === 'compact') {
    return (
      <div
        onClick={onClick}
        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors cursor-pointer"
      >
        <div className="flex items-center space-x-3 min-w-0">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white font-medium"
            style={{ backgroundColor: account.color }}
          >
            {getIcon()}
          </div>
          <div className="truncate">
            <p className="text-sm font-medium text-foreground truncate">{account.name}</p>
            <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[account.type] || account.type}</p>
          </div>
        </div>
        <div className="text-right shrink-0 pl-2">
          <p className="text-sm font-semibold text-foreground">{formatMoney(account.opening_balance, account.currency_code as any)}</p>
        </div>
      </div>
    );
  }

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-slate-400/40 group relative overflow-hidden"
    >
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: account.color }}
      />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-xs"
              style={{ backgroundColor: account.color }}
            >
              {getIcon()}
            </div>
            <div>
              <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm sm:text-base">
                {account.name}
              </h4>
              <p className="text-xs text-muted-foreground">
                {account.institution || ACCOUNT_TYPE_LABELS[account.type]}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5">
            <CurrencyBadge currency={account.currency_code as any} />
          </div>
        </div>

        <div className="mt-5 flex items-baseline justify-between pt-2 border-t border-border/60">
          <div>
            <span className="text-xs text-muted-foreground">Số dư</span>
            <p className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {formatMoney(account.opening_balance, account.currency_code as any)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
