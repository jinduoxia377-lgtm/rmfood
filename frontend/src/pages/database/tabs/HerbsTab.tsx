/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 中药材 Tab — 多数据源融合版
 * - 支持 TCMSP / SymMap 两种数据源切换
 * - OB%/DL/化合物数 列排序
 * - 药食同源快速过滤开关
 * - 收藏功能（本地 Set，支持仅看收藏）
 * - 卡片/表格 双视图切换
 * - 搜索高亮
 * - 骨架屏加载
 * - 导出 CSV（含收藏标记）
 */
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { databaseApi } from '@/api/database';
import type { TCMHerb, SymMapHerb } from '@/types';
import { Input, Button, Badge, Modal, Pagination, Card } from '@/components/ui';
import CrossSearchPanel from '../CrossSearchPanel';
import { Search, Download, ChevronUp, ChevronDown, Zap, Star, StarOff, Grid3X3, List, Database } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

// ─── 搜索高亮 ───
export function Highlight({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword || !text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200/80 dark:bg-yellow-700/50 text-inherit rounded px-0.5">
        {text.slice(idx, idx + keyword.length)}
      </mark>
      {text.slice(idx + keyword.length)}
    </>
  );
}

type SortField = 'name_cn' | 'ob_percent' | 'dl_value' | 'compound_count' | 'nameCn';
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'card';
type DataSource = 'tcmsp' | 'symmap';

const CHART_PRIMARY = 'var(--color-primary, #34C759)';

// 排序图标组件
function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  return sortField === field ? (
    sortDir === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 ml-0.5 inline text-primary-500" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 ml-0.5 inline text-primary-500" />
    )
  ) : (
    <ChevronUp className="w-3.5 h-3.5 ml-0.5 inline opacity-20" />
  );
}

