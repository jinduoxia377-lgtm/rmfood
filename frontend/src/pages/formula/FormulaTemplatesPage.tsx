/**
 * 配方模板库页面 - 真实数据版
 * 模板数据来自后端 GET /api/v1/formulas/templates（真实数据库）
 * 支持搜索、分类筛选、收藏、一键使用模板（跳转新建配方页并预填）
 */
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { Plus, Search, FlaskConical, Sparkles, Star, Copy, Clock, Zap, RefreshCw } from 'lucide-react'
import { Button, Input, Badge, Card, CardContent } from '@/components/ui'
import { EmptyState, Skeleton } from '@/components/ui/Common'
import { cn } from '@/lib/utils'
import { getFormulaTemplates, type FormulaTemplateItem } from '@/api/formula'

type Category = 'all' | '热门' | '免疫力' | '睡眠' | '肠胃' | '美容' | '慢性病' | '其他'

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: '热门', label: '热门推荐' },
  { value: '免疫力', label: '增强免疫' },
  { value: '睡眠', label: '改善睡眠' },
  { value: '肠胃', label: '调理肠胃' },
  { value: '美容', label: '美容养颜' },
  { value: '慢性病', label: '慢性病辅助' },
  { value: '其他', label: '其他功效' },
]

// 类别 → 视觉颜色（纯展示用，非数据字段）
const CATEGORY_COLORS: Record<string, string> = {
  免疫力: 'var(--color-primary, var(--color-primary-400))',
  睡眠: 'var(--color-tertiary, var(--color-accent-500))',
  慢性病: 'var(--color-secondary, #0A84FF)',
  美容: 'var(--color-danger-500, #D946EF)',
  肠胃: 'var(--color-warning, #FF9F0A)',
  其他: 'var(--color-teal-500, #14B8A6)',
}

const OTHER_CATEGORY_KEYS = ['免疫力', '睡眠', '肠胃', '美容', '慢性病']

// 后端模板 → 卡片展示字段映射
function mapTemplate(t: FormulaTemplateItem) {
  return {
    id: String(t.id),
    code: t.code,
    name: t.name,
    description: t.description || '',
    effects: t.effects || [],
    ingredients: (t.ingredients || []).map((ing) => ({
      name: ing.name,
      role: ing.role || '',
      dosage: ing.dosage || '',
      category: ing.category || '',
    })),
    usage: t.usage || '',
    usage_count: t.usage_count || 0,
    tags: [t.category || '其他'],
    is_featured: t.is_featured,
    color: CATEGORY_COLORS[t.category || '其他'] || 'var(--color-primary, var(--color-primary-400))',
  }
}

