/**
 * TCMSP 疾病检索面板
 * 展示 867+ 疾病数据，支持关键词搜索
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { databaseApi } from '@/api/database';
import { Input, Button } from '@/components/ui';
import { Search, Download, ArrowUp, ArrowDown, Minus } from 'lucide-react';

type SortField = 'name';
type SortDir = 'asc' | 'desc';

export default function DiseasesTab() {
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const pageSize = 20;

  const diseasesQuery = useQuery({
    queryKey: ['db-diseases', keyword, page],
    queryFn: async () => databaseApi.searchDiseases({
      keyword: keyword.trim() || undefined,
      page, page_size: pageSize,
    }),
  });

  const statsQuery = useQuery({
    queryKey: ['db-diseases-stats'],
    queryFn: () => databaseApi.getDiseaseStats(),
  });

  const total = diseasesQuery.data?.total ?? 0;
  const items = diseasesQuery.data?.items ?? [];
  const totalPages = Math.ceil(total / pageSize);

  const doSearch = () => setPage(1);

  const exportCSV = () => {
    const headers = ['疾病名称', 'MeSH ID', '来源'];
    const rows = items.map((d: any) => [d.name, d.mesh_id || '', d.source || '']);
    const csv = [headers, ...rows].map((r: any[]) => r.map((c: any) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diseases_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* 统计概览 */}
      {statsQuery.data && (
        <div className="flex flex-wrap gap-3">
          <div className="card px-4 py-3 flex-1 min-w-[140px]">
            <div className="text-lg font-bold text-primary-700 tabular-nums">{statsQuery.data.total_diseases?.toLocaleString() ?? '-'}</div>
            <div className="text-xs text-text-muted font-medium">疾病总数</div>
          </div>
        </div>
      )}

      {/* 搜索栏 */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} placeholder="搜索疾病名称..." className="pl-9" />
        </div>
        <Button variant="primary" size="sm" onClick={doSearch} icon={<Search className="w-3.5 h-3.5" />}>搜索</Button>
        <Button variant="ghost" size="sm" onClick={exportCSV} icon={<Download className="w-3.5 h-3.5" />} disabled={items.length === 0}>导出</Button>
      </div>

      <div className="text-xs text-text-muted">共 {total.toLocaleString()} 种疾病，第 {page}/{totalPages || 1} 页</div>

      {/* 表格 */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">疾病名称</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">MeSH ID</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">来源</th>
              </tr>
            </thead>
            <tbody>
              {diseasesQuery.isLoading ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-text-muted text-sm">加载中...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-text-muted text-sm">暂无数据，请先执行数据同步</td></tr>
              ) : items.map((d: any) => (
                <tr key={d.id} className="border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-text-primary">{d.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-text-muted">{d.mesh_id || <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">-</span>}</td>
                  <td className="px-4 py-2.5 text-text-muted text-xs">{d.source || 'tcmsp'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-text-muted">第 {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} 条，共 {total} 条</div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
            <span className="px-3 py-1 text-xs font-medium text-text-muted">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</Button>
          </div>
        </div>
      )}
    </div>
  );
}
