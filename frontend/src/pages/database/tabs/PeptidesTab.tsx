/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 活性肽 Tab — Phase 3 深度完善版
 * - 序列长度范围筛选
 * - 活性值排序（支持升序/降序）
 * - 氨基酸组成统计可视化
 * - 搜索高亮
 * - 骨架屏加载
 * - 导出 CSV
 */
import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { databaseApi } from '@/api/database';
import type { BioactivePeptide } from '@/types';
import { Input, Button, Badge, Modal, Pagination, Card } from '@/components/ui';
import { Download, ChevronUp, ChevronDown, Filter, Dna, Microscope } from 'lucide-react';
import { PeptideDetailContent } from '../PeptideDetailContent';
import PeptideStructureAnalyzer from './PeptideStructureAnalyzer';

// ─── 活性类型颜色映射 ───
const ACTIVITY_COLORS: Record<string, 'primary' | 'info' | 'danger' | 'warning' | 'neutral' | 'success'> = {
  'ACE inhibitory': 'info',
  Antioxidant: 'warning',
  Antimicrobial: 'danger',
  'DPP-IV inhibitory': 'primary',
  Immunomodulatory: 'success',
  'Bone-stimulating': 'info',
};

// ─── 搜索高亮 ───
function Highlight({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword || !text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)] rounded px-0.5">{text.slice(idx, idx + keyword.length)}</mark>
      {text.slice(idx + keyword.length)}
    </>
  );
}

// ─── 骨架屏 ───
function TableSkeleton() {
  return (
    <div className="space-y-[var(--space-apple-sm)] p-[var(--space-apple-md)]">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="h-5 w-24 bg-[var(--border-color)] dark:bg-[var(--bg-secondary)] rounded" />
          <div className="h-5 w-32 bg-[var(--border-color)] dark:bg-[var(--bg-secondary)] rounded" />
          <div className="h-5 w-20 bg-[var(--border-color)] dark:bg-[var(--bg-secondary)] rounded" />
          <div className="h-5 w-24 bg-[var(--border-color)] dark:bg-[var(--bg-secondary)] rounded" />
          <div className="h-5 w-16 bg-[var(--border-color)] dark:bg-[var(--bg-secondary)] rounded" />
          <div className="h-5 w-20 bg-[var(--border-color)] dark:bg-[var(--bg-secondary)] rounded" />
        </div>
      ))}
    </div>
  );
}

type SortField = 'activity_value' | 'molecular_weight' | 'sequence';
type SortDir = 'asc' | 'desc';

// 品类=载体/来源蛋白，DB 真实 source_protein 全称（Lead 从 DB distinct 取，精确 == 匹配用）。
// 全称而非缩写：'Soy protein' 非 'Soy'，'Egg white protein' 非 'Egg'。
const CATEGORY_OPTIONS = [
  'Collagen',
  'Soy protein',
  'Egg white protein',
  'Wheat protein',
  'Casein',
  'Whey protein',
  'Pea protein',
  'Corn protein',
  'Rice protein',
  'Zein',
  'β-Casein',
];

interface PeptidesTabProps {
  initKeyword?: string;
  initialSelectedSequence?: string | null;
  onSequenceConsumed?: () => void;
}

