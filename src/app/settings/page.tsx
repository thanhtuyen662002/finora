"use client";

import React, { useState } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  // User Profile
  const [name, setName] = useState('Võ Thanh Tuyền');
  const [email, setEmail] = useState('thanhtuyen662002@gmail.com');

  // Currency & Region
  const [baseCurrency, setBaseCurrency] = useState('VND');
  const [locale, setLocale] = useState('vi-VN');
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
  const [maskBalance, setMaskBalance] = useState(false);
  const [autoFx, setAutoFx] = useState(true);

  // Appearance
  const [appearanceTheme, setAppearanceTheme] = useState<'light' | 'dark' | 'system'>('system');

  // Notifications
  const [notifyBudgetAlert, setNotifyBudgetAlert] = useState(true);
  const [notifyRecurringBill, setNotifyRecurringBill] = useState(true);
  const [notifyGoalMilestone, setNotifyGoalMilestone] = useState(true);
  const [notifyWeeklySummary, setNotifyWeeklySummary] = useState(false);

  // AI Configuration
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiCredentialSource, setAiCredentialSource] = useState<'ADMIN' | 'PERSONAL'>('ADMIN');
  const [personalApiKey, setPersonalApiKey] = useState('AIzaSyD892kLqP098234KlmnOpQrStUvWxYz');

  // Security
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status & Feedback
  const [saved, setSaved] = useState(false);
  const [exported, setExported] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleExportBackup = () => {
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    setPasswordUpdated(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordUpdated(false), 2500);
  };

  return (
    <AppShell>
      <PageHeader
        title="Cài đặt hệ thống"
        subtitle="Quản lý hồ sơ cá nhân, giao diện, thông báo, trợ lý AI và bảo mật."
      />

      <form onSubmit={handleSave} className="space-y-6 max-w-4xl pb-10">
        {/* User Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">Hồ sơ người dùng</CardTitle>
            </div>
            <CardDescription>
              Thông tin hiển thị trên không gian tài chính cá nhân của bạn.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 pb-2">
              <Avatar className="h-16 w-16">
                <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80" />
                <AvatarFallback>TT</AvatarFallback>
              </Avatar>
              <div className="text-center sm:text-left space-y-1">
                <Button variant="outline" size="sm" type="button">
                  Thay đổi ảnh đại diện
                </Button>
                <p className="text-xs text-muted-foreground">
                  Hỗ trợ JPG, PNG định dạng nhỏ hơn 2MB.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Họ và tên</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email tài khoản</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
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
              <CardTitle className="text-base font-semibold">Tiền tệ & Khu vực</CardTitle>
            </div>
            <CardDescription>
              Định dạng hiển thị số tiền, tiền tệ cơ sở và múi giờ.
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
                    Hiển thị giá trị quy đổi sang VND bên cạnh các tài khoản hoặc giao dịch ngoại tệ.
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

        {/* Notifications Mock Preferences */}
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
                  <div className="space-y-1.5 p-3.5 rounded-lg border bg-muted/20">
                    <Label htmlFor="apiKey" className="flex items-center space-x-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-primary" />
                      <span>Google Gemini API Key (Mô phỏng giao diện)</span>
                    </Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={personalApiKey}
                      onChange={(e) => setPersonalApiKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Khóa API được mã hóa và chỉ lưu trữ trên server-side. Không bao giờ gửi về client bundle.
                    </p>
                  </div>
                )}

                <div className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-900 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground">Lưu ý kiến trúc Finora AI (Phase 1 Mock):</p>
                  <p>
                    Finora hoạt động độc lập không phụ thuộc hoàn toàn vào AI. Nếu mất kết nối Gemini, các chức năng ghi chép, ngân sách, chuyển tiền vẫn hoạt động chính xác 100%.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security & Sessions */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Lock className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">Bảo mật & Phiên đăng nhập</CardTitle>
            </div>
            <CardDescription>
              Đổi mật khẩu tài khoản và quản lý các thiết bị đang truy cập.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="curPass">Mật khẩu hiện tại</Label>
                <Input
                  id="curPass"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="newPass">Mật khẩu mới</Label>
                <Input
                  id="newPass"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confPass">Xác nhận mật khẩu</Label>
                <Input
                  id="confPass"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                Xác thực 2 yếu tố (2FA / OTP): <span className="text-amber-600 dark:text-amber-400 font-medium">Dự kiến triển khai ở Phase 2 (Supabase Auth)</span>
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePasswordChange}
                disabled={!currentPassword || !newPassword}
              >
                {passwordUpdated ? 'Đã cập nhật' : 'Đổi mật khẩu'}
              </Button>
            </div>

            {/* Active Sessions Preview */}
            <div className="pt-3 border-t space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Thiết bị đang đăng nhập (Active Sessions)
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs">
                  <div className="flex items-center space-x-2.5">
                    <Laptop className="h-4 w-4 text-emerald-600" />
                    <div>
                      <p className="font-semibold text-foreground">Chrome trên macOS (Mô phỏng)</p>
                      <p className="text-[11px] text-muted-foreground">TP. Hồ Chí Minh, Việt Nam · Đang hoạt động</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    Hiện tại
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs">
                  <div className="flex items-center space-x-2.5">
                    <Smartphone className="h-4 w-4 text-slate-500" />
                    <div>
                      <p className="font-semibold text-foreground">Safari trên iPhone 15 Pro (PWA Mock)</p>
                      <p className="text-[11px] text-muted-foreground">TP. Hồ Chí Minh · Hoạt động 2 giờ trước</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" type="button" className="h-7 text-xs text-red-600 hover:text-red-700">
                    Đăng xuất
                  </Button>
                </div>
              </div>
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
          {saved ? (
            <span className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Đã lưu cài đặt thành công!
            </span>
          ) : (
            <span />
          )}

          <Button type="submit">
            Lưu thay đổi cài đặt
          </Button>
        </div>
      </form>
    </AppShell>
  );
}

