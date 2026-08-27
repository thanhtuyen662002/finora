"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { MockAccount } from '@/types/finance';
import { formatMoney, formatConverted } from '@/lib/money/format';
import { CurrencyBadge } from './CurrencyBadge';
import { Button } from '@/components/ui/button';
import { ArrowDownLeft, ArrowUpRight, Plus, ArrowRightLeft } from 'lucide-react';

interface AccountDetailModalProps {
  account: MockAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuickAction?: (action: 'ADD_TX' | 'TRANSFER') => void;
}

export const AccountDetailModal: React.FC<AccountDetailModalProps> = ({
  account,
  open,
  onOpenChange,
  onQuickAction,
}) => {
  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white font-bold"
              style={{ backgroundColor: account.color }}
            >
              {account.currency}
            </div>
            <div>
              <DialogTitle className="text-lg">{account.name}</DialogTitle>
              <DialogDescription>
                {account.institution || 'Tài khoản tài chính'} · {account.type}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Balance card */}
          <div className="p-4 rounded-xl bg-muted/60 border space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Số dư khả dụng</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {formatMoney(account.balance, account.currency)}
              </span>
              <CurrencyBadge currency={account.currency} />
            </div>
            {account.currency !== 'VND' && (
              <p className="text-xs text-muted-foreground font-medium pt-1">
                Quy đổi theo tỷ giá hiện tại: {formatConverted(account.convertedBalanceVND)}
              </p>
            )}
          </div>

          {/* Monthly Inflow / Outflow */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border bg-card space-y-1">
              <div className="flex items-center space-x-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <ArrowDownLeft className="h-3.5 w-3.5" />
                <span>Tiền vào tháng 8</span>
              </div>
              <p className="text-base font-semibold text-foreground">
                {formatMoney(account.monthlyInflow || 0, account.currency)}
              </p>
            </div>

            <div className="p-3 rounded-lg border bg-card space-y-1">
              <div className="flex items-center space-x-1 text-xs text-slate-500 font-medium">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>Tiền ra tháng 8</span>
              </div>
              <p className="text-base font-semibold text-foreground">
                {formatMoney(account.monthlyOutflow || 0, account.currency)}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onQuickAction?.('ADD_TX');
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Thêm giao dịch
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onQuickAction?.('TRANSFER');
              }}
            >
              <ArrowRightLeft className="h-4 w-4 mr-1.5" />
              Chuyển khoản
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
