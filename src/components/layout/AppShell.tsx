"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  WalletCards,
  ReceiptText,
  Target,
  PieChart,
  Repeat,
  Plus,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AddTransactionModal } from '@/components/finance/AddTransactionModal';
import { cn } from '@/lib/utils';
import { getCurrentUser, getCurrentProfile, getCurrentUserSettings, signOut } from '@/lib/auth';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [addTxOpen, setAddTxOpen] = useState(false);

  // User state
  const [displayName, setDisplayName] = useState<string>('Người dùng');
  const [userEmail, setUserEmail] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<string>('VND');
  const [locale, setLocale] = useState<string>('vi-VN');

  useEffect(() => {
    let isMounted = true;

    async function loadUserData() {
      try {
        const { user } = await getCurrentUser();
        if (user && isMounted) {
          setUserEmail(user.email || '');
          const fallbackName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'Người dùng';
          setDisplayName(fallbackName);
        }

        const { data: profile } = await getCurrentProfile();
        if (profile && isMounted) {
          if (profile.display_name) setDisplayName(profile.display_name);
          if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
        }

        const { data: settings } = await getCurrentUserSettings();
        if (settings && isMounted) {
          if (settings.base_currency) setBaseCurrency(settings.base_currency);
          if (settings.locale) setLocale(settings.locale);
        }
      } catch (err) {
        console.debug('Could not load user profile in AppShell', err);
      }
    }

    loadUserData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
    router.refresh();
  };

  const initials = displayName
    ? displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'FN';

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
    { href: 'MENU_ACTION', label: 'Menu', icon: Menu, isMenu: true },
  ];

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

        {/* Authenticated User Footer */}
        <div className="p-3 border-t bg-muted/30">
          <div className="flex items-center justify-between p-2 rounded-lg border bg-card">
            <Link href="/settings" className="flex items-center space-x-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity">
              <Avatar className="h-8 w-8 shrink-0">
                {avatarUrl && <AvatarImage src={avatarUrl} />}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="truncate">
                <p className="text-xs font-semibold text-foreground truncate">
                  {displayName}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {baseCurrency} · {locale}
                </p>
              </div>
            </Link>
            <button
              onClick={handleSignOut}
              title="Đăng xuất"
              type="button"
              className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
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
              {avatarUrl && <AvatarImage src={avatarUrl} />}
              <AvatarFallback>{initials}</AvatarFallback>
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-3 py-1.5 pb-safe">
        <div className="grid grid-cols-5 items-end w-full">
          {mobileNavItems.map((item) => {
            if (item.isAction) {
              return (
                <div key="add-action-wrapper" className="flex w-full items-center justify-center">
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
                </div>
              );
            }

            if (item.isMenu) {
              return (
                <div key="menu-action-wrapper" className="flex w-full items-center justify-center">
                  <Sheet key="menu-action" open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <button
                      className={cn(
                        'flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Menu className="h-5 w-5 mb-0.5 text-muted-foreground" />
                      <span>{item.label}</span>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[85%] max-w-sm p-0 flex flex-col h-full">
                    <SheetHeader className="p-5 border-b text-left shrink-0">
                      <SheetTitle className="flex items-center space-x-2.5">
                        <div className="h-8 w-8 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center font-bold tracking-wider text-sm shadow-xs">
                          F
                        </div>
                        <span className="font-bold text-lg tracking-tight">Finora</span>
                      </SheetTitle>
                    </SheetHeader>
                    
                    <div className="flex-1 overflow-y-auto">
                      <nav className="px-3 py-4 space-y-6">
                        {navGroups.map((group) => (
                          <div key={group.group} className="space-y-2">
                            <span className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                              {group.group}
                            </span>
                            <div className="space-y-1">
                              {group.items.map((navItem) => {
                                const isActive =
                                  pathname === navItem.href ||
                                  (navItem.href !== '/dashboard' && pathname?.startsWith(navItem.href));
                                const Icon = navItem.icon;
                                return (
                                  <Link
                                    key={navItem.href}
                                    href={navItem.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={cn(
                                      'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                      isActive
                                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs font-semibold'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                    )}
                                  >
                                    <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-inherit' : 'text-muted-foreground')} />
                                    <span>{navItem.label}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </nav>
                    </div>

                    <div className="p-4 border-t bg-muted/30 shrink-0">
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <Link 
                          href="/settings" 
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center space-x-3 min-w-0 flex-1 hover:opacity-80 transition-opacity"
                        >
                          <Avatar className="h-9 w-9 shrink-0">
                            {avatarUrl && <AvatarImage src={avatarUrl} />}
                            <AvatarFallback>{initials}</AvatarFallback>
                          </Avatar>
                          <div className="truncate">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {displayName}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {userEmail || `${baseCurrency} · ${locale}`}
                            </p>
                          </div>
                        </Link>
                        <button
                          onClick={() => {
                            setMobileMenuOpen(false);
                            handleSignOut();
                          }}
                          title="Đăng xuất"
                          type="button"
                          className="text-muted-foreground hover:text-destructive p-2 rounded-md hover:bg-muted transition-colors shrink-0 ml-2"
                        >
                          <LogOut className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </SheetContent>
                  </Sheet>
                </div>
              );
            }

            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname?.startsWith(item.href));
            const Icon = item.icon;

            return (
              <div key={item.href} className="flex w-full items-center justify-center">
                <Link
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
              </div>
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
