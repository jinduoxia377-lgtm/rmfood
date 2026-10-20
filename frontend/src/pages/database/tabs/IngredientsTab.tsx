/**
 * TCMSP 化合物检索面板
 * 展示 13,000+ 化合物，支持 OB%/DL 筛选、分页、排序
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { databaseApi } from '@/api/database';
import { Input, Button } from '@/components/ui';
import { Search, Filter, ArrowUp, ArrowDown, Minus, Download } from 'lucide-react';

type SortField = 'name' | 'ob_percent' | 'dl_value' | 'molecular_weight';
type SortDir = 'asc' | 'desc';

export default function IngredientsTab() {
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [minOB, setMinOB] = useState<string>('');
  const [maxOB, setMaxOB] = useState<string>('');
  const [minDL, setMinDL] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('ob_percent');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showFilters, setShowFilters] = useState(false);

  const pageSize = 20;

  const compoundsQuery = useQuery({
    queryKey: ['db-compounds', keyword, minOB, maxOB, minDL, page, sortField, sortDir],
    queryFn: async () => databaseApi.searchCompounds({
      keyword: keyword.trim() || undefined,
      min_ob: minOB !== '' ? parseFloat(minOB) : undefined,
      max_ob: maxOB !== '' ? parseFloat(maxOB) : undefined,
      min_dl: minDL !== '' ? parseFloat(minDL) : undefined,
      page, page_size: pageSize,
    }),
  });

  const statsQuery = useQuery({
    queryKey: ['db-compounds-stats'],
    queryFn: () => databaseApi.getCompoundStats(),
  });

  const total = compoundsQuery.data?.total ?? 0;
  const items = compoundsQuery.data?.items ?? [];
  const totalPages = Math.ceil(total / pageSize);

  const doSearch = () => setPage(1);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const exportCSV = () => {
    const headers = ['化合物名称', 'TCMSP ID', 'OB%', 'DL', '分子量', 'LogP', 'HBD', 'HBA'];
    const rows = items.map((c: any) => [
      c.name, c.tcmsp_compound_id, c.ob_percent ?? '', c.dl_value ?? '',
      c.molecular_weight ?? '', c.logp ?? '', c.hbd ?? '', c.hba ?? '',
    ]);
    const csv = [headers, ...rows].map((r: any[]) => r.map((c: any) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compounds_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <Minus className="w-3 h-3 ml-0.5 opacity-20" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-0.5 text-[var(--color-primary-text)]0" />
      : <ArrowDown className="w-3 h-3 ml-0.5 text-[var(--color-primary-text)]0" />;
  };

  const obColor = (ob: number | null) => {
    if (ob === null) return 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]';
    if (ob >= 50) return 'text-[var(--color-primary-text)] font-semibold';
    if (ob >= 30) return 'text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]';
    return 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]';
  };

  const dlColor = (dl: number | null) => {
    if (dl === null) return 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]';
    if (dl >= 0.50) return 'text-[var(--color-primary-text)] font-semibold';
    if (dl >= 0.18) return 'text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]';
    return 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]';
  };

  return (
    <div className="space-y-[var(--space-apple-md)]">
      {/* 统计概览 */}
      {statsQuery.data && (
        <div className="flex flex-wrap gap-[var(--space-apple-sm)]">
          {[
            { label: '化合物总数', value: statsQuery.data.total_compounds?.toLocaleString() ?? '-', color: 'text-[var(--color-primary-text)]' },
            { label: '高活性(OB≥50%)', value: statsQuery.data.ob_distribution?.find((o: any) => o.label.includes('50-70'))?.count ?? 0, color: 'text-[var(--color-accent-text)]' },
            { label: '类药性好(DL≥0.18)', value: statsQuery.data.dl_distribution?.filter((d: any) => d.label.includes('0.18') || d.label.includes('0.50') || d.label.includes('0.80')).reduce((s: number, d: any) => s + d.count, 0) ?? 0, color: 'text-[var(--color-success-text)]' },
          ].map((s, i) => (
            <div key={i} className="card px-[var(--space-apple-md)] py-[var(--space-apple-md)] flex-1 min-w-[140px]">
              <div className={`text-lg font-bold ${s.color} tabular-nums`}>{s.value}</div>
              <div className="text-xs text-[var(--text-muted)] font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 搜索栏 */}
      <div className="flex flex-wrap gap-[var(--space-apple-sm)] items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="搜索化合物名称..."
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} icon={<Filter className="w-3.5 h-3.5" />}>
          筛选
        </Button>
        <Button variant="primary" size="sm" onClick={doSearch} icon={<Search className="w-3.5 h-3.5" />}>
          搜索
        </Button>
        <Button variant="ghost" size="sm" onClick={exportCSV} icon={<Download className="w-3.5 h-3.5" />} disabled={items.length === 0}>
          导出
        </Button>
      </div>

      {/* 筛选面板 */}
      {showFilters && (
        <div className="card p-[var(--space-apple-md)] space-y-[var(--space-apple-sm)]">
          <div className="flex flex-wrap gap-[var(--space-apple-sm)]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] w-16">OB% 范围:</span>
              <Input value={minOB} onChange={(e) => setMinOB(e.target.value)} placeholder="最小" className="w-20 text-xs" />
              <span className="text-xs text-[var(--text-muted)]">-</span>
              <Input value={maxOB} onChange={(e) => setMaxOB(e.target.value)} placeholder="最大" className="w-20 text-xs" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] w-16">DL 最小:</span>
              <Input value={minDL} onChange={(e) => setMinDL(e.target.value)} placeholder="0.18" className="w-20 text-xs" />
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setMinOB(''); setMaxOB(''); setMinDL(''); setPage(1); }}>
              重置
            </Button>
          </div>
        </div>
      )}

      {/* 结果计数 */}
      <div className="text-xs text-[var(--text-muted)]">
        共 {total.toLocaleString()} 个化合物，第 {page}/{totalPages || 1} 页
      </div>

      {/* 表格 */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/50">
                <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                    化合物名称
                    {/* eslint-disable-next-line react-hooks/static-components */}
                    <SortIcon field="name" />
                  </button>
                </th>
                <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">TCMSP ID</th>
                <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  <button onClick={() => toggleSort('ob_percent')} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                    OB%
                    {/* eslint-disable-next-line react-hooks/static-components */}
                    <SortIcon field="ob_percent" />
                  </button>
                </th>
                <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  <button onClick={() => toggleSort('dl_value')} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                    DL
                    {/* eslint-disable-next-line react-hooks/static-components */}
                    <SortIcon field="dl_value" />
                  </button>
                </th>
                <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  <button onClick={() => toggleSort('molecular_weight')} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                    分子量
                    {/* eslint-disable-next-line react-hooks/static-components */}
                    <SortIcon field="molecular_weight" />
                  </button>
                </th>
                <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">LogP</th>
                <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">HBD</th>
                <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">HBA</th>
              </tr>
            </thead>
            <tbody>
              {compoundsQuery.isLoading ? (
                <tr><td colSpan={8} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">加载中...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">暂无数据，请先执行数据同步</td></tr>
              ) : items.map((c: any) => (
                <tr key={c.id} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                  <td className="px-[var(--space-apple-md)] py-2.5 font-medium text-[var(--text-primary)] max-w-[200px] truncate" title={c.name}>
                    {c.name}
                  </td>
                  <td className="px-[var(--space-apple-md)] py-2.5 font-mono text-xs text-[var(--text-muted)]">{c.tcmsp_compound_id || '-'}</td>
                  <td className={`px-[var(--space-apple-md)] py-2.5 tabular-nums ${obColor(c.ob_percent)}`}>{c.ob_percent ?? '-'}</td>
                  <td className={`px-[var(--space-apple-md)] py-2.5 tabular-nums ${dlColor(c.dl_value)}`}>{c.dl_value ?? '-'}</td>
                  <td className="px-[var(--space-apple-md)] py-2.5 tabular-nums text-[var(--text-muted)]">{c.molecular_weight ?? '-'}</td>
                  <td className="px-[var(--space-apple-md)] py-2.5 tabular-nums text-[var(--text-muted)]">{c.logp ?? '-'}</td>
                  <td className="px-[var(--space-apple-md)] py-2.5 tabular-nums text-[var(--text-muted)]">{c.hbd ?? '-'}</td>
                  <td className="px-[var(--space-apple-md)] py-2.5 tabular-nums text-[var(--text-muted)]">{c.hba ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-[var(--text-muted)]">
            第 {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} 条，共 {total} 条
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              上一页
            </Button>
            <span className="px-[var(--space-apple-sm)] py-1 text-xs font-medium text-[var(--text-muted)]">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
