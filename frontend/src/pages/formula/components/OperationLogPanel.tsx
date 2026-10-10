import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  Activity,
  Eye,
  CalendarDays,
  Search,
} from 'lucide-react';
import { formulaApi } from '@/api/formula';
import type { OperationLog, OperationAction, OperationLogQueryParams } from '@/types/formula';
import { Button, Modal, Select, Input, Badge, Card, CardContent, Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';
import { logger } from '@/utils/safeLogger';

interface OperationLogPanelProps {
  open: boolean;
  onClose: () => void;
  targetId?: string;
  targetType?: string;
}

type TimeRange = 'today' | '7days' | '30days' | 'custom';
type SortField = 'created_at' | 'action' | 'operator_name';
type SortOrder = 'asc' | 'desc';

const ACTION_LABELS: Record<OperationAction, string> = {
  create: '创建',
  update: '编辑',
  delete: '删除',
  import: '导入',
  export: '导出',
  approve: '审核通过',
  reject: '审核驳回',
  archive: '归档',
  restore: '恢复',
  rollback: '版本回滚',
  permission_change: '权限变更',
  batch_operation: '批量操作',
  undo_delete: '撤销删除',
};

const ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const TIME_RANGE_OPTIONS = [
  { value: 'today', label: '今天' },
  { value: '7days', label: '最近7天' },
  { value: '30days', label: '最近30天' },
  { value: 'custom', label: '自定义' },
];

const RESULT_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'success', label: '成功' },
  { value: 'failure', label: '失败' },
  { value: 'partial', label: '部分成功' },
];

const PAGE_SIZE = 20;

