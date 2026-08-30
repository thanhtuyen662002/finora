import React, { useState, useMemo } from 'react';
import { ExtendedTransfer } from '@/features/transfers';
import { TransferItem } from './TransferItem';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { EmptyState } from './EmptyState';
import { Search } from 'lucide-react';
import { AccountRow } from '@/types/database';

interface TransferListProps {
  transfers: ExtendedTransfer[];
  accounts: AccountRow[];
  onSelectTransfer?: (transfer: ExtendedTransfer) => void;
  onAddNewTransfer?: () => void;
}

export const TransferList: React.FC<TransferListProps> = ({
  transfers,
  accounts,
  onSelectTransfer,
  onAddNewTransfer,
}) => {
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 20;

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleAccountFilterChange = (val: string) => {
    setAccountFilter(val);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      // Status filter
      if (statusFilter === 'ACTIVE' && t.is_voided) return false;
      if (statusFilter === 'VOIDED' && !t.is_voided) return false;

      // Account filter
      if (accountFilter !== 'ALL') {
        if (t.from_account_id !== accountFilter && t.to_account_id !== accountFilter) {
          return false;
        }
      }

      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase();
        const fromName = (t.fromAccountName || '').toLowerCase();
        const toName = (t.toAccountName || '').toLowerCase();
        const note = (t.note || '').toLowerCase();
        const currency = (t.currency_code || '').toLowerCase();
        if (
          !fromName.includes(query) &&
          !toName.includes(query) &&
          !note.includes(query) &&
          !currency.includes(query)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [transfers, search, accountFilter, statusFilter]);

  const totalPages = Math.ceil(filteredTransfers.length / pageSize) || 1;
  const paginatedTransfers = filteredTransfers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-4">
      {/* Controls / Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Tìm theo tài khoản, ghi chú..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>

        <div className="sm:col-span-3">
          <Select
            value={accountFilter}
            onChange={(e) => handleAccountFilterChange(e.target.value)}
            className="bg-card"
          >
            <option value="ALL">Tất cả tài khoản</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency_code})
              </option>
            ))}
          </Select>
        </div>

        <div className="sm:col-span-3">
          <Select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="bg-card"
          >
            <option value="ACTIVE">Chỉ giao dịch hoạt động</option>
            <option value="ALL">Tất cả (cả đã hủy)</option>
            <option value="VOIDED">Chỉ giao dịch đã hủy</option>
          </Select>
        </div>
      </div>

      {/* List */}
      {filteredTransfers.length === 0 ? (
        <EmptyState
          title={
            transfers.length === 0
              ? 'Chưa có giao dịch chuyển tiền nào'
              : 'Không tìm thấy giao dịch chuyển tiền phù hợp'
          }
          description={
            transfers.length === 0
              ? 'Thực hiện chuyển tiền giữa các tài khoản của bạn để theo dõi dòng tiền.'
              : 'Thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh bộ lọc.'
          }
          actionLabel={transfers.length === 0 && onAddNewTransfer ? '+ Chuyển tiền' : undefined}
          onAction={onAddNewTransfer}
        />
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            {paginatedTransfers.map((transfer) => (
              <TransferItem
                key={transfer.id}
                transfer={transfer}
                onClick={() => onSelectTransfer?.(transfer)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t text-xs text-muted-foreground">
              <span>
                Hiển thị {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, filteredTransfers.length)} trên tổng {filteredTransfers.length} chuyển tiền
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-2.5 text-xs"
                >
                  Trang trước
                </Button>
                <span className="px-2 font-medium text-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="h-8 px-2.5 text-xs"
                >
                  Trang sau
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
