/**
 * TCMSP 靶点检索面板
 * 展示 3,300+ 靶点数据，支持关键词搜索
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { databaseApi } from '@/api/database';
import { Input, Button, Badge } from '@/components/ui';
import { Search, Download, ArrowUp, ArrowDown, Minus } from 'lucide-react';

type SortField = 'name' | 'gene_symbol';
type SortDir = 'asc' | 'desc';

export default function TargetsTab() {
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const pageSize = 20;

  const targetsQuery = useQuery({
    queryKey: ['db-targets', keyword, page, sortField, sortDir],
    queryFn: async () => databaseApi.searchTargets({
      keyword: keyword.trim() || undefined,
      page, page_size: pageSize,
    }),
  });

  const statsQuery = useQuery({
    queryKey: ['db-targets-stats'],
    queryFn: () => databaseApi.getTargetStats(),
  });

  const total = targetsQuery.data?.total ?? 0;
  const items = targetsQuery.data?.items ?? [];
  const totalPages = Math.ceil(total / pageSize);

  const doSearch = () => setPage(1);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <Minus className="w-3 h-3 ml-0.5 opacity-20" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 ml-0.5 text-[var(--color-primary-text)]0" />
      : <ArrowDown className="w-3 h-3 ml-0.5 text-[var(--color-primary-text)]0" />;
  };

  const exportCSV = () => {
    const headers = ['靶点名称', '基因符号', '物种', '来源'];
    const rows = items.map((t: any) => [t.name, t.gene_symbol || '', t.organism || '', t.source || '']);
    const csv = [headers, ...rows].map((r: any[]) => r.map((c: any) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `targets_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* 统计概览 */}
      {statsQuery.data && (
        <div className="flex flex-wrap gap-3">
          {[
            { label: '靶点总数', value: statsQuery.data.total_targets?.toLocaleString() ?? '-', color: 'text-[var(--color-primary-text)]' },
            { label: '有基因符号', value: statsQuery.data.with_gene_symbol?.toLocaleString() ?? '0', color: 'text-[var(--color-accent-text)]' },
          ].map((s, i) => (
            <div key={i} className="card px-4 py-3 flex-1 min-w-[140px]">
              <div className={`text-lg font-bold ${s.color} tabular-nums`}>{s.value}</div>
              <div className="text-xs text-[var(--text-muted)] font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 搜索栏 */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} placeholder="搜索靶点名称或基因符号..." className="pl-9" />
        </div>
        <Button variant="primary" size="sm" onClick={doSearch} icon={<Search className="w-3.5 h-3.5" />}>搜索</Button>
        <Button variant="ghost" size="sm" onClick={exportCSV} icon={<Download className="w-3.5 h-3.5" />} disabled={items.length === 0}>导出</Button>
      </div>

      <div className="text-xs text-[var(--text-muted)]">共 {total.toLocaleString()} 个靶点，第 {page}/{totalPages || 1} 页</div>

      {/* 表格 */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] dark:border-neutral-700 bg-[var(--bg-tertiary)]/50">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                    靶点名称 <SortIcon field="name" />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  <button onClick={() => toggleSort('gene_symbol')} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                    基因符号 <SortIcon field="gene_symbol" />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">物种</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">来源</th>
              </tr>
            </thead>
            <tbody>
              {targetsQuery.isLoading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">加载中...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">暂无数据，请先执行数据同步</td></tr>
              ) : items.map((t: any) => (
                <tr key={t.id} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-[var(--text-primary)] max-w-[300px] truncate" title={t.name}>{t.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-primary-text)] dark:text-[var(--color-primary-text)]">{t.gene_symbol || <span className="text-[var(--text-muted)]">-</span>}</td>
                  <td className="px-4 py-2.5 text-[var(--text-muted)]">{t.organism || '-'}</td>
                  <td className="px-4 py-2.5"><Badge variant="secondary" size="sm">{t.source || 'tcmsp'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-[var(--text-muted)]">第 {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} 条，共 {total} 条</div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
            <span className="px-3 py-1 text-xs font-medium text-[var(--text-muted)]">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</Button>
          </div>
        </div>
      )}
    </div>
  );
}