export default function OperationLogPanel({ open, onClose, targetId, targetType }: OperationLogPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open, onClose);
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [selectedActions, setSelectedActions] = useState<OperationAction[]>([]);
  const [selectedResult, setSelectedResult] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const getDateRange = useCallback(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    switch (timeRange) {
      case 'today':
        return { start_date: today, end_date: today };
      case '7days': {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start_date: sevenDaysAgo.toISOString().split('T')[0], end_date: today };
      }
      case '30days': {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { start_date: thirtyDaysAgo.toISOString().split('T')[0], end_date: today };
      }
      case 'custom':
        return { start_date: customStartDate, end_date: customEndDate };
      default:
        return {};
    }
  }, [timeRange, customStartDate, customEndDate]);

  const queryParams: OperationLogQueryParams = useMemo(
    () => ({
      page,
      page_size: PAGE_SIZE,
      ...getDateRange(),
      ...(selectedOperator && { operator_id: selectedOperator }),
      ...(selectedActions.length > 0 && { action: selectedActions[0] }),
      ...(selectedResult && { result: selectedResult as 'success' | 'failure' | 'partial' }),
      sort_field: sortField,
      sort_order: sortOrder,
      ...(targetId && { target_id: targetId }),
      ...(targetType && { target_type: targetType }),
    }),
    [page, getDateRange, selectedOperator, selectedActions, selectedResult, sortField, sortOrder, targetId, targetType],
  );

  const {
    data: logsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['operation-logs', queryParams],
    queryFn: () => formulaApi.getOperationLogs(queryParams),
    enabled: open,
  });

  const logs = logsData?.data || [];
  const total = logsData?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const uniqueOperators = useMemo(() => {
    const operatorMap = new Map<string, string>();
    logs.forEach((log) => {
      if (!operatorMap.has(log.operatorId)) {
        operatorMap.set(log.operatorId, log.operatorName);
      }
    });
    return Array.from(operatorMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }, [logs]);

  useEffect(() => {
    if (!open) {
      setPage(1);
      setSearchQuery('');
      setSelectedLogId(null);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['operation-logs'] });
      }, 30000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [open, queryClient]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await formulaApi.exportLogs(queryParams, 'excel');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `操作日志_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('[OperationLogPanel] Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;

    const query = searchQuery.toLowerCase();
    return logs.filter(
      (log) =>
        log.target_name.toLowerCase().includes(query) ||
        log.operatorName.toLowerCase().includes(query) ||
        ACTION_LABELS[log.action]?.toLowerCase().includes(query),
    );
  }, [logs, searchQuery]);

  const selectedLog = useMemo(() => logs.find((log) => log.id === selectedLogId), [logs, selectedLogId]);

  const renderResultBadge = (result: string) => {
    switch (result) {
      case 'success':
        return (
          <Badge variant="success" size="sm">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            成功
          </Badge>
        );
      case 'failure':
        return (
          <Badge variant="danger" size="sm">
            <XCircle className="w-3 h-3 mr-1" />
            失败
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="warning" size="sm">
            <AlertTriangle className="w-3 h-3 mr-1" />
            部分成功
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" size="sm">
            {result}
          </Badge>
        );
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="operation-log-title"
        className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary-700" />
            <h2 id="operation-log-title" className="text-lg font-semibold text-neutral-900 dark:text-white">操作日志</h2>
            <Badge variant="neutral" size="sm">
              共 {total} 条
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={handleExport}
              loading={isExporting}
            >
              导出
            </Button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 space-y-3">
          <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <Filter className="w-4 h-4" />
            <span className="font-medium">筛选条件</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Select
              value={timeRange}
              onChange={(v) => setTimeRange(v as TimeRange)}
              placeholder="时间范围"
            >
              {TIME_RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>

            {timeRange === 'custom' && (
              <>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomStartDate(e.target.value)}
                />
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomEndDate(e.target.value)}
                  placeholder="结束日期"
                />
              </>
            )}

            <Select value={selectedOperator} onChange={(v) => setSelectedOperator(v)} placeholder="操作人">
              <option value="">全部操作人</option>
              {uniqueOperators.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>

            <Select
              value={selectedActions[0] || ''}
              onChange={(v) => setSelectedActions(v ? [v as OperationAction] : [])}
              placeholder="操作类型"
            >
              <option value="">全部操作类型</option>
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>

            <Select value={selectedResult} onChange={(v) => setSelectedResult(v)} placeholder="操作结果">
              {RESULT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                placeholder="搜索目标名称、操作人..."
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-neutral-800"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-error-600">加载失败，请重试</div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              <FileText className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">暂无日志记录</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800 sticky top-0">
                <tr>
                  <th
                    className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      时间
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    onClick={() => handleSort('operator_name')}
                  >
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      操作人
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    onClick={() => handleSort('action')}
                  >
                    <div className="flex items-center gap-1">
                      <Activity className="w-4 h-4" />
                      操作类型
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300">操作对象</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300">结果</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className={cn(
                      'hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors',
                      selectedLogId === log.id && 'bg-primary-50 dark:bg-primary-300/20',
                    )}
                    onClick={() => setSelectedLogId(log.id)}
                  >
                    <td className="px-4 py-3 text-neutral-900 dark:text-white whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{log.operatorName}</td>
                    <td className="px-4 py-3">
                      <Badge variant="neutral" size="sm">
                        {ACTION_LABELS[log.action] || log.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300 max-w-xs truncate">
                      {log.target_name}
                    </td>
                    <td className="px-4 py-3">{renderResultBadge(log.result)}</td>
                    <td className="px-4 py-3">
                      <Tooltip content="查看详情">
                        <button className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded">
                          <Eye className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
            <div className="text-sm text-neutral-600 dark:text-neutral-400">
              共 {total} 条 · 第 {page}/{totalPages} 页
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon={<ChevronsLeft className="w-4 h-4" />}
                onClick={() => setPage(1)}
                disabled={page === 1}
              />
              <Button
                variant="ghost"
                size="sm"
                icon={<ChevronLeft className="w-4 h-4" />}
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              />
              <span className="text-sm text-neutral-600 dark:text-neutral-400 px-2">{page}</span>
              <Button
                variant="ghost"
                size="sm"
                icon={<ChevronRight className="w-4 h-4" />}
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
              />
              <Button
                variant="ghost"
                size="sm"
                icon={<ChevronsRight className="w-4 h-4" />}
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
              />
            </div>
          </div>
        )}

        {/* Detail Modal */}
        <Modal open={!!selectedLog} onClose={() => setSelectedLogId(null)} title="日志详情" size="lg">
          {selectedLog &&
            (() => {
              const log = selectedLog;
              return (
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">操作时间</label>
                      <div className="text-sm text-neutral-900 dark:text-white">
                        {new Date(log.created_at).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">操作人</label>
                      <div className="text-sm text-neutral-900 dark:text-white">
                        {log.operatorName} ({log.operatorRole})
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">操作类型</label>
                      <div className="text-sm">{renderResultBadge(log.result)}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">IP 地址</label>
                      <div className="text-sm text-neutral-900 dark:text-white">{log.ip_address || '-'}</div>
                    </div>
                  </div>

                  {/* Target Info */}
                  <div>
                    <label className="block text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">操作对象</label>
                    <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{log.target_name}</p>
                      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
                        类型: {log.target_type} · ID: {log.target_id}
                      </p>
                    </div>
                  </div>

                  {/* Changes Diff */}
                  {log.details?.changes && Object.keys(log.details.changes).length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-2">变更详情</label>
                      <div className="space-y-2">
                        {Object.entries(log.details.changes).map(([key, change]) => (
                          <div key={key} className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                            <div className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">{key}</div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-error-600 line-through mr-2">{JSON.stringify(change.from)}</span>
                              </div>
                              <div>
                                <span className="text-success-600">→ {JSON.stringify(change.to)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {log.details?.error_message && (
                    <div>
                      <label className="block text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">错误信息</label>
                      <div className="bg-error-50 dark:bg-error-300/20 border border-error-200 dark:border-error-800 rounded-lg p-3">
                        <p className="text-sm text-error-700 dark:text-error-600">{log.details.error_message}</p>
                      </div>
                    </div>
                  )}

                  {/* Duration & Metadata */}
                  {(log.details?.duration_ms || log.details?.metadata) && (
                    <div className="grid grid-cols-2 gap-4">
                      {log.details?.duration_ms && (
                        <div>
                          <label className="block text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">执行耗时</label>
                          <div className="text-sm text-neutral-900 dark:text-white">
                            {(log.details.duration_ms / 1000).toFixed(2)} 秒
                          </div>
                        </div>
                      )}
                      {log.details?.metadata && (
                        <div>
                          <label className="block text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">元数据</label>
                          <pre className="text-xs bg-neutral-50 dark:bg-neutral-800 rounded p-2 overflow-auto max-h-32">
                            {JSON.stringify(log.details.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
        </Modal>
      </div>
    </div>
  );
}
