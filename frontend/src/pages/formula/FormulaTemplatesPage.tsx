/**
 * 配方模板库页面 - Phase 5 增强
 * 预设常用配方模板，支持一键创建配方
 */
import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Plus, Search, FlaskConical, Sparkles, Star, ArrowRight, Copy, Clock, Zap } from 'lucide-react'
import { Button, Input, PageHeader, Badge, Card, CardContent } from '@/components/ui'
import { EmptyState } from '@/components/ui/Common'
import { cn } from '@/lib/utils'

// 预设配方模板
const FORMULA_TEMPLATES = [
  {
    id: 'immune-boost',
    name: '增强免疫配方',
    description: '枸杞子、黄芪、人参等补气养阴药材组合，适用于免疫力低下人群',
    effects: ['增强免疫', '补气养阴', '抗疲劳'],
    ingredients: [
      { name: '枸杞子', role: '君', dosage: '10g', category: '补益药' },
      { name: '黄芪', role: '臣', dosage: '15g', category: '补益药' },
      { name: '人参', role: '君', dosage: '5g', category: '补益药' },
      { name: '红枣', role: '佐', dosage: '10g', category: '补益药' },
      { name: '山药', role: '使', dosage: '15g', category: '补益药' },
    ],
    usage: '每日1-2次，每次5g，温水冲服',
    tags: ['热门', '免疫力', '药食同源'],
    usage_count: 328,
    color: 'var(--color-primary, var(--color-primary-400))',
  },
  {
    id: 'sleep-aid',
    name: '改善睡眠配方',
    description: '酸枣仁、百合、茯苓等安神药材组合，适用于失眠多梦人群',
    effects: ['改善睡眠', '安神', '养心'],
    ingredients: [
      { name: '酸枣仁', role: '君', dosage: '15g', category: '安神药' },
      { name: '百合', role: '臣', dosage: '10g', category: '补益药' },
      { name: '茯苓', role: '佐', dosage: '15g', category: '利水渗湿药' },
      { name: '莲子', role: '使', dosage: '10g', category: '补益药' },
    ],
    usage: '睡前30分钟服用，每次8g，温水冲泡',
    tags: ['睡眠', '安神', '药食同源'],
    usage_count: 256,
    color: 'var(--color-tertiary, var(--color-accent-500))',
  },
  {
    id: 'blood-sugar',
    name: '辅助降血糖配方',
    description: '苦瓜、黄精、桑叶等清热生津药材组合，适用于血糖偏高人群',
    effects: ['降血糖', '清热生津', '养阴润燥'],
    ingredients: [
      { name: '苦瓜', role: '君', dosage: '10g', category: '清热药' },
      { name: '黄精', role: '臣', dosage: '15g', category: '补益药' },
      { name: '桑叶', role: '佐', dosage: '10g', category: '解表药' },
      { name: '玉米须', role: '使', dosage: '15g', category: '利水渗湿药' },
    ],
    usage: '每日2次，餐后30分钟服用，每次6g',
    tags: ['降血糖', '清热', '慢性病'],
    usage_count: 189,
    color: 'var(--color-secondary, #0A84FF)',
  },
  {
    id: 'blood-pressure',
    name: '辅助降血压配方',
    description: '决明子、山楂、葛根等活血化瘀药材组合，适用于血压偏高人群',
    effects: ['降血压', '活血化瘀', '清肝明目'],
    ingredients: [
      { name: '决明子', role: '君', dosage: '10g', category: '清热药' },
      { name: '山楂', role: '臣', dosage: '15g', category: '消食药' },
      { name: '葛根', role: '佐', dosage: '15g', category: '解表药' },
      { name: '槐米', role: '使', dosage: '10g', category: '止血药' },
    ],
    usage: '每日1-2次，每次5g，饭后服用',
    tags: ['降血压', '活血', '慢性病'],
    usage_count: 167,
    color: 'var(--color-error, #FF3B30)',
  },
  {
    id: 'beauty-skin',
    name: '美容养颜配方',
    description: '玫瑰花、白芷、茯苓等养血活血药材组合，适用于面色暗沉人群',
    effects: ['美容养颜', '养血活血', '祛斑'],
    ingredients: [
      { name: '玫瑰花', role: '君', dosage: '6g', category: '理气药' },
      { name: '白芷', role: '臣', dosage: '10g', category: '解表药' },
      { name: '茯苓', role: '佐', dosage: '15g', category: '利水渗湿药' },
      { name: '红枣', role: '使', dosage: '10g', category: '补益药' },
    ],
    usage: '每日早晚各一次，每次5g，温水冲服',
    tags: ['美容', '养颜', '女性'],
    usage_count: 412,
    color: 'var(--color-pink-500, #D946EF)',
  },
  {
    id: 'digestive',
    name: '调理肠胃配方',
    description: '山楂、陈皮、薏苡仁等健脾消食药材组合，适用于消化不良人群',
    effects: ['调理肠胃', '健脾消食', '祛湿'],
    ingredients: [
      { name: '山楂', role: '君', dosage: '15g', category: '消食药' },
      { name: '陈皮', role: '臣', dosage: '10g', category: '理气药' },
      { name: '薏苡仁', role: '佐', dosage: '20g', category: '利水渗湿药' },
      { name: '茯苓', role: '使', dosage: '15g', category: '利水渗湿药' },
    ],
    usage: '每日2次，餐后服用，每次8g',
    tags: ['肠胃', '消食', '祛湿'],
    usage_count: 234,
    color: 'var(--color-warning, #FF9F0A)',
  },
  {
    id: 'anti-fatigue',
    name: '抗疲劳配方',
    description: '红景天、五味子、西洋参等补气提神药材组合，适用于疲劳人群',
    effects: ['抗疲劳', '补气提神', '增强体力'],
    ingredients: [
      { name: '红景天', role: '君', dosage: '10g', category: '补益药' },
      { name: '五味子', role: '臣', dosage: '6g', category: '收涩药' },
      { name: '西洋参', role: '佐', dosage: '5g', category: '补益药' },
      { name: '枸杞子', role: '使', dosage: '10g', category: '补益药' },
    ],
    usage: '每日1次，运动前30分钟服用，每次6g',
    tags: ['抗疲劳', '补气', '运动'],
    usage_count: 198,
    color: 'var(--color-teal-500, #14B8A6)',
  },
  {
    id: 'slimming',
    name: '辅助减肥配方',
    description: '荷叶、山楂、决明子等清热利湿药材组合，适用于肥胖人群',
    effects: ['辅助减肥', '清热利湿', '润肠通便'],
    ingredients: [
      { name: '荷叶', role: '君', dosage: '10g', category: '利水渗湿药' },
      { name: '山楂', role: '臣', dosage: '15g', category: '消食药' },
      { name: '决明子', role: '佐', dosage: '10g', category: '清热药' },
      { name: '番泻叶', role: '使', dosage: '3g', category: '泻下药' },
    ],
    usage: '每日1-2次，餐后服用，每次5g',
    tags: ['减肥', '清热', '塑身'],
    usage_count: 289,
    color: 'var(--color-tertiary, var(--color-accent-500))',
  },
]

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