export default function HerbsTab({
  initKeyword = '',
  onInitKwConsumed,
  initialSelectedHerbName,
  onHerbSelectionConsumed,
}: {
  initKeyword?: string;
  onInitKwConsumed?: () => void;
  initialSelectedHerbName?: string | null;
  onHerbSelectionConsumed?: () => void;
}) {
  const [keyword, setKeyword] = useState(initKeyword || '');
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('name_cn');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [dataSource, setDataSource] = useState<DataSource>('tcmsp');
  const [selectedHerb, setSelectedHerb] = useState<Record<string, any> | null>(null);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [foodOnly, setFoodOnly] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // 处理初始关键词消耗
  useEffect(() => {
    if (initKeyword) {
      onInitKwConsumed?.();
    }
  }, [initKeyword, onInitKwConsumed]);

  const categoriesQuery = useQuery({
    queryKey: ['db-herb-categories'],
    queryFn: () => databaseApi.getCategories(),
  });

  const pageSize = viewMode === 'card' ? 12 : 15;

  // TCMSP 数据查询
  const herbQuery = useQuery({
    queryKey: ['db-herbs', keyword, category, foodOnly, page, pageSize],
    queryFn: () =>
      databaseApi.searchHerbs({
        keyword,
        category: category || undefined,
        food_homology_only: foodOnly,
        page,
        page_size: pageSize,
      }),
    enabled: dataSource === 'tcmsp',
  });

  // SymMap 数据查询
  const symmapQuery = useQuery({
    queryKey: ['db-symmap-herbs', keyword, page, pageSize],
    queryFn: () =>
      databaseApi.searchSymmapHerbs({
        keyword,
        page,
        page_size: pageSize,
      }),
    enabled: dataSource === 'symmap',
  });

  // 统一获取 items 和 total
  const herbData = dataSource === 'tcmsp' ? herbQuery : symmapQuery;
  const total = (herbData.data as Record<string, unknown>)?.total as number ?? 0;

  const items = useMemo(() => {
    const rawItems = (herbData.data as Record<string, unknown>)?.items as unknown[] ?? [];
    let arr = [...rawItems];
    if (showFavOnly) arr = arr.filter((h: any) => favorites.has(h.id));
    arr.sort((a: any, b: any) => {
      const va = a[sortField] ?? (typeof a[sortField] === 'string' ? '' : 0);
      const vb = b[sortField] ?? (typeof b[sortField] === 'string' ? '' : 0);
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === 'asc' ? Number(va) - Number(vb) : Number(vb) - Number(va);
    });
    return arr;
  }, [herbData.data, sortField, sortDir, showFavOnly, favorites]);

  // 当从排行组件点击药材名称时，自动选中并打开详情 Modal
  useEffect(() => {
    if (initialSelectedHerbName && (herbData.data as Record<string, unknown>)?.items?.length) {
      const match = (herbData.data as Record<string, unknown>).items.find((h: unknown) => (h as Record<string, unknown>).name_cn === initialSelectedHerbName || (h as Record<string, unknown>).nameCn === initialSelectedHerbName);
      if (match) {
        setSelectedHerb(match);
        onHerbSelectionConsumed?.();
      }
    }
  }, [initialSelectedHerbName, (herbData.data as Record<string, unknown>)?.items, onHerbSelectionConsumed]);

  const doSearch = () => {
    setPage(1);
    setSelectedHerb(null);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const toggleFav = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const exportCSV = () => {
    setExportLoading(true);
    const headers = [
      '药材名称',
      '拉丁名',
      '拼音',
      '分类',
      '功效',
      '生物利用度(%)',
      '类药性(DL)',
      '药食同源',
      '化合物数',
      '靶点数',
      '收藏',
    ];
    const rows = items.map((h: any) => [
      h.name_cn || h.nameCn || '',
      h.name_latin || h.nameLatin || '',
      h.name_pinyin || h.namePinyin || '',
      h.category || h.categoryCn || '',
      h.effects || '',
      h.ob_percent ?? '',
      h.dl_value ?? '',
      h.is_food_homology ? '是' : '否',
      h.compound_count ?? 0,
      h.target_count ?? 0,
      favorites.has(h.id) ? '★' : '',
    ]);
    const csv = [headers, ...rows].map((r: any[]) => r.map((c: any) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `herbs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportLoading(false);
  };

  // 判断是否为 SymMap 数据 — 只有 SymMap 数据有 symmap_id 字段
  const isSymmap = (h: any) => h && h.symmap_id != null;

  return (
    <div className="space-y-4">
      {/* 数据源切换 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-muted,#9A9A9F)] dark:text-[var(--text-secondary,#6E6E73)]">数据源：</span>
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
          <button
            onClick={() => { setDataSource('tcmsp'); setPage(1); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${dataSource === 'tcmsp' ? 'bg-white dark:bg-neutral-700 shadow-sm text-primary-600' : 'text-[var(--text-muted,#9A9A9F)] hover:text-[var(--text-secondary,#6E6E73)]'}`}
          >
            <Database className="w-3.5 h-3.5" />
            TCMSP ({herbQuery.data?.total || 0})
          </button>
          <button
            onClick={() => { setDataSource('symmap'); setPage(1); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${dataSource === 'symmap' ? 'bg-white dark:bg-neutral-700 shadow-sm text-primary-600' : 'text-[var(--text-muted,#9A9A9F)] hover:text-[var(--text-secondary,#6E6E73)]'}`}
          >
            <Database className="w-3.5 h-3.5" />
            SymMap ({symmapQuery.data?.total || 0})
          </button>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted,#9A9A9F)]" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder={dataSource === 'symmap' ? '药材名称、拉丁名、拼音...' : '药材名称、拉丁名、拼音、功效...'}
            className="pl-9"
          />
        </div>
        {dataSource === 'tcmsp' && (
          <select
            value={category || ''}
            onChange={(e) => {
              setCategory(e.target.value || null);
              setPage(1);
            }}
            className="input w-auto min-w-[140px]"
          >
            <option value="">全部分类</option>
            {categoriesQuery.data?.categories.map((c) => (
              <option key={c.category} value={c.category}>
                {c.category} ({c.count})
              </option>
            ))}
          </select>
        )}
        <Button variant="primary" onClick={doSearch}>
          搜索
        </Button>
        {/* 视图切换 */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
          {(['table', 'card'] as const).map((mode) => {
            const Icon = mode === 'table' ? List : Grid3X3;
            return (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`p-1.5 rounded-md transition-all ${viewMode === mode ? 'bg-white dark:bg-neutral-700 shadow-sm text-primary-600' : 'text-[var(--text-muted,#9A9A9F)] hover:text-[var(--text-secondary,#6E6E73)]'}`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      </div>

      {/* 过滤标签 */}
      <div className="flex flex-wrap gap-3 items-center">
        {!isSymmap(items[0]) && (
          <button
            onClick={() => {
              setFoodOnly(!foodOnly);
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${foodOnly ? 'bg-primary-500 text-white border-emerald-500' : 'border-[var(--border-subtle,rgba(0,0,0,0.06))] text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] hover:border-emerald-400 hover:text-primary-600'}`}
          >
            <Zap className="w-3.5 h-3.5" />
            仅药食同源
          </button>
        )}
        <button
          onClick={() => setShowFavOnly(!showFavOnly)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${showFavOnly ? 'bg-warning-500 text-white border-amber-500' : 'border-[var(--border-subtle,rgba(0,0,0,0.06))] text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] hover:border-amber-400 hover:text-warning-600'}`}
        >
          <Star className="w-3.5 h-3.5" />
          收藏{favorites.size > 0 ? ` (${favorites.size})` : ''}
        </button>
        <div className="flex-1" />
        <span className="text-xs text-[var(--text-muted,#9A9A9F)]">共 {total} 条</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={exportCSV}
          disabled={exportLoading || items.length === 0}
          className="gap-1"
        >
          <Download className="w-3.5 h-3.5" />
          导出 CSV
        </Button>
      </div>

      {/* 表格视图 */}
      {viewMode === 'table' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle,rgba(0,0,0,0.06))] bg-slate-50/60 dark:bg-neutral-800/40">
                  <th className="px-3 py-3 w-8" />
                  {[{ key: 'name_cn' as SortField, label: '药材名称' }].map(({ key, label }) => (
                    <th
                      key={key}
                      onClick={() => toggleSort(key)}
                      className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider cursor-pointer hover:text-primary-600 transition-colors"
                    >
                      {label}
                      <SortIcon field={key} sortField={sortField} sortDir={sortDir} />
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider">
                    拉丁名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider">
                    分类
                  </th>
                  {isSymmap(items[0]) ? (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider hidden md:table-cell">
                        性味
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider hidden md:table-cell">
                        归经
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider hidden lg:table-cell">
                        药用部位
                      </th>
                    </>
                  ) : (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider hidden md:table-cell">
                      功效
                    </th>
                  )}
                  {!isSymmap(items[0]) && (
                    <>
                      {[
                        { key: 'ob_percent' as SortField, label: '生物利用度', title: '口服生物利用度 (OB%)' },
                        { key: 'dl_value' as SortField, label: '类药性', title: '类药性指数 (DL)' },
                      ].map(({ key, label, title }) => (
                        <th
                          key={key}
                          onClick={() => toggleSort(key)}
                          className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider cursor-pointer hover:text-primary-600 transition-colors"
                          title={title}
                        >
                          {label}
                          <SortIcon field={key} sortField={sortField} sortDir={sortDir} />
                        </th>
                      ))}
                      <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider">
                        药食同源
                      </th>
                      <th
                        onClick={() => toggleSort('compound_count')}
                        className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider cursor-pointer hover:text-primary-600 transition-colors"
                      >
                        化合物
                        <SortIcon field="compound_count" sortField={sortField} sortDir={sortDir} />
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(148,163,184,0.08)]">
                {herbData.isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div
                            className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"
                            style={{ width: `${60 + Math.random() * 30}%` }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : herbData.isError ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="text-error-500 text-sm">❌ 数据加载失败，请刷新页面重试</div>
                    </td>
                  </tr>
                ) : (
                  items.map((item: any) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedHerb(item)}
                      className="cursor-pointer hover:bg-primary-50/60 dark:hover:bg-primary-950/20 transition-colors duration-150 group"
                    >
                      <td className="px-3 py-3" onClick={(e) => toggleFav(item.id, e)}>
                        {favorites.has(item.id) ? (
                          <Star className="w-4 h-4 text-warning-400 fill-amber-400" />
                        ) : (
                          <StarOff className="w-4 h-4 text-[var(--text-muted,#9A9A9F)] opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">
                        <span className="group-hover:text-primary-600 transition-colors">
                          <Highlight text={item.name_cn || item.nameCn} keyword={keyword} />
                        </span>
                        {item.name_pinyin || item.namePinyin ? (
                          <div className="text-[10px] text-[var(--text-muted,#9A9A9F)] font-mono">{item.name_pinyin || item.namePinyin}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary,#6E6E73)] text-xs italic font-mono">{item.name_latin || item.nameLatin || '-'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="info" size="sm">
                          {item.category || item.category_cn || item.categoryCn || '-'}
                        </Badge>
                      </td>
                      {isSymmap(item) ? (
                        <>
                          <td className="px-4 py-3 text-xs max-w-[180px] truncate text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)] hidden md:table-cell">
                            {item.natureCn || item.nature_cn || '-'}
                          </td>
                          <td className="px-4 py-3 text-xs max-w-[180px] truncate text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)] hidden md:table-cell">
                            {item.meridiansCn || item.meridians_cn || '-'}
                          </td>
                          <td className="px-4 py-3 text-xs max-w-[140px] truncate text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)] hidden lg:table-cell">
                            {item.use_part || '-'}
                          </td>
                        </>
                      ) : (
                        <td className="px-4 py-3 text-xs max-w-[180px] truncate text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)] hidden md:table-cell">
                          <Highlight text={item.effects || '-'} keyword={keyword} />
                        </td>
                      )}
                      {!isSymmap(item) && (
                        <>
                          <td className="px-4 py-3 text-center">
                            {item.ob_percent != null ? (
                              <span className={`font-mono text-sm font-semibold ${Number(item.ob_percent) >= 30 ? 'text-primary-600' : 'text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)]'}`}>
                                {Number(item.ob_percent).toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-[var(--text-muted,#9A9A9F)]">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-xs text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)]">
                            {item.dl_value != null ? Number(item.dl_value).toFixed(2) : '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.is_food_homology ? (
                              <Badge variant="success" size="sm">是</Badge>
                            ) : (
                              <span className="text-[var(--text-muted,#9A9A9F)] text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-mono text-sm font-semibold ${(item.compound_count || 0) > 20 ? 'text-secondary-600' : 'text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)]'}`}>
                              {item.compound_count}
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!herbData.isLoading && items.length === 0 && (
            <div className="p-16 text-center">
              <div className="text-5xl mb-3 opacity-20">🌿</div>
              <div className="text-[var(--text-muted,#9A9A9F)] text-sm mb-2">
                {keyword ? `未找到「${keyword}」的结果` : '请输入关键词搜索'}
              </div>
              {keyword && (
                <button
                  onClick={() => {
                    setKeyword('');
                    doSearch();
                  }}
                  className="text-xs text-primary-600 hover:underline"
                >
                  清除搜索
                </button>
              )}
            </div>
          )}
        </Card>
      )}

      {/* 卡片视图 */}
      {viewMode === 'card' && (
        <>
          {herbData.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card p-4 space-y-3 animate-pulse">
                  <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3" />
                  <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
                  <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedHerb(item)}
                  className="card p-4 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group border border-transparent hover:border-primary-200 dark:hover:border-primary-800"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)] group-hover:text-primary-600 transition-colors truncate">
                        <Highlight text={item.name_cn || item.nameCn} keyword={keyword} />
                      </h3>
                      <p className="text-xs text-[var(--text-muted,#9A9A9F)] font-mono italic truncate">{item.name_latin || item.nameLatin || '-'}</p>
                    </div>
                    <button
                      onClick={(e) => toggleFav(item.id, e)}
                      className="p-1 rounded-lg hover:bg-warning-50 dark:hover:bg-amber-950/20 transition-colors flex-shrink-0"
                    >
                      {favorites.has(item.id) ? (
                        <Star className="w-4 h-4 text-warning-400 fill-amber-400" />
                      ) : (
                        <StarOff className="w-4 h-4 text-[var(--text-muted,#9A9A9F)]" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] line-clamp-2 mb-3">
                    {isSymmap(item)
                      ? (item.natureCn || item.nature_cn || '暂无性味描述')
                      : (item.effects || '暂无功效描述')}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="info" size="sm">
                      {item.category || item.category_cn || item.categoryCn || '-'}
                    </Badge>
                    {isSymmap(item) && (item.use_part || item.usePart) && (
                      <span className="text-[10px] font-mono text-[var(--text-muted,#9A9A9F)]">
                        部位: {item.use_part || item.usePart}
                      </span>
                    )}
                    {!isSymmap(item) && item.is_food_homology && (
                      <Badge variant="success" size="sm">药食同源</Badge>
                    )}
                    {!isSymmap(item) && item.ob_percent != null && (
                      <span className="text-[10px] font-mono text-[var(--text-muted,#9A9A9F)]">
                        OB {Number(item.ob_percent).toFixed(1)}%
                      </span>
                    )}
                    {isSymmap(item) && (item.meridiansCn || item.meridians_cn) ? (
                      <span className="text-[10px] font-mono text-[var(--text-muted,#9A9A9F)]">
                        {item.meridiansCn || item.meridians_cn}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 pt-3 border-t border-[var(--border-subtle,rgba(0,0,0,0.06))] flex justify-between text-xs text-[var(--text-muted,#9A9A9F)]">
                    {!isSymmap(item) && (
                      <>
                        <span>
                          化合物 <strong className="text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)]">{item.compound_count}</strong>
                        </span>
                        <span>
                          靶点 <strong className="text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)]">{item.target_count}</strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!herbData.isLoading && items.length === 0 && (
            <div className="card p-16 text-center">
              <div className="text-5xl mb-3 opacity-20">🌿</div>
              <div className="text-[var(--text-muted,#9A9A9F)] text-sm">
                {keyword ? `未找到「${keyword}」的结果` : '请输入关键词搜索'}
              </div>
            </div>
          )}
        </>
      )}

      {Math.ceil(total / pageSize) > 1 && (
        <Pagination currentPage={page} totalPages={Math.ceil(total / pageSize)} onPageChange={setPage} />
      )}

      {/* 详情弹窗 */}
      <Modal
        open={!!selectedHerb}
        onClose={() => setSelectedHerb(null)}
        title={selectedHerb?.name_cn || selectedHerb?.nameCn || ''}
        maxWidth="max-w-3xl lg:max-w-5xl xl:max-w-6xl"
        className="max-h-[90vh] lg:max-h-[85vh] overflow-hidden"
      >
        {selectedHerb && (
          <div className="overflow-y-auto max-h-[calc(90vh-11rem)] lg:max-h-[calc(85vh-10rem)]">
            {isSymmap(selectedHerb) ? (
              <SymMapHerbDetail herb={selectedHerb} />
            ) : (
              <TcmspHerbDetail herb={selectedHerb} chartColor={CHART_PRIMARY} />
            )}
            <div className="mt-5 pt-4 border-t border-[var(--border-subtle,rgba(0,0,0,0.06))] flex-shrink-0">
              <CrossSearchPanel initialHerbName={selectedHerb?.name_cn || selectedHerb?.nameCn} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── TCMSP 药材详情 ───
function TcmspHerbDetail({ herb, chartColor }: { herb: any; chartColor: string }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'compounds' | 'targets' | 'diseases'>('overview');
  const radarData = [
    { subject: '口服生物利用度', A: Math.min(((herb.ob_percent ?? 0) / 80) * 100, 100), fullMark: 100 },
    { subject: '类药性', A: Math.min(((herb.dl_value ?? 0) / 0.5) * 100, 100), fullMark: 100 },
    { subject: '化合物丰富度', A: Math.min(((herb.compounds?.length || 0) / 30) * 100, 100), fullMark: 100 },
    { subject: '靶点覆盖', A: Math.min(((herb.targets?.length || 0) / 20) * 100, 100), fullMark: 100 },
  ];
  const compounds = herb.compounds || [];
  const targets = herb.targets || [];
  const diseases = herb.diseases || [];

  const tgtName = (t: any) => (typeof t === 'string' ? t : t?.name || '');
  const disName = (d: any) => (typeof d === 'string' ? d : d?.name || '');

  function renderTabContent(): React.ReactNode {
    if (activeTab === 'overview') {
      return (
        <div className="space-y-4">
          <div className="rounded-lg bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-800/60 dark:to-blue-950/10 p-3 border border-[var(--border-subtle,rgba(0,0,0,0.06))]">
            <p className="text-xs text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] leading-relaxed">{herb.effects}</p>
            <p className="text-[10px] text-[var(--text-muted,#9A9A9F)] mt-1">分类：{herb.category}</p>
          </div>

          {compounds.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-primary-700 dark:text-primary-400 mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span>
                核心化学成分
                <span className="font-normal text-[10px] text-[var(--text-muted,#9A9A9F)] font-mono">共 {compounds.length} 种</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {compounds.slice(0, 8).map((c: any, i: number) => (
                  <div key={i} className="bg-white dark:bg-neutral-800/80 px-3 py-1.5 rounded-lg text-xs border border-blue-100 dark:border-blue-900/20 shadow-sm hover:shadow-md transition-shadow">
                    <div className="font-medium text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)] truncate max-w-[140px]" title={c.name}>{c.name}</div>
                    <div className="text-[10px] text-[var(--text-muted,#9A9A9F)] font-mono mt-0.5">
                      <span className="text-primary-600 dark:text-primary-400">OB {Number(c.ob).toFixed(1)}</span>
                      <span className="text-secondary-600 dark:text-secondary-400 ml-2">DL {Number(c.dl).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
                {compounds.length > 8 && (
                  <button onClick={() => setActiveTab('compounds')} className="self-center px-3 py-1.5 rounded-lg text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/30 dark:hover:bg-primary-900/40 transition-colors">
                    查看全部 {compounds.length} 种成分 →
                  </button>
                )}
              </div>
            </div>
          )}

          {targets.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-warning-700 dark:text-warning-400 mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-warning-500"></span>
                作用靶点预测
                <span className="font-normal text-[10px] text-[var(--text-muted,#9A9A9F)] font-mono">{targets.length} 个唯一靶点</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {targets.slice(0, 15).map((t: any, i: number) => (
                  <Badge key={i} variant="warning" size="sm" className="cursor-default" title={`靶点ID: ${t?.id || '-'}`}>
                    {tgtName(t)}
                  </Badge>
                ))}
                {targets.length > 15 && (
                  <button onClick={() => setActiveTab('targets')} className="px-2 py-0.5 rounded text-xs text-warning-600 bg-warning-50 hover:bg-warning-100 dark:bg-amber-950/20 transition-colors font-medium">
                    +{targets.length - 15} 更多
                  </button>
                )}
              </div>
            </div>
          )}

          {diseases.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-error-700 dark:text-error-400 mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-error-500"></span>
                关联疾病谱
                <span className="font-normal text-[10px] text-[var(--text-muted,#9A9A9F)] font-mono">{diseases.length} 种相关疾病</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {diseases.slice(0, 12).map((d: any, i: number) => (
                  <Badge key={i} variant="danger" size="sm" className="cursor-default" title={`疾病ID: ${d?.id || '-'}`}>
                    {disName(d)}
                  </Badge>
                ))}
                {diseases.length > 12 && (
                  <button onClick={() => setActiveTab('diseases')} className="px-2 py-0.5 rounded text-xs text-error-600 bg-error-50 hover:bg-error-100 dark:bg-red-950/20 transition-colors font-medium">
                    +{diseases.length - 12} 更多
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'compounds' && compounds.length > 0) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-neutral-100/80 dark:bg-neutral-800/80 border-b border-[var(--border-subtle,rgba(0,0,0,0.06))]">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)] rounded-tl-lg">化合物名称</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)]">生物利用度 (%)</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)]">类药性</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)] rounded-tr-lg">关联靶点</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(148,163,184,0.08)]">
              {compounds.map((c: any, i: number) => (
                <tr key={i} className="hover:bg-secondary-50/40 dark:hover:bg-blue-950/10 transition-colors">
                  <td className="px-3 py-2.5 font-medium text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">{c.name}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-[var(--text-secondary,#6E6E73)]">{c.ob != null ? Number(c.ob).toFixed(1) : '-'}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-[var(--text-secondary,#6E6E73)]">{c.dl != null ? Number(c.dl).toFixed(3) : '-'}</td>
                  <td className="px-3 py-2.5 text-center text-[var(--text-secondary,#6E6E73)]">{c.target_count ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'targets') {
      return (
        <div className="flex flex-wrap gap-2">
          {targets.map((t: any, i: number) => (
            <Badge key={i} variant="warning" size="sm">{tgtName(t)}</Badge>
          ))}
          {targets.length === 0 && <div className="text-sm text-[var(--text-muted,#9A9A9F)]">暂无靶点数据</div>}
        </div>
      );
    }

    if (activeTab === 'diseases') {
      return (
        <div className="flex flex-wrap gap-2">
          {diseases.map((d: any, i: number) => (
            <Badge key={i} variant="danger" size="sm">{disName(d)}</Badge>
          ))}
          {diseases.length === 0 && <div className="text-sm text-[var(--text-muted,#9A9A9F)]">暂无疾病关联数据</div>}
        </div>
      );
    }
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      <div className="space-y-3 lg:space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <p className="text-sm text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] italic font-mono">{herb.name_latin}</p>
              {herb.is_food_homology && <Badge variant="success" size="sm">药食同源</Badge>}
              {herb.tcmsp_id && <Badge variant="neutral" size="sm" className="font-mono text-[10px]">TCMSP:{herb.tcmsp_id}</Badge>}
            </div>
            <p className="text-sm text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)] leading-relaxed">{herb.effects}</p>
            <p className="text-xs text-[var(--text-muted,#9A9A9F)] mt-1">{herb.category}</p>
          </div>
        </div>

        <div className="bg-slate-50/60 dark:bg-neutral-800/40 rounded-xl p-4 border border-[var(--border-subtle,rgba(0,0,0,0.06))]">
          <h4 className="text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)] mb-3 flex items-center gap-1.5">
            <span className="w-1 h-3 rounded-full bg-gradient-to-b from-primary-400 to-primary-600"></span>
            药理属性雷达图
          </h4>
          <ResponsiveContainer width="100%" height={160}>
            <RadarChart data={radarData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <PolarGrid stroke="rgba(148,163,184,0.15)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: 'var(--text-muted, #9A9A9F)' }} />
              <Radar dataKey="A" stroke={chartColor} fill={chartColor} fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { value: herb.ob_percent != null ? `${Number(herb.ob_percent).toFixed(1)}%` : '-', label: '口服生物利用度', sub: 'OB', color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50/80 dark:bg-emerald-950/20', border: 'border-emerald-200/50 dark:border-emerald-800/20' },
            { value: herb.dl_value != null ? Number(herb.dl_value).toFixed(3) : '-', label: '类药性', sub: 'DL', color: 'text-secondary-600 dark:text-secondary-400', bg: 'bg-secondary-50/80 dark:bg-blue-950/20', border: 'border-blue-200/50 dark:border-blue-800/20' },
            { value: compounds.length, label: '活性化合物', sub: 'Compounds', color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50/80 dark:bg-primary-950/20', border: 'border-primary-200/50 dark:border-primary-800/20' },
            { value: targets.length, label: '作用靶点', sub: 'Targets', color: 'text-warning-600 dark:text-warning-400', bg: 'bg-warning-50/80 dark:bg-amber-950/20', border: 'border-amber-200/50 dark:border-amber-800/20' },
          ].map(({ value, label, sub, color, bg, border }) => (
            <div key={label} className={`p-3 rounded-xl text-center ${bg} border ${border} transition-all hover:shadow-sm`}>
              <div className={`text-lg font-bold ${color}`}>{value}</div>
              <div className="text-[10px] text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] mt-0.5 font-medium">{label}</div>
              <div className="text-[8px] text-[var(--text-muted,#9A9A9F)]/60 font-mono">{sub}</div>
            </div>
          ))}
        </div>

        {/* 竖屏模式 */}
        <div className="lg:hidden">
          <div className="flex gap-1 border-b border-[var(--border-subtle,rgba(0,0,0,0.06))] overflow-x-auto">
            {[
              { key: 'overview', label: '概览' },
              { key: 'compounds', label: `化学成分 (${compounds.length})` },
              { key: 'targets', label: `作用靶点 (${targets.length})` },
              { key: 'diseases', label: `关联疾病 (${diseases.length})` },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as 'overview' | 'compounds' | 'targets' | 'diseases')}
                className={`px-4 py-2.5 text-sm font-medium transition-all relative whitespace-nowrap ${activeTab === key ? 'text-primary-600' : 'text-[var(--text-muted,#9A9A9F)] hover:text-[var(--text-secondary,#6E6E73)]'}`}
              >
                {label}
                {activeTab === key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full" />}
              </button>
            ))}
          </div>
          {renderTabContent()}
        </div>
      </div>

      {/* 右侧栏 - 仅横屏 */}
      <div className="hidden lg:flex flex-col space-y-4">
        <div className="flex gap-1 border-b border-[var(--border-subtle,rgba(0,0,0,0.06))]">
          {[
            { key: 'overview', label: '概览总览' },
            { key: 'compounds', label: `化学成分 (${compounds.length})` },
            { key: 'targets', label: `作用靶点 (${targets.length})` },
            { key: 'diseases', label: `关联疾病 (${diseases.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`px-4 py-2.5 text-sm font-medium transition-all relative ${activeTab === key ? 'text-primary-600' : 'text-[var(--text-muted,#9A9A9F)] hover:text-[var(--text-secondary,#6E6E73)]'}`}
            >
              {label}
              {activeTab === key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full" />}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">{renderTabContent()}</div>
      </div>
    </div>
  );
}

// ─── SymMap 药材详情 ───
function SymMapHerbDetail({ herb }: { herb: any }) {
  return (
    <div className="space-y-4">
      {/* 基本信息 */}
      <div className="rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50/30 dark:from-purple-950/20 dark:to-indigo-950/10 p-4 border border-purple-200/50 dark:border-purple-800/20">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">{herb.name_cn || herb.nameCn}</h3>
              {herb.symmap_id && (
                <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
                  SymMap #{herb.symmap_id}
                </Badge>
              )}
            </div>
            <p className="text-sm text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] italic font-mono">{herb.name_latin || herb.nameLatin}</p>
            {herb.name_pinyin || herb.namePinyin ? (
              <p className="text-xs text-[var(--text-muted,#9A9A9F)] font-mono mt-0.5">{herb.name_pinyin || herb.namePinyin}</p>
            ) : null}
            {herb.name_eng || herb.nameEng ? (
              <p className="text-xs text-[var(--text-muted,#9A9A9F)] mt-0.5">{herb.name_eng || herb.nameEng}</p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          {herb.nature_cn || herb.natureCn ? (
            <div className="bg-white/60 dark:bg-neutral-800/60 rounded-lg p-2 border border-purple-100/50 dark:border-purple-900/20">
              <div className="text-[10px] text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider">性味</div>
              <div className="text-sm font-medium text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)] mt-0.5">{herb.nature_cn || herb.natureCn}</div>
            </div>
          ) : null}
          {herb.meridians_cn || herb.meridiansCn ? (
            <div className="bg-white/60 dark:bg-neutral-800/60 rounded-lg p-2 border border-purple-100/50 dark:border-purple-900/20">
              <div className="text-[10px] text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider">归经</div>
              <div className="text-sm font-medium text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)] mt-0.5">{herb.meridians_cn || herb.meridiansCn}</div>
            </div>
          ) : null}
          {herb.category_cn || herb.categoryCn ? (
            <div className="bg-white/60 dark:bg-neutral-800/60 rounded-lg p-2 border border-purple-100/50 dark:border-purple-900/20">
              <div className="text-[10px] text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider">分类</div>
              <div className="text-sm font-medium text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)] mt-0.5">{herb.category_cn || herb.categoryCn}</div>
            </div>
          ) : null}
          {herb.use_part ? (
            <div className="bg-white/60 dark:bg-neutral-800/60 rounded-lg p-2 border border-purple-100/50 dark:border-purple-900/20">
              <div className="text-[10px] text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider">药用部位</div>
              <div className="text-sm font-medium text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)] mt-0.5">{herb.use_part}</div>
            </div>
          ) : null}
          {herb.category_eng ? (
            <div className="bg-white/60 dark:bg-neutral-800/60 rounded-lg p-2 border border-purple-100/50 dark:border-purple-900/20">
              <div className="text-[10px] text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider">分类(英)</div>
              <div className="text-sm font-medium text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)] mt-0.5">{herb.category_eng}</div>
            </div>
          ) : null}
          {herb.alias ? (
            <div className="bg-white/60 dark:bg-neutral-800/60 rounded-lg p-2 border border-purple-100/50 dark:border-purple-900/20 sm:col-span-2">
              <div className="text-[10px] text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider">别名</div>
              <div className="text-sm font-medium text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)] mt-0.5">{herb.alias}</div>
            </div>
          ) : null}
        </div>
      </div>

      {(herb.tcmsp_id || herb.tcmid_id || herb.tcmid2_id || herb.herbdb_id) && (
        <div className="rounded-lg bg-slate-50/60 dark:bg-neutral-800/40 p-3 border border-[var(--border-subtle,rgba(0,0,0,0.06))]">
          <h4 className="text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)] mb-2">交叉引用</h4>
          <div className="flex flex-wrap gap-2">
            {herb.tcmsp_id && (
              <Badge variant="info" size="sm">TCMSP: {herb.tcmsp_id}</Badge>
            )}
            {herb.tcmid_id && (
              <Badge variant="warning" size="sm">TCMID: {herb.tcmid_id}</Badge>
            )}
            {herb.tcmid2_id && (
              <Badge variant="warning" size="sm">TCM-ID: {herb.tcmid2_id}</Badge>
            )}
            {herb.herbdb_id && (
              <Badge variant="neutral" size="sm">HERB: {herb.herbdb_id}</Badge>
            )}
          </div>
        </div>
      )}

      {/* 数据信息 */}
      <div className="rounded-lg bg-slate-50/60 dark:bg-neutral-800/40 p-3 border border-[var(--border-subtle,rgba(0,0,0,0.06))]">
        <h4 className="text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)] mb-2">数据信息</h4>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--text-muted,#9A9A9F)]">
          {herb.source_version && (
            <span>版本: {herb.source_version}</span>
          )}
          {herb.synced_at && (
            <span>同步: {new Date(herb.synced_at).toLocaleDateString('zh-CN')}</span>
          )}
          {herb.created_at && (
            <span>入库: {new Date(herb.created_at).toLocaleDateString('zh-CN')}</span>
          )}
        </div>
      </div>

      {/* 功效可视化 */}
      {herb.function_cn || herb.functionCn ? (
        <div className="rounded-lg bg-gradient-to-br from-teal-50 to-emerald-50/30 dark:from-teal-950/20 dark:to-emerald-950/10 p-4 border border-teal-200/50 dark:border-teal-800/20">
          <h4 className="text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)] mb-2 flex items-center gap-1.5">
            <span className="w-1 h-3 rounded-full bg-gradient-to-b from-teal-400 to-teal-600"></span>
            功效
          </h4>
          <p className="text-sm text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)] leading-relaxed">{herb.function_cn || herb.functionCn}</p>
          {herb.function_en || herb.functionEn ? (
            <p className="text-xs text-[var(--text-muted,#9A9A9F)] mt-1 italic">{herb.function_en || herb.functionEn}</p>
          ) : null}
        </div>
      ) : null}

      {/* 性味可视化 */}
      {herb.nature_cn || herb.natureCn ? (
        <div className="rounded-lg bg-gradient-to-br from-amber-50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10 p-4 border border-amber-200/50 dark:border-amber-800/20">
          <h4 className="text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)] mb-2 flex items-center gap-1.5">
            <span className="w-1 h-3 rounded-full bg-gradient-to-b from-amber-400 to-amber-600"></span>
            四气五味
          </h4>
          <p className="text-sm text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)] leading-relaxed">{herb.nature_cn || herb.natureCn}</p>
          {herb.nature_eng || herb.natureEng ? (
            <p className="text-xs text-[var(--text-muted,#9A9A9F)] mt-1 italic">{herb.nature_eng || herb.natureEng}</p>
          ) : null}
        </div>
      ) : null}

      {/* 归经可视化 */}
      {herb.meridians_cn || herb.meridiansCn ? (
        <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10 p-4 border border-blue-200/50 dark:border-blue-800/20">
          <h4 className="text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)] mb-2 flex items-center gap-1.5">
            <span className="w-1 h-3 rounded-full bg-gradient-to-b from-blue-400 to-blue-600"></span>
            归经
          </h4>
          <p className="text-sm text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)] leading-relaxed">{herb.meridians_cn || herb.meridiansCn}</p>
          {herb.meridians_eng || herb.meridiansEng ? (
            <p className="text-xs text-[var(--text-muted,#9A9A9F)] mt-1 italic">{herb.meridians_eng || herb.meridiansEng}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