export default function FormulaTemplatesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category>('all')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [showFavOnly, setShowFavOnly] = useState(false)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['formula-templates'],
    queryFn: () => getFormulaTemplates(),
  })

  const templates = useMemo(() => (data?.items || []).map(mapTemplate), [data])

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredTemplates = useMemo(() => {
    let result = [...templates]
    if (showFavOnly) result = result.filter(t => favorites.has(t.id))
    if (category !== 'all') {
      if (category === '热门') {
        result = result.filter(t => t.is_featured)
      } else if (category === '其他') {
        result = result.filter(t => !OTHER_CATEGORY_KEYS.includes(t.tags[0] || ''))
      } else {
        result = result.filter(t => t.tags.includes(category))
      }
    }
    if (search.trim()) {
      const keyword = search.toLowerCase()
      result = result.filter(t =>
        t.name.toLowerCase().includes(keyword) ||
        t.description.toLowerCase().includes(keyword) ||
        t.effects.some(e => e.toLowerCase().includes(keyword)),
      )
    }
    return result.sort((a, b) => b.usage_count - a.usage_count)
  }, [templates, search, category, favorites, showFavOnly])

  const totalUsage = useMemo(() => templates.reduce((sum, t) => sum + t.usage_count, 0), [templates])

  const handleUseTemplate = (template: ReturnType<typeof mapTemplate>) => {
    // 将模板数据存储到 sessionStorage，跳转到新建配方页
    sessionStorage.setItem('formula_template', JSON.stringify(template))
    navigate('/formulas/new?from_template=true')
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 py-[var(--space-apple-lg)]">
      {/* 欢迎横幅 */}
      <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-[var(--space-apple-md)]">
          <div>
            <h1 className="text-xl font-semibold leading-snug tracking-tight">配方模板</h1>
            <p className="mt-1 text-sm text-white/80">预设配方模板，快速创建标准化配方</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setShowFavOnly(!showFavOnly)}
              className={cn(
                'p-2 rounded-[var(--radius-Apple-sm)] border transition-all',
                showFavOnly
                  ? 'bg-[var(--color-warning-container)] border-[var(--color-warning-border)] dark:border-[var(--color-warning)] text-[var(--color-warning-text)]'
                  : 'border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
              )}
              title={showFavOnly ? '显示全部模板' : '仅显示收藏模板'}
            >
              <Star size={18} className={showFavOnly ? 'fill-warning-400' : ''} />
            </button>
            <Link to="/formulas/new">
              <Button icon={<Plus size={16} />} size="md">新建配方</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 搜索与分类 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索模板名称、功效..."
          prefix={<Search size={16} />}
          className="flex-1"
        />
        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={cn(
                'px-[var(--space-apple-sm)] py-1.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-all',
                category === cat.value
                  ? 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)] dark:bg-[var(--color-primary-container)]/30 dark:text-[var(--color-primary-text)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 模板统计 */}
      <div className="flex items-center gap-4 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
        <span>共 {filteredTemplates.length} 个模板</span>
        {favorites.size > 0 && (
          <span className="flex items-center gap-1">
            <Star size={12} className="fill-warning-400 text-[var(--color-warning-text)]" />
            {favorites.size} 个收藏
          </span>
        )}
        <span className="flex items-center gap-1">
          <FlaskConical size={12} />
          已使用 {totalUsage.toLocaleString()} 次
        </span>
        {isError && (
          <button onClick={() => refetch()} className="flex items-center gap-1 text-[var(--color-error-text)] hover:underline">
            <RefreshCw size={12} /> 加载失败，点击重试
          </button>
        )}
      </div>

      {/* 模板网格 */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="h-1.5 bg-[var(--border-color)]" />
              <CardContent className="p-5 space-y-[var(--space-apple-sm)]">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-14" />
                  <Skeleton className="h-5 w-14" />
                  <Skeleton className="h-5 w-14" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={48} />}
          title={isError ? '模板加载失败' : showFavOnly ? '您还没有收藏任何模板' : '未找到匹配模板'}
          description={
            isError
              ? '后端模板服务暂不可用，请检查网络后重试'
              : showFavOnly
                ? '点击卡片右上角星标收藏常用模板'
                : '尝试调整搜索条件或分类筛选'
          }
          action={
            isError ? (
              <Button variant="secondary" onClick={() => refetch()}>重新加载</Button>
            ) : showFavOnly ? (
              <Button variant="secondary" onClick={() => setShowFavOnly(false)}>显示全部模板</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className="group overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
            >
              {/* 顶部色条 */}
              <div className="h-1.5" style={{ backgroundColor: template.color }} />

              <CardContent className="p-5">
                {/* 头部 */}
                <div className="flex items-start justify-between mb-[var(--space-apple-sm)]">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary-text)] transition-colors">
                      {template.name}
                    </h3>
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5 flex items-center gap-1">
                      <Zap size={10} className="text-[var(--color-warning-text)]0" />
                      使用 {template.usage_count} 次
                    </p>
                  </div>
                  <button
                    onClick={() => toggleFavorite(template.id)}
                    className="p-1.5 rounded-[var(--radius-Apple-sm)] hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    <Star
                      size={16}
                      className={favorites.has(template.id) ? 'fill-warning-400 text-[var(--color-warning-text)]' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'}
                    />
                  </button>
                </div>

                {/* 描述 */}
                <p className="text-sm text-[var(--text-muted)] line-clamp-2 mb-[var(--space-apple-sm)]">
                  {template.description}
                </p>

                {/* 功效标签 */}
                {template.effects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-[var(--space-apple-sm)]">
                    {template.effects.map(effect => (
                      <Badge key={effect} variant="primary" size="sm">{effect}</Badge>
                    ))}
                  </div>
                )}

                {/* 成分预览 */}
                {template.ingredients.length > 0 && (
                  <div className="bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] p-2.5 mb-[var(--space-apple-sm)]">
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-2">成分组成</p>
                    <div className="flex flex-wrap gap-1">
                      {template.ingredients.slice(0, 4).map(ing => (
                        <span key={ing.name} className="text-xs text-[var(--text-secondary)]">
                          {ing.name}
                          {ing.role && <span className="text-[var(--color-primary-text)]0 ml-0.5">({ing.role})</span>}
                          {ing.dosage && <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-0.5">{ing.dosage}</span>}
                        </span>
                      ))}
                      {template.ingredients.length > 4 && (
                        <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">+{template.ingredients.length - 4}种</span>
                      )}
                    </div>
                  </div>
                )}

                {/* 服用方法 */}
                {template.usage && (
                  <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-[var(--space-apple-md)] flex items-center gap-1">
                    <Clock size={10} />
                    {template.usage}
                  </p>
                )}

                {/* 操作 */}
                <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-color)]">
                  <Button
                    size="sm"
                    className="flex-1"
                    icon={<Copy size={14} />}
                    onClick={() => handleUseTemplate(template)}
                    style={template.color ? { backgroundColor: template.color } : undefined}
                  >
                    使用此模板
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 底部提示 */}
      <div className="text-center py-[var(--space-apple-lg)] text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
        <p>没有找到合适的模板？</p>
        <Link to="/formulas/new" className="text-[var(--color-primary-text)] hover:text-[var(--color-primary-text)] mt-1 inline-block">
          从空白配方开始创建
        </Link>
      </div>
    </div>
  )
}