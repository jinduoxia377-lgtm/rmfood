/**
 * 合规范式页面
 * 展示国家标准目录、药食同源目录、GB 2760/14880、禁忌搭配、合规检查
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { complianceApi } from '@/api/compliance';
import type { ComplianceResult } from '@/api/compliance';
import {
  Input, Button, Badge, Card, CardHeader, CardTitle, CardContent,
} from '@/components/ui';
import {
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, XCircle,
  Search, Download, RefreshCw, ArrowUp, ArrowDown, Minus, FileText,
  BookOpen, Pill, Beaker, TestTube, Scale,
} from 'lucide-react';

type Population = 'adults' | 'children' | 'elderly';
type SortDir = 'asc' | 'desc';

// ─── 合规状态徽标 ───
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string; border: string; label: string }> = {
    compliant: { color: 'text-[var(--color-success-text)] dark:text-[var(--color-success-text)]', bg: 'bg-[var(--color-success-container)]', border: 'border-[var(--color-success-border)] dark:border-[var(--color-success)]', label: '合规' },
    warning: { color: 'text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]', bg: 'bg-[var(--color-warning-container)]', border: 'border-[var(--color-warning-border)] dark:border-[var(--color-warning)]', label: '需注意' },
    non_compliant: { color: 'text-[var(--color-error-text)] dark:text-[var(--color-error-text)]', bg: 'bg-[var(--color-error-container)]', border: 'border-[var(--color-error-border)] dark:border-[var(--color-error)]', label: '不合规' },
  };
  const c = config[status] ?? config.compliant;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-pill)] text-xs font-semibold border ${c.bg} ${c.border} ${c.color}`}>
      {c.label}
    </span>
  );
}

// ─── 违规类型标签 ───
function ViolationTypeTag({ type }: { type: string }) {
  const config: Record<string, { label: string; color: string; bg: string; border: string }> = {
    exceeds_limit: { label: '超限量', color: 'text-[var(--color-error-text)] dark:text-[var(--color-error-text)]', bg: 'bg-[var(--color-error-container)]', border: 'border-[var(--color-error-border)] dark:border-[var(--color-error)]' },
    prohibited_combo: { label: '禁忌搭配', color: 'text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]', bg: 'bg-[var(--color-warning-container)]', border: 'border-[var(--color-warning-border)] dark:border-[var(--color-warning)]' },
    child_forbidden: { label: '儿童禁忌', color: 'text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]', bg: 'bg-[var(--color-accent-container)]', border: 'border-[var(--color-accent-border)] dark:border-[var(--color-accent)]' },
    not_in_directory: { label: '非目录', color: 'text-[var(--text-secondary)]', bg: 'bg-[var(--bg-tertiary)]/50', border: 'border-[var(--border-color)]' },
    gb2760: { label: 'GB 2760', color: 'text-info-600 dark:text-info-600', bg: 'bg-info-50 dark:bg-info-300/20', border: 'border-info-200 dark:border-info-800' },
    gb14880: { label: 'GB 14880', color: 'text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]', bg: 'bg-[var(--color-accent-container)]', border: 'border-[var(--color-accent-border)] dark:border-[var(--color-accent)]' },
    prohibited_tcm: { label: '禁用品', color: 'text-[var(--color-error-text)] dark:text-[var(--color-error-text)]', bg: 'bg-[var(--color-error-container)]', border: 'border-[var(--color-error-border)] dark:border-[var(--color-error)]' },
  };
  const c = config[type] ?? config.not_in_directory;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${c.bg} ${c.border} ${c.color}`}>
      {c.label}
    </span>
  );
}

// ─── 排序图标 ───
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <Minus className="w-3 h-3 ml-0.5 opacity-20" />;
  return dir === 'asc'
    ? <ArrowUp className="w-3 h-3 ml-0.5 text-[var(--color-primary-text)]0" />
    : <ArrowDown className="w-3 h-3 ml-0.5 text-[var(--color-primary-text)]0" />;
}

// ─── CSV 导出辅助 ───
function exportCSV(rows: Record<string, any>[], columns: string[], filename: string) {
  const header = columns.join(',');
  const csvRows = rows.map(row =>
    columns.map(c => `"${String(row[c] ?? '').replace(/"/g, '""')}"`).join(',')
  );
  const blob = new Blob(['\uFEFF' + [header, ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── 主组件 ───
export default function ComplianceTab() {
  const [activeSection, setActiveSection] = useState<'standards' | 'homology' | 'gb' | 'prohibited' | 'check'>('standards');
  const [population, setPopulation] = useState<Population>('adults');
  const [ingredients, setIngredients] = useState<{ name: string; dosage_mg: string }[]>([
    { name: '', dosage_mg: '' },
  ]);
  const [checkResult, setCheckResult] = useState<ComplianceResult | null>(null);
  const [checking, setChecking] = useState(false);

  // 搜索状态
  const [standardSearch, setStandardSearch] = useState('');
  const [standardCategory, setStandardCategory] = useState('');
  const [homologySearch, setHomologySearch] = useState('');
  const [prohibitedSearch, setProhibitedSearch] = useState('');

  // 排序状态
  const [gb2760Sort, setGb2760Sort] = useState<{ field: 'name' | 'max_usage'; dir: SortDir }>({ field: 'name', dir: 'asc' });
  const [gb14880Sort, setGb14880Sort] = useState<{ field: 'name' | 'min' | 'max'; dir: SortDir }>({ field: 'name', dir: 'asc' });
  const [homologySort] = useState<{ field: 'name' | 'max_dosage'; dir: SortDir }>({ field: 'name', dir: 'asc' });
  const [standardsSort, setStandardsSort] = useState<{ field: 'standard_code' | 'publish_date' | 'category'; dir: SortDir }>({ field: 'publish_date', dir: 'desc' });

  // 法规分类筛选
  const STANDARD_CATEGORIES = ['全部', '食品添加剂', '农药残留', '污染物限量', '微生物控制', '乳制品', '饮料', '调味品', '油脂', '婴幼儿食品', '冷冻食品', '蛋白质类', '食品接触材料', '兽药残留'];

  // 加载药食同源限量数据
  const { data: limitsData, isLoading: limitsLoading } = useQuery({
    queryKey: ['compliance-limits'],
    queryFn: () => complianceApi.getLimits(),
  });
  // 加载禁忌搭配
  const { data: prohibitedData, isLoading: prohibitedLoading } = useQuery({
    queryKey: ['compliance-prohibited'],
    queryFn: () => complianceApi.getProhibited(),
  });
  // 加载 GB 2760
  const { data: gb2760Data, isLoading: gb2760Loading } = useQuery({
    queryKey: ['compliance-gb2760'],
    queryFn: () => complianceApi.getGB2760(),
    retry: 1,
  });
  // 加载 GB 14880
  const { data: gb14880Data, isLoading: gb14880Loading } = useQuery({
    queryKey: ['compliance-gb14880'],
    queryFn: () => complianceApi.getGB14880(),
    retry: 1,
  });
  // 加载禁用品清单
  const { data: gbProhibitedData, isLoading: gbProhibitedLoading } = useQuery({
    queryKey: ['compliance-gb-prohibited'],
    queryFn: () => complianceApi.getGBProhibited(),
    retry: 1,
  });
  // 加载食品安全国家标准目录
  const { data: standardsData, isLoading: standardsLoading } = useQuery({
    queryKey: ['compliance-standards', standardCategory],
    queryFn: () => complianceApi.getStandards(standardCategory || undefined),
    retry: 1,
  });
  // 加载药食同源完整目录
  const { data: homologyData, isLoading: homologyLoading } = useQuery({
    queryKey: ['compliance-food-homology', homologySearch],
    queryFn: () => complianceApi.getFoodHomology(homologySearch || undefined),
    retry: 1,
    enabled: activeSection === 'homology',
  });

  const limits = limitsData?.data?.limits ?? {};
  const prohibitedPairs = prohibitedData?.data?.combinations ?? [];
  const gb2760Additives = gb2760Data?.data?.additives ?? [];
  const gb14880Enrichers = gb14880Data?.data?.enrichers ?? [];
  const gbProhibitedItems = gbProhibitedData?.data?.items ?? [];
  const foodSafetyStandards = standardsData?.data?.standards ?? [];
  const foodHomologyMaterials = homologyData?.data?.materials ?? [];
  const standardsCount = standardsData?.data?.count ?? 0;
  const homologyCount = homologyData?.data?.count ?? 0;

  // GB 2760 排序
  const toggleGb2760Sort = (field: 'name' | 'max_usage') => {
    setGb2760Sort(prev => prev.field === field
      ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { field, dir: 'asc' });
  };
  const sortedGb2760 = [...gb2760Additives]
    .sort((a: any, b: any) => {
      const av = gb2760Sort.field === 'name' ? a.name : a.max_usage;
      const bv = gb2760Sort.field === 'name' ? b.name : b.max_usage;
      const cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
      return gb2760Sort.dir === 'asc' ? cmp : -cmp;
    })
    .filter(a => !standardSearch || a.name.includes(standardSearch));

  // GB 14880 排序
  const toggleGb14880Sort = (field: 'name' | 'min' | 'max') => {
    setGb14880Sort(prev => prev.field === field
      ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { field, dir: 'asc' });
  };
  const sortedGb14880 = [...gb14880Enrichers]
    .sort((a: any, b: any) => {
      const av = gb14880Sort.field === 'name' ? a.name : gb14880Sort.field === 'min' ? a.min : a.max;
      const bv = gb14880Sort.field === 'name' ? b.name : gb14880Sort.field === 'min' ? b.min : b.max;
      const cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
      return gb14880Sort.dir === 'asc' ? cmp : -cmp;
    })
    .filter(a => !standardSearch || a.name.includes(standardSearch));

  // 药食同源排序
  const sortedHomology = [...foodHomologyMaterials]
    .sort((a: any, b: any) => {
      const av = homologySort.field === 'name' ? a.name : String(a.max_dosage || '');
      const bv = homologySort.field === 'name' ? b.name : String(b.max_dosage || '');
      const cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
      return homologySort.dir === 'asc' ? cmp : -cmp;
    });

  // 国家标准目录排序
  const toggleStandardsSort = (field: 'standard_code' | 'publish_date' | 'category') => {
    setStandardsSort(prev => prev.field === field
      ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { field, dir: 'asc' });
  };
  const filteredStandards = foodSafetyStandards
    .sort((a: any, b: any) => {
      const av = standardsSort.field === 'standard_code' ? a.standard_code :
                 standardsSort.field === 'publish_date' ? a.publish_date : a.category;
      const bv = standardsSort.field === 'standard_code' ? b.standard_code :
                 standardsSort.field === 'publish_date' ? b.publish_date : b.category;
      const cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
      return standardsSort.dir === 'asc' ? cmp : -cmp;
    })
    .filter(s => {
      const matchSearch = !standardSearch ||
        s.standard_code.toLowerCase().includes(standardSearch.toLowerCase()) ||
        s.title.includes(standardSearch) ||
        s.summary.includes(standardSearch);
      const matchCategory = !standardCategory || standardCategory === '全部' || s.category === standardCategory;
      return matchSearch && matchCategory;
    });

  // 禁忌搜索
  const filteredProhibited = prohibitedPairs.filter((p: any) =>
    !prohibitedSearch || p.pair.some((n: string) => n.includes(prohibitedSearch))
  );

  // 成分管理
  const addIngredient = () => setIngredients(prev => [...prev, { name: '', dosage_mg: '' }]);
  const removeIngredient = (idx: number) => setIngredients(prev => prev.filter((_, i) => i !== idx));
  const updateIngredient = (idx: number, field: string, value: string) => {
    setIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing));
  };

  const handleCheck = async () => {
    const valid = ingredients.filter(i => i.name.trim() && i.dosage_mg.trim());
    if (valid.length === 0) return;
    setChecking(true);
    try {
      const res = await complianceApi.bulkCheck(
        valid.map(i => ({ name: i.name.trim(), dosage_mg: parseFloat(i.dosage_mg) || 0 })),
        population,
      );
      setCheckResult(res.data);
    } catch {
      setCheckResult({ score: 0, status: 'non_compliant', violations: [], warnings: ['检查失败，请重试'], suggestions: [] });
    } finally {
      setChecking(false);
    }
  };

  // ─── 导航按钮 ───
  const tabs = [
    { key: 'standards' as const, label: '国家标准目录', icon: FileText, count: standardsCount },
    { key: 'homology' as const, label: '药食同源目录', icon: BookOpen, count: homologyCount },
    { key: 'gb' as const, label: 'GB 2760/14880', icon: Beaker, count: gb2760Additives.length + gb14880Enrichers.length },
    { key: 'prohibited' as const, label: '禁忌禁用品', icon: ShieldAlert, count: prohibitedPairs.length + gbProhibitedItems.length },
    { key: 'check' as const, label: '合规检查', icon: ShieldCheck },
  ];

  return (
    <div className="space-y-5">
      {/* 导航栏 */}
      <div className="flex flex-wrap gap-2 p-1 bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-md)]">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--radius-Apple-sm)] text-sm font-semibold transition-all ${
              activeSection === key
                ? 'bg-[var(--bg-secondary)] text-[var(--color-primary-text)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {count !== undefined && count > 0 && (
              <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-[var(--radius-pill)] ${
                activeSection === key
                  ? 'bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)]/30 text-[var(--color-primary-text)]'
                  : 'bg-[var(--border-color)] dark:bg-[var(--bg-secondary)] text-[var(--text-muted)]'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════ */}
      {/*  国家标准目录                          */}
      {/* ════════════════════════════════════ */}
      {activeSection === 'standards' && (
        <div className="space-y-[var(--space-apple-md)]">
          {/* 说明卡 */}
          <Card>
            <CardContent className="p-[var(--space-apple-md)]">
              <div className="flex items-start gap-[var(--space-apple-sm)]">
                <Scale className="w-5 h-5 text-[var(--color-primary-text)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] leading-relaxed">
                    食品安全国家标准目录（持续更新）
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                    涵盖 GB 2760（食品添加剂）、GB 2763（农药残留）、GB 2762（污染物）等 P0 核心标准，
                    以及乳制品、饮料、调味品等品类标准。数据来源：国家卫生健康委员会 / FoodTalks。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 筛选工具栏 */}
          <div className="flex flex-wrap items-center gap-[var(--space-apple-sm)]">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
              <Input
                value={standardSearch}
                onChange={e => setStandardSearch(e.target.value)}
                placeholder="搜索标准号或名称..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STANDARD_CATEGORIES.slice(0, 6).map(cat => (
                <button
                  key={cat}
                  onClick={() => setStandardCategory(cat === standardCategory ? '' : cat)}
                  className={`px-[var(--space-apple-sm)] py-1.5 text-xs font-medium rounded-[var(--radius-Apple-sm)] border transition-all ${
                    standardCategory === cat
                      ? 'bg-[var(--color-primary-container)] border-[var(--color-primary-border)] dark:border-[var(--color-primary)] text-[var(--color-primary-text)]'
                      : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--border-color)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 标准列表 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[var(--color-primary-text)]" />
                  国家标准列表（{filteredStandards.length} 项）
                </CardTitle>
                <Button
                  variant="ghost" size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => exportCSV(
                    filteredStandards.map(s => ({
                      标准号: s.standard_code,
                      名称: s.title,
                      类别: s.category,
                      状态: s.status,
                      发布日期: s.publish_date,
                      实施日期: s.implementation_date,
                    })),
                    ['标准号', '名称', '类别', '状态', '发布日期', '实施日期'],
                    `food_safety_standards_${new Date().toISOString().slice(0, 10)}.csv`,
                  )}
                  disabled={standardsLoading}
                >
                  导出
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/50">
                      <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                        <button onClick={() => toggleStandardsSort('standard_code')} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                          标准号 <SortIcon active={standardsSort.field === 'standard_code'} dir={standardsSort.dir} />
                        </button>
                      </th>
                      <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">标准名称</th>
                      <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">类别</th>
                      <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                        <button onClick={() => toggleStandardsSort('publish_date')} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                          实施日期 <SortIcon active={standardsSort.field === 'publish_date'} dir={standardsSort.dir} />
                        </button>
                      </th>
                      <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">优先级</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standardsLoading ? (
                      <tr><td colSpan={5} className="px-[var(--space-apple-md)] py-12 text-center text-[var(--text-muted)] text-sm">加载中...</td></tr>
                    ) : filteredStandards.length === 0 ? (
                      <tr><td colSpan={5} className="px-[var(--space-apple-md)] py-12 text-center text-[var(--text-muted)] text-sm">暂无匹配标准</td></tr>
                    ) : filteredStandards.map((s: any, i: number) => (
                      <tr key={i} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                        <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] font-mono text-xs font-semibold text-[var(--color-primary-text)]">{s.standard_code}</td>
                        <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] max-w-[320px]">
                          <p className="font-medium text-[var(--text-primary)] text-sm leading-snug">{s.title}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">{s.summary}</p>
                        </td>
                        <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                            {s.category}
                          </span>
                        </td>
                        <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-xs text-[var(--text-muted)] tabular-nums">{s.implementation_date || '—'}</td>
                        <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                          <Badge
                            variant={s.priority?.startsWith('P0') ? 'default' : s.priority?.startsWith('P1') ? 'secondary' : 'outline'}
                            className="text-xs"
                          >
                            {s.priority?.replace('P0-核心必备', '核心').replace('P1-重要', '重要') || '—'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════ */}
      {/*  药食同源目录                          */}
      {/* ════════════════════════════════════ */}
      {activeSection === 'homology' && (
        <div className="space-y-[var(--space-apple-md)]">
          <Card>
            <CardContent className="p-[var(--space-apple-md)]">
              <div className="flex items-start gap-[var(--space-apple-sm)]">
                <BookOpen className="w-5 h-5 text-[var(--color-success-text)] dark:text-[var(--color-success-text)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] leading-relaxed">
                    药食同源物质目录（卫健委公告）
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                    收录已获批用于普通食品的药食同源中药材，含拉丁学名、适用人群、每日限量、用法形式及禁忌事项。
                    数据来源于国家卫健委公告及 TCMSP 中药系统药理学数据库。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 搜索框 */}
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
              <Input
                value={homologySearch}
                onChange={e => setHomologySearch(e.target.value)}
                placeholder="搜索药材名称..."
                className="pl-9"
              />
            </div>
            <button
              onClick={() => exportCSV(
                sortedHomology.map(m => ({
                  名称: m.name,
                  拉丁名: m.latin_name,
                  类别: m.category,
                  限量: m.max_dosage,
                  禁用人群: (m.restrictions || []).join('；'),
                })),
                ['名称', '拉丁名', '类别', '限量', '禁用人群'],
                `food_homology_${new Date().toISOString().slice(0, 10)}.csv`,
              )}
              className="px-[var(--space-apple-sm)] py-2 text-xs font-medium bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[var(--radius-Apple-sm)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)] transition-colors flex items-center gap-1.5 text-[var(--text-secondary)]"
            >
              <Download className="w-3.5 h-3.5" /> 导出
            </button>
          </div>

          {/* 药材卡片网格 */}
          {homologyLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-5 space-y-[var(--space-apple-sm)]">
                    <div className="h-4 bg-[var(--border-color)] dark:bg-[var(--bg-secondary)] rounded w-1/2" />
                    <div className="h-3 bg-[var(--bg-tertiary)] rounded w-3/4" />
                    <div className="h-3 bg-[var(--bg-tertiary)] rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : sortedHomology.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-[var(--text-muted)] text-sm">暂无匹配药材</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedHomology.map((m: any, i: number) => (
                <Card key={i} className="group hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-[var(--space-apple-sm)]">
                      <div>
                        <p className="font-bold text-[var(--text-primary)] text-base">{m.name}</p>
                        <p className="text-xs text-[var(--text-muted)] italic mt-0.5">{m.latin_name}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-semibold ${
                        m.status === '允许用于普通食品'
                          ? 'bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/25 text-[var(--color-success-text)] dark:text-[var(--color-success-text)]'
                          : m.status === '试点用于普通食品'
                          ? 'bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/25 text-[var(--color-warning-text)]'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                      }`}>
                        {m.status === '允许用于普通食品' ? '允许' : m.status === '试点用于普通食品' ? '试点' : '—'}
                      </span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">分类</span>
                        <span className="font-medium text-[var(--text-primary)]">{m.category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">日用量上限</span>
                        <span className="font-semibold text-[var(--color-primary-text)]">{m.max_dosage || '无限制'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">批准日期</span>
                        <span className="text-[var(--text-muted)]">{m.approval_date || '传统'}</span>
                      </div>
                    </div>
                    {m.restrictions && m.restrictions.length > 0 && (
                      <div className="mt-[var(--space-apple-sm)] pt-3 border-t border-[var(--border-color)]">
                        <p className="text-xs font-semibold text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)] mb-1.5 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> 禁忌人群
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {m.restrictions.map((r: string, j: number) => (
                            <span key={j} className="px-2 py-0.5 rounded bg-[var(--color-warning-container)] text-[var(--color-warning-text)] text-xs border border-[var(--color-warning-border)] dark:border-[var(--color-warning)]">
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {m.usage_forms && m.usage_forms.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.usage_forms.map((f: string, j: number) => (
                          <span key={j} className="px-2 py-0.5 rounded bg-info-50 dark:bg-info-300/20 text-info-700 dark:text-info-600 text-xs border border-info-200 dark:border-info-800">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════ */}
      {/*  GB 2760 / GB 14880                   */}
      {/* ════════════════════════════════════ */}
      {activeSection === 'gb' && (
        <div className="space-y-6">
          {/* GB 2760 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                  <Beaker className="w-4 h-4 text-info-600 dark:text-info-600" />
                  GB 2760-2024 食品添加剂使用标准
                  <Badge variant="default" className="text-xs">2025年2月8日实施</Badge>
                </CardTitle>
                <Button
                  variant="ghost" size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => exportCSV(
                    gb2760Additives.map((a: any) => ({ name: a.name, max_usage: a.max_usage, categories: a.categories.join(';') })),
                    ['name', 'max_usage', 'categories'],
                    `gb2760_${new Date().toISOString().slice(0, 10)}.csv`,
                  )}
                  disabled={gb2760Loading}
                >
                  导出
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative mb-[var(--space-apple-sm)]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                <Input
                  value={standardSearch}
                  onChange={e => setStandardSearch(e.target.value)}
                  placeholder="搜索添加剂名称..."
                  className="pl-9"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/50">
                      <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                        <button onClick={() => toggleGb2760Sort('name')} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                          添加剂名称 <SortIcon active={gb2760Sort.field === 'name'} dir={gb2760Sort.dir} />
                        </button>
                      </th>
                      <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                        <button onClick={() => toggleGb2760Sort('max_usage')} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                          最大使用量 <SortIcon active={gb2760Sort.field === 'max_usage'} dir={gb2760Sort.dir} />
                        </button>
                      </th>
                      <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">适用食品类别</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gb2760Loading ? (
                      <tr><td colSpan={3} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">加载中...</td></tr>
                    ) : sortedGb2760.length === 0 ? (
                      <tr><td colSpan={3} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">暂无数据</td></tr>
                    ) : sortedGb2760.map((a: any, i: number) => (
                      <tr key={i} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                        <td className="px-[var(--space-apple-md)] py-2.5 font-medium text-[var(--text-primary)]">{a.name}</td>
                        <td className="px-[var(--space-apple-md)] py-2.5 tabular-nums font-semibold text-info-600 dark:text-info-600">{a.max_usage}</td>
                        <td className="px-[var(--space-apple-md)] py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {a.categories.map((cat: string, j: number) => (
                              <span key={j} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-info-50 dark:bg-info-300/20 text-info-700 dark:text-info-600 border border-info-200 dark:border-info-800">
                                {cat}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* GB 14880 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                  <TestTube className="w-4 h-4 text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]" />
                  GB 14880-2012 营养强化剂使用标准
                </CardTitle>
                <Button
                  variant="ghost" size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => exportCSV(
                    gb14880Enrichers.map((e: any) => ({ name: e.name, min: e.min, max: e.max, categories: e.categories.join(';') })),
                    ['name', 'min', 'max', 'categories'],
                    `gb14880_${new Date().toISOString().slice(0, 10)}.csv`,
                  )}
                  disabled={gb14880Loading}
                >
                  导出
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative mb-[var(--space-apple-sm)]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                <Input
                  value={standardSearch}
                  onChange={e => setStandardSearch(e.target.value)}
                  placeholder="搜索强化剂名称..."
                  className="pl-9"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/50">
                      <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                        <button onClick={() => toggleGb14880Sort('name')} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                          强化剂名称 <SortIcon active={gb14880Sort.field === 'name'} dir={gb14880Sort.dir} />
                        </button>
                      </th>
                      <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                        <button onClick={() => toggleGb14880Sort('min')} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                          最小用量 <SortIcon active={gb14880Sort.field === 'min'} dir={gb14880Sort.dir} />
                        </button>
                      </th>
                      <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                        <button onClick={() => toggleGb14880Sort('max')} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                          最大用量 <SortIcon active={gb14880Sort.field === 'max'} dir={gb14880Sort.dir} />
                        </button>
                      </th>
                      <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">适用食品类别</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gb14880Loading ? (
                      <tr><td colSpan={4} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">加载中...</td></tr>
                    ) : sortedGb14880.length === 0 ? (
                      <tr><td colSpan={4} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">暂无数据</td></tr>
                    ) : sortedGb14880.map((e: any, i: number) => (
                      <tr key={i} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                        <td className="px-[var(--space-apple-md)] py-2.5 font-medium text-[var(--text-primary)]">{e.name}</td>
                        <td className="px-[var(--space-apple-md)] py-2.5 tabular-nums text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]">{e.min}</td>
                        <td className="px-[var(--space-apple-md)] py-2.5 tabular-nums font-semibold text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]">{e.max}</td>
                        <td className="px-[var(--space-apple-md)] py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {e.categories.map((cat: string, j: number) => (
                              <span key={j} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-accent-container)] text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)] border border-[var(--color-accent-border)] dark:border-[var(--color-accent)]">
                                {cat}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 药食同源目录限量参考 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                  <Pill className="w-4 h-4 text-[var(--color-success-text)] dark:text-[var(--color-success-text)]" />
                  药食同源目录限量参考（2023版）
                </CardTitle>
                <Button
                  variant="ghost" size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => exportCSV(
                    Object.entries(limits).map(([name, mg]) => ({ name, dosage_mg: Number(mg) })),
                    ['name', 'dosage_mg'],
                    `homology_limits_${new Date().toISOString().slice(0, 10)}.csv`,
                  )}
                  disabled={limitsLoading}
                >
                  导出
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative mb-[var(--space-apple-sm)]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                <Input
                  value={standardSearch}
                  onChange={e => setStandardSearch(e.target.value)}
                  placeholder="搜索药材名称..."
                  className="pl-9"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/50">
                      <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">成分名称</th>
                      <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">日用量上限 (mg)</th>
                      <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">法规来源</th>
                    </tr>
                  </thead>
                  <tbody>
                    {limitsLoading ? (
                      <tr><td colSpan={3} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">加载中...</td></tr>
                    ) : Object.entries(limits).length === 0 ? (
                      <tr><td colSpan={3} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">暂无数据</td></tr>
                    ) : Object.entries(limits)
                      .sort(([, a], [, b]) => Number(a) - Number(b))
                      .filter(([, mg]) => !standardSearch || String(mg).includes(standardSearch))
                      .map(([name, mg], i) => (
                        <tr key={i} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                          <td className="px-[var(--space-apple-md)] py-2.5 font-medium text-[var(--text-primary)]">{name}</td>
                          <td className="px-[var(--space-apple-md)] py-2.5 tabular-nums font-semibold text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">{Number(mg).toLocaleString()}</td>
                          <td className="px-[var(--space-apple-md)] py-2.5 text-[var(--text-muted)] text-xs">卫健委药食同源目录（2023版）</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════ */}
      {/*  禁忌禁用品                            */}
      {/* ════════════════════════════════════ */}
      {activeSection === 'prohibited' && (
        <div className="space-y-6">
          {/* 十八反十九畏 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" />
                  中药十八反十九畏禁忌搭配
                </CardTitle>
                <Button
                  variant="ghost" size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => exportCSV(
                    prohibitedPairs.map((p: any) => ({ pair: p.pair.join(' + '), rule: p.rule })),
                    ['pair', 'rule'],
                    `prohibited_pairs_${new Date().toISOString().slice(0, 10)}.csv`,
                  )}
                  disabled={prohibitedLoading}
                >
                  导出
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative mb-[var(--space-apple-sm)]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                <Input
                  value={prohibitedSearch}
                  onChange={e => setProhibitedSearch(e.target.value)}
                  placeholder="搜索搭配成分..."
                  className="pl-9"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/50">
                      <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">搭配成分</th>
                      <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">禁忌类型</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prohibitedLoading ? (
                      <tr><td colSpan={2} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">加载中...</td></tr>
                    ) : filteredProhibited.length === 0 ? (
                      <tr><td colSpan={2} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">暂无数据</td></tr>
                    ) : filteredProhibited.map((p: any, i: number) => (
                      <tr key={i} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                        <td className="px-[var(--space-apple-md)] py-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            {p.pair.map((n: string, j: number) => (
                              <span key={j} className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--color-warning-container)] text-[var(--color-warning-text)] text-xs font-medium border border-[var(--color-warning-border)] dark:border-[var(--color-warning)]">
                                {n}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-[var(--space-apple-md)] py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                            {p.rule}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 中国食品安全禁用品 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-[var(--color-error-text)] dark:text-[var(--color-error-text)]" />
                  中国食品安全法规禁用品清单
                  <Badge variant="destructive" className="text-xs">{gbProhibitedItems.length} 项</Badge>
                </CardTitle>
                <Button
                  variant="ghost" size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => exportCSV(
                    gbProhibitedItems.map((item: string) => ({ item, source: '中国食品安全法规' })),
                    ['item', 'source'],
                    `gb_prohibited_${new Date().toISOString().slice(0, 10)}.csv`,
                  )}
                  disabled={gbProhibitedLoading}
                >
                  导出
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/50">
                      <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">禁用品名称</th>
                      <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">法规依据</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gbProhibitedLoading ? (
                      <tr><td colSpan={2} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">加载中...</td></tr>
                    ) : gbProhibitedItems.length === 0 ? (
                      <tr><td colSpan={2} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">暂无数据</td></tr>
                    ) : gbProhibitedItems.map((item: string, i: number) => (
                      <tr key={i} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                        <td className="px-[var(--space-apple-md)] py-2.5 font-medium text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">{item}</td>
                        <td className="px-[var(--space-apple-md)] py-2.5 text-[var(--text-muted)] text-xs">中国食品安全法规禁用品</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════ */}
      {/*  合规检查                             */}
      {/* ════════════════════════════════════ */}
      {activeSection === 'check' && (
        <div className="space-y-[var(--space-apple-md)]">
          <p className="text-sm text-[var(--text-muted)]">输入配方成分及日用量，对照国家标准（GB 2760/GB 14880/药食同源目录）检查合规性</p>

          {/* 人群选择 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--text-muted)]">目标人群：</span>
            {(['adults', 'children', 'elderly'] as Population[]).map(p => (
              <button
                key={p}
                onClick={() => setPopulation(p)}
                className={`px-[var(--space-apple-sm)] py-1.5 text-xs font-semibold rounded-[var(--radius-Apple-sm)] transition-all ${
                  population === p
                    ? 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)] border border-[var(--color-primary-border)] dark:border-[var(--color-primary)]'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-color)] dark:hover:bg-[var(--bg-secondary)]'
                }`}
              >
                {p === 'adults' ? '成人' : p === 'children' ? '儿童' : '老人'}
              </button>
            ))}
          </div>

          {/* 成分输入 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">配方成分</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ingredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={ing.name}
                      onChange={e => updateIngredient(idx, 'name', e.target.value)}
                      placeholder="成分名称（如：黄芪）"
                      className="flex-1 h-9 text-sm"
                    />
                    <Input
                      value={ing.dosage_mg}
                      onChange={e => updateIngredient(idx, 'dosage_mg', e.target.value)}
                      placeholder="日用量(mg)"
                      type="number"
                      className="w-28 h-9 text-sm"
                    />
                    {ingredients.length > 1 && (
                      <button onClick={() => removeIngredient(idx)} className="p-2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--color-error-text)]0 transition-colors">
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-[var(--space-apple-sm)]">
                <Button variant="outline" size="sm" onClick={addIngredient} icon={<CheckCircle2 className="w-3.5 h-3.5" />}>添加成分</Button>
                <Button variant="primary" size="sm" onClick={handleCheck} disabled={checking || !ingredients.some(i => i.name.trim())} icon={checking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}>
                  {checking ? '检查中...' : '开始合规检查'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 检查结果 */}
          {checkResult && (
            <div className="space-y-[var(--space-apple-md)]">
              {/* 总体评分 */}
              <Card className={`border-l-4 ${checkResult.status === 'compliant' ? 'border-l-success-500' : checkResult.status === 'warning' ? 'border-l-warning-500' : 'border-l-error-500'}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-[var(--radius-pill)] flex items-center justify-center ${
                        checkResult.status === 'compliant' ? 'bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/25' :
                        checkResult.status === 'warning' ? 'bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/25' : 'bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]/25'
                      }`}>
                        {checkResult.status === 'compliant' ? <CheckCircle2 className="w-6 h-6 text-[var(--color-success-text)] dark:text-[var(--color-success-text)]" /> :
                         checkResult.status === 'warning' ? <AlertTriangle className="w-6 h-6 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" /> :
                         <XCircle className="w-6 h-6 text-[var(--color-error-text)] dark:text-[var(--color-error-text)]" />}
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[var(--text-primary)]">
                          合规评分：<span className={checkResult.status === 'compliant' ? 'text-[var(--color-success-text)]' : checkResult.status === 'warning' ? 'text-[var(--color-warning-text)]' : 'text-[var(--color-error-text)]'}>{checkResult.score.toFixed(1)}</span>/100
                        </p>
                        <div className="mt-1"><StatusBadge status={checkResult.status} /></div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[var(--text-muted)]">违规数</p>
                      <p className="text-2xl font-bold text-[var(--text-primary)]">{checkResult.violations.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 违规详情 */}
              {checkResult.violations.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">违规详情</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {checkResult.violations.map((v, i) => (
                        <div key={i} className="flex items-start gap-[var(--space-apple-sm)] p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]/15 border border-[var(--color-error-border)] dark:border-error-900/30">
                          <XCircle className="w-4 h-4 text-[var(--color-error-text)]0 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-[var(--text-primary)] text-sm">{v.ingredient}</span>
                              <ViolationTypeTag type={v.type} />
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">{v.message}</p>
                          </div>
                          {v.max_allowed !== undefined && v.actual_value !== undefined && (
                            <div className="text-right shrink-0">
                              <p className="text-xs text-[var(--text-muted)]">限量</p>
                              <p className="text-sm font-semibold text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">{v.max_allowed}mg</p>
                              <p className="text-xs text-[var(--text-muted)]">实际</p>
                              <p className="text-sm font-semibold">{v.actual_value}mg</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 警告 */}
              {checkResult.warnings.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">警告</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {checkResult.warnings.map((w, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-[var(--color-warning-text)]">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          {w}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 建议 */}
              {checkResult.suggestions.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">建议</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {checkResult.suggestions.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                          <CheckCircle2 className="w-4 h-4 text-[var(--color-success-text)]0 shrink-0" />
                          {s}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
