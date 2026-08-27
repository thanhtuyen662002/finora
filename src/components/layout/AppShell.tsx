"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  WalletCards,
  ReceiptText,
  Target,
  PieChart,
  Repeat,
  SlidersHorizontal,
  Plus,
  ShieldCheck,
  Menu,
  X,
  Sparkles,
  TrendingUp,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AddTransactionModal } from '@/components/finance/AddTransactionModal';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [addTxOpen, setAddTxOpen] = useState(false);

  const navGroups = [
    {
      group: 'Tổng quan',
      items: [
        { href: '/dashboard', label: 'Bảng điều khiển', icon: LayoutDashboard },
      ],
    },
    {
      group: 'Dòng tiền',
      items: [
        { href: '/accounts', label: 'Tài khoản & Ví', icon: WalletCards },
        { href: '/transactions', label: 'Sổ giao dịch', icon: ReceiptText },
        { href: '/budgets', label: 'Ngân sách', icon: Target },
        { href: '/recurring', label: 'Định kỳ & Hóa đơn', icon: Repeat },
      ],
    },
    {
      group: 'Kế hoạch',
      items: [
        { href: '/goals', label: 'Mục tiêu tài chính', icon: TrendingUp },
      ],
    },
    {
      group: 'Phân tích',
      items: [
        { href: '/reports', label: 'Báo cáo thông minh', icon: PieChart },
      ],
    },
    {
      group: 'Hệ thống',
      items: [
        { href: '/settings', label: 'Cài đặt', icon: Settings },
      ],
    },
  ];

  const mobileNavItems = [
    { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { href: '/transactions', label: 'Giao dịch', icon: ReceiptText },
    { href: 'ADD_ACTION', label: 'Thêm', icon: Plus, isAction: true },
    { href: '/reports', label: 'Báo cáo', icon: PieChart },
    { href: '/settings', label: 'Cài đặt', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r bg-card h-screen sticky top-0 z-30 overflow-y-auto">
        {/* Brand Header */}
        <div className="p-5 border-b flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center font-bold tracking-wider text-base shadow-xs">
              F
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-foreground block leading-tight">
                Finora
              </span>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                Personal Finance OS
              </span>
            </div>
          </Link>
        </div>

        {/* Quick Add Button */}
        <div className="px-4 pt-4 pb-2">
          <Button
            onClick={() => setAddTxOpen(true)}
            className="w-full justify-center shadow-xs font-semibold"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Thêm giao dịch
          </Button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-2 space-y-5">
          {navGroups.map((group) => (
            <div key={group.group} className="space-y-1">
              <span className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {group.group}
              </span>
              <div className="space-y-0.5 pt-1">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs font-semibold'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-inherit' : 'text-muted-foreground')} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User / Admin Footer */}
        <div className="p-3 border-t bg-muted/30 space-y-2">
          <Link
            href="/admin"
            className={cn(
              'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors',
              pathname === '/admin'
                ? 'bg-slate-200 dark:bg-slate-800 text-foreground font-semibold'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <span className="flex items-center space-x-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Quản trị hệ thống</span>
            </span>
            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono">
              ADMIN
            </span>
          </Link>

          <div className="flex items-center justify-between p-2 rounded-lg border bg-card">
            <div className="flex items-center space-x-2.5 min-w-0">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" />
                <AvatarFallback>TT</AvatarFallback>
              </Avatar>
              <div className="truncate">
                <p className="text-xs font-semibold text-foreground truncate">
                  Võ Thanh Tuyền
                </p>
                <p className="text-[10px] text-muted-foreground">VND (₫) · vi-VN</p>
              </div>
            </div>
            <Link
              href="/login"
              title="Đăng xuất (Mock)"
              className="text-muted-foreground hover:text-foreground p-1 rounded-md"
            >
              <LogOut className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card sticky top-0 z-30">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <div className="h-7 w-7 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center font-bold text-sm">
            F
          </div>
          <span className="font-bold text-base tracking-tight text-foreground">
            Finora
          </span>
        </Link>

        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs font-medium px-2.5"
            onClick={() => setAddTxOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Giao dịch
          </Button>

          <Link href="/settings">
            <Avatar className="h-7 w-7">
              <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" />
              <AvatarFallback>TT</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 min-w-0 pb-20 md:pb-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-3 py-1.5">
        <div className="flex items-center justify-around">
          {mobileNavItems.map((item) => {
            if (item.isAction) {
              return (
                <button
                  key="add-action"
                  onClick={() => setAddTxOpen(true)}
                  className="flex flex-col items-center justify-center -mt-5"
                  aria-label="Thêm giao dịch"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-lg active:scale-95 transition-transform">
                    <Plus className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-medium text-foreground mt-1">
                    Thêm
                  </span>
                </button>
              );
            }

            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname?.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors',
                  isActive
                    ? 'text-slate-900 dark:text-slate-100 font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn('h-5 w-5 mb-0.5', isActive ? 'text-inherit' : 'text-muted-foreground')} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Global Add Transaction Modal */}
      <AddTransactionModal
        open={addTxOpen}
        onOpenChange={setAddTxOpen}
        onSuccess={() => {
          // Local mock feedback handled inside modal
        }}
      />
    </div>
  );
};
