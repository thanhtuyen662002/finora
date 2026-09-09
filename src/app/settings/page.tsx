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
import { applyTheme } from '@/lib/theme';
import { useBalanceVisibility } from '@/features/preferences';
import { buildUserBackup, downloadBackupFile } from '@/features/backup';
import {
  getMyAiCredentialMetadata,
  saveMyPersonalAiCredential,
  revokeMyPersonalAiCredential,
} from '@/features/ai/credentials/actions';
import type { AiCredentialSafeMetadata } from '@/features/ai/credentials/types';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/features/notifications';

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
  const { maskBalance, setMaskBalance } = useBalanceVisibility();

  // User Profile
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Currency & Region
  const [baseCurrency, setBaseCurrency] = useState('VND');
  const [locale, setLocale] = useState('vi-VN');
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
  const [autoFx, setAutoFx] = useState(true);
  const [hasAutoFxSchema, setHasAutoFxSchema] = useState(true);

  // Theme
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  // Notifications
  const [notifyBudgetAlert, setNotifyBudgetAlert] = useState(true);
  const [notifyRecurringBill, setNotifyRecurringBill] = useState(true);

  // AI Credential Configuration (Phase 11)
  const [aiMetadata, setAiMetadata] = useState<AiCredentialSafeMetadata | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(true);
  const [personalApiKeyInput, setPersonalApiKeyInput] = useState('');
  const [isSavingAiKey, setIsSavingAiKey] = useState(false);
  const [isRevokingAiKey, setIsRevokingAiKey] = useState(false);
  const [aiActionError, setAiActionError] = useState<string | null>(null);
  const [aiActionSuccess, setAiActionSuccess] = useState<string | null>(null);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [isConfirmingRevoke, setIsConfirmingRevoke] = useState(false);

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
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [backupExportMessage, setBackupExportMessage] = useState<string | null>(null);
  const [backupExportError, setBackupExportError] = useState<string | null>(null);

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
          if (settings.mask_balance !== undefined) setMaskBalance(settings.mask_balance);
          if (settings.theme) {
            const savedTheme = settings.theme as 'light' | 'dark' | 'system';
            setTheme(savedTheme);
            applyTheme(savedTheme);
          }

          if (settings.auto_fx_enabled !== undefined) {
            setAutoFx(settings.auto_fx_enabled);
            setHasAutoFxSchema(true);
          } else {
            setAutoFx(false);
            setHasAutoFxSchema(false);
          }
        }

        try {
          const notificationPreferences = await getNotificationPreferences();
          if (isMounted) {
            setNotifyBudgetAlert(notificationPreferences.budget_alerts_enabled);
            setNotifyRecurringBill(notificationPreferences.recurring_reminders_enabled);
          }
        } catch {
          // Notification preferences are optional until the Phase 13C migration is available.
        }

        try {
          const aiRes = await getMyAiCredentialMetadata();
          if (aiRes.ok && isMounted) {
            setAiMetadata(aiRes.metadata);
          }
        } catch {
          // Graceful non-blocking fallback if credentials unconfigured
        } finally {
          if (isMounted) setIsAiLoading(false);
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

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

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
        theme,
        mask_balance: maskBalance,
      };

      if (hasAutoFxSchema) {
        settingsUpdates.auto_fx_enabled = autoFx;
      }

      const { error: settingsError } = await updateCurrentUserSettings(settingsUpdates);

      let notificationError: Error | null = null;
      try {
        await updateNotificationPreferences({
          budget_alerts_enabled: notifyBudgetAlert,
          recurring_reminders_enabled: notifyRecurringBill,
        });
      } catch (err) {
        notificationError = err instanceof Error ? err : new Error('Không thể cập nhật tùy chọn thông báo.');
      }

      if (profileError || settingsError || notificationError) {
        const errorDetail =
          profileError?.message ||
          settingsError?.message ||
          notificationError?.message ||
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

  const handleExportBackup = async () => {
    setBackupExportError(null);
    setBackupExportMessage(null);
    setIsExportingBackup(true);

    try {
      const backup = await buildUserBackup();
      downloadBackupFile(backup);
      setBackupExportMessage('Đã tạo bản sao lưu JSON. Hãy lưu tệp ở nơi an toàn.');
      setTimeout(() => setBackupExportMessage(null), 5000);
    } catch (error) {
      setBackupExportError(
        error instanceof Error
          ? error.message
          : 'Không thể tạo bản sao lưu. Vui lòng thử lại.'
      );
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
    router.refresh();
  };

  const handleSavePersonalAiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiActionError(null);
    setAiActionSuccess(null);

    const trimmed = personalApiKeyInput.trim();
    if (!trimmed) {
      setAiActionError('Vui lòng nhập khóa API Google Gemini hợp lệ.');
      return;
    }

    setIsSavingAiKey(true);
    try {
      const res = await saveMyPersonalAiCredential(trimmed);
      if (res.ok) {
        setPersonalApiKeyInput('');
        setAiMetadata(res.metadata);
        setShowKeyInput(false);
        setAiActionSuccess('Đã lưu và mã hóa khóa Google Gemini cá nhân thành công.');
        setTimeout(() => setAiActionSuccess(null), 4000);
      } else {
        setAiActionError(res.message);
      }
    } catch {
      setAiActionError('Không thể lưu khóa API vào lúc này. Vui lòng thử lại sau.');
    } finally {
      setIsSavingAiKey(false);
    }
  };

  const handleRevokePersonalAiKey = async () => {
    setAiActionError(null);
    setAiActionSuccess(null);
    setIsRevokingAiKey(true);

    try {
      const res = await revokeMyPersonalAiCredential();
      if (res.ok) {
        setAiMetadata(res.metadata);
        setIsConfirmingRevoke(false);
        setShowKeyInput(false);
        setAiActionSuccess('Đã xóa khóa cá nhân thành công.');
        setTimeout(() => setAiActionSuccess(null), 4000);
      } else {
        setAiActionError(res.message);
      }
    } catch {
      setAiActionError('Không thể xóa khóa cá nhân vào lúc này. Vui lòng thử lại sau.');
    } finally {
      setIsRevokingAiKey(false);
    }
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
              <div className="finora-notice-error p-3 text-xs border rounded-lg flex items-start gap-2" role="alert">
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
                      onClick={() => handleThemeChange('light')}
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
                      onClick={() => handleThemeChange('dark')}
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
                      onClick={() => handleThemeChange('system')}
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
                          Ẩn số dư tài khoản và các tổng số tiền khi bạn trình chiếu hoặc chia sẻ màn hình.
                        </p>
                      </div>
                      <Switch
                        checked={maskBalance}
                        onCheckedChange={setMaskBalance}
                        aria-label="Che số dư công cộng"
                      />
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
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-2">
                      <Bell className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base font-semibold">Thông báo & Cảnh báo</CardTitle>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => router.push('/notifications')}
                    >
                      Xem thông báo
                    </Button>
                  </div>
                  <CardDescription>
                    Bật các cảnh báo trong ứng dụng. Finora không gửi email/push và không tự tạo giao dịch.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">Cảnh báo ngưỡng ngân sách</p>
                      <p className="text-xs text-muted-foreground">
                        Hiển thị khi chi tiêu của danh mục đạt từ 80% hạn mức tháng.
                      </p>
                    </div>
                    <Switch
                      checked={notifyBudgetAlert}
                      onCheckedChange={setNotifyBudgetAlert}
                      aria-label="Bật cảnh báo ngưỡng ngân sách"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-2 border-t">
                    <div>
                      <p className="text-sm font-medium text-foreground">Nhắc nhở khoản chi định kỳ</p>
                      <p className="text-xs text-muted-foreground">
                        Hiển thị trước tối đa 3 ngày khi khoản chi định kỳ sắp đến hạn.
                      </p>
                    </div>
                    <Switch
                      checked={notifyRecurringBill}
                      onCheckedChange={setNotifyRecurringBill}
                      aria-label="Bật nhắc nhở khoản chi định kỳ"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* AI Credentials Configuration (Phase 11) */}
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <KeyRound className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-semibold">Khóa truy cập AI (AI Credentials)</CardTitle>
                  </div>
                  <CardDescription>
                    Quản lý khóa API Google Gemini cá nhân. Toàn bộ khóa được mã hóa an toàn server-side với AES-256-GCM.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {aiActionError && (
                    <div className="finora-notice-error p-3 text-xs border rounded-lg flex items-start gap-2" role="alert">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{aiActionError}</span>
                    </div>
                  )}

                  {aiActionSuccess && (
                    <div className="finora-notice-success p-3 text-xs border rounded-lg flex items-start gap-2" role="status">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{aiActionSuccess}</span>
                    </div>
                  )}

                  {/* Priority and Active Resolution Status */}
                  <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                          Nguồn khóa đang áp dụng
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Thứ tự ưu tiên tự động: Khóa cá nhân &gt; Khóa do Admin cấp &gt; Khóa mặc định hệ thống.
                        </p>
                      </div>
                      <div className="shrink-0">
                        {isAiLoading ? (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Đang kiểm tra...</span>
                          </div>
                        ) : aiMetadata?.activeResolvedSource === 'PERSONAL' ? (
                          <span className="finora-notice-success inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium" role="status">
                            Khóa cá nhân (Active)
                          </span>
                        ) : aiMetadata?.activeResolvedSource === 'ADMIN_ASSIGNED' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sky-500/10 text-sky-600 border border-sky-500/20">
                            Được Admin cấp (Active)
                          </span>
                        ) : aiMetadata?.activeResolvedSource === 'SYSTEM' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                            Khóa mặc định hệ thống (Active)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border">
                            Chưa cấu hình
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Personal Key Management */}
                  <div className="pt-2 border-t space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">Khóa Google Gemini cá nhân</p>
                        <p className="text-xs text-muted-foreground">
                          {aiMetadata?.hasPersonalCredential
                            ? `Đã cấu hình an toàn (kết thúc bằng: •••• ${aiMetadata.personalKeyHint})`
                            : 'Chưa cấu hình khóa cá nhân.'}
                        </p>
                      </div>

                      {!showKeyInput && !isConfirmingRevoke && (
                        <div className="flex items-center gap-2">
                          {aiMetadata?.hasPersonalCredential ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setShowKeyInput(true);
                                  setAiActionError(null);
                                }}
                              >
                                Thay thế khóa
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setIsConfirmingRevoke(true)}
                              >
                                Xóa khóa
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowKeyInput(true);
                                setAiActionError(null);
                              }}
                            >
                              Thêm khóa cá nhân
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Revoke confirmation block */}
                    {isConfirmingRevoke && (
                      <div className="finora-notice-warning p-3 border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2" role="alert">
                        <span className="text-xs font-medium">
                          Xác nhận xóa khóa API cá nhân khỏi tài khoản?
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={isRevokingAiKey}
                            onClick={handleRevokePersonalAiKey}
                          >
                            {isRevokingAiKey ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Đang xóa...
                              </>
                            ) : (
                              'Xác nhận xóa'
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isRevokingAiKey}
                            onClick={() => setIsConfirmingRevoke(false)}
                          >
                            Hủy
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Input form for adding/replacing key */}
                    {showKeyInput && (
                      <div className="p-3 border rounded-lg bg-card space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="personalAiKey" className="text-xs">
                            Nhập khóa Google Gemini API
                          </Label>
                          <Input
                            id="personalAiKey"
                            type="password"
                            autoComplete="off"
                            placeholder="AIzaSy..."
                            value={personalApiKeyInput}
                            onChange={(e) => setPersonalApiKeyInput(e.target.value)}
                            disabled={isSavingAiKey}
                            className="font-mono text-xs"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Khóa của bạn sẽ được mã hóa bằng AES-256-GCM trên server trước khi lưu trữ. Không bao giờ lưu trữ dạng văn bản thuần.
                          </p>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isSavingAiKey}
                            onClick={() => {
                              setShowKeyInput(false);
                              setPersonalApiKeyInput('');
                              setAiActionError(null);
                            }}
                          >
                            Hủy
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={!personalApiKeyInput.trim() || isSavingAiKey}
                            onClick={handleSavePersonalAiKey}
                          >
                            {isSavingAiKey ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                Đang mã hóa và lưu...
                              </>
                            ) : (
                              'Lưu khóa cá nhân'
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Read-only status for Admin-Assigned & System keys */}
                  <div className="pt-2 border-t space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1">
                      <span className="text-muted-foreground">Khóa do Admin cấp cho tài khoản:</span>
                      <span className="font-medium text-foreground">
                        {aiMetadata?.hasAdminAssignedCredential
                          ? `Đã cấp (kết thúc: •••• ${aiMetadata.adminAssignedKeyHint})`
                          : 'Không có'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-muted-foreground">Khóa mặc định toàn hệ thống:</span>
                      <span className="font-medium text-foreground">
                        {aiMetadata?.hasSystemKeyConfigured
                          ? 'Sẵn sàng trên máy chủ'
                          : 'Chưa cấu hình'}
                      </span>
                    </div>
                  </div>

                  {/* Truthful Phase 11 Readiness Statement */}
                  <div className="pt-2 border-t">
                    <p className="text-[11px] text-muted-foreground italic">
                      Lưu ý: Khóa AI đã được lưu trữ và mã hóa an toàn với AES-256-GCM. Các tính năng tài chính AI (bóc tách giao dịch, phân loại, giải thích) sẽ được kích hoạt ở giai đoạn tiếp theo (Phase 12).
                    </p>
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
                  <div className="finora-notice-error p-3 text-xs border rounded-lg flex items-start gap-2" role="alert">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{passwordError}</span>
                  </div>
                )}

                {passwordSuccess && (
                  <div className="finora-notice-success p-3 text-xs border rounded-lg flex items-start gap-2" role="status">
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
                {backupExportError && (
                  <div className="finora-notice-error p-3 text-xs border rounded-lg flex items-start gap-2" role="alert">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{backupExportError}</span>
                  </div>
                )}
                {backupExportMessage && (
                  <div className="finora-notice-success p-3 text-xs border rounded-lg flex items-start gap-2" role="status">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{backupExportMessage}</span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border bg-muted/20">
                  <div>
                    <p className="text-sm font-medium text-foreground">Xuất bản sao lưu dữ liệu</p>
                    <p className="text-xs text-muted-foreground">
                      Tải JSON gồm tài khoản, giao dịch, ngân sách, mục tiêu, khoản nợ và tùy chọn ứng dụng. Không bao gồm khóa AI.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={isExportingBackup}
                    onClick={handleExportBackup}
                    className="shrink-0"
                  >
                    {isExportingBackup ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        Đang tạo bản sao...
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
                <span className="finora-notice-success inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold" role="status">
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
