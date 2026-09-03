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
  Loader2,
  Search,
  KeyRound,
} from 'lucide-react';
import {
  checkIsAdmin,
  getAdminAiCredentialTarget,
  saveAdminAssignedCredential,
  revokeAdminAssignedCredential,
} from '@/features/ai/credentials/actions';
import type { AdminTargetUserDTO } from '@/features/ai/credentials/types';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [flags, setFlags] = useState(MOCK_FEATURE_FLAGS);
  const [selectedModelParser, setSelectedModelParser] = useState('gemini-2.5-flash');
  const [selectedModelChat, setSelectedModelChat] = useState('gemini-2.5-pro');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState(false);
  const [fxSyncFeedback, setFxSyncFeedback] = useState(false);

  // Admin Authority & Security Gate
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  // Phase 11 Admin AI Credential Assignment
  const [targetEmail, setTargetEmail] = useState('');
  const [isLookingUpTarget, setIsLookingUpTarget] = useState(false);
  const [targetUserDTO, setTargetUserDTO] = useState<AdminTargetUserDTO | null>(null);
  const [targetLookupError, setTargetLookupError] = useState<string | null>(null);
  const [targetLookupSuccess, setTargetLookupSuccess] = useState<string | null>(null);

  const [adminAssignKeyInput, setAdminAssignKeyInput] = useState('');
  const [isAssigningKey, setIsAssigningKey] = useState(false);
  const [isRevokingAssignedKey, setIsRevokingAssignedKey] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    async function verifyAdmin() {
      try {
        const res = await checkIsAdmin();
        if (isMounted) {
          setIsAdmin(res.isAdmin);
        }
      } catch {
        if (isMounted) setIsAdmin(false);
      } finally {
        if (isMounted) setIsCheckingAdmin(false);
      }
    }
    verifyAdmin();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLookupTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setTargetLookupError(null);
    setTargetLookupSuccess(null);
    setAssignError(null);
    setAssignSuccess(null);

    const trimmed = targetEmail.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setTargetLookupError('Vui lòng nhập địa chỉ email hợp lệ để tra cứu.');
      return;
    }

    setIsLookingUpTarget(true);
    try {
      const res = await getAdminAiCredentialTarget(trimmed);
      if (!res.ok) {
        setTargetUserDTO(null);
        setTargetLookupError(res.message);
      } else if (res.data) {
        setTargetUserDTO(res.data);
        setTargetLookupSuccess(`Đã tìm thấy người dùng: ${res.data.email}`);
      }
    } catch {
      setTargetUserDTO(null);
      setTargetLookupError('Không thể tra cứu người dùng vào lúc này.');
    } finally {
      setIsLookingUpTarget(false);
    }
  };

  const handleAssignCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserDTO) return;

    setAssignError(null);
    setAssignSuccess(null);

    const trimmedKey = adminAssignKeyInput.trim();
    if (!trimmedKey) {
      setAssignError('Vui lòng nhập khóa Google Gemini API hợp lệ.');
      return;
    }

    setIsAssigningKey(true);
    try {
      const res = await saveAdminAssignedCredential({
        targetEmail: targetUserDTO.email,
        plaintext: trimmedKey,
      });

      if (!res.ok) {
        setAssignError(res.message);
      } else if (res.data) {
        setAdminAssignKeyInput('');
        setTargetUserDTO(res.data);
        setAssignSuccess(`Đã cấp và mã hóa khóa thành công cho người dùng ${res.data.email}.`);
      }
    } catch {
      setAssignError('Không thể cấp khóa vào lúc này. Vui lòng thử lại.');
    } finally {
      setIsAssigningKey(false);
    }
  };

  const handleRevokeAssignedCredential = async () => {
    if (!targetUserDTO) return;

    setAssignError(null);
    setAssignSuccess(null);
    setIsRevokingAssignedKey(true);

    try {
      const res = await revokeAdminAssignedCredential({
        targetEmail: targetUserDTO.email,
      });

      if (!res.ok) {
        setAssignError(res.message);
      } else if (res.data) {
        setTargetUserDTO(res.data);
        setAssignSuccess(`Đã thu hồi khóa Admin cấp cho ${res.data.email}.`);
      }
    } catch {
      setAssignError('Không thể thu hồi khóa vào lúc này.');
    } finally {
      setIsRevokingAssignedKey(false);
    }
  };

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

      {!isCheckingAdmin && !isAdmin && (
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold">Quyền truy cập quản trị bị từ chối (Admin Access Restricted)</h4>
            <p className="text-xs mt-1 text-destructive/90">
              Tài khoản hiện tại không nằm trong danh sách quản trị viên được ủy quyền của hệ thống. Mọi thao tác ghi hoặc tra cứu quản trị server-side sẽ bị từ chối với mã lỗi FORBIDDEN.
            </p>
          </div>
        </div>
      )}

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
                  Số liệu mô phỏng Phase 1
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
                  {MOCK_ADMIN_METRICS.aiRequestsCount} lượt mô phỏng
                </span>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Kiến trúc cô lập dữ liệu (Data Isolation — Planned for Phase 2)
                </CardTitle>
                <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800">
                  Backend chưa kết nối
                </Badge>
              </div>
              <CardDescription>
                Thẻ này minh họa nguyên tắc RLS Invariant: User A không bao giờ thấy dữ liệu của User B (Dự kiến triển khai ở Phase 2).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl border bg-muted/30 flex items-start space-x-3">
                <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground">
                    Kế hoạch bảo mật Supabase Row Level Security (RLS) & PostgreSQL
                  </p>
                  <p>
                    Thẻ này minh họa kiến trúc cô lập dữ liệu dự kiến ở Phase 2. Hiện tại hệ thống đang chạy trên giao diện thử nghiệm Phase 1 và chưa kết nối cơ sở dữ liệu thực tế.
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
          {/* Phase 11: Real Authenticated AI Credential Assignment */}
          <Card className="border-primary/20 shadow-sm">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <KeyRound className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">
                  Cấp khóa AI cho người dùng (AI Credential Assignment — Phase 11)
                </CardTitle>
              </div>
              <CardDescription>
                Quản trị viên ủy quyền khóa Google Gemini API cho từng tài khoản người dùng. Khóa được mã hóa AES-256-GCM server-side và chỉ quản trị viên hợp lệ mới có quyền cấp hoặc thu hồi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isCheckingAdmin ? (
                <div className="py-8 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs">Đang xác thực quyền quản trị...</span>
                </div>
              ) : !isAdmin ? (
                <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold">Quyền truy cập quản trị bị từ chối (Access Denied)</h4>
                    <p className="text-xs mt-1 text-destructive/90">
                      Bạn không có quyền quản trị viên để tra cứu, quản lý hoặc cấp khóa AI cho người dùng khác.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Lookup by Email */}
                  <form onSubmit={handleLookupTarget} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="targetEmailInput" className="text-xs font-semibold">
                        Địa chỉ Email người dùng cần tra cứu / cấp khóa
                      </Label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <Input
                          id="targetEmailInput"
                          type="email"
                          placeholder="user@example.com"
                          value={targetEmail}
                          onChange={(e) => setTargetEmail(e.target.value)}
                          disabled={isLookingUpTarget}
                          className="font-mono text-xs flex-1"
                        />
                        <Button
                          type="submit"
                          disabled={!targetEmail.trim() || isLookingUpTarget}
                          size="sm"
                          className="shrink-0"
                        >
                          {isLookingUpTarget ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              Đang tra cứu...
                            </>
                          ) : (
                            <>
                              <Search className="h-3.5 w-3.5 mr-1.5" />
                              Tra cứu người dùng
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </form>

                  {targetLookupError && (
                    <div className="p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-lg flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{targetLookupError}</span>
                    </div>
                  )}

                  {targetLookupSuccess && (
                    <div className="p-3 text-xs bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-lg flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{targetLookupSuccess}</span>
                    </div>
                  )}

                  {/* Target User Status Panel */}
                  {targetUserDTO && (
                    <div className="p-4 rounded-xl border bg-muted/20 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                        <div>
                          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                            Tài khoản mục tiêu
                          </span>
                          <p className="text-sm font-medium text-foreground mt-0.5">
                            {targetUserDTO.email}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-2.5 rounded-lg border bg-background space-y-1">
                          <span className="text-muted-foreground block text-[11px]">Nguồn khóa đang kích hoạt:</span>
                          <span className="font-semibold text-foreground">
                            {targetUserDTO.metadata.activeResolvedSource === 'PERSONAL'
                              ? 'Khóa cá nhân'
                              : targetUserDTO.metadata.activeResolvedSource === 'ADMIN_ASSIGNED'
                              ? 'Admin cấp'
                              : targetUserDTO.metadata.activeResolvedSource === 'SYSTEM'
                              ? 'Hệ thống'
                              : 'Chưa có'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg border bg-background space-y-1">
                          <span className="text-muted-foreground block text-[11px]">Khóa cá nhân (User sở hữu):</span>
                          <span className="font-medium text-foreground">
                            {targetUserDTO.metadata.hasPersonalCredential
                              ? `Đã lưu (•••• ${targetUserDTO.metadata.personalKeyHint})`
                              : 'Chưa cấu hình'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg border bg-background space-y-1">
                          <span className="text-muted-foreground block text-[11px]">Khóa Admin cấp:</span>
                          <span className="font-semibold text-foreground">
                            {targetUserDTO.metadata.hasAdminAssignedCredential
                              ? `Đã cấp (•••• ${targetUserDTO.metadata.adminAssignedKeyHint})`
                              : 'Chưa cấp'}
                          </span>
                        </div>
                      </div>

                      {assignError && (
                        <div className="p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-lg flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>{assignError}</span>
                        </div>
                      )}

                      {assignSuccess && (
                        <div className="p-3 text-xs bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-lg flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>{assignSuccess}</span>
                        </div>
                      )}

                      {/* Form to Assign or Replace Key */}
                      <form onSubmit={handleAssignCredential} className="space-y-3 pt-2 border-t">
                        <div className="space-y-1.5">
                          <Label htmlFor="adminAssignKeyInput" className="text-xs font-medium">
                            {targetUserDTO.metadata.hasAdminAssignedCredential
                              ? 'Thay thế khóa Admin cấp cho người dùng này'
                              : 'Cấp khóa Google Gemini API mới cho người dùng này'}
                          </Label>
                          <Input
                            id="adminAssignKeyInput"
                            type="password"
                            autoComplete="off"
                            placeholder="AIzaSy..."
                            value={adminAssignKeyInput}
                            onChange={(e) => setAdminAssignKeyInput(e.target.value)}
                            disabled={isAssigningKey}
                            className="font-mono text-xs"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Khóa sẽ được mã hóa và lưu trữ tại bảng thông tin bảo mật. Người dùng không cần cấu hình khóa cá nhân.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          {targetUserDTO.metadata.hasAdminAssignedCredential ? (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={isRevokingAssignedKey || isAssigningKey}
                              onClick={handleRevokeAssignedCredential}
                            >
                              {isRevokingAssignedKey ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                  Đang thu hồi...
                                </>
                              ) : (
                                'Thu hồi khóa đã cấp'
                              )}
                            </Button>
                          ) : (
                            <span />
                          )}

                          <Button
                            type="submit"
                            size="sm"
                            disabled={!adminAssignKeyInput.trim() || isAssigningKey || isRevokingAssignedKey}
                          >
                            {isAssigningKey ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                Đang mã hóa & cấp khóa...
                              </>
                            ) : (
                              'Cấp khóa cho người dùng'
                            )}
                          </Button>
                        </div>
                      </form>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

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
                    <Label htmlFor="systemKey">Khóa API mặc định hệ thống (System Key — Preview)</Label>
                    <span className="text-xs text-muted-foreground font-mono flex items-center">
                      <Lock className="h-3 w-3 mr-1" />
                      Credential management preview
                    </span>
                  </div>
                  <Input
                    id="systemKey"
                    value="AIzaSy••••••••••••••••••••••••••••"
                    disabled
                    className="font-mono bg-muted"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Bản xem trước quản lý khóa — Cơ chế mã hóa và lưu trữ an toàn server-side chưa được triển khai ở Phase 1.
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
                      Đã cập nhật cấu hình mô phỏng (Preview only — Chưa lưu backend)
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
                  Tỷ giá tiền tệ mô phỏng (Mock FX Rates Engine)
                </CardTitle>
                <CardDescription>
                  Tỷ giá cố định phục vụ hiển thị giao diện Phase 1. Chưa kết nối API tỷ giá thời gian thực.
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                {fxSyncFeedback && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Đã làm mới dữ liệu mô phỏng (Mock refresh complete)
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncFx}
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Làm mới tỷ giá
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-3 font-semibold">Cặp tiền</th>
                      <th className="pb-3 font-semibold">Tỷ giá mô phỏng (VND)</th>
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
