import React, { useState, useMemo } from 'react';
import { ExtendedTransfer } from '@/features/transfers';
import { TransferItem } from './TransferItem';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from './EmptyState';
import { Search, ArrowRightLeft } from 'lucide-react';
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
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>

        <div className="sm:col-span-3">
          <Select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
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
            onChange={(e) => setStatusFilter(e.target.value)}
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
        <div className="space-y-2">
          {filteredTransfers.map((transfer) => (
            <TransferItem
              key={transfer.id}
              transfer={transfer}
              onClick={() => onSelectTransfer?.(transfer)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
