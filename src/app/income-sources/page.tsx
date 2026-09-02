"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import {
  getIncomeSourcesWithStreams,
  createIncomeSource,
  updateIncomeSource,
  createIncomeSourceStream,
  updateIncomeSourceStream,
  type IncomeSourceWithStreams,
  type IncomeSourceType,
} from '@/features/income-sources';
import {
  Coins,
  Plus,
  Briefcase,
  Video,
  Laptop,
  TrendingUp,
  CircleDollarSign,
  Archive,
  ArchiveRestore,
  Edit2,
  Layers,
  Search,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  GitBranch,
} from 'lucide-react';

const SOURCE_TYPE_LABELS: Record<IncomeSourceType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  SALARY: { label: 'Lương cố định', icon: Briefcase, color: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60' },
  YOUTUBE: { label: 'YouTube / Sáng tạo', icon: Video, color: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60' },
  FREELANCE: { label: 'Freelance / Dự án', icon: Laptop, color: 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/60' },
  INVESTMENT: { label: 'Đầu tư / Cổ tức', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60' },
  OTHER: { label: 'Thu nhập khác', icon: CircleDollarSign, color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60' },
};

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'Tất cả loại' },
  { value: 'SALARY', label: 'Lương cố định (SALARY)' },
  { value: 'YOUTUBE', label: 'YouTube / Sáng tạo (YOUTUBE)' },
  { value: 'FREELANCE', label: 'Freelance / Dự án (FREELANCE)' },
  { value: 'INVESTMENT', label: 'Đầu tư / Cổ tức (INVESTMENT)' },
  { value: 'OTHER', label: 'Thu nhập khác (OTHER)' },
];

const SOURCE_TYPE_SELECT_OPTIONS = [
  { value: 'SALARY', label: 'Lương cố định (SALARY)' },
  { value: 'YOUTUBE', label: 'YouTube / Sáng tạo nội dung (YOUTUBE)' },
  { value: 'FREELANCE', label: 'Freelance / Dự án ngoài (FREELANCE)' },
  { value: 'INVESTMENT', label: 'Đầu tư / Cổ tức / Lãi vay (INVESTMENT)' },
  { value: 'OTHER', label: 'Nguồn thu khác (OTHER)' },
];

export default function IncomeSourcesPage() {
  const [sources, setSources] = useState<IncomeSourceWithStreams[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Source Modal state
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<IncomeSourceWithStreams | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [sourceType, setSourceType] = useState<IncomeSourceType>('SALARY');
  const [sourceModalSubmitting, setSourceModalSubmitting] = useState(false);
  const [sourceModalError, setSourceModalError] = useState<string | null>(null);

  // Stream Modal state
  const [streamModalOpen, setStreamModalOpen] = useState(false);
  const [parentSourceForStream, setParentSourceForStream] = useState<IncomeSourceWithStreams | null>(null);
  const [editingStreamId, setEditingStreamId] = useState<string | null>(null);
  const [streamName, setStreamName] = useState('');
  const [streamModalSubmitting, setStreamModalSubmitting] = useState(false);
  const [streamModalError, setStreamModalError] = useState<string | null>(null);

  // Feedback banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getIncomeSourcesWithStreams({ includeArchived: true });
      setSources(res);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải danh sách nguồn thu nhập');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchSources() {
      try {
        setLoading(true);
        setError(null);
        const res = await getIncomeSourcesWithStreams({ includeArchived: true });
        if (active) {
          setSources(res);
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'Không thể tải danh sách nguồn thu nhập');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    fetchSources();
    return () => {
      active = false;
    };
  }, []);

  // Open Create Source Modal
  const handleOpenCreateSource = () => {
    setEditingSource(null);
    setSourceName('');
    setSourceType('SALARY');
    setSourceModalError(null);
    setSourceModalOpen(true);
  };

  // Open Edit Source Modal
  const handleOpenEditSource = (source: IncomeSourceWithStreams) => {
    setEditingSource(source);
    setSourceName(source.name);
    setSourceType(source.type);
    setSourceModalError(null);
    setSourceModalOpen(true);
  };

  // Submit Source (Create or Edit)
  const handleSaveSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceName.trim()) {
      setSourceModalError('Vui lòng nhập tên nguồn thu nhập');
      return;
    }

    try {
      setSourceModalSubmitting(true);
      setSourceModalError(null);

      if (editingSource) {
        await updateIncomeSource(editingSource.id, {
          name: sourceName.trim(),
          type: sourceType,
        });
        showFeedback('success', `Đã cập nhật nguồn thu "${sourceName.trim()}"`);
      } else {
        await createIncomeSource({
          name: sourceName.trim(),
          type: sourceType,
        });
        showFeedback('success', `Đã tạo nguồn thu "${sourceName.trim()}"`);
      }

      setSourceModalOpen(false);
      await loadData();
    } catch (err: any) {
      setSourceModalError(err?.message || 'Không thể lưu nguồn thu nhập');
    } finally {
      setSourceModalSubmitting(false);
    }
  };

  // Toggle Source Archive Status
  const handleToggleArchiveSource = async (source: IncomeSourceWithStreams) => {
    try {
      const nextStatus = !source.is_archived;
      await updateIncomeSource(source.id, { is_archived: nextStatus });
      showFeedback('success', nextStatus ? `Đã lưu trữ nguồn thu "${source.name}"` : `Đã kích hoạt lại nguồn thu "${source.name}"`);
      await loadData();
    } catch (err: any) {
      showFeedback('error', err?.message || 'Không thể thay đổi trạng thái lưu trữ');
    }
  };

  // Open Create Stream Modal
  const handleOpenCreateStream = (source: IncomeSourceWithStreams) => {
    setParentSourceForStream(source);
    setEditingStreamId(null);
    setStreamName('');
    setStreamModalError(null);
    setStreamModalOpen(true);
  };

  // Open Edit Stream Modal
  const handleOpenEditStream = (source: IncomeSourceWithStreams, streamId: string, currentName: string) => {
    setParentSourceForStream(source);
    setEditingStreamId(streamId);
    setStreamName(currentName);
    setStreamModalError(null);
    setStreamModalOpen(true);
  };

  // Submit Stream (Create or Rename)
  const handleSaveStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamName.trim()) {
      setStreamModalError('Vui lòng nhập tên kênh thu nhánh');
      return;
    }
    if (!parentSourceForStream) return;

    try {
      setStreamModalSubmitting(true);
      setStreamModalError(null);

      if (editingStreamId) {
        await updateIncomeSourceStream(editingStreamId, {
          name: streamName.trim(),
        });
        showFeedback('success', `Đã đổi tên kênh thu thành "${streamName.trim()}"`);
      } else {
        await createIncomeSourceStream({
          income_source_id: parentSourceForStream.id,
          name: streamName.trim(),
        });
        showFeedback('success', `Đã thêm kênh thu "${streamName.trim()}" vào nguồn "${parentSourceForStream.name}"`);
      }

      setStreamModalOpen(false);
      await loadData();
    } catch (err: any) {
      setStreamModalError(err?.message || 'Không thể lưu kênh thu nhập');
    } finally {
      setStreamModalSubmitting(false);
    }
  };

  // Toggle Stream Archive Status
  const handleToggleArchiveStream = async (streamId: string, currentArchived: boolean, streamTitle: string) => {
    try {
      const nextStatus = !currentArchived;
      await updateIncomeSourceStream(streamId, { is_archived: nextStatus });
      showFeedback('success', nextStatus ? `Đã lưu trữ kênh "${streamTitle}"` : `Đã kích hoạt lại kênh "${streamTitle}"`);
      await loadData();
    } catch (err: any) {
      showFeedback('error', err?.message || 'Không thể thay đổi trạng thái kênh thu');
    }
  };

  // Filter sources
  const filteredSources = sources.filter((s) => {
    const matchesTab = activeTab === 'active' ? !s.is_archived : s.is_archived;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.streams || []).some(st => st.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === 'ALL' || s.type === typeFilter;
    return matchesTab && matchesSearch && matchesType;
  });

  const activeCount = sources.filter(s => !s.is_archived).length;
  const archivedCount = sources.filter(s => s.is_archived).length;
  const totalActiveStreams = sources.filter(s => !s.is_archived).reduce((acc, s) => {
    return acc + (s.streams || []).filter(st => !st.is_archived).length;
  }, 0);

  return (
    <AppShell>
      <PageHeader
        title="Nguồn thu nhập"
        subtitle="Quản lý các nguồn doanh thu như Lương, YouTube, Freelance, Đầu tư và các kênh thu nhánh đa tầng."
      >
        <Button onClick={handleOpenCreateSource} className="shadow-xs font-semibold">
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm nguồn thu
        </Button>
      </PageHeader>

      {/* Feedback Toast Notification */}
      {feedback && (
        <div className={`p-3.5 rounded-lg border flex items-center justify-between text-xs font-medium animate-in fade-in duration-200 ${
          feedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
            : 'bg-destructive/10 text-destructive border-destructive/20'
        }`}>
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-muted-foreground hover:text-foreground font-bold px-1.5"
          >
            &times;
          </button>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border shadow-2xs">
          <CardContent className="p-4 sm:p-5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nguồn thu hoạt động
              </span>
              <Coins className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {activeCount}
            </p>
            <span className="text-[11px] text-muted-foreground block">
              {archivedCount > 0 ? `${archivedCount} nguồn đã lưu trữ` : 'Tất cả nguồn đang sẵn sàng'}
            </span>
          </CardContent>
        </Card>

        <Card className="bg-card border shadow-2xs">
          <CardContent className="p-4 sm:p-5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Kênh thu nhánh (Streams)
              </span>
              <GitBranch className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {totalActiveStreams}
            </p>
            <span className="text-[11px] text-muted-foreground block">
              Kênh nhánh con hoạt động độc lập
            </span>
          </CardContent>
        </Card>

        <Card className="bg-card border shadow-2xs">
          <CardContent className="p-4 sm:p-5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Đa dạng hóa thu nhập
              </span>
              <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {new Set(sources.filter(s => !s.is_archived).map(s => s.type)).size} / 5
            </p>
            <span className="text-[11px] text-muted-foreground block">
              Phân loại dòng tiền đang hoạt động
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'active' | 'archived')}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-2 w-full sm:w-auto">
            <TabsTrigger value="active" className="text-xs font-medium">
              Đang hoạt động ({activeCount})
            </TabsTrigger>
            <TabsTrigger value="archived" className="text-xs font-medium">
              Đã lưu trữ ({archivedCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm nguồn thu hoặc kênh..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>

          {/* Type Filter */}
          <div className="w-36 sm:w-40">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={TYPE_OPTIONS}
              className="h-9 text-xs"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            title="Làm mới danh sách"
            className="h-9 px-2.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main Income Sources Grid */}
      {error ? (
        <div className="p-8 text-center rounded-xl border border-destructive/20 bg-destructive/5 space-y-3 max-w-md mx-auto my-8">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <h3 className="font-semibold text-foreground text-sm">Không thể tải nguồn thu nhập</h3>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button size="sm" variant="outline" onClick={loadData}>
            Thử lại
          </Button>
        </div>
      ) : filteredSources.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed bg-card space-y-3 my-4">
          <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
            <Coins className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-foreground text-sm">
            {activeTab === 'active'
              ? searchQuery || typeFilter !== 'ALL'
                ? 'Không tìm thấy nguồn thu nhập phù hợp'
                : 'Chưa có nguồn thu nhập nào'
              : 'Không có nguồn thu nào trong lưu trữ'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {activeTab === 'active' && !searchQuery && typeFilter === 'ALL'
              ? 'Tạo nguồn thu nhập đầu tiên (Lương, Kênh YouTube, Freelance,...) để phân bổ và theo dõi chi tiết doanh thu.'
              : 'Thử thay đổi bộ lọc tìm kiếm hoặc từ khóa.'}
          </p>
          {activeTab === 'active' && !searchQuery && typeFilter === 'ALL' && (
            <Button size="sm" onClick={handleOpenCreateSource} className="mt-2">
              <Plus className="h-4 w-4 mr-1.5" />
              Thêm nguồn thu mới
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {filteredSources.map((source) => {
            const typeConfig = SOURCE_TYPE_LABELS[source.type] || SOURCE_TYPE_LABELS.OTHER;
            const TypeIcon = typeConfig.icon;
            const activeStreams = (source.streams || []).filter((st) => !st.is_archived);
            const archivedStreams = (source.streams || []).filter((st) => st.is_archived);

            return (
              <Card
                key={source.id}
                className={`flex flex-col justify-between border shadow-2xs transition-all ${
                  source.is_archived
                    ? 'opacity-70 bg-muted/20 border-dashed'
                    : 'bg-card hover:border-foreground/20'
                }`}
              >
                <CardHeader className="pb-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className={`p-2 rounded-lg border shrink-0 ${typeConfig.color}`}>
                        <TypeIcon className="h-4 w-4" />
                      </div>
                      <div className="truncate">
                        <CardTitle className="text-sm font-semibold truncate flex items-center gap-1.5">
                          <span>{source.name}</span>
                          {source.is_archived && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed">
                              Đã lưu trữ
                            </Badge>
                          )}
                        </CardTitle>
                        <span className="text-[11px] text-muted-foreground">
                          {typeConfig.label}
                        </span>
                      </div>
                    </div>

                    {/* Source Top Actions */}
                    <div className="flex items-center space-x-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEditSource(source)}
                        title="Chỉnh sửa nguồn thu"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleArchiveSource(source)}
                        title={source.is_archived ? 'Kích hoạt lại' : 'Lưu trữ nguồn thu'}
                        className={`h-7 w-7 ${
                          source.is_archived
                            ? 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400'
                            : 'text-muted-foreground hover:text-amber-600'
                        }`}
                      >
                        {source.is_archived ? (
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        ) : (
                          <Archive className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 text-xs flex-1 flex flex-col justify-between">
                  {/* Streams List Section */}
                  <div className="space-y-2 pt-1 border-t">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium pt-2">
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        <span>Kênh nhánh ({activeStreams.length}{archivedStreams.length > 0 ? ` + ${archivedStreams.length} lưu trữ` : ''})</span>
                      </span>
                      {!source.is_archived && (
                        <button
                          type="button"
                          onClick={() => handleOpenCreateStream(source)}
                          className="text-primary hover:underline flex items-center gap-0.5 text-[11px] font-semibold"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Thêm kênh</span>
                        </button>
                      )}
                    </div>

                    {activeStreams.length === 0 && archivedStreams.length === 0 ? (
                      <div className="p-3 text-center text-[11px] text-muted-foreground border border-dashed rounded-md bg-muted/20">
                        Chưa có kênh thu nhánh. Có thể ghi nhận trực tiếp theo nguồn chính.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {activeStreams.map((st) => (
                          <div
                            key={st.id}
                            className="flex items-center justify-between p-2 rounded-md border bg-muted/30 hover:bg-muted/60 transition-colors"
                          >
                            <div className="flex items-center space-x-1.5 min-w-0 pr-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span className="font-medium text-foreground truncate text-[11px]">{st.name}</span>
                            </div>
                            <div className="flex items-center space-x-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenEditStream(source, st.id, st.name)}
                                title="Đổi tên kênh"
                                className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleArchiveStream(st.id, st.is_archived, st.name)}
                                title="Lưu trữ kênh"
                                className="p-1 text-muted-foreground hover:text-amber-600 rounded hover:bg-muted"
                              >
                                <Archive className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {archivedStreams.map((st) => (
                          <div
                            key={st.id}
                            className="flex items-center justify-between p-1.5 rounded-md border border-dashed bg-muted/10 opacity-60 text-[10px]"
                          >
                            <div className="flex items-center space-x-1.5 min-w-0 pr-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                              <span className="line-through text-muted-foreground truncate">{st.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleArchiveStream(st.id, st.is_archived, st.name)}
                              title="Kích hoạt lại kênh"
                              className="p-1 text-muted-foreground hover:text-emerald-600 rounded hover:bg-muted shrink-0"
                            >
                              <ArchiveRestore className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Create / Edit Income Source */}
      <Dialog open={sourceModalOpen} onOpenChange={setSourceModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveSource}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                {editingSource ? 'Chỉnh sửa nguồn thu nhập' : 'Thêm nguồn thu nhập mới'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {editingSource
                  ? 'Cập nhật tên và phân loại cho nguồn thu nhập này.'
                  : 'Khai báo nguồn thu nhập chính (Ví dụ: Lương Công ty, Thu nhập YouTube, Hợp đồng Freelance,...)'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              {sourceModalError && (
                <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{sourceModalError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="source-name" className="text-xs font-semibold">
                  Tên nguồn thu nhập <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="source-name"
                  placeholder="Ví dụ: Công ty Alphabet, Kênh YouTube Chính, Khách hàng Upwork..."
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  maxLength={200}
                  className="text-xs h-9"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="source-type" className="text-xs font-semibold">
                  Phân loại nguồn thu
                </Label>
                <Select
                  id="source-type"
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value as IncomeSourceType)}
                  options={SOURCE_TYPE_SELECT_OPTIONS}
                  className="text-xs h-9"
                />
                <p className="text-[11px] text-muted-foreground">
                  Phân loại giúp hệ thống gom nhóm và tính toán tỷ trọng thu nhập chuẩn xác trên báo cáo.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSourceModalOpen(false)}
                disabled={sourceModalSubmitting}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={sourceModalSubmitting}
                className="font-semibold"
              >
                {sourceModalSubmitting ? 'Đang lưu...' : editingSource ? 'Cập nhật' : 'Tạo nguồn thu'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Create / Edit Stream */}
      <Dialog open={streamModalOpen} onOpenChange={setStreamModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveStream}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                {editingStreamId ? 'Đổi tên kênh thu nhánh' : 'Thêm kênh thu nhánh mới'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Thuộc nguồn: <strong className="text-foreground">{parentSourceForStream?.name}</strong> ({parentSourceForStream?.type})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              {streamModalError && (
                <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{streamModalError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="stream-name" className="text-xs font-semibold">
                  Tên kênh thu nhánh <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="stream-name"
                  placeholder="Ví dụ: Kênh Tech Reviews, Kênh Gaming, Hợp đồng bảo trì A..."
                  value={streamName}
                  onChange={(e) => setStreamName(e.target.value)}
                  maxLength={200}
                  className="text-xs h-9"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  Kênh thu nhánh gắn chặt vĩnh viễn với nguồn thu cha này để đảm bảo tính toàn vẹn của dữ liệu lịch sử.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStreamModalOpen(false)}
                disabled={streamModalSubmitting}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={streamModalSubmitting}
                className="font-semibold"
              >
                {streamModalSubmitting ? 'Đang lưu...' : editingStreamId ? 'Lưu tên' : 'Thêm kênh'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