export default function PeptidesTab({
  initKeyword = '',
  initialSelectedSequence,
  onSequenceConsumed,
}: PeptidesTabProps) {
  const [keyword, setKeyword] = useState(initKeyword);
  const [activityType, setActivityType] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedPeptide, setSelectedPeptide] = useState<BioactivePeptide | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [showStructureAnalyzer, setShowStructureAnalyzer] = useState(false);
  // 默认只看「文献确证」真食源肽，避免 7887 条合成/未溯源行淹没 232 条真肽
  const [confirmedOnly, setConfirmedOnly] = useState(true);
  // 品类筛选（维度=载体/来源蛋白 source_protein，客户端过滤；'' = 全部）
  const [selectedCategory, setSelectedCategory] = useState('');

  // 排序
  const [sortField, setSortField] = useState<SortField>('activity_value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // 序列长度筛选
  const [lenMin, setLenMin] = useState('');
  const [lenMax, setLenMax] = useState('');

  const activityTypesQuery = useQuery({
    queryKey: ['db-peptide-types'],
    queryFn: () => databaseApi.getActivityTypes(),
  });

  // 构建 type_en → type_cn 映射表，用于表格和导出
  const activityTypeMap = useMemo(() => {
    const map: Record<string, string> = {};
    activityTypesQuery.data?.activity_types?.forEach((t) => {
      map[t.type_en] = t.type_cn || t.type_en;
    });
    return map;
  }, [activityTypesQuery.data]);

  const peptideQuery = useQuery({
    queryKey: ['db-peptides', keyword, activityType, page, confirmedOnly, selectedCategory],
    queryFn: () =>
      databaseApi.searchPeptides({
        keyword,
        activity_type: activityType || undefined,
        page,
        page_size: 20,
        // 默认只拉「文献确证」真食源肽；关掉开关则传 undefined（后端默认 all 向后兼容）
        provenance: confirmedOnly ? 'literature_confirmed' : undefined,
        // 品类=载体/来源蛋白，服务端精确过滤一次拉全（非当前页子集）
        source_protein: selectedCategory || undefined,
      }),
  });

  const doSearch = () => {
    setPage(1);
    setSelectedPeptide(null);
  };

  // 处理初始选中的肽序列（从热门排行点击过来时）
  useEffect(() => {
    if (initialSelectedSequence && peptideQuery.data?.items && !selectedPeptide) {
      const target = (peptideQuery.data.items.find((p: any) => p.sequence === initialSelectedSequence));
      if (target) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedPeptide(target);
        onSequenceConsumed?.();
      }
    }
  }, [initialSelectedSequence, peptideQuery.data?.items, selectedPeptide, onSequenceConsumed]);

  // 排序后的数据
  const items = useMemo(() => {
    const raw = peptideQuery.data?.items ?? [];
    let arr: unknown[] = [...raw];

    // 长度筛选
    if (lenMin) arr = arr.filter((p: any) => (p.sequence?.length ?? 0) >= Number(lenMin));
    if (lenMax) arr = arr.filter((p: any) => (p.sequence?.length ?? 0) <= Number(lenMax));

    // 排序
    arr.sort((a: any, b: any) => {
      let va: any, vb: any;
      if (sortField === 'activity_value') {
        va = a.activity_value ?? -1;
        vb = b.activity_value ?? -1;
      } else if (sortField === 'molecular_weight') {
        va = a.molecular_weight ?? 0;
        vb = b.molecular_weight ?? 0;
      } else {
        va = a.sequence?.length ?? 0;
        vb = b.sequence?.length ?? 0;
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return arr;
  }, [peptideQuery.data?.items, sortField, sortDir, lenMin, lenMax]);

  // 品类下拉选项：见模块级 CATEGORY_OPTIONS


  const total = peptideQuery.data?.total ?? 0;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  // 导出 CSV
  const exportCSV = () => {
    setExportLoading(true);
    const headers = ['序列', '长度', '来源蛋白', '来源生物', '活性类型', '活性值', '单位', '分子量(Da)', '水解酶'];
    const rows = items.map((p: any) => [
      p.sequence,
      p.sequence?.length ?? '',
      p.source_protein || '',
      p.source_organism || '',
      activityTypeMap[p.activity_type] || p.activity_type || '',
      p.activity_value ?? '',
      p.activity_unit || '',
      p.molecular_weight ?? '',
      p.hydrolysis_enzyme || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `peptides_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportLoading(false);
  };

  return (
    <div className="space-y-[var(--space-apple-md)]">
      {/* 搜索 + 筛选栏 */}
      <div className="flex flex-wrap gap-[var(--space-apple-sm)] items-end">
        <div className="flex-1 min-w-[200px]">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="搜索肽序列、来源蛋白、活性类型..."
            aria-label="搜索活性肽"
          />
        </div>
        <select
          value={activityType || ''}
          onChange={(e) => {
            setActivityType(e.target.value || null);
            setPage(1);
          }}
          className="input w-auto min-w-[160px]"
        >
          <option value="">全部活性类型</option>
          {activityTypesQuery.data?.activity_types.map((t) => (
            <option key={t.type_en} value={t.type_en}>
              {t.type_cn} ({t.count})
            </option>
          ))}
        </select>
        {/* 仅看已确证食源肽（provenance=literature_confirmed） */}
        <button
          type="button"
          onClick={() => { setConfirmedOnly(!confirmedOnly); setPage(1); }}
          aria-pressed={confirmedOnly}
          className={`px-2.5 py-1.5 min-h-[44px] inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] text-xs font-medium transition-all border ${
            confirmedOnly
              ? 'bg-secondary-container text-secondary-main border-[var(--color-secondary)]'
              : 'bg-[var(--bg-secondary)] text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] border-[var(--border-subtle,rgba(0,0,0,0.06))] hover:border-[var(--color-secondary-border)] dark:hover:border-[var(--color-secondary)]'
          }`}
          title="只显示有 PMID/DOI 文献溯源的真食源肽"
        >
          <Dna className="w-3.5 h-3.5" />
          仅看已确证食源肽
        </button>
        {/* 品类筛选（载体/来源蛋白 source_protein，服务端精确过滤一次拉全） */}
        <select
          value={selectedCategory}
          onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
          className="input w-auto min-w-[150px]"
          aria-label="按品类筛选"
        >
          <option value="">全部品类</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {/* 长度筛选 */}
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-[var(--text-muted,#9A9A9F)]" />
          <input
            type="number"
            value={lenMin}
            onChange={(e) => setLenMin(e.target.value)}
            min={1}
            placeholder="最小"
            className="input w-16 text-center text-xs py-1.5"
          />
          <span className="text-[var(--text-muted,#9A9A9F)] text-xs">-</span>
          <input
            type="number"
            value={lenMax}
            onChange={(e) => setLenMax(e.target.value)}
            min={1}
            placeholder="最大"
            className="input w-16 text-center text-xs py-1.5"
          />
          <span className="text-xs text-[var(--text-muted,#9A9A9F)]">aa</span>
        </div>
        <Button variant="primary" onClick={doSearch}>
          搜索
        </Button>
        <Button
          variant="secondary"
          onClick={exportCSV}
          disabled={exportLoading || items.length === 0}
          className="gap-1.5"
        >
          <Download className="w-4 h-4" />
          导出
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowStructureAnalyzer(!showStructureAnalyzer)}
          className="gap-1.5"
        >
          <Microscope className="w-4 h-4" />
          结构分析
        </Button>
      </div>

      {/* 活性类型快速筛选标签 */}
      <div className="flex flex-wrap gap-1.5">
        {activityTypesQuery.data?.activity_types?.slice(0, 8).map((t) => (
          <button
            key={t.type_en}
            onClick={() => {
              setActivityType(activityType === t.type_en ? null : t.type_en);
              setPage(1);
            }}
            className={`px-2.5 py-1 min-h-[44px] inline-flex items-center rounded-[var(--radius-pill)] text-xs font-medium transition-all border ${
              activityType === t.type_en
                ? 'bg-secondary-container text-secondary-main border-[var(--color-secondary)]'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] border-[var(--border-subtle,rgba(0,0,0,0.06))] hover:border-[var(--color-secondary-border)] dark:hover:border-[var(--color-secondary)]'
            }`}
          >
            {t.type_cn} <span className="opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      {showStructureAnalyzer && (
        <PeptideStructureAnalyzer />
      )}

      <Card className="overflow-hidden">
        {peptideQuery.isError ? (
          <div className="p-16 text-center">
            <div className="text-[var(--color-error-text)]0 text-sm">❌ 数据加载失败，请刷新页面重试</div>
          </div>
        ) : peptideQuery.isLoading ? (
          <TableSkeleton />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle,rgba(0,0,0,0.06))]">
                  {[
                    { label: '序列', field: null as SortField | null },
                    { label: '来源蛋白', field: null },
                    { label: '活性类型', field: null },
                    { label: '活性值', field: 'activity_value' as SortField },
                    { label: '分子量(Da)', field: 'molecular_weight' as SortField },
                    { label: '长度(aa)', field: 'sequence' as SortField },
                  ].map(({ label, field }) => (
                    <th
                      key={label}
                      className={`px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-left text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider ${field ? 'cursor-pointer hover:text-[var(--text-primary,#1D1D1F)] dark:hover:text-white select-none' : ''}`}
                      onClick={() => field && toggleSort(field)}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        {field && <SortIcon field={field} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(148,163,184,0.08)]">
                {items.map((item: any) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedPeptide(item)}
                    className="cursor-pointer hover:bg-[var(--color-secondary-container)]/60 dark:hover:bg-[var(--color-secondary-container)]/20 transition-colors duration-150 group"
                  >
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                      <span className="font-mono font-medium text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)] group-hover:text-[var(--color-secondary-text)] transition-colors">
                        <Highlight text={item.sequence} keyword={keyword} />
                      </span>
                      {item.provenance === 'literature_confirmed' && (
                        <Badge variant="success" size="sm" className="ml-1.5">文献确证</Badge>
                      )}
                    </td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,var(--bg-canvas))]">
                      <Highlight text={item.source_protein || '-'} keyword={keyword} />
                    </td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                      <Badge variant={ACTIVITY_COLORS[item.activity_type || ''] || 'neutral'} size="sm">
                        {activityTypeMap[item.activity_type || ''] || item.activity_type || '-'}
                      </Badge>
                    </td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-center">
                      <span className="font-mono text-xs">
                        {item.activity_value != null ? `${item.activity_value} ${item.activity_unit || ''}` : '-'}
                      </span>
                    </td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-center">
                      <span className="font-mono text-xs text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)]">
                        {item.molecular_weight?.toFixed(1) || '-'}
                      </span>
                    </td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-center">
                      <span className="font-mono text-xs text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)]">
                        {item.sequence?.length ?? '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {items.length === 0 && !peptideQuery.isLoading && (
          <div className="p-16 text-center">
            <Dna className="w-10 h-10 mx-auto mb-[var(--space-apple-sm)] opacity-30" />
            <div className="text-[var(--text-muted,#9A9A9F)] text-sm">
              {keyword || activityType || lenMin || lenMax || selectedCategory ? '未找到匹配结果' : '请输入关键词搜索活性肽数据'}
            </div>
          </div>
        )}
      </Card>

      {Math.ceil(total / 20) > 1 && (
        <Pagination currentPage={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
      )}

      <Modal
        open={!!selectedPeptide}
        onClose={() => setSelectedPeptide(null)}
        title={selectedPeptide?.sequence ?? ''}
        size="lg"
      >
        {selectedPeptide && <PeptideDetailContent peptide={selectedPeptide} />}
      </Modal>
    </div>
  );
}
