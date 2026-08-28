"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ShieldCheck,
  Download,
  Globe,
  User,
  Palette,
  CheckCircle2,
  Lock,
  Bell,
  Sparkles,
  KeyRound,
  Laptop,
  Moon,
  Sun,
  Smartphone,
  Check,
  Loader2,
  AlertCircle,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getCurrentUser,
  getCurrentProfile,
  getCurrentUserSettings,
  updateCurrentProfile,
  updateCurrentUserSettings,
  updatePassword,
  signOut,
} from '@/lib/auth';

export default function SettingsPage() {
  const router = useRouter();

  // User Profile
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Currency & Region
  const [baseCurrency, setBaseCurrency] = useState('VND');
  const [locale, setLocale] = useState('vi-VN');
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
  const [maskBalance, setMaskBalance] = useState(false);
  const [autoFx, setAutoFx] = useState(true);

  // Appearance
  const [appearanceTheme, setAppearanceTheme] = useState<'light' | 'dark' | 'system'>('system');

  // Notifications (Mock preferences for Phase 1/2)
  const [notifyBudgetAlert, setNotifyBudgetAlert] = useState(true);
  const [notifyRecurringBill, setNotifyRecurringBill] = useState(true);
  const [notifyGoalMilestone, setNotifyGoalMilestone] = useState(true);
  const [notifyWeeklySummary, setNotifyWeeklySummary] = useState(false);

  // AI Configuration (Mock preferences for Phase 1/2)
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiCredentialSource, setAiCredentialSource] = useState<'ADMIN' | 'PERSONAL'>('ADMIN');

  // Security
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status & Feedback
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [exported, setExported] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const { user } = await getCurrentUser();
        if (user && isMounted) {
          setEmail(user.email || '');
          setName(
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            ''
          );
        }

        const { data: profile } = await getCurrentProfile();
        if (profile && isMounted) {
          if (profile.display_name) setName(profile.display_name);
          if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
        }

        const { data: settings } = await getCurrentUserSettings();
        if (settings && isMounted) {
          if (settings.base_currency) setBaseCurrency(settings.base_currency);
          if (settings.locale) setLocale(settings.locale);
          if (settings.timezone) setTimezone(settings.timezone);
          if (settings.theme) setAppearanceTheme(settings.theme);
        }
      } catch (err) {
        console.debug('Failed to load user settings', err);
      } finally {
        if (isMounted) setIsPageLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);

    try {
      // 1. Update profile
      const { error: profileError } = await updateCurrentProfile({
        display_name: name,
      });

      // 2. Update user_settings
      const { error: settingsError } = await updateCurrentUserSettings({
        base_currency: baseCurrency,
        locale,
        timezone,
        theme: appearanceTheme,
      });

      if (profileError || settingsError) {
        const errorDetail =
          profileError?.message ||
          settingsError?.message ||
          'Không thể cập nhật thông tin trong cơ sở dữ liệu.';
        setErrorMessage(`Lỗi lưu cài đặt: ${errorDetail}`);
        return;
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch {
      setErrorMessage('Không thể lưu cài đặt. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportBackup = () => {
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsPasswordSaving(true);

    try {
      const { error } = await updatePassword(newPassword);

      if (error) {
        setPasswordError(error.message);
        setIsPasswordSaving(false);
        return;
      }

      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch {
      setPasswordError('Không thể cập nhật mật khẩu mới. Vui lòng thử lại.');
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
    router.refresh();
  };

  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'FN';

  return (
    <AppShell>
      <PageHeader
        title="Cài đặt hệ thống"
        subtitle="Quản lý hồ sơ cá nhân, tiền tệ cơ sở, bảo mật và quyền riêng tư."
      />

      {isPageLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6 max-w-4xl pb-10">
          {errorMessage && (
            <div className="p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* User Profile Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">Hồ sơ người dùng</CardTitle>
              </div>
              <CardDescription>
                Thông tin tài khoản và hồ sơ quản lý dưới cơ chế Row Level Security (RLS).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 pb-2">
                <Avatar className="h-16 w-16">
                  {avatarUrl && <AvatarImage src={avatarUrl} />}
                  <AvatarFallback className="text-base font-bold">{initials}</AvatarFallback>
                </Avatar>
                <div className="text-center sm:text-left space-y-1">
                  <p className="text-sm font-semibold text-foreground">{name || 'Người dùng Finora'}</p>
                  <p className="text-xs text-muted-foreground">
                    {email} · Tài khoản đã xác thực
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Họ và tên hiển thị</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email đăng nhập</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="bg-muted text-muted-foreground cursor-not-allowed"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appearance Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Palette className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">Giao diện (Appearance)</CardTitle>
              </div>
              <CardDescription>
                Tùy chỉnh chủ đề sáng, tối hoặc theo cài đặt hệ điều hành.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setAppearanceTheme('light')}
                  className={cn(
                    'flex flex-col items-center justify-center p-3.5 rounded-xl border-2 transition-all',
                    appearanceTheme === 'light'
                      ? 'border-primary bg-primary/5 text-primary font-semibold'
                      : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/40'
                  )}
                >
                  <Sun className="h-5 w-5 mb-1.5" />
                  <span className="text-xs">Sáng (Light)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAppearanceTheme('dark')}
                  className={cn(
                    'flex flex-col items-center justify-center p-3.5 rounded-xl border-2 transition-all',
                    appearanceTheme === 'dark'
                      ? 'border-primary bg-primary/5 text-primary font-semibold'
                      : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/40'
                  )}
                >
                  <Moon className="h-5 w-5 mb-1.5" />
                  <span className="text-xs">Tối (Dark)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAppearanceTheme('system')}
                  className={cn(
                    'flex flex-col items-center justify-center p-3.5 rounded-xl border-2 transition-all',
                    appearanceTheme === 'system'
                      ? 'border-primary bg-primary/5 text-primary font-semibold'
                      : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/40'
                  )}
                >
                  <Laptop className="h-5 w-5 mb-1.5" />
                  <span className="text-xs">Hệ thống (Auto)</span>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Currency & Localization Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Globe className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">Tiền tệ & Khu vực (user_settings)</CardTitle>
              </div>
              <CardDescription>
                Định dạng hiển thị số tiền, tiền tệ cơ sở và múi giờ được lưu trữ vào bảng user_settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="baseCurrency">Tiền tệ cơ sở (Base Currency)</Label>
                  <Select
                    id="baseCurrency"
                    value={baseCurrency}
                    onChange={(e) => setBaseCurrency(e.target.value)}
                    options={[
                      { value: 'VND', label: 'VND (Việt Nam Đồng)' },
                      { value: 'USD', label: 'USD (US Dollar)' },
                      { value: 'EUR', label: 'EUR (Euro)' },
                      { value: 'JPY', label: 'JPY (Japanese Yen)' },
                      { value: 'CNY', label: 'CNY (Chinese Yuan)' },
                      { value: 'KRW', label: 'KRW (Korean Won)' },
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="locale">Định dạng ngôn ngữ & số</Label>
                  <Select
                    id="locale"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                    options={[
                      { value: 'vi-VN', label: 'vi-VN (100.000 ₫)' },
                      { value: 'en-US', label: 'en-US ($100,000)' },
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="timezone">Múi giờ</Label>
                  <Select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    options={[
                      { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (GMT+7)' },
                      { value: 'Asia/Tokyo', label: 'Asia/Tokyo (GMT+9)' },
                      { value: 'America/New_York', label: 'America/New_York (GMT-4)' },
                    ]}
                  />
                </div>
              </div>

              <div className="pt-2 space-y-3 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Tự động quy đổi ngoại tệ tức thời</p>
                    <p className="text-xs text-muted-foreground">
                      Hiển thị giá trị quy đổi sang {baseCurrency} bên cạnh các tài khoản hoặc giao dịch ngoại tệ.
                    </p>
                  </div>
                  <Switch checked={autoFx} onCheckedChange={setAutoFx} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Ẩn số dư nhạy cảm ở nơi công cộng</p>
                    <p className="text-xs text-muted-foreground">
                      Mặc định che số tiền bằng dấu chấm ••• cho đến khi nhấp vào.
                    </p>
                  </div>
                  <Switch checked={maskBalance} onCheckedChange={setMaskBalance} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications Preferences */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">Thông báo & Cảnh báo</CardTitle>
              </div>
              <CardDescription>
                Cấu hình các nhắc nhở tài chính định kỳ và cảnh báo vượt định mức.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Cảnh báo chạm ngưỡng ngân sách (80% - 100%)</p>
                    <p className="text-xs text-muted-foreground">
                      Nhận cảnh báo khi một danh mục chi tiêu sắp hoặc đã vượt hạn mức tháng.
                    </p>
                  </div>
                  <Switch checked={notifyBudgetAlert} onCheckedChange={setNotifyBudgetAlert} />
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <p className="text-sm font-medium text-foreground">Nhắc nhở hóa đơn & khoản chi định kỳ</p>
                    <p className="text-xs text-muted-foreground">
                      Nhắc trước 3 ngày khi sắp đến hạn thanh toán tiền nhà, điện nước, internet...
                    </p>
                  </div>
                  <Switch checked={notifyRecurringBill} onCheckedChange={setNotifyRecurringBill} />
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <p className="text-sm font-medium text-foreground">Cập nhật tiến độ mục tiêu tài chính</p>
                    <p className="text-xs text-muted-foreground">
                      Thông báo khi đạt cột mốc 25%, 50%, 75% hoặc hoàn thành mục tiêu tiết kiệm.
                    </p>
                  </div>
                  <Switch checked={notifyGoalMilestone} onCheckedChange={setNotifyGoalMilestone} />
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <p className="text-sm font-medium text-foreground">Báo cáo tổng kết tuần & tháng</p>
                    <p className="text-xs text-muted-foreground">
                      Gửi tóm tắt dòng tiền vào mỗi sáng thứ Hai đầu tuần.
                    </p>
                  </div>
                  <Switch checked={notifyWeeklySummary} onCheckedChange={setNotifyWeeklySummary} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Assistant Preferences */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">Trợ lý AI Gemini</CardTitle>
              </div>
              <CardDescription>
                Tùy chọn xử lý ngôn ngữ tự nhiên, phân loại giao dịch và gợi ý tài chính thông minh.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b">
                <div>
                  <p className="text-sm font-medium text-foreground">Kích hoạt tính năng AI</p>
                  <p className="text-xs text-muted-foreground">
                    Hỗ trợ nhập giao dịch bằng tiếng Việt tự nhiên và phân tích tài chính.
                  </p>
                </div>
                <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
              </div>

              {aiEnabled && (
                <div className="space-y-4 pt-1">
                  <div className="space-y-1.5">
                    <Label>Nguồn khóa API (Credential Source)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setAiCredentialSource('ADMIN')}
                        className={cn(
                          'p-3 rounded-lg border text-left transition-all',
                          aiCredentialSource === 'ADMIN'
                            ? 'border-primary bg-primary/5 text-foreground'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                        )}
                      >
                        <p className="text-xs font-semibold text-foreground">Khóa do quản trị viên cấp</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Mặc định an toàn, không cần cấu hình thêm API key cá nhân.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAiCredentialSource('PERSONAL')}
                        className={cn(
                          'p-3 rounded-lg border text-left transition-all',
                          aiCredentialSource === 'PERSONAL'
                            ? 'border-primary bg-primary/5 text-foreground'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                        )}
                      >
                        <p className="text-xs font-semibold text-foreground">Sử dụng Google AI API key riêng</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Dành cho người dùng kỹ thuật muốn tự quản lý quota Gemini.
                        </p>
                      </button>
                    </div>
                  </div>

                  {aiCredentialSource === 'PERSONAL' && (
                    <div className="space-y-2 p-3.5 rounded-lg border bg-muted/20">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="apiKey" className="flex items-center space-x-1.5">
                          <KeyRound className="h-3.5 w-3.5 text-primary" />
                          <span>Google Gemini API Key (Bản xem trước giao diện)</span>
                        </Label>
                        <span className="text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded">
                          Preview only
                        </span>
                      </div>
                      <Input
                        id="apiKey"
                        type="password"
                        value="••••••••••••••••••••••••"
                        disabled
                        className="font-mono text-xs bg-muted text-muted-foreground cursor-not-allowed"
                      />
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        UI preview only — Cơ chế mã hóa và lưu trữ an toàn trên server-side sẽ được triển khai ở Phase 11 (AI Credentials).
                      </p>
                    </div>
                  )}

                  <div className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-900 text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">Lưu ý kiến trúc Finora AI:</p>
                    <p>
                      Finora hoạt động độc lập không phụ thuộc hoàn toàn vào AI. Nếu mất kết nối Gemini, các chức năng ghi chép, ngân sách, chuyển tiền vẫn hoạt động chính xác 100%.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security & Password */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Lock className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">Bảo mật & Mật khẩu</CardTitle>
              </div>
              <CardDescription>
                Cập nhật mật khẩu tài khoản và quản lý đăng xuất an toàn.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {passwordError && (
                <div className="p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 text-xs bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-lg flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Mật khẩu của bạn đã được cập nhật thành công!</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="newPass">Mật khẩu mới</Label>
                  <Input
                    id="newPass"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự"
                    disabled={isPasswordSaving}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confPass">Xác nhận mật khẩu</Label>
                  <Input
                    id="confPass"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    disabled={isPasswordSaving}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">
                  Mật khẩu bảo vệ tài khoản Supabase Auth của bạn.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePasswordChange}
                  disabled={!newPassword || !confirmPassword || isPasswordSaving}
                >
                  {isPasswordSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Đang cập nhật...
                    </>
                  ) : (
                    'Cập nhật mật khẩu'
                  )}
                </Button>
              </div>

              {/* Sign out section */}
              <div className="pt-4 border-t flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Đăng xuất khỏi thiết bị</p>
                  <p className="text-xs text-muted-foreground">
                    Xóa phiên đăng nhập an toàn và quay về màn hình đăng nhập.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4 mr-1.5" />
                  Đăng xuất
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Data Portability & Export */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">Dữ liệu & Quyền riêng tư</CardTitle>
              </div>
              <CardDescription>
                Bạn hoàn toàn làm chủ dữ liệu tài chính cá nhân của mình.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border bg-muted/20">
                <div>
                  <p className="text-sm font-medium text-foreground">Xuất bản sao lưu dữ liệu (JSON / CSV)</p>
                  <p className="text-xs text-muted-foreground">
                    Tải về toàn bộ tài khoản, giao dịch, ngân sách và mục tiêu dưới định dạng chuẩn mở.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={handleExportBackup}
                  className="shrink-0"
                >
                  {exported ? (
                    <>
                      <Check className="h-4 w-4 mr-1.5 text-emerald-600" />
                      Đã tải bản sao lưu
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-1.5" />
                      Tải bản sao lưu
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Action Button */}
          <div className="flex items-center justify-between pt-2">
            {saveSuccess ? (
              <span className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Đã lưu cài đặt thành công!
              </span>
            ) : (
              <span />
            )}

            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                'Lưu thay đổi cài đặt'
              )}
            </Button>
          </div>
        </form>
      )}
    </AppShell>
  );
}
