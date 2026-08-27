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
import { ShieldCheck, Download, Trash2, Globe, User, Palette, CheckCircle2, Lock } from 'lucide-react';

export default function SettingsPage() {
  const [name, setName] = useState('Võ Thanh Tuyền');
  const [email, setEmail] = useState('thanhtuyen@finora.me');
  const [baseCurrency, setBaseCurrency] = useState('VND');
  const [locale, setLocale] = useState('vi-VN');
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
  const [theme, setTheme] = useState('light');
  const [maskBalance, setMaskBalance] = useState(false);
  const [autoFx, setAutoFx] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <AppShell>
      <PageHeader
        title="Cài đặt hệ thống"
        subtitle="Quản lý hồ sơ cá nhân, tiền tệ quy chuẩn và thiết lập bảo mật."
      />

      <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
        {/* User Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">Hồ sơ người dùng</CardTitle>
            </div>
            <CardDescription>
              Thông tin hiển thị trên không gian tài chính của bạn.
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
                <Label htmlFor="email">Email</Label>
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
                    Hiển thị giá trị quy đổi sang VND bên cạnh các tài khoản hoặc giao dịch USD.
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
                  Tải về toàn bộ tài khoản, giao dịch, ngân sách và mục tiêu.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => alert('Xuất bản sao lưu Finora JSON thành công')}
                className="shrink-0"
              >
                <Download className="h-4 w-4 mr-1.5" />
                Tải bản sao lưu
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
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
