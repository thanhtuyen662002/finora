"use client";

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { AccountCard } from '@/components/finance/AccountCard';
import { AddAccountModal } from '@/components/finance/AddAccountModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { formatMoney } from '@/lib/money/format';
import { EmptyState } from '@/components/finance/EmptyState';
import { Plus, Wallet, Globe } from 'lucide-react';
import { getAccounts, createAccount, updateAccount } from '@/features/accounts/accounts';
import type { AccountRow, AccountInsert } from '@/types/database';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [addAccountOpen, setAddAccountOpen] = useState(false);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await getAccounts();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load accounts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAccounts();
  }, []);

  const filteredAccounts = accounts.filter((a) => {
    if (a.is_archived) return false;
    if (filterType === 'ALL') return true;
    if (filterType === 'FOREIGN') return a.currency_code !== 'VND';
    return a.type === filterType;
  });

  const foreignAccountsCount = accounts.filter((a) => a.currency_code !== 'VND' && !a.is_archived).length;

  const handleCreateAccount = async (newAcc: Omit<AccountInsert, 'user_id'>) => {
    try {
      await createAccount(newAcc);
      await loadAccounts();
    } catch (err) {
      console.error('Failed to create account', err);
    }
  };

  const handleArchiveAccount = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn lưu trữ tài khoản này?')) return;
    try {
      await updateAccount(id, { is_archived: true });
      await loadAccounts();
    } catch (err) {
      console.error('Failed to archive account', err);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Tài khoản & Ví"
        subtitle="Quản lý toàn bộ ngân hàng, ví điện tử, tiền mặt và tài khoản ngoại tệ."
      >
        <Button size="sm" onClick={() => setAddAccountOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm tài khoản
        </Button>
      </PageHeader>

      {/* Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
        <Card className="bg-card border">
          <CardContent className="p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Wallet className="h-4 w-4 text-primary" />
              <span>Số tài khoản đang hoạt động</span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mt-2">
              {accounts.filter(a => !a.is_archived).length}
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
              {foreignAccountsCount} Tài khoản
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
            { value: 'FOREIGN', label: 'Ngoại tệ' },
            { value: 'SAVINGS', label: 'Sổ tiết kiệm' },
          ]}
        />
        <span className="text-xs text-muted-foreground hidden sm:inline-block">
          Hiển thị {filteredAccounts.length} / {accounts.filter(a => !a.is_archived).length} tài khoản
        </span>
      </div>

      {/* Account Cards Grid or Empty States */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Đang tải tài khoản...</div>
      ) : accounts.filter(a => !a.is_archived).length === 0 ? (
        <EmptyState
          title="Bạn chưa có tài khoản nào"
          description="Thêm tài khoản đầu tiên để bắt đầu theo dõi tài chính."
          actionLabel="+ Thêm tài khoản"
          onAction={() => setAddAccountOpen(true)}
        />
      ) : filteredAccounts.length === 0 ? (
        <EmptyState
          title="Không tìm thấy tài khoản phù hợp"
          description="Không có tài khoản nào thuộc bộ lọc hiện tại."
          actionLabel="Hiển thị tất cả"
          onAction={() => setFilterType('ALL')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map((acc) => (
            <div key={acc.id} className="relative group">
              <AccountCard account={acc} variant="detailed" />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" onClick={() => handleArchiveAccount(acc.id)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                  <span className="sr-only">Lưu trữ</span>
                  Lưu trữ
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      <AddAccountModal
        open={addAccountOpen}
        onOpenChange={setAddAccountOpen}
        onSuccess={handleCreateAccount}
      />
    </AppShell>
  );
}
