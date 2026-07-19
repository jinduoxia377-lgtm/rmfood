/**
 * 学术报告独立页面 - UI/UX优化版
 * 提供完整的学术报告管理功能，符合专业学术标准
 */

import { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  Calendar,
  ChevronRight,
  BookOpen,
  Link2,
  AlertCircle,
  CheckCircle,
  User,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Download,
  Star,
  StarOff,
  MoreHorizontal,
  SortAsc,
  SortDesc,
  CheckSquare,
  Square,
  X,
  Menu,
  FileCode,
  FileText as FileTextIcon,
  ClipboardCopy,
  Share2,
  MoreVertical,
  MoveVertical,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Input, Badge } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { EmptyStateIllustration } from '@/components/ui/EmptyStateIllustration';
import { PageHeader } from '@/components/ui/PageHeader';
import { Divider } from '@/components/ui/Divider';
import { useAcademicReportStore } from '@/stores/academicReportStore';
import { useToastStore } from '@/stores/toastStore';
import { AcademicReportEditor } from '@/components/academic/AcademicReportEditor';
import type { ReportItem } from '@/stores/academicReportStore';

type ViewMode = 'list' | 'editor';
type SortField = 'createdAt' | 'updatedAt' | 'title' | 'status';
type SortOrder = 'asc' | 'desc';

