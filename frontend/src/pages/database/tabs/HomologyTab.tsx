/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 药食同源 Tab — Phase 3 深度完善版
 * - 卡片网格视图（可切换表格）
 * - 功效分类标签快速过滤
 * - 随机推荐功能
 * - 查询历史（localStorage）
 * - 搜索高亮
 */
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { databaseApi } from '@/api/database';
import { Input, Button, Badge, Pagination, Card } from '@/components/ui';
import { Search, Grid3X3, List, Shuffle, Clock, CheckCircle2, XCircle } from 'lucide-react';

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
function CardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-[var(--space-apple-md)]">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="card p-[var(--space-apple-md)] animate-pulse">
          <div className="flex items-start gap-[var(--space-apple-sm)]">
            <div className="w-10 h-10 bg-[var(--border-color)] dark:bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-[var(--border-color)] dark:bg-[var(--bg-secondary)] rounded" />
              <div className="h-3 w-32 bg-[var(--border-color)] dark:bg-[var(--bg-secondary)] rounded" />
              <div className="h-3 w-16 bg-[var(--border-color)] dark:bg-[var(--bg-secondary)] rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 功效分类颜色 ───
const EFFECT_COLORS: Record<string, string> = {
  补益类: 'bg-[var(--color-primary-container)] dark:bg-[var(--color-success-container)]/30 border-[var(--color-success-border)] dark:border-[var(--color-success)]',
  清热类: 'bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]/30 border-[var(--color-error-border)] dark:border-[var(--color-error)]',
  活血类: 'bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/30 border-[var(--color-warning-border)] dark:border-[var(--color-warning)]',
  理气类: 'bg-[var(--color-accent-container)] dark:bg-[var(--color-accent-container)]/30 border-[var(--color-accent-border)] dark:border-[var(--color-accent)]',
  解表类: 'bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/30 border-[var(--color-secondary-border)] dark:border-[var(--color-secondary)]',
  利水渗湿: 'bg-info-50 dark:bg-info-950/30 border-info-200 dark:border-info-800',
  安神类: 'bg-[var(--color-accent-container)] dark:bg-[var(--color-accent-container)]/30 border-[var(--color-accent-border)] dark:border-[var(--color-accent)]',
};

