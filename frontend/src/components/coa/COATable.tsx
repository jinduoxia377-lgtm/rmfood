/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * COA 列表表格组件 — 含 Toast 反馈、删除确认、批量导出
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coaService } from '@/services/professional/coaService';
import type { PeptideBatchCOA } from '@/services/professional/coaService';
import { COACard } from '@/components/coa/COAView';
import { COACreateForm } from '@/components/coa/COACreateForm';
import { Button, Input } from '@/components/ui';
import { Search, RefreshCw, Plus, Trash2, Edit2, Download } from 'lucide-react';
import { useToast } from '@/components/ui';

interface COATableProps {
  peptideId?: number;
  onCOAClick?: (coa: PeptideBatchCOA) => void;
  showStats?: boolean;
  className?: string;
  showBatchExport?: boolean;
}

export function COATable({ peptideId, onCOAClick, showStats = false, className = '', showBatchExport = false }: COATableProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editingCOA, setEditingCOA] = useState<PeptideBatchCOA | null>(null);
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['coa-list', page, search, statusFilter, peptideId],
    queryFn: async () => {
      const params: any = { page, page_size: 20 };
      if (peptideId) params.peptide_id = peptideId;
      if (search) params.product_name_cn = search;
      if (statusFilter !== 'all') params.test_conclusion = statusFilter;
      return coaService.list(params);
    },
  });

  const items = (data as unknown as { items?: PeptideBatchCOA[] } | undefined)?.items ?? [];
  const total = (data as unknown as { total?: number } | undefined)?.total ?? 0;

  // 删除
  const deleteMutation = useMutation({
    mutationFn: (id: number) => coaService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coa-list'] });
      toastSuccess('COA 报告已删除');
    },
    onError: () => {
      toastError('删除失败，请稍后重试');
    },
  });

  // 批量导出（当前页）
  const handleBatchExport = async (format: 'word' | 'pdf') => {
    if (items.length === 0) return;
    for (const coa of items) {
      try {
        const blob = format === 'word'
          ? await coaService.generateWord(coa.id)
          : await coaService.generatePdf(coa.id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `COA_${coa.batch_no}.${format === 'word' ? 'docx' : 'pdf'}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        toastWarning(`COA ${coa.batch_no} 导出失败，已跳过`);
      }
    }
  };

  return (
    <div className={className}>
      {/* 统计 */}
      {showStats && data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg border p-3 text-center">
            <div className="text-xl font-bold">{total}</div>
            <div className="text-xs text-[var(--text-muted)]">总计</div>
          </div>
          <div className="bg-success-50 rounded-lg border border-success-200 p-3 text-center">
            <div className="text-xl font-bold text-success-600">{items.filter((i: PeptideBatchCOA) => i.qualified).length}</div>
            <div className="text-xs text-[var(--text-muted)]">合格</div>
          </div>
          <div className="bg-white dark:bg-neutral-900 rounded-lg border p-3 text-center">
            <div className="text-xl font-bold">{items.length}</div>
            <div className="text-xs text-[var(--text-muted)]">当前页</div>
          </div>
          <div className="bg-white dark:bg-neutral-900 rounded-lg border p-3 text-center">
            <div className="text-xl font-bold">{Math.ceil(total / 20)}</div>
            <div className="text-xs text-[var(--text-muted)]">总页数</div>
          </div>
        </div>
      )}

      {/* 操作栏 */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <Input
              placeholder="搜索产品名称..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 text-sm border border-[var(--border-subtle)] rounded-lg bg-white dark:bg-neutral-900 text-[var(--text-primary)]"
          >
            <option value="all">全部状态</option>
            <option value="合格">合格</option>
            <option value="不合格">不合格</option>
            <option value="待检">待检</option>
          </select>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {showBatchExport && items.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleBatchExport('word')} className="gap-1 text-xs">
                <Download className="w-3.5 h-3.5" /> 批量导出Word
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleBatchExport('pdf')} className="gap-1 text-xs">
                <Download className="w-3.5 h-3.5" /> 批量导出PDF
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" className="gap-1" onClick={() => { setEditingCOA(null); setShowCreate(true); }}>
            <Plus className="w-3.5 h-3.5" />
            新建COA
          </Button>
        </div>
      </div>

      {/* 加载中 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
        </div>
      )}

      {/* 错误状态 */}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <p className="text-sm text-[var(--color-error-text)]">
            {(error as { response?: { status?: number } } | null)?.response?.status === 403
              ? '当前账号无组织或访问权限，请联系管理员确认授权'
              : 'COA数据加载失败，请点击刷新重试'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> 刷新
          </Button>
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && !error && items.length === 0 && (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <p className="text-sm">暂无COA数据</p>
          <p className="text-xs mt-1">点击"新建COA"添加出厂检验报告</p>
        </div>
      )}

      {/* 列表 */}
      {!isLoading && !error && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((coa: PeptideBatchCOA) => (
            <div key={coa.id} className="relative group">
              <COACard coa={coa} onClick={() => onCOAClick?.(coa)} />
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={e => { e.stopPropagation(); setEditingCOA(coa); setShowCreate(true); }}
                  className="p-1 bg-white dark:bg-neutral-900 rounded-lg shadow-sm hover:bg-secondary-50 text-[var(--text-muted)] hover:text-secondary-600"
                  title="编辑"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (confirm(`确定删除批号 ${coa.batch_no} 的COA报告？此操作不可恢复。`)) {
                      deleteMutation.mutate(coa.id);
                    }
                  }}
                  className="p-1 bg-white dark:bg-neutral-900 rounded-lg shadow-sm hover:bg-error-50 text-[var(--text-muted)] hover:text-error-600"
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页 */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-[var(--text-muted)] px-3">
            {page} / {Math.ceil(total / 20)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(total / 20)}
            onClick={() => setPage(p => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      {showCreate && (
        <COACreateForm
          peptideId={peptideId}
          editCOA={editingCOA}
          onClose={() => { setShowCreate(false); setEditingCOA(null); }}
        />
      )}
    </div>
  );
}