export default function AcademicReportPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState<string | null>(null);

  const { reports, isLoading, error, fetchReports, deleteReport, loadReport, createReport } = useAcademicReportStore();
  const { addToast } = useToastStore();

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const filteredAndSortedReports = useMemo(() => {
    const result = reports.filter(report => {
      const matchesSearch = report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.formulaName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.authors.some(author => author.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (report.abstract || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = selectedStatus === 'all' || report.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'status':
          const statusOrder = { draft: 0, 'in_review': 1, published: 2 };
          comparison = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
        default:
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [reports, searchQuery, selectedStatus, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setShowSortMenu(false);
  };

  const handleSelectReport = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedReports.length) {
      setSelectedIds(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedIds(new Set(filteredAndSortedReports.map(r => r.id)));
      setShowBulkActions(true);
    }
  };

  const handleBulkDelete = () => {
    selectedIds.forEach(id => deleteReport(id));
    addToast({
      type: 'success',
      title: '批量删除成功',
      message: `已删除 ${selectedIds.size} 份报告`,
    });
    setSelectedIds(new Set());
    setShowBulkActions(false);
    setShowDeleteConfirm(false);
  };

  const handleDuplicateReport = (report: ReportItem) => {
    createReport('research');
    addToast({
      type: 'success',
      title: '报告已复制',
      message: '已创建报告副本',
    });
    setShowMoreMenu(null);
  };

  const handleViewReport = (report: ReportItem) => {
    setSelectedReport(report);
    loadReport(report.id);
    setViewMode('editor');
    setShowMoreMenu(null);
  };

  const handleEditReport = (report: ReportItem) => {
    setSelectedReport(report);
    loadReport(report.id);
    setViewMode('editor');
    setShowMoreMenu(null);
  };

  const handleDelete = async (id: string) => {
    try {
      deleteReport(id);
      addToast({
        type: 'success',
        title: '删除成功',
        message: '报告已删除',
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: '删除失败',
        message: error instanceof Error ? error.message : '请重试',
      });
    }
    setShowDeleteConfirm(false);
    setDeleteTargetId(null);
    setShowMoreMenu(null);
  };

  const confirmDelete = (id: string) => {
    setDeleteTargetId(id);
    setShowDeleteConfirm(true);
    setShowMoreMenu(null);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: '草稿', className: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300' },
      'in_review': { label: '审核中', className: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400' },
      published: { label: '已发布', className: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' },
    };
    return statusConfig[status as keyof typeof statusConfig] || { label: status, className: 'bg-neutral-100 text-neutral-600' };
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 text-neutral-400" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 text-primary" /> : <ArrowDown className="w-4 h-4 text-primary" />;
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setSortField('updatedAt');
    setSortOrder('desc');
  };

  const hasActiveFilters = searchQuery || selectedStatus !== 'all' || sortField !== 'updatedAt' || sortOrder !== 'desc';

  if (viewMode === 'editor') {
    return (
      <div className="h-screen flex flex-col bg-neutral-50 dark:bg-neutral-900">
        <div className="sticky top-0 z-20 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-6 py-4 flex items-center gap-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-neutral-900/80">
          <Button
            variant="ghost"
            onClick={() => setViewMode('list')}
            className="gap-2 text-neutral-600 dark:text-neutral-400"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            返回列表
          </Button>
          {selectedReport && (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">{selectedReport.title}</h2>
                <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(selectedReport.status).className}`}>
                    {getStatusBadge(selectedReport.status).label}
                  </span>
                  <span>•</span>
                  <span>更新于 {formatDate(selectedReport.updatedAt)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <AcademicReportEditor />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* 删除确认对话框 */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="确认删除"
        description={selectedIds.size > 1 ? `确定要删除选中的 ${selectedIds.size} 份报告吗？此操作无法撤销。` : '此操作将永久删除该报告，无法撤销。确定要继续吗？'}
      >
        <div className="flex gap-3 justify-end mt-6">
          <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="text-neutral-600 dark:text-neutral-400">
            取消
          </Button>
          <Button
            variant="danger"
            onClick={() => selectedIds.size > 1 ? handleBulkDelete() : deleteTargetId && handleDelete(deleteTargetId)}
          >
            确认删除
          </Button>
        </div>
      </Modal>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 页面标题 */}
        <PageHeader
          title="学术报告管理"
          description="管理和查看您的所有学术报告，支持创建、编辑、搜索和分享"
          actions={
            <Button
              onClick={() => {
                setSelectedReport(null);
                setViewMode('editor');
              }}
              icon={<Plus className="w-4 h-4" />}
              className="gap-2"
            >
              新建报告
            </Button>
          }
          className="text-left"
        />

        {/* 统计卡片 - 清晰的视觉层级 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card hoverable className="border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">总报告数</p>
                  <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">{reports.length}</p>
                </div>
                <div className="w-12 h-12 bg-secondary-100 dark:bg-secondary-900/30 rounded-xl flex items-center justify-center">
                  <FileTextIcon className="w-6 h-6 text-secondary-600 dark:text-secondary-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hoverable className="border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">草稿报告</p>
                  <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                    {reports.filter(r => r.status === 'draft').length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center">
                  <Edit className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hoverable className="border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">审核中</p>
                  <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                    {reports.filter(r => r.status === 'in_review').length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-warning-100 dark:bg-warning-900/30 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-warning-600 dark:text-warning-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hoverable className="border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">已发布</p>
                  <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                    {reports.filter(r => r.status === 'published').length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 批量操作栏 - 突出显示 */}
        {showBulkActions && (
          <Card className="border-primary-200 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                    <CheckSquare className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    已选择 {selectedIds.size} 份报告
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedIds(new Set());
                      setShowBulkActions(false);
                    }}
                    className="text-neutral-600 dark:text-neutral-400"
                  >
                    取消选择
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    icon={<Trash2 className="w-4 h-4" />}
                    className="gap-1"
                  >
                    批量删除
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 搜索和筛选 - 优化布局 */}
        <Card className="border-neutral-200 dark:border-neutral-700">
          <CardContent className="p-5">
            <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
              {/* 搜索框 */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <Input
                  placeholder="搜索报告标题、作者、摘要或关联配方..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-neutral-400" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* 状态筛选 */}
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-neutral-400" />
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 transition-all"
                  >
                    <option value="all">全部状态</option>
                    <option value="draft">草稿</option>
                    <option value="in_review">审核中</option>
                    <option value="published">已发布</option>
                  </select>
                </div>

                {/* 排序下拉 */}
                <div className="relative">
                  <Button
                    variant="outline"
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="gap-2"
                    icon={<SortAsc className="w-4 h-4" />}
                    iconRight={getSortIcon(sortField)}
                  >
                    排序
                  </Button>
                  {showSortMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowSortMenu(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 py-2 z-20 animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-3 py-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">排序方式</div>
                        <button
                          onClick={() => handleSort('updatedAt')}
                          className={`w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center justify-between transition-colors ${sortField === 'updatedAt' ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'text-neutral-700 dark:text-neutral-300'}`}
                        >
                          <span className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            更新时间
                          </span>
                          {sortField === 'updatedAt' && (sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                        </button>
                        <button
                          onClick={() => handleSort('createdAt')}
                          className={`w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center justify-between transition-colors ${sortField === 'createdAt' ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'text-neutral-700 dark:text-neutral-300'}`}
                        >
                          <span className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            创建时间
                          </span>
                          {sortField === 'createdAt' && (sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                        </button>
                        <button
                          onClick={() => handleSort('title')}
                          className={`w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center justify-between transition-colors ${sortField === 'title' ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'text-neutral-700 dark:text-neutral-300'}`}
                        >
                          <span className="flex items-center gap-2">
                            <FileTextIcon className="w-4 h-4" />
                            标题
                          </span>
                          {sortField === 'title' && (sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                        </button>
                        <button
                          onClick={() => handleSort('status')}
                          className={`w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center justify-between transition-colors ${sortField === 'status' ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'text-neutral-700 dark:text-neutral-300'}`}
                        >
                          <span className="flex items-center gap-2">
                            <Badge className="px-2 py-0.5 text-xs">状态</Badge>
                            状态
                          </span>
                          {sortField === 'status' && (sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* 清除筛选按钮 */}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    onClick={clearFilters}
                    className="gap-1 text-neutral-600 dark:text-neutral-400"
                    icon={<X className="w-4 h-4" />}
                  >
                    清除筛选
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 报告列表 */}
        {isLoading ? (
          <Card className="border-neutral-200 dark:border-neutral-700">
            <CardContent className="p-16 text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 dark:border-t-primary-400 mb-5" />
              <p className="text-neutral-500 dark:text-neutral-400 font-medium">加载报告列表...</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-red-200 dark:border-red-800 bg-error-50 dark:bg-error-900/20">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-14 h-14 text-error-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-error-700 dark:text-error-400 mb-1">加载报告列表失败</h3>
              <p className="text-error-500 dark:text-error-400 text-sm mb-4">{error}</p>
              <Button onClick={fetchReports} className="gap-2" icon={<RefreshCw className="w-4 h-4" />}>
                重试
              </Button>
            </CardContent>
          </Card>
        ) : filteredAndSortedReports.length === 0 ? (
          <Card className="border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <CardContent className="p-0">
              <EmptyStateIllustration
                type={hasActiveFilters ? 'search-empty' : 'no-data'}
                title={hasActiveFilters ? '未找到匹配的报告' : '暂无学术报告'}
                description={hasActiveFilters ? '尝试调整搜索条件或清除筛选' : '点击上方按钮创建您的第一份学术报告'}
                action={
                  hasActiveFilters ? (
                    <Button variant="outline" onClick={clearFilters} className="gap-2">
                      <X className="w-4 h-4" />
                      清除筛选
                    </Button>
                  ) : (
                    <Button onClick={() => setViewMode('editor')} className="gap-2" icon={<Plus className="w-4 h-4" />}>
                      新建报告
                    </Button>
                  )
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* 全选行 */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAll}
                  className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                >
                  {selectedIds.size === filteredAndSortedReports.length && filteredAndSortedReports.length > 0 ? (
                    <CheckSquare className="w-5 h-5 text-primary" />
                  ) : (
                    <Square className="w-5 h-5 text-neutral-400" />
                  )}
                </button>
                <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  {filteredAndSortedReports.length} 份报告
                </span>
              </div>
            </div>

            {/* 报告卡片列表 */}
            {filteredAndSortedReports.map((report, index) => (
              <Card
                key={report.id}
                hoverable
                className={`border-neutral-200 dark:border-neutral-700 overflow-hidden transition-all duration-300 ${
                  selectedIds.has(report.id) ? 'ring-2 ring-primary bg-primary-50/50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700' : ''
                } animate-in fade-in slide-in-from-bottom-4 duration-500`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="p-0">
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      {/* 选择框和图标 */}
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => handleSelectReport(report.id)}
                          className="mt-1 p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors shrink-0"
                        >
                          {selectedIds.has(report.id) ? (
                            <CheckSquare className="w-5 h-5 text-primary" />
                          ) : (
                            <Square className="w-5 h-5 text-neutral-400" />
                          )}
                        </button>

                        <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/40 dark:to-primary-800/40 rounded-xl flex items-center justify-center shrink-0 text-primary-600 dark:text-primary-400 font-semibold text-lg">
                          {report.title.charAt(0)}
                        </div>
                      </div>

                      {/* 报告内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3
                              className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 hover:text-primary cursor-pointer transition-colors truncate mb-2"
                              onClick={() => handleViewReport(report)}
                            >
                              {report.title}
                            </h3>

                            {report.abstract && (
                              <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3 leading-relaxed">
                                {report.abstract}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
                              {report.authors.length > 0 && (
                                <span className="flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-neutral-400" />
                                  <span className="truncate">{report.authors.join('、')}</span>
                                </span>
                              )}
                              {report.formulaName && (
                                <span className="flex items-center gap-1.5">
                                  <Link2 className="w-3.5 h-3.5 text-neutral-400" />
                                  <span className="truncate font-medium text-neutral-600 dark:text-neutral-300">{report.formulaName}</span>
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-neutral-400 dark:text-neutral-500">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-3 h-3" />
                                创建于 {formatDate(report.createdAt)}
                              </span>
                              {report.updatedAt !== report.createdAt && (
                                <span className="flex items-center gap-1.5">
                                  <Calendar className="w-3 h-3" />
                                  更新于 {formatDate(report.updatedAt)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(report.status).className}`}>
                              {getStatusBadge(report.status).label}
                            </span>

                            {/* 桌面端操作按钮 */}
                            <div className="hidden md:flex items-center gap-1">
                              <Button
                                variant="ghost"
                                onClick={() => handleViewReport(report)}
                                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg"
                                title="查看"
                              >
                                <Eye className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => handleEditReport(report)}
                                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg"
                                title="编辑"
                              >
                                <Edit className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                              </Button>

                              {/* 更多菜单 */}
                              <div className="relative">
                                <Button
                                  variant="ghost"
                                  onClick={() => setShowMoreMenu(showMoreMenu === report.id ? null : report.id)}
                                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg"
                                  title="更多操作"
                                >
                                  <MoreVertical className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                                </Button>
                                {showMoreMenu === report.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-10"
                                      onClick={() => setShowMoreMenu(null)}
                                    />
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 py-1.5 z-20 animate-in fade-in zoom-in-95 duration-200">
                                      <button
                                        onClick={() => handleDuplicateReport(report)}
                                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
                                      >
                                        <Copy className="w-4 h-4" />
                                        复制报告
                                      </button>
                                      <Divider className="my-1" />
                                      <button
                                        onClick={() => confirmDelete(report.id)}
                                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-error-50 dark:hover:bg-error-900/20 flex items-center gap-2 text-error-600 dark:text-error-400"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                        删除报告
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* 移动端更多菜单 */}
                            <div className="md:hidden relative">
                              <Button
                                variant="ghost"
                                onClick={() => setShowMoreMenu(showMoreMenu === report.id ? null : report.id)}
                                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg"
                              >
                                <Menu className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                              </Button>
                              {showMoreMenu === report.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setShowMoreMenu(null)}
                                  />
                                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 py-1.5 z-20 animate-in fade-in zoom-in-95 duration-200">
                                    <button
                                      onClick={() => handleViewReport(report)}
                                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
                                    >
                                      <Eye className="w-4 h-4" />
                                      查看
                                    </button>
                                    <button
                                      onClick={() => handleEditReport(report)}
                                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
                                    >
                                      <Edit className="w-4 h-4" />
                                      编辑
                                    </button>
                                    <button
                                      onClick={() => handleDuplicateReport(report)}
                                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
                                    >
                                      <Copy className="w-4 h-4" />
                                      复制
                                    </button>
                                    <Divider className="my-1" />
                                    <button
                                      onClick={() => confirmDelete(report.id)}
                                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-error-50 dark:hover:bg-error-900/20 flex items-center gap-2 text-error-600 dark:text-error-400"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      删除
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
