import React, { useState } from 'react';
import { Search, Filter, ArrowUpDown } from 'lucide-react';
import { MockTransaction } from '@/types/finance';
import { TransactionItem } from './TransactionItem';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatDateVN } from '@/lib/money/format';
import { EmptyState } from './EmptyState';

interface TransactionListProps {
  transactions: MockTransaction[];
  showFilters?: boolean;
  limit?: number;
  onSelectTransaction?: (tx: MockTransaction) => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  showFilters = true,
  limit,
  onSelectTransaction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedAccount, setSelectedAccount] = useState<string>('ALL');

  const filtered = transactions.filter((tx) => {
    const matchesSearch =
      tx.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.note && tx.note.toLowerCase().includes(searchTerm.toLowerCase())) ||
      tx.categoryName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = selectedType === 'ALL' || tx.type === selectedType;
    const matchesCategory =
      selectedCategory === 'ALL' || tx.categoryId === selectedCategory;
    const matchesAccount =
      selectedAccount === 'ALL' || tx.accountId === selectedAccount;

    return matchesSearch && matchesType && matchesCategory && matchesAccount;
  });

  const displayedTransactions = limit ? filtered.slice(0, limit) : filtered;

  // Group by date
  const groupedByDate: Record<string, MockTransaction[]> = {};
  displayedTransactions.forEach((tx) => {
    if (!groupedByDate[tx.occurredAt]) {
      groupedByDate[tx.occurredAt] = [];
    }
    groupedByDate[tx.occurredAt].push(tx);
  });

  const sortedDates = Object.keys(groupedByDate).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm giao dịch, ghi chú, cửa hàng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-card"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-auto min-w-[120px] bg-card text-xs sm:text-sm"
              options={[
                { value: 'ALL', label: 'Tất cả loại' },
                { value: 'EXPENSE', label: 'Chi tiêu (-)' },
                { value: 'INCOME', label: 'Thu nhập (+)' },
                { value: 'TRANSFER', label: 'Chuyển tiền' },
              ]}
            />
          </div>
        </div>
      )}

      {displayedTransactions.length === 0 ? (
        <EmptyState
          title="Chưa có giao dịch phù hợp"
          description="Không tìm thấy giao dịch nào với bộ lọc hiện tại."
        />
      ) : (
        <div className="space-y-5">
          {sortedDates.map((dateStr) => (
            <div key={dateStr} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {formatDateVN(dateStr)}
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {groupedByDate[dateStr].length} giao dịch
                </span>
              </div>
              <div className="space-y-2">
                {groupedByDate[dateStr].map((tx) => (
                  <TransactionItem
                    key={tx.id}
                    transaction={tx}
                    onClick={() => onSelectTransaction?.(tx)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
