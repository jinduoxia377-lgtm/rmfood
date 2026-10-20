/**
 * 扩展数据库检索 Tab — RMCHM 中药材库 + CFAM 官方药食同源目录
 * 数据来源: /api/v1/databases/rmchm/herbs + /api/v1/databases/cfam/herbs
 * 支持表格 / 卡片双视图，图片可点击放大预览。
 */
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { databaseApi, RMCHMHerb, CFAMHerb, RMCHMStats, CFAMStats } from '@/api/database'
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { Search, Leaf, BookOpen, RefreshCw, Loader2, LayoutList, LayoutGrid, X, CheckCircle2 } from 'lucide-react'

type Panel = 'rmchm' | 'cfam'
type ViewMode = 'table' | 'card'

const PAGE_SIZE = 20

/** 图片占位 / 缩略图（加载失败时显示占位图标） */
function HerbImage({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [error, setError] = useState(false)
  const cls = className ?? 'w-10 h-10 object-cover rounded-md border border-[var(--border-color)]'

  if (!src || error) {
    return (
      <div
        className={`${cls} bg-[var(--color-neutral-subtle,#f1f5f9)] dark:bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-muted,#94a3b8)] border-[var(--border-color)]`}
        title={alt}
      >
        <Leaf className="w-4 h-4" />
      </div>
    )
  }

  return <img src={src} alt={alt} loading="lazy" className={cls} onError={() => setError(true)} />
}

/** 图片放大预览弹窗 */
function Lightbox({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} 大图预览`}
    >
      <div
        className="relative w-full max-w-3xl my-auto bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-lg)] p-4 shadow-2xl border border-[var(--border-color)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭预览"
          className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <img src={src} alt={name} className="w-full max-h-[80vh] object-contain rounded-lg" />
        <p className="mt-3 text-center font-medium text-[var(--text-primary)]">{name}</p>
      </div>
    </div>
  )
}

/** 药材卡片（卡片视图用） */
function HerbCard({
  name,
  latin,
  imageUrl,
  meta,
  badge,
  onImageClick,
}: {
  name: string
  latin?: string | null
  imageUrl?: string | null
  meta: string[]
  badge?: string
  onImageClick: () => void
}) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <button
        type="button"
        onClick={onImageClick}
        className="w-full aspect-[4/3] bg-[var(--color-neutral-subtle,#f1f5f9)] dark:bg-[var(--bg-tertiary)] flex items-center justify-center overflow-hidden cursor-zoom-in"
        title={`点击查看 ${name} 大图`}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={name} loading="lazy" className="w-full h-full object-cover transition-transform hover:scale-105" />
        ) : (
          <Leaf className="w-10 h-10 text-[var(--text-muted,#94a3b8)]" />
        )}
      </button>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm text-[var(--text-primary)] truncate">{name}</span>
          {badge && (
            <span className="shrink-0 inline-flex items-center gap-0.5 text-xs font-medium text-[var(--color-success-text)] bg-[var(--color-success-container)]/60 dark:bg-[var(--color-success-container)]/20 rounded-full px-1.5 py-0.5">
              <CheckCircle2 className="w-3 h-3" /> {badge}
            </span>
          )}
        </div>
        {latin && <div className="text-xs text-[var(--text-muted)] italic truncate mt-0.5">{latin}</div>}
        <div className="mt-2 flex flex-wrap gap-1">
          {meta.map((m, i) =>
            m ? (
              <span key={i} className="text-xs px-1.5 py-0.5 rounded-md bg-[var(--color-neutral-subtle,#f1f5f9)] dark:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                {m}
              </span>
            ) : null,
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function ExtDatabaseTab() {
  const [panel, setPanel] = useState<Panel>('rmchm')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [keyword, setKeyword] = useState('')
  const [input, setInput] = useState('')
  const [page, setPage] = useState(1)

  // RMCHM
  const [rmchmItems, setRmchmItems] = useState<RMCHMHerb[]>([])
  const [rmchmTotal, setRmchmTotal] = useState(0)
  const [rmchmStats, setRmchmStats] = useState<RMCHMStats | null>(null)

  // CFAM
  const [cfamItems, setCfamItems] = useState<CFAMHerb[]>([])
  const [cfamTotal, setCfamTotal] = useState(0)
  const [cfamStats, setCfamStats] = useState<CFAMStats | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 图片放大预览
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (panel === 'rmchm') {
        const res = await databaseApi.searchRmchmHerbs({ keyword, page, page_size: PAGE_SIZE })
        setRmchmItems(res.items as RMCHMHerb[])
        setRmchmTotal(res.total ?? 0)
        const st = await databaseApi.getRmchmStats()
        setRmchmStats(st)
      } else {
        const res = await databaseApi.searchCfamHerbs({ keyword, page, page_size: PAGE_SIZE })
        setCfamItems(res.items as CFAMHerb[])
        setCfamTotal(res.total ?? 0)
        const st = await databaseApi.getCfamStats()
        setCfamStats(st)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [panel, keyword, page])

  useEffect(() => {
    load()
  }, [load])

  const doSearch = () => {
    setKeyword(input.trim())
    setPage(1)
  }

  const switchPanel = (p: Panel) => {
    setPanel(p)
    setKeyword('')
    setInput('')
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil((panel === 'rmchm' ? rmchmTotal : cfamTotal) / PAGE_SIZE))

  const openLightbox = (src: string | null | undefined, name: string) => {
    if (src) setLightbox({ src, name })
  }

  return (
    <div className="space-y-4">
      {/* 面板切换 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={panel === 'rmchm' ? 'default' : 'outline'} size="sm" onClick={() => switchPanel('rmchm')}>
            <BookOpen className="w-4 h-4 mr-1" /> RMCHM 中药材库（{rmchmStats?.total_herbs ?? '…'}）
          </Button>
          <Button variant={panel === 'cfam' ? 'default' : 'outline'} size="sm" onClick={() => switchPanel('cfam')}>
            <Leaf className="w-4 h-4 mr-1" /> CFAM 官方药食同源（{cfamStats?.total_herbs ?? '…'}）
          </Button>
        </div>

        {/* 视图切换 */}
        <div className="flex items-center gap-1 bg-[var(--color-neutral-subtle,#f1f5f9)] dark:bg-[var(--bg-tertiary)] rounded-lg p-1">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-[var(--bg-secondary)] text-[var(--color-primary-text)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title="表格视图"
          >
            <LayoutList className="w-3.5 h-3.5" /> 表格
          </button>
          <button
            type="button"
            onClick={() => setViewMode('card')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'card'
                ? 'bg-[var(--bg-secondary)] text-[var(--color-primary-text)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title="卡片视图"
          >
            <LayoutGrid className="w-3.5 h-3.5" /> 卡片
          </button>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          placeholder={panel === 'rmchm' ? '搜索药材（中文名/拼音/拉丁名/功效）…' : '搜索药食同源目录（中文名/拉丁名）…'}
          className="max-w-md"
        />
        <Button onClick={doSearch}><Search className="w-4 h-4 mr-1" /> 搜索</Button>
        <Button variant="ghost" size="icon" onClick={load} title="刷新">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {error && <div className="text-red-500 text-sm">加载失败: {error}</div>}

      {/* 数据展示 */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : viewMode === 'card' ? (
        panel === 'rmchm' ? (
          <RmchmCardGrid items={rmchmItems} onImageClick={openLightbox} />
        ) : (
          <CfamCardGrid items={cfamItems} onImageClick={openLightbox} />
        )
      ) : panel === 'rmchm' ? (
        <RmchmTable items={rmchmItems} onImageClick={openLightbox} />
      ) : (
        <CfamTable items={cfamItems} onImageClick={openLightbox} />
      )}

      {/* 分页 */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-[var(--text-muted)]">
          共 {(panel === 'rmchm' ? rmchmTotal : cfamTotal) || 0} 条记录
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            上一页
          </Button>
          <span className="text-xs">第 {page} / {totalPages} 页</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            下一页
          </Button>
        </div>
      </div>

      {/* 图片放大预览 — 通过 Portal 挂载到 body，脱离带 transform 的祖先容器，保证视口居中 */}
      {lightbox && createPortal(
        <Lightbox src={lightbox.src} name={lightbox.name} onClose={() => setLightbox(null)} />,
        document.body,
      )}
    </div>
  )
}

/* ───────── 表格视图 ───────── */

function RmchmTable({ items, onImageClick }: { items: RMCHMHerb[]; onImageClick: (src: string | null | undefined, name: string) => void }) {
  return (
    <Card>
      <CardHeader className="px-4 py-3">
        <CardTitle as="h3" className="text-sm font-semibold">RMCHM 中药材</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {items.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--text-muted)]">暂无数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-[var(--text-muted)]">
                  <th className="py-2 pr-2 font-medium">图片</th>
                  <th className="py-2 pr-2 font-medium">名称</th>
                  <th className="py-2 pr-2 font-medium">拼音</th>
                  <th className="py-2 pr-2 font-medium">拉丁名</th>
                  <th className="py-2 pr-2 font-medium">分类</th>
                  <th className="py-2 pr-2 font-medium">性味</th>
                  <th className="py-2 pr-2 font-medium">归经</th>
                  <th className="py-2 pr-2 font-medium">药食同源</th>
                  <th className="py-2 font-medium">化合物</th>
                </tr>
              </thead>
              <tbody>
                {items.map((h) => (
                  <tr key={h.id} className="border-b last:border-0 hover:bg-[var(--color-neutral-subtle)]/60">
                    <td className="py-2 pr-2">
                      <button type="button" onClick={() => onImageClick(h.image_url, h.name_cn)} title="点击查看大图" className="cursor-zoom-in">
                        <HerbImage src={h.image_url} alt={h.name_cn} />
                      </button>
                    </td>
                    <td className="py-2 pr-2 font-medium">{h.name_cn}</td>
                    <td className="py-2 pr-2 text-[var(--text-muted)]">{h.name_pinyin || '-'}</td>
                    <td className="py-2 pr-2 text-[var(--text-muted)]">{h.name_latin || '-'}</td>
                    <td className="py-2 pr-2">{h.category_cn || '-'}</td>
                    <td className="py-2 pr-2 text-[var(--text-muted)]">{h.nature_cn || '-'}</td>
                    <td className="py-2 pr-2 text-[var(--text-muted)]">{h.meridians_cn || '-'}</td>
                    <td className="py-2 pr-2">{h.is_food_homology ? '是' : '否'}</td>
                    <td className="py-2">{h.compounds_count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CfamTable({ items, onImageClick }: { items: CFAMHerb[]; onImageClick: (src: string | null | undefined, name: string) => void }) {
  return (
    <Card>
      <CardHeader className="px-4 py-3">
        <CardTitle as="h3" className="text-sm font-semibold">CFAM 国家卫健委官方药食同源目录</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {items.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--text-muted)]">暂无数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-[var(--text-muted)]">
                  <th className="py-2 pr-2 font-medium">图片</th>
                  <th className="py-2 pr-2 font-medium">名称</th>
                  <th className="py-2 pr-2 font-medium">拉丁名</th>
                  <th className="py-2 pr-2 font-medium">四气</th>
                  <th className="py-2 pr-2 font-medium">五味</th>
                  <th className="py-2 pr-2 font-medium">公告批次</th>
                  <th className="py-2 font-medium">特殊提示</th>
                </tr>
              </thead>
              <tbody>
                {items.map((h) => (
                  <tr key={h.id} className="border-b last:border-0 hover:bg-[var(--color-neutral-subtle)]/60">
                    <td className="py-2 pr-2">
                      <button type="button" onClick={() => onImageClick(h.image_url, h.name_cn)} title="点击查看大图" className="cursor-zoom-in">
                        <HerbImage src={h.image_url} alt={h.name_cn} />
                      </button>
                    </td>
                    <td className="py-2 pr-2 font-medium">{h.name_cn}</td>
                    <td className="py-2 pr-2 text-[var(--text-muted)]">{h.name_latin || '-'}</td>
                    <td className="py-2 pr-2">{h.nature || '-'}</td>
                    <td className="py-2 pr-2">{h.flavor || '-'}</td>
                    <td className="py-2 pr-2 text-[var(--text-muted)]">{h.announcement_id || '-'}</td>
                    <td className="py-2 text-[var(--text-muted)]">{h.special_notice || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ───────── 卡片视图 ───────── */

function RmchmCardGrid({ items, onImageClick }: { items: RMCHMHerb[]; onImageClick: (src: string | null | undefined, name: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.length === 0 ? (
        <div className="col-span-full py-10 text-center text-sm text-[var(--text-muted)]">暂无数据</div>
      ) : (
        items.map((h) => (
          <HerbCard
            key={h.id}
            name={h.name_cn}
            latin={h.name_latin}
            imageUrl={h.image_url}
            meta={[h.category_cn, h.nature_cn, h.meridians_cn].filter(Boolean) as string[]}
            badge={h.is_food_homology ? '药食同源' : undefined}
            onImageClick={() => onImageClick(h.image_url, h.name_cn)}
          />
        ))
      )}
    </div>
  )
}

function CfamCardGrid({ items, onImageClick }: { items: CFAMHerb[]; onImageClick: (src: string | null | undefined, name: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.length === 0 ? (
        <div className="col-span-full py-10 text-center text-sm text-[var(--text-muted)]">暂无数据</div>
      ) : (
        items.map((h) => (
          <HerbCard
            key={h.id}
            name={h.name_cn}
            latin={h.name_latin}
            imageUrl={h.image_url}
            meta={[h.nature, h.flavor, h.announcement_id].filter(Boolean) as string[]}
            badge="官方目录"
            onImageClick={() => onImageClick(h.image_url, h.name_cn)}
          />
        ))
      )}
    </div>
  )
}