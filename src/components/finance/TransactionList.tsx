import React, { useState, useMemo } from 'react';
import { Search, Filter, X, SlidersHorizontal, ArrowUpDown, RotateCcw } from 'lucide-react';
import { ExtendedTransaction } from '@/features/transactions';
import { TransactionItem } from './TransactionItem';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { formatDateVN } from '@/lib/money/format';


import { EmptyState } from './EmptyState';

import { AccountRow, CategoryRow } from '@/types/database';

interface TransactionListProps {
  accounts?: AccountRow[];
  categories?: CategoryRow[];
  transactions: ExtendedTransaction[];
  showFilters?: boolean;
  limit?: number;
  onSelectTransaction?: (tx: ExtendedTransaction) => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  accounts = [],
  categories = [],
  transactions,
  showFilters = true,
  limit,
  onSelectTransaction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedAccount, setSelectedAccount] = useState<string>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('NEWEST');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const isFiltered =
    searchTerm.trim() !== '' ||
    selectedType !== 'ALL' ||
    selectedCategory !== 'ALL' ||
    selectedAccount !== 'ALL' ||
    selectedPeriod !== 'ALL' ||
    sortBy !== 'NEWEST';

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedType('ALL');
    setSelectedCategory('ALL');
    setSelectedAccount('ALL');
    setSelectedPeriod('ALL');
    setSortBy('NEWEST');
  };

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        (tx.merchant || '').toLowerCase().includes(q) ||
        ((tx.note || '') && (tx.note || '').toLowerCase().includes(q)) ||
        (tx.categoryName || '').toLowerCase().includes(q) ||
        (tx.accountName || '').toLowerCase().includes(q);

      const matchesType = selectedType === 'ALL' || tx.type === selectedType;
      const matchesCategory =
        selectedCategory === 'ALL' || tx.category_id === selectedCategory;
      const matchesAccount =
        selectedAccount === 'ALL' || tx.account_id === selectedAccount;

      let matchesPeriod = true;
      if (selectedPeriod === 'THIS_MONTH') {
        matchesPeriod = tx.occurred_on.startsWith('2026-08');
      } else if (selectedPeriod === 'LAST_MONTH') {
        matchesPeriod = tx.occurred_on.startsWith('2026-07');
      } else if (selectedPeriod === 'LAST_30_DAYS') {
        const txDate = new Date(tx.occurred_on).getTime();
        const thirtyDaysAgo = new Date('2026-08-27').getTime() - 30 * 24 * 60 * 60 * 1000;
        matchesPeriod = txDate >= thirtyDaysAgo;
      }

      return matchesSearch && matchesType && matchesCategory && matchesAccount && matchesPeriod;
    });
  }, [transactions, searchTerm, selectedType, selectedCategory, selectedAccount, selectedPeriod]);

  // Sorting
  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortBy) {
      case 'OLDEST':
        return list.sort(
          (a, b) => new Date(a.occurred_on).getTime() - new Date(b.occurred_on).getTime()
        );
      case 'AMOUNT_DESC':
        return list.sort(
          (a, b) => (b.amount || b.amount) - (a.amount || a.amount)
        );
      case 'AMOUNT_ASC':
        return list.sort(
          (a, b) => (a.amount || a.amount) - (b.amount || b.amount)
        );
      case 'NEWEST':
      default:
        return list.sort(
          (a, b) => new Date(b.occurred_on).getTime() - new Date(a.occurred_on).getTime()
        );
    }
  }, [filtered, sortBy]);

  const displayedTransactions = limit ? sorted.slice(0, limit) : sorted;

  // Group by date
  const groupedByDate: Record<string, ExtendedTransaction[]> = {};
  displayedTransactions.forEach((tx) => {
    if (!groupedByDate[tx.occurred_on]) {
      groupedByDate[tx.occurred_on] = [];
    }
    groupedByDate[tx.occurred_on].push(tx);
  });

  const sortedDates = Object.keys(groupedByDate).sort(
    (a, b) => (sortBy === 'OLDEST' ? new Date(a).getTime() - new Date(b).getTime() : new Date(b).getTime() - new Date(a).getTime())
  );

  const activeFilterCount = [
    selectedType !== 'ALL',
    selectedCategory !== 'ALL',
    selectedAccount !== 'ALL',
    selectedPeriod !== 'ALL',
    sortBy !== 'NEWEST',
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="space-y-3">
          {/* Primary Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm giao dịch, cửa hàng, ghi chú..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-card"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex gap-2 items-center">
              <Select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-auto min-w-[130px] bg-card text-xs sm:text-sm"
                options={[
                  { value: 'ALL', label: 'Tất cả loại thu/chi' },
                  { value: 'EXPENSE', label: 'Chi tiêu (-)' },
                  { value: 'INCOME', label: 'Thu nhập (+)' },
                ]}
              />

              <Button
                type="button"
                variant={showAdvancedFilters || activeFilterCount > 0 ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="whitespace-nowrap"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                <span>Bộ lọc</span>
                {activeFilterCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                    {activeFilterCount}
                  </span>
                )}
              </Button>

              {isFiltered && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="text-muted-foreground hover:text-foreground px-2"
                  title="Đặt lại tất cả bộ lọc"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Advanced Collapsible Filter Row */}
          {showAdvancedFilters && (
            <div className="p-3 rounded-lg border bg-muted/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Tài khoản</label>
                <Select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full bg-card text-xs"
                  options={[
                    { value: 'ALL', label: 'Tất cả tài khoản' },
                    ...accounts.map((a) => ({
                      value: a.id,
                      label: `${a.name} (${a.currency_code})`,
                    })),
                  ]}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Danh mục</label>
                <Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-card text-xs"
                  options={[
                    { value: 'ALL', label: 'Tất cả danh mục' },
                    ...categories.map((c) => ({
                      value: c.id,
                      label: c.name,
                    })),
                  ]}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Thời gian</label>
                <Select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full bg-card text-xs"
                  options={[
                    { value: 'ALL', label: 'Tất cả thời gian' },
                    { value: 'THIS_MONTH', label: 'Tháng 8/2026 (Hiện tại)' },
                    { value: 'LAST_MONTH', label: 'Tháng 7/2026' },
                    { value: 'LAST_30_DAYS', label: '30 ngày gần đây' },
                  ]}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Sắp xếp</label>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full bg-card text-xs"
                  options={[
                    { value: 'NEWEST', label: 'Mới nhất trước' },
                    { value: 'OLDEST', label: 'Cũ nhất trước' },
                    { value: 'AMOUNT_DESC', label: 'Số tiền giảm dần' },
                    { value: 'AMOUNT_ASC', label: 'Số tiền tăng dần' },
                  ]}
                />
              </div>
            </div>
          )}

          {/* Active filter summary tag when filters are applied */}
          {isFiltered && (
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>
                Tìm thấy <strong>{displayedTransactions.length}</strong> kết quả phù hợp
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-primary hover:underline text-xs"
              >
                Xóa tất cả bộ lọc
              </button>
            </div>
          )}
        </div>
      )}

      {displayedTransactions.length === 0 ? (
        <EmptyState
          title="Chưa có giao dịch phù hợp"
          description="Không tìm thấy giao dịch nào với bộ lọc hoặc từ khóa hiện tại."
          actionLabel={isFiltered ? 'Đặt lại bộ lọc' : undefined}
          onAction={isFiltered ? handleResetFilters : undefined}
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