export default function HomologyTab() {
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [checkName, setCheckName] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [effectFilter, setEffectFilter] = useState<string | null>(null);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);

  const listQuery = useQuery({
    queryKey: ['db-homology-list', keyword, page, effectFilter],
    queryFn: () => databaseApi.getFoodHomologyHerbs({ keyword, page, page_size: 24 }),
  });

  const checkQuery = useQuery({
    queryKey: ['db-homology-check', checkName],
    queryFn: () => databaseApi.checkFoodHomology(checkName),
    enabled: checkName.length >= 1,
  });

  // 加载历史记录
  useEffect(() => {
    const loadHistory = () => {
      try {
        const saved = localStorage.getItem('rmfood_homology_history');
        if (saved) {
          try {
            const history = JSON.parse(saved);
            if (Array.isArray(history)) {
              setQueryHistory(history);
            }
          } catch {
            /* empty */
          }
        }
      } catch {
        /* empty */
      }
    };

    loadHistory();
  }, []);

  // 保存查询历史
  const handleCheck = () => {
    if (!checkName.trim()) return;
    const trimmed = checkName.trim();
    setQueryHistory((prev) => {
      const next = [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, 10);
      try {
        localStorage.setItem('rmfood_homology_history', JSON.stringify(next));
      } catch {
        /* empty */
      }
      return next;
    });
  };

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;

  // 提取所有功效分类（用于过滤）
  const allEffects = useMemo(() => {
    const set = new Set<string>();
    items.forEach((h: any) => {
      if (h.effects) {
        h.effects.split(/[；;,，]/).forEach((e: string) => {
          const trimmed = e.trim();
          if (trimmed) set.add(trimmed);
        });
      }
    });
    return Array.from(set).slice(0, 12);
  }, [items]);

  const randomRecommend = () => {
    if (items.length === 0) return;
    const random = items[Math.floor(Math.random() * items.length)];
    setKeyword(random.name_cn || '');
    setPage(1);
  };

  return (
    <div className="space-y-[var(--space-apple-md)]">
      {/* 查询工具 */}
      <Card className="p-5">
        <h3 className="font-bold text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,var(--bg-canvas))] mb-2 flex items-center gap-2">
          <Search className="w-4 h-4 text-[var(--color-primary-text)]" />
          药食同源快速查询
        </h3>
        <p className="text-xs text-[var(--text-muted,#9A9A9F)] mb-[var(--space-apple-sm)]">输入药材名称，查询是否在药食同源目录中</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={checkName}
              onChange={(e) => setCheckName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
              placeholder="输入药材名称，如：人参、黄芪、枸杞子..."
            />
          </div>
          <Button variant="primary" onClick={handleCheck}>
            查询
          </Button>
          <Button variant="ghost" size="sm" onClick={randomRecommend} title="随机推荐" className="gap-1">
            <Shuffle className="w-4 h-4" />
            推荐
          </Button>
        </div>

        {/* 查询结果 */}
        {checkQuery.data && (
          <div
            className={`mt-[var(--space-apple-md)] p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] transition-all duration-300 ${checkQuery.data.is_food_homology ? 'bg-[var(--color-primary-container)]/60 dark:bg-[var(--color-primary-container)]/20 border border-[var(--color-primary-border)] dark:border-[var(--color-primary)]' : 'bg-[var(--bg-tertiary)]/60 dark:bg-[var(--bg-tertiary)]/40 border border-[var(--border-subtle,rgba(0,0,0,0.06))]'}`}
          >
            <div className="flex items-center gap-[var(--space-apple-sm)]">
              <div
                className={`w-10 h-10 rounded-[var(--radius-Apple-md)] flex items-center justify-center text-xl ${checkQuery.data.is_food_homology ? 'bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)]/30' : 'bg-[var(--border-color)] dark:bg-[var(--bg-secondary)]'}`}
              >
                {checkQuery.data.is_food_homology ? (
                  <CheckCircle2 className="w-5 h-5 text-[var(--color-primary-text)]" />
                ) : (
                  <XCircle className="w-5 h-5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,var(--bg-canvas))] text-lg">
                    {checkQuery.data.herb_name}
                  </span>
                  <Badge variant={checkQuery.data.is_food_homology ? 'success' : 'neutral'} size="md">
                    {checkQuery.data.is_food_homology ? '药食同源' : '非药食同源'}
                  </Badge>
                </div>
                <p className="text-xs text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] mt-1">{checkQuery.data.regulatory_basis}</p>
              </div>
            </div>
            {checkQuery.data.matched_catalog_entries?.length > 0 && (
              <div className="mt-[var(--space-apple-sm)] flex flex-wrap gap-1.5">
                {checkQuery.data.matched_catalog_entries.map((entry: string, i: number) => (
                  <Badge key={i} variant="primary" size="sm" className="font-mono">
                    {entry}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 查询历史 */}
        {queryHistory.length > 0 && (
          <div className="mt-[var(--space-apple-sm)] flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[var(--text-muted,#9A9A9F)] flex items-center gap-1">
              <Clock className="w-3 h-3" />
              历史
            </span>
            {queryHistory.map((h, i) => (
              <button
                key={i}
                onClick={() => setCheckName(h)}
                className="text-xs px-2 py-1 rounded-[var(--radius-pill)] bg-[var(--bg-tertiary)] text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] hover:bg-[var(--border-color)] dark:hover:bg-[var(--bg-secondary)] transition-colors"
              >
                {h}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* 目录浏览 */}
      <div className="flex gap-[var(--space-apple-sm)] items-center">
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
          placeholder="在药食同源目录中搜索..."
          className="flex-1"
        />
        <Button variant="primary" onClick={() => setPage(1)}>
          搜索
        </Button>
        <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-[var(--bg-secondary)] shadow-sm' : 'hover:bg-[var(--border-color)] dark:hover:bg-[var(--bg-secondary)]'}`}
          >
            <Grid3X3 className="w-4 h-4 text-[var(--text-secondary,#6E6E73)]" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded transition-all ${viewMode === 'table' ? 'bg-[var(--bg-secondary)] shadow-sm' : 'hover:bg-[var(--border-color)] dark:hover:bg-[var(--bg-secondary)]'}`}
          >
            <List className="w-4 h-4 text-[var(--text-secondary,#6E6E73)]" />
          </button>
        </div>
      </div>

      {/* 功效分类快速过滤 */}
      {allEffects.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setEffectFilter(null)}
            className={`px-2.5 py-1 min-h-[44px] inline-flex items-center rounded-[var(--radius-pill)] text-xs font-medium border transition-all ${!effectFilter ? 'bg-primary-container text-[var(--color-primary)] border-[var(--color-primary)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary,#6E6E73)] border-[var(--border-subtle,rgba(0,0,0,0.06))] hover:border-[var(--color-primary-border)]'}`}
          >
            全部
          </button>
          {allEffects.map((effect) => (
            <button
              key={effect}
              onClick={() => setEffectFilter(effectFilter === effect ? null : effect)}
              className={`px-2.5 py-1 min-h-[44px] inline-flex items-center rounded-[var(--radius-pill)] text-xs font-medium border transition-all ${effectFilter === effect ? 'bg-primary-container text-[var(--color-primary)] border-[var(--color-primary)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary,#6E6E73)] border-[var(--border-subtle,rgba(0,0,0,0.06))] hover:border-[var(--color-primary-border)]'}`}
            >
              {effect}
            </button>
          ))}
        </div>
      )}

      {/* 内容区域 */}
      {listQuery.isLoading ? (
        <CardSkeleton />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item: any) => {
            const effectClass =
              EFFECT_COLORS[Object.keys(EFFECT_COLORS).find((k) => item.effects?.includes(k)) || ''] || '';
            return (
              <Card
                key={item.id}
                className={`p-[var(--space-apple-md)] hover:shadow-md transition-shadow cursor-pointer ${effectClass}`}
                onClick={() => {
                  /* 后续可打开详情 */
                }}
              >
                <div className="flex items-start gap-[var(--space-apple-sm)]">
                  <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)]/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-[var(--color-primary-text)] text-lg">🌿</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,var(--bg-canvas))]">
                        <Highlight text={item.name_cn} keyword={keyword} />
                      </span>
                      <Badge variant="success" size="sm">
                        药食同源
                      </Badge>
                    </div>
                    <div className="text-xs text-[var(--text-muted,#9A9A9F)] italic font-mono mb-1">{item.name_latin || '-'}</div>
                    {item.category && (
                      <Badge variant="info" size="sm" className="mb-1">
                        {item.category}
                      </Badge>
                    )}
                    {item.effects && (
                      <p className="text-xs text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] mt-1 leading-relaxed line-clamp-2">
                        <Highlight text={item.effects} keyword={keyword} />
                      </p>
                    )}
                    <div className="flex gap-[var(--space-apple-sm)] mt-2 text-xs text-[var(--text-muted,#9A9A9F)]">
                      <span>OB {item.ob_percent != null ? Number(item.ob_percent).toFixed(1) : '-'}</span>
                      <span>·</span>
                      <span>{item.compound_count} 化合物</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle,rgba(0,0,0,0.06))]">
                  {['药材名称', '拉丁名', '分类', '功效', 'OB%', '化合物'].map((h) => (
                    <th
                      key={h}
                      className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-left text-xs font-semibold text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(148,163,184,0.08)]">
                {items.map((item: any) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[var(--color-primary-container)]/60 dark:hover:bg-[var(--color-primary-container)]/20 transition-colors duration-150"
                  >
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] font-medium text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,var(--bg-canvas))]">
                      <Highlight text={item.name_cn} keyword={keyword} />
                      <Badge variant="success" size="sm" className="ml-1.5">
                        药食同源
                      </Badge>
                    </td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-[var(--text-secondary,#6E6E73)] text-xs italic font-mono">{item.name_latin || '-'}</td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                      <Badge variant="info" size="sm">
                        {item.category || '-'}
                      </Badge>
                    </td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-xs max-w-[200px] truncate text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)]">
                      <Highlight text={item.effects || '-'} keyword={keyword} />
                    </td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-center font-mono text-xs text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)]">
                      {item.ob_percent != null ? Number(item.ob_percent).toFixed(1) : '-'}
                    </td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-center font-mono text-xs text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)]">
                      {item.compound_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {listQuery.isError && (
        <div className="text-center py-12">
          <div className="text-[var(--color-error-text)]0 text-sm">❌ 数据加载失败，请刷新页面重试</div>
        </div>
      )}
      {!listQuery.isError && items.length === 0 && !listQuery.isLoading && (
        <div className="text-center py-12">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-[var(--space-apple-sm)] opacity-30" />
          <div className="text-[var(--text-muted,#9A9A9F)] text-sm">
            {keyword || effectFilter ? '未找到匹配结果' : '请先同步数据后浏览'}
          </div>
        </div>
      )}

      {Math.ceil(total / 24) > 1 && (
        <Pagination currentPage={page} totalPages={Math.ceil(total / 24)} onPageChange={setPage} />
      )}
    </div>
  );
}
