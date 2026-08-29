"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CurrencyBadge } from './CurrencyBadge';
import { Button } from '@/components/ui/button';
import { Plus, ArrowRightLeft } from 'lucide-react';
import { formatExactMoney } from '@/lib/money';
import type { AccountBalanceSnapshot } from '@/features/reports';

interface AccountDetailModalProps {
  account: AccountBalanceSnapshot | null;
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
            <span className="text-xs text-muted-foreground font-medium">Số dư hiện tại</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {formatExactMoney(account.currentBalance, account.currency)}
              </span>
              <CurrencyBadge currency={account.currency} />
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
