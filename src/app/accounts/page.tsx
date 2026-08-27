"use client";

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { AccountCard } from '@/components/finance/AccountCard';
import { AddAccountModal } from '@/components/finance/AddAccountModal';
import { AccountDetailModal } from '@/components/finance/AccountDetailModal';
import { AddTransactionModal } from '@/components/finance/AddTransactionModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { MOCK_ACCOUNTS } from '@/lib/mock/accounts';
import { MockAccount, AccountType } from '@/types/finance';
import { formatMoney } from '@/lib/money/format';
import { Plus, Wallet, ArrowRightLeft, Globe } from 'lucide-react';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<MockAccount[]>(MOCK_ACCOUNTS);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [addTxOpen, setAddTxOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<MockAccount | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filteredAccounts = accounts.filter((a) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'FOREIGN') return a.currency !== 'VND';
    return a.type === filterType;
  });

  const totalVND = accounts.reduce((sum, a) => sum + a.convertedBalanceVND, 0);
  const foreignAccountsCount = accounts.filter((a) => a.currency !== 'VND').length;

  const handleCreateAccount = (newAcc: any) => {
    const created: MockAccount = {
      id: `acc-${Date.now()}`,
      name: newAcc.name,
      type: newAcc.type,
      currency: newAcc.currency,
      balance: newAcc.balance,
      convertedBalanceVND:
        newAcc.currency === 'USD' ? newAcc.balance * 26200 : newAcc.balance,
      color: newAcc.color,
      institution: newAcc.institution,
      isDefault: false,
      monthlyInflow: 0,
      monthlyOutflow: 0,
    };
    setAccounts([created, ...accounts]);
  };

  return (
    <AppShell>
      <PageHeader
        title="Tài khoản & Ví"
        subtitle="Quản lý toàn bộ ngân hàng, ví điện tử, tiền mặt và tài khoản ngoại tệ."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAddTxOpen(true)}
          className="hidden sm:inline-flex"
        >
          <ArrowRightLeft className="h-4 w-4 mr-1.5" />
          Chuyển khoản
        </Button>
        <Button size="sm" onClick={() => setAddAccountOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm tài khoản
        </Button>
      </PageHeader>

      {/* Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <Card className="sm:col-span-2 bg-card border">
          <CardContent className="p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Wallet className="h-4 w-4 text-primary" />
              <span>Tổng số dư tất cả tài khoản (Quy đổi VND)</span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mt-2">
              {formatMoney(totalVND)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Bao gồm {accounts.length} tài khoản ({foreignAccountsCount} tài khoản ngoại tệ USD)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardContent className="p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Globe className="h-4 w-4 text-blue-500" />
              <span>Tài khoản ngoại tệ</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground mt-2">
              {foreignAccountsCount} Ví USD
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PayPal & Wise (Tỷ giá 1 USD ≈ 26.200 ₫)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-full sm:w-56 bg-card"
          options={[
            { value: 'ALL', label: 'Tất cả loại tài khoản' },
            { value: 'BANK', label: 'Ngân hàng' },
            { value: 'CASH', label: 'Tiền mặt' },
            { value: 'EWALLET', label: 'Ví điện tử' },
            { value: 'FOREIGN', label: 'Ngoại tệ (USD)' },
            { value: 'SAVINGS', label: 'Sổ tiết kiệm' },
          ]}
        />
        <span className="text-xs text-muted-foreground hidden sm:inline-block">
          Hiển thị {filteredAccounts.length} / {accounts.length} tài khoản
        </span>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAccounts.map((acc) => (
          <AccountCard
            key={acc.id}
            account={acc}
            variant="detailed"
            onClick={() => {
              setSelectedAccount(acc);
              setDetailOpen(true);
            }}
          />
        ))}
      </div>

      {/* Add Account Modal */}
      <AddAccountModal
        open={addAccountOpen}
        onOpenChange={setAddAccountOpen}
        onSuccess={handleCreateAccount}
      />

      {/* Account Detail Modal */}
      <AccountDetailModal
        account={selectedAccount}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onQuickAction={() => setAddTxOpen(true)}
      />

      {/* Add Transaction Modal */}
      <AddTransactionModal
        open={addTxOpen}
        onOpenChange={setAddTxOpen}
      />
    </AppShell>
  );
}
