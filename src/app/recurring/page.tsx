"use client";

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MOCK_RECURRING } from '@/lib/mock/recurring';
import { MockRecurringItem } from '@/types/finance';
import { formatMoney, formatDateVN } from '@/lib/money/format';
import { CurrencyBadge } from '@/components/finance/CurrencyBadge';
import {
  Repeat,
  Calendar,
  Plus,
  Play,
  Pause,
  AlertCircle,
  Film,
  Tv,
  Music,
  Wifi,
  Dumbbell,
  Briefcase,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function RecurringPage() {
  const [recurringList, setRecurringList] = useState<MockRecurringItem[]>(MOCK_RECURRING);

  const totalMonthlyOutflowVND = recurringList
    .filter((r) => r.type === 'EXPENSE' && r.status === 'ACTIVE')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalMonthlyInflowVND = recurringList
    .filter((r) => r.type === 'INCOME' && r.status === 'ACTIVE')
    .reduce((sum, r) => sum + r.amount, 0);

  const toggleStatus = (id: string) => {
    setRecurringList((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
            }
          : item
      )
    );
  };

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Film':
        return <Film className="h-4 w-4" />;
      case 'Tv':
        return <Tv className="h-4 w-4" />;
      case 'Music':
        return <Music className="h-4 w-4" />;
      case 'Wifi':
        return <Wifi className="h-4 w-4" />;
      case 'Dumbbell':
        return <Dumbbell className="h-4 w-4" />;
      case 'Briefcase':
        return <Briefcase className="h-4 w-4" />;
      default:
        return <Layers className="h-4 w-4" />;
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Định kỳ & Hóa đơn"
        subtitle="Quản lý các gói đăng ký, hóa đơn dịch vụ và thu nhập lặp lại hàng tháng."
      >
        <Button size="sm" onClick={() => alert('Chức năng thêm định kỳ mẫu')}>
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm khoản định kỳ
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-card border">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tổng hóa đơn cố định hàng tháng
              </span>
              <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                -{formatMoney(totalMonthlyOutflowVND)}
              </p>
              <span className="text-xs text-muted-foreground">
                {recurringList.filter((r) => r.type === 'EXPENSE' && r.status === 'ACTIVE').length} dịch vụ đang kích hoạt
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-slate-600 dark:text-slate-400">
              <Repeat className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Thu nhập định kỳ hàng tháng
              </span>
              <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                +{formatMoney(totalMonthlyInflowVND)}
              </p>
              <span className="text-xs text-muted-foreground">
                Lương cơ bản cố định
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Calendar className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recurring Items List */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">
          Danh sách dịch vụ & hóa đơn ({recurringList.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {recurringList.map((item) => {
            const isIncome = item.type === 'INCOME';
            const isActive = item.status === 'ACTIVE';

            return (
              <Card
                key={item.id}
                className={cn(
                  'transition-all duration-200 border',
                  !isActive ? 'opacity-60 bg-muted/20' : 'bg-card'
                )}
              >
                <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0 pr-2">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-2xs"
                      style={{ backgroundColor: item.color || '#64748b' }}
                    >
                      {getIcon(item.icon)}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-semibold text-foreground truncate">
                          {item.name}
                        </h4>
                        <Badge
                          variant={isActive ? 'default' : 'secondary'}
                          className="text-[10px] uppercase font-mono px-1.5 py-0"
                        >
                          {isActive ? 'Đang chạy' : 'Tạm dừng'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {item.accountName} · Lặp lại hàng tháng (Ngày {new Date(item.nextDueDate).getDate()})
                      </p>
                      <div className="flex items-center space-x-1 text-[11px] text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        <span>Kỳ tới: {formatDateVN(item.nextDueDate)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end space-y-2">
                    <span
                      className={cn(
                        'text-sm sm:text-base font-bold',
                        isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
                      )}
                    >
                      {isIncome ? '+' : '-'}
                      {formatMoney(item.amount, item.currency)}
                    </span>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleStatus(item.id)}
                      className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                    >
                      {isActive ? (
                        <>
                          <Pause className="h-3.5 w-3.5 mr-1 text-amber-500" />
                          Tạm ngưng
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                          Kích hoạt
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
