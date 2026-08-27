"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  MOCK_ADMIN_METRICS,
  MOCK_ADMIN_USERS,
  MOCK_FX_RATES,
  MOCK_FEATURE_FLAGS,
} from '@/lib/mock/admin';
import { formatMoney } from '@/lib/money/format';
import {
  ShieldCheck,
  Users,
  Cpu,
  Globe,
  Sliders,
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Edit2,
  Lock,
} from 'lucide-react';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [flags, setFlags] = useState(MOCK_FEATURE_FLAGS);
  const [selectedModelParser, setSelectedModelParser] = useState('gemini-2.5-flash');
  const [selectedModelChat, setSelectedModelChat] = useState('gemini-2.5-pro');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState(false);
  const [fxSyncFeedback, setFxSyncFeedback] = useState(false);

  const toggleFlag = (key: string) => {
    setFlags((prev) =>
      prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f))
    );
  };

  const handleSaveAIConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleInviteUser = () => {
    setInviteFeedback(true);
    setTimeout(() => setInviteFeedback(false), 2500);
  };

  const handleSyncFx = () => {
    setFxSyncFeedback(true);
    setTimeout(() => setFxSyncFeedback(false), 2500);
  };

  return (
    <AppShell>
      <PageHeader
        title="Quản trị hệ thống (Admin Shell)"
        subtitle="Cấu hình hệ thống, AI Provider, người dùng và tỷ giá hối đoái."
      >
        <Badge variant="outline" className="font-mono text-xs px-2.5 py-1">
          Bản thử nghiệm giao diện Phase 1
        </Badge>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto p-1 gap-1">
          <TabsTrigger value="overview" className="text-xs sm:text-sm py-2">
            <ShieldCheck className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Tổng quan
          </TabsTrigger>
          <TabsTrigger value="users" className="text-xs sm:text-sm py-2">
            <Users className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Người dùng
          </TabsTrigger>
          <TabsTrigger value="ai" className="text-xs sm:text-sm py-2">
            <Cpu className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Cấu hình AI
          </TabsTrigger>
          <TabsTrigger value="fx" className="text-xs sm:text-sm py-2">
            <Globe className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Tỷ giá FX
          </TabsTrigger>
          <TabsTrigger value="flags" className="text-xs sm:text-sm py-2">
            <Sliders className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Feature Flags
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card>
              <CardContent className="p-4 sm:p-5">
                <span className="text-xs text-muted-foreground uppercase font-semibold">
                  Tổng tài khoản người dùng
                </span>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {MOCK_ADMIN_METRICS.totalUsers} thành viên
                </p>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {MOCK_ADMIN_METRICS.activeUsers30d} đang hoạt động 30 ngày
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5">
                <span className="text-xs text-muted-foreground uppercase font-semibold">
                  Tổng lượng giao dịch
                </span>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {MOCK_ADMIN_METRICS.totalTransactions} GD
                </p>
                <span className="text-xs text-muted-foreground">
                  Ghi nhận an toàn & cô lập
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5">
                <span className="text-xs text-muted-foreground uppercase font-semibold">
                  Tổng lượng tiền quy đổi
                </span>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {formatMoney(MOCK_ADMIN_METRICS.totalVolumeVND)}
                </p>
                <span className="text-xs text-muted-foreground">
                  VND & USD chuyển đổi
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5">
                <span className="text-xs text-muted-foreground uppercase font-semibold">
                  Lượt gọi AI Token
                </span>
                <p className="text-2xl font-bold text-primary mt-1">
                  {MOCK_ADMIN_METRICS.aiTokensConsumed.toLocaleString()}
                </p>
                <span className="text-xs text-muted-foreground">
                  {MOCK_ADMIN_METRICS.aiRequestsCount} lượt phân tích
                </span>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Kiến trúc cô lập dữ liệu (Data Isolation Status)
              </CardTitle>
              <CardDescription>
                Mọi tài khoản và giao dịch đều tuân thủ nguyên tắc RLS Invariant: User A không bao giờ thấy User B.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl border bg-muted/30 flex items-start space-x-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground">
                    Supabase Row Level Security (RLS) & PostgreSQL
                  </p>
                  <p>
                    Finora áp dụng chính sách bảo mật đa tầng. Bảng điều khiển quản trị không cho phép xem trộm số dư chi tiết của các tài khoản riêng tư mà chỉ tổng hợp các chỉ số vận hành hệ thống.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Users */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">
                  Danh sách người dùng hệ thống ({MOCK_ADMIN_USERS.length})
                </CardTitle>
                <CardDescription>
                  Quản lý quyền truy cập và phân quyền API Key.
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                {inviteFeedback && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Đã gửi thư mời (Mô phỏng)!
                  </span>
                )}
                <Button size="sm" onClick={handleInviteUser}>
                  Mời thành viên mới
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-3 font-semibold">Người dùng</th>
                      <th className="pb-3 font-semibold">Vai trò</th>
                      <th className="pb-3 font-semibold">Tiền tệ gốc</th>
                      <th className="pb-3 font-semibold">Trạng thái</th>
                      <th className="pb-3 font-semibold">Khóa AI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {MOCK_ADMIN_USERS.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/30">
                        <td className="py-3 pr-2">
                          <div className="font-semibold text-foreground">
                            {u.displayName}
                          </div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={u.role === 'ADMIN' ? 'default' : 'secondary'}
                            className="font-mono text-[10px]"
                          >
                            {u.role}
                          </Badge>
                        </td>
                        <td className="py-3 font-mono font-medium">{u.baseCurrency}</td>
                        <td className="py-3">
                          <span className="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5" />
                            {u.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm khóa'}
                          </span>
                        </td>
                        <td className="py-3 text-xs text-muted-foreground">
                          {u.assignedAiKeyStatus === 'ASSIGNED_BY_ADMIN'
                            ? 'Admin cấp sẵn'
                            : 'Khóa cá nhân'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: AI Configuration */}
        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">
                  Cấu hình AI Provider (Google Gemini)
                </CardTitle>
              </div>
              <CardDescription>
                Tách biệt tầng AI khỏi logic tài chính cốt lõi. Khi AI mất kết nối, toàn bộ tính năng tài chính vẫn hoạt động 100%.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveAIConfig} className="space-y-4 max-w-2xl">
                <div className="space-y-1.5">
                  <Label>Nhà cung cấp AI mặc định</Label>
                  <Input value="Google Gemini API (Vertex / AI Studio)" disabled />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="systemKey">Khóa API mặc định hệ thống (System Key)</Label>
                    <span className="text-xs text-muted-foreground font-mono flex items-center">
                      <Lock className="h-3 w-3 mr-1" />
                      Server Secret Encrypted
                    </span>
                  </div>
                  <Input
                    id="systemKey"
                    value="AIzaSyA8••••••••••••••••••••••••92K"
                    disabled
                    className="font-mono bg-muted"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Khóa hệ thống được bảo mật trong môi trường server, không bao giờ lộ về trình duyệt.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="parserModel">Model bóc tách giao dịch (Parse)</Label>
                    <Select
                      id="parserModel"
                      value={selectedModelParser}
                      onChange={(e) => setSelectedModelParser(e.target.value)}
                      options={[
                        { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash (Nhanh & Tiết kiệm)' },
                        { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro (Độ chính xác cao)' },
                      ]}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="chatModel">Model trợ lý tài chính (Assistant)</Label>
                    <Select
                      id="chatModel"
                      value={selectedModelChat}
                      onChange={(e) => setSelectedModelChat(e.target.value)}
                      options={[
                        { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro (Khuyên dùng)' },
                        { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
                      ]}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3">
                  {savedSuccess ? (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Đã lưu cấu hình AI
                    </span>
                  ) : (
                    <span />
                  )}
                  <Button type="submit">Lưu cấu hình</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: FX Rates */}
        <TabsContent value="fx" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">
                  Tỷ giá tiền tệ hiện tại (FX Rates Engine)
                </CardTitle>
                <CardDescription>
                  Quy đổi ngoại tệ phục vụ định giá tài sản và báo cáo theo tỷ giá thời gian thực.
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                {fxSyncFeedback && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Đã đồng bộ tỷ giá mới nhất!
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncFx}
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Cập nhật tỷ giá
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-3 font-semibold">Cặp tiền</th>
                      <th className="pb-3 font-semibold">Tỷ giá hiện tại (VND)</th>
                      <th className="pb-3 font-semibold">Nguồn dữ liệu</th>
                      <th className="pb-3 font-semibold">Cập nhật lúc</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {MOCK_FX_RATES.map((rate) => (
                      <tr key={rate.from} className="hover:bg-muted/30">
                        <td className="py-3 font-bold text-foreground">
                          {rate.from} / {rate.to}
                        </td>
                        <td className="py-3 font-mono font-semibold">
                          {rate.rate.toLocaleString('vi-VN')} ₫
                        </td>
                        <td className="py-3 text-muted-foreground">{rate.source}</td>
                        <td className="py-3 text-xs text-muted-foreground">
                          {rate.updatedAt}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Feature Flags */}
        <TabsContent value="flags" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Công tắc tính năng (Feature Flags)
              </CardTitle>
              <CardDescription>
                Bật tắt an toàn các tính năng mới trong quá trình thử nghiệm.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {flags.map((flag) => (
                <div
                  key={flag.key}
                  className="flex items-center justify-between p-3.5 rounded-xl border bg-card hover:bg-muted/20 transition-colors"
                >
                  <div className="space-y-0.5 pr-4">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {flag.key}
                      </span>
                      <Badge
                        variant={flag.enabled ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {flag.enabled ? 'Bật' : 'Tắt'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{flag.description}</p>
                  </div>
                  <Switch
                    checked={flag.enabled}
                    onCheckedChange={() => toggleFlag(flag.key)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
