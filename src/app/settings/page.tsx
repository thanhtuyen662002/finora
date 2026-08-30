"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
  CheckCircle2,
  Lock,
  Bell,
  Sparkles,
  KeyRound,
  Check,
  Loader2,
  AlertCircle,
  LogOut,
  Palette,
} from 'lucide-react';
import {
  getCurrentUser,
  getCurrentProfile,
  getCurrentUserSettings,
  updateCurrentProfile,
  updateCurrentUserSettings,
  updatePassword,
  signOut,
} from '@/lib/auth';

const SUPPORTED_CURRENCIES = [
  { value: 'VND', label: 'VND - Đồng Việt Nam (₫)' },
  { value: 'USD', label: 'USD - Đô la Mỹ ($)' },
  { value: 'EUR', label: 'EUR - Euro (€)' },
  { value: 'JPY', label: 'JPY - Yên Nhật (¥)' },
  { value: 'CNY', label: 'CNY - Nhân dân tệ (¥)' },
  { value: 'KRW', label: 'KRW - Won Hàn Quốc (₩)' },
];

const COMMON_TIMEZONES = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Việt Nam (GMT+7)' },
  { value: 'Asia/Bangkok', label: 'Thái Lan (GMT+7)' },
  { value: 'Asia/Singapore', label: 'Singapore (GMT+8)' },
  { value: 'Asia/Tokyo', label: 'Nhật Bản (GMT+9)' },
  { value: 'America/New_York', label: 'New York (GMT-4)' },
  { value: 'Europe/London', label: 'Luân Đôn (GMT+0)' },
];

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
  const [hasAutoFxSchema, setHasAutoFxSchema] = useState(true);

  // Theme
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  // Notifications
  const [notifyBudgetAlert, setNotifyBudgetAlert] = useState(true);
  const [notifyRecurringBill, setNotifyRecurringBill] = useState(true);
  const [notifyGoalMilestone, setNotifyGoalMilestone] = useState(true);

  // AI Configuration
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

          if (settings.auto_fx_enabled !== undefined) {
            setAutoFx(settings.auto_fx_enabled);
            setHasAutoFxSchema(true);
          } else {
            setAutoFx(false);
            setHasAutoFxSchema(false);
          }
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
      const { error: profileError } = await updateCurrentProfile({
        display_name: name,
      });

      const settingsUpdates: any = {
        base_currency: baseCurrency,
        locale,
        timezone,
      };

      if (hasAutoFxSchema) {
        settingsUpdates.auto_fx_enabled = autoFx;
      }

      const { error: settingsError } = await updateCurrentUserSettings(settingsUpdates);

      if (profileError || settingsError) {
        const errorDetail =
          profileError?.message ||
          settingsError?.message ||
          'Không thể cập nhật thông tin cài đặt.';
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
      <div className="max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="Cài đặt"
          subtitle="Quản lý hồ sơ cá nhân, tiền tệ mặc định, bảo mật và tùy chọn ứng dụng."
        />

        {isPageLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6 pb-10">
            {errorMessage && (
              <div className="p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* User Profile Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <User className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-semibold">Hồ sơ người dùng</CardTitle>
                  </div>
                  <CardDescription>
                    Thông tin tài khoản người dùng và thông tin cá nhân.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 pb-2">
                    <Avatar className="h-14 w-14">
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

                  <div className="space-y-3">
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

              {/* Theme Settings */}
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Palette className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-semibold">Giao diện</CardTitle>
                  </div>
                  <CardDescription>
                    Tùy chỉnh chế độ hiển thị giao diện sáng hoặc tối.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`p-3 rounded-lg border text-center text-xs ${
                        theme === 'light'
                          ? 'border-primary bg-primary/5 font-semibold text-foreground'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      Sáng
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`p-3 rounded-lg border text-center text-xs ${
                        theme === 'dark'
                          ? 'border-primary bg-primary/5 font-semibold text-foreground'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      Tối
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('system')}
                      className={`p-3 rounded-lg border text-center text-xs ${
                        theme === 'system'
                          ? 'border-primary bg-primary/5 font-semibold text-foreground'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      Theo hệ thống
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Currency & Regional Preferences */}
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Globe className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-semibold">Tiền tệ & khu vực</CardTitle>
                  </div>
                  <CardDescription>
                    Cấu hình đơn vị tiền tệ chính và cài đặt hiển thị khu vực.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="baseCurrency">Tiền tệ cơ sở</Label>
                      <Select
                        id="baseCurrency"
                        value={baseCurrency}
                        onChange={(e) => setBaseCurrency(e.target.value)}
                        options={SUPPORTED_CURRENCIES}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="locale">Định dạng hiển thị số</Label>
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
                        options={COMMON_TIMEZONES}
                      />
                    </div>
                  </div>

                  <div className="pt-2 space-y-3 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground font-sans">Tự động quy đổi ngoại tệ</p>
                        <p className="text-xs text-muted-foreground">
                          Quy đổi sang {baseCurrency} đối với các tài khoản ngoại tệ.
                        </p>
                      </div>
                      {hasAutoFxSchema && (
                        <Switch checked={autoFx} onCheckedChange={setAutoFx} />
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Che số dư công cộng</p>
                        <p className="text-xs text-muted-foreground">
                          Ẩn các con số tài chính ở giao diện chính.
                        </p>
                      </div>
                      <Switch checked={maskBalance} onCheckedChange={setMaskBalance} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Categories Management Navigation Card */}
            <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => router.push('/settings/categories')}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Palette className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-semibold">Danh mục thu chi</CardTitle>
                  </div>
                  <Button variant="ghost" size="sm" type="button">
                    Quản lý danh mục &rarr;
                  </Button>
                </div>
                <CardDescription>
                  Tùy chỉnh danh mục phân loại giao dịch thu/chi của bạn.
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Notifications Preferences */}
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Bell className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-semibold">Thông báo & Cảnh báo</CardTitle>
                  </div>
                  <CardDescription>
                    Cấu hình các nhắc nhở tài chính định kỳ và cảnh báo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between opacity-60">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">Cảnh báo ngưỡng ngân sách</p>
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">Sắp hỗ trợ</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Nhắc nhở khi danh mục chi tiêu chạm hạn mức.
                      </p>
                    </div>
                    <Switch checked={false} disabled />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t opacity-60">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">Nhắc nhở khoản chi định kỳ</p>
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">Sắp hỗ trợ</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Nhắc trước 3 ngày khi sắp đến hạn thanh toán.
                      </p>
                    </div>
                    <Switch checked={false} disabled />
                  </div>
                </CardContent>
              </Card>

              {/* AI Assistant Preferences */}
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-semibold">Trợ lý AI</CardTitle>
                  </div>
                  <CardDescription>
                    Tùy chọn xử lý ngôn ngữ tự nhiên và gợi ý thông minh.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between opacity-60">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">Kích hoạt tính năng AI</p>
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">Sắp hỗ trợ</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Hỗ trợ nhập giao dịch tự nhiên và phân tích.
                      </p>
                    </div>
                    <Switch checked={false} disabled />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Security & Password */}
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Lock className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-semibold font-sans">Bảo mật & Mật khẩu</CardTitle>
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
                    Cập nhật mật khẩu đăng nhập cá nhân.
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
                  Tùy chọn tải bản sao lưu dữ liệu cá nhân.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border bg-muted/20">
                  <div>
                    <p className="text-sm font-medium text-foreground">Xuất bản sao lưu dữ liệu</p>
                    <p className="text-xs text-muted-foreground">
                      Tải về toàn bộ tài khoản và giao dịch dưới định dạng chuẩn.
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
      </div>
    </AppShell>
  );
}

