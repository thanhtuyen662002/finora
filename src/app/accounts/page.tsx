"use client";

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { AccountCard } from '@/components/finance/AccountCard';
import { AddAccountModal } from '@/components/finance/AddAccountModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/finance/EmptyState';
import { Plus, Wallet, Globe, ArrowRightLeft } from 'lucide-react';
import { getAccounts, createAccount, updateAccount, getAccountBalances } from '@/features/accounts/accounts';
import { AddTransferModal } from '@/components/finance/AddTransferModal';
import type { AccountRow, AccountInsert, AccountUpdate } from '@/types/database';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<AccountRow | null>(null);
  const [addTransferOpen, setAddTransferOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [accountPage, setAccountPage] = useState(1);

  const accountPageSize = 12;

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const [accountsData, balancesData] = await Promise.all([
        getAccounts(),
        getAccountBalances(),
      ]);
      setAccounts(accountsData);
      setBalances(balancesData);
    } catch (err: unknown) {
      console.error('Failed to load accounts', err);
      setErrorMessage(err instanceof Error ? err.message : 'Không thể tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAccounts();
  }, []);

  const activeAccounts = accounts.filter((account) => !account.is_archived);
  const archivedAccounts = accounts.filter((account) => account.is_archived);
  const accountsToShow = showArchived ? archivedAccounts : activeAccounts;

  const filteredAccounts = accountsToShow.filter((account) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'FOREIGN') return account.currency_code !== 'VND';
    return account.type === filterType;
  });

  const foreignAccountsCount = activeAccounts.filter((account) => account.currency_code !== 'VND').length;

  const handleCreateAccount = async (accountInput: Omit<AccountInsert, 'user_id'> | AccountUpdate) => {
    if (editAccount) {
      await updateAccount(editAccount.id, accountInput as AccountUpdate);
    } else {
      await createAccount(accountInput as Omit<AccountInsert, 'user_id'>);
    }
    await loadAccounts();
    setEditAccount(null);
  };

  const handleArchiveAccount = async (id: string, archive: boolean) => {
    if (archive && !confirm('Bạn có chắc chắn muốn lưu trữ tài khoản này?')) return;

    try {
      setErrorMessage('');
      await updateAccount(id, { is_archived: archive });
      await loadAccounts();
    } catch (err: unknown) {
      console.error('Failed to update account archive status', err);
      setErrorMessage(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái tài khoản');
    }
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
          onClick={() => setAddTransferOpen(true)}
        >
          <ArrowRightLeft className="h-4 w-4 mr-1.5 text-indigo-600 dark:text-indigo-400" />
          Chuyển tiền
        </Button>
        <Button size="sm" onClick={() => { setEditAccount(null); setAddAccountOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm tài khoản
        </Button>
      </PageHeader>

      {errorMessage && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
        <Card className="bg-card border">
          <CardContent className="p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Wallet className="h-4 w-4 text-primary" />
              <span>Số tài khoản đang hoạt động</span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mt-2">
              {activeAccounts.length}
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <Select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setAccountPage(1); }}
          className="w-full sm:w-56 bg-card"
          options={[
            { value: 'ALL', label: 'Tất cả loại tài khoản' },
            { value: 'BANK', label: 'Ngân hàng' },
            { value: 'CASH', label: 'Tiền mặt' },
            { value: 'EWALLET', label: 'Ví điện tử' },
            { value: 'SAVINGS', label: 'Sổ tiết kiệm' },
            { value: 'CREDIT_CARD', label: 'Thẻ tín dụng' },
            { value: 'INVESTMENT', label: 'Đầu tư' },
            { value: 'OTHER', label: 'Khác' },
            { value: 'FOREIGN', label: 'Ngoại tệ' },
          ]}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowArchived((current) => !current);
              setAccountPage(1);
            }}
          >
            {showArchived ? 'Hiện đang hoạt động' : 'Hiện đã lưu trữ'}
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:inline-block">
            Hiển thị {filteredAccounts.length} / {accountsToShow.length} tài khoản
          </span>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Đang tải tài khoản...</div>
      ) : accountsToShow.length === 0 ? (
        showArchived ? (
          <EmptyState
            title="Chưa có tài khoản đã lưu trữ"
            description="Các tài khoản bạn lưu trữ sẽ xuất hiện tại đây."
            actionLabel="Hiện tài khoản đang hoạt động"
            onAction={() => setShowArchived(false)}
          />
        ) : (
          <EmptyState
            title="Bạn chưa có tài khoản nào"
            description="Thêm tài khoản đầu tiên để bắt đầu theo dõi tài chính."
            actionLabel="+ Thêm tài khoản"
            onAction={() => setAddAccountOpen(true)}
          />
        )
      ) : filteredAccounts.length === 0 ? (
        <EmptyState
          title="Không tìm thấy tài khoản phù hợp"
          description="Không có tài khoản nào thuộc bộ lọc hiện tại."
          actionLabel="Hiển thị tất cả"
          onAction={() => setFilterType('ALL')}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts
              .slice((accountPage - 1) * accountPageSize, accountPage * accountPageSize)
              .map((account) => (
                <div key={account.id} className="relative group">
                  <AccountCard account={account} currentBalance={balances[account.id]} variant="detailed" />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditAccount(account); setAddAccountOpen(true); }}
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-primary"
                    >
                      Sửa
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleArchiveAccount(account.id, !showArchived)}
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                    >
                      {showArchived ? 'Khôi phục' : 'Lưu trữ'}
                    </Button>
                  </div>
                </div>
              ))}
          </div>

          {Math.ceil(filteredAccounts.length / accountPageSize) > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t text-xs text-muted-foreground">
              <span>
                Hiển thị {(accountPage - 1) * accountPageSize + 1}–
                {Math.min(accountPage * accountPageSize, filteredAccounts.length)} trên tổng {filteredAccounts.length} tài khoản
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAccountPage((p) => Math.max(p - 1, 1))}
                  disabled={accountPage === 1}
                  className="h-8 px-2.5 text-xs"
                >
                  Trang trước
                </Button>
                <span className="px-2 font-medium text-foreground">
                  {accountPage} / {Math.ceil(filteredAccounts.length / accountPageSize)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setAccountPage((p) => Math.min(p + 1, Math.ceil(filteredAccounts.length / accountPageSize)))
                  }
                  disabled={accountPage === Math.ceil(filteredAccounts.length / accountPageSize)}
                  className="h-8 px-2.5 text-xs"
                >
                  Trang sau
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <AddAccountModal
        open={addAccountOpen}
        onOpenChange={(open) => { setAddAccountOpen(open); if (!open) setEditAccount(null); }}
        onSuccess={handleCreateAccount}
        initialData={editAccount}
      />

      <AddTransferModal
        open={addTransferOpen}
        onOpenChange={setAddTransferOpen}
        onSuccess={loadAccounts}
        accounts={accounts}
      />
    </AppShell>
  );
}