export default function FormulaTemplatesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category>('all')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [showFavOnly, setShowFavOnly] = useState(false)

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredTemplates = useMemo(() => {
    let templates = [...FORMULA_TEMPLATES]
    if (showFavOnly) templates = templates.filter(t => favorites.has(t.id))
    if (category !== 'all') {
      if (category === '热门') {
        templates = templates.filter(t => t.tags.includes('热门'))
      } else if (category === '其他') {
        templates = templates.filter(t =>
          !t.tags.some(tag => ['热门', '免疫力', '睡眠', '肠胃', '美容', '慢性病'].includes(tag)),
        )
      } else {
        templates = templates.filter(t => t.tags.includes(category))
      }
    }
    if (search.trim()) {
      const keyword = search.toLowerCase()
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(keyword) ||
        t.description.toLowerCase().includes(keyword) ||
        t.effects.some(e => e.toLowerCase().includes(keyword)),
      )
    }
    return templates.sort((a, b) => b.usage_count - a.usage_count)
  }, [search, category, favorites, showFavOnly])

  const handleUseTemplate = (template: typeof FORMULA_TEMPLATES[0]) => {
    // 将模板数据存储到 sessionStorage，跳转到新建配方页
    sessionStorage.setItem('formula_template', JSON.stringify(template))
    navigate('/formulas/new?from_template=true')
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="配方模板库"
        description="基于经典药食同源配伍原则设计的配方模板，一键创建您的专属配方"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFavOnly(!showFavOnly)}
              className={cn(
                'p-2 rounded-lg border transition-all',
                showFavOnly
                  ? 'bg-warning-50 dark:bg-warning-900/20 border-amber-300 dark:border-amber-700 text-warning-600'
                  : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-neutral-600',
              )}
            >
              <Star size={18} className={showFavOnly ? 'fill-amber-400' : ''} />
            </button>
            <Link to="/formulas/new">
              <Button icon={<Plus size={16} />} size="md">新建配方</Button>
            </Link>
          </div>
        }
      />

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
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                category === cat.value
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                  : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 模板统计 */}
      <div className="flex items-center gap-4 text-sm text-neutral-500">
        <span>共 {filteredTemplates.length} 个模板</span>
        {favorites.size > 0 && (
          <span className="flex items-center gap-1">
            <Star size={12} className="fill-amber-400 text-warning-400" />
            {favorites.size} 个收藏
          </span>
        )}
        <span className="flex items-center gap-1">
          <FlaskConical size={12} />
          已使用 {FORMULA_TEMPLATES.reduce((sum, t) => sum + t.usage_count, 0).toLocaleString()} 次
        </span>
      </div>

      {/* 模板网格 */}
      {filteredTemplates.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={48} />}
          title="未找到匹配模板"
          description={showFavOnly ? "您还没有收藏任何模板" : "尝试调整搜索条件或分类筛选"}
          action={
            showFavOnly ? (
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
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-neutral-900 dark:text-white group-hover:text-primary-600 transition-colors">
                      {template.name}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-1">
                      <Zap size={10} className="text-warning-500" />
                      使用 {template.usage_count} 次
                    </p>
                  </div>
                  <button
                    onClick={() => toggleFavorite(template.id)}
                    className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <Star
                      size={16}
                      className={favorites.has(template.id) ? 'fill-amber-400 text-warning-400' : 'text-neutral-300'}
                    />
                  </button>
                </div>

                {/* 描述 */}
                <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2 mb-3">
                  {template.description}
                </p>

                {/* 功效标签 */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {template.effects.map(effect => (
                    <Badge key={effect} variant="primary" size="sm">{effect}</Badge>
                  ))}
                </div>

                {/* 成分预览 */}
                <div className="bg-slate-50 dark:bg-neutral-800/50 rounded-lg p-2.5 mb-3">
                  <p className="text-xs text-neutral-500 mb-2">成分组成</p>
                  <div className="flex flex-wrap gap-1">
                    {template.ingredients.slice(0, 4).map(ing => (
                      <span key={ing.name} className="text-xs text-neutral-600 dark:text-neutral-400">
                        {ing.name}
                        {ing.role && <span className="text-primary-500 ml-0.5">({ing.role})</span>}
                        {ing.dosage && <span className="text-neutral-400 ml-0.5">{ing.dosage}</span>}
                      </span>
                    ))}
                    {template.ingredients.length > 4 && (
                      <span className="text-xs text-neutral-400">+{template.ingredients.length - 4}种</span>
                    )}
                  </div>
                </div>

                {/* 服用方法 */}
                <p className="text-xs text-neutral-400 mb-4 flex items-center gap-1">
                  <Clock size={10} />
                  {template.usage}
                </p>

                {/* 操作 */}
                <div className="flex items-center gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <Button
                    size="sm"
                    className="flex-1"
                    icon={<Copy size={14} />}
                    onClick={() => handleUseTemplate(template)}
                    style={template.color ? { backgroundColor: template.color } : undefined}
                  >
                    使用此模板
                  </Button>
                  <button
                    className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-primary-600 hover:border-primary-300 transition-colors"
                    title="预览配方详情"
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 底部提示 */}
      <div className="text-center py-6 text-sm text-neutral-400">
        <p>没有找到合适的模板？</p>
        <Link to="/formulas/new" className="text-primary-600 hover:text-primary-700 mt-1 inline-block">
          从空白配方开始创建
        </Link>
      </div>
    </div>
  )
}
