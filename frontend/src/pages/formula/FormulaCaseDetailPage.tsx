/**
 * 配方案例详情页 — v3.0 字体排版 & 功能扩展
 *
 * 升级内容：
 * 1. 排版体系全面对齐 RMFOOD 设计令牌（H1/H2/H3/Body/Caption 四级）
 * 2. 内容阅读时间估算（基于字数）
 * 3. 目录导航（TOC）— 自动从 H1/H2/H3 标题提取锚点
 * 4. 正文区字号缩放控件（小/中/大）
 * 5. 评论点赞交互
 * 6. 案例图片画廊（多图时横向滚动预览）
 * 7. 分享弹窗改进（复制成功视觉反馈）
 * 8. 深色模式下的内容可读性优化
 */
import { useState, useRef, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Heart,
  Eye,
  Clock,
  Tag as TagIcon,
  Share2,
  MessageCircle,
  Calendar,
  User,
  FileText,
  ArrowRight,
  Bookmark,
  Flag,
  Copy,
  Mail,
  Link as LinkIcon,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Award,
  ThumbsUp,
  Trash2,
  X,
  Minus,
  Plus,
  List,
  Image as ImageIcon,
  Hash,
} from 'lucide-react'
import {
  getFormulaCase,
  toggleCaseLike,
  getCaseComments,
  createCaseComment,
  deleteFormulaCase,
  toggleBookmark,
  reportCase,
  getCasesByFormula,
  type FormulaCase,
  type CaseComment,
} from '@/api/formula'
import { Card, CardContent, Badge, Button, Input, Textarea } from '@/components/ui'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toastStore'

// ── 分类主题映射 ───────────────────────────────────────────────
const CATEGORY_THEME: Record<string, { gradient: string; text: string; bg: string; ring: string; label: string }> = {
  '补气养血':   { gradient: 'from-rose-600 to-pink-700',   text: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/30',  ring: 'ring-rose-300 dark:ring-rose-700', label: '气血' },
  '滋阴润燥':   { gradient: 'from-violet-600 to-purple-700', text: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30', ring: 'ring-violet-300 dark:ring-violet-700', label: '润燥' },
  '清热解毒':   { gradient: 'from-emerald-600 to-teal-700', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', ring: 'ring-emerald-300 dark:ring-emerald-700', label: '解毒' },
  '活血化瘀':   { gradient: 'from-red-600 to-rose-700',   text: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30',  ring: 'ring-red-300 dark:ring-red-700', label: '化瘀' },
  '祛湿化浊':   { gradient: 'from-amber-600 to-orange-700', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', ring: 'ring-amber-300 dark:ring-amber-700', label: '祛湿' },
  '扶正固本':   { gradient: 'from-sky-600 to-blue-700',   text: 'text-sky-700 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-900/30',  ring: 'ring-sky-300 dark:ring-sky-700', label: '固本' },
  '疏肝理气':   { gradient: 'from-lime-600 to-green-700', text: 'text-lime-700 dark:text-lime-400', bg: 'bg-lime-100 dark:bg-lime-900/30', ring: 'ring-lime-300 dark:ring-lime-700', label: '疏肝' },
  '化痰散结':   { gradient: 'from-purple-600 to-violet-700', text: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30', ring: 'ring-purple-300 dark:ring-purple-700', label: '散结' },
  '安神定志':   { gradient: 'from-indigo-600 to-blue-700', text: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30', ring: 'ring-indigo-300 dark:ring-indigo-700', label: '安神' },
  '健脾和胃':   { gradient: 'from-orange-600 to-amber-700', text: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30', ring: 'ring-orange-300 dark:ring-orange-700', label: '健脾' },
  '补肾填精':   { gradient: 'from-teal-600 to-emerald-700', text: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-900/30', ring: 'ring-teal-300 dark:ring-teal-700', label: '补肾' },
  '清热利湿':   { gradient: 'from-cyan-600 to-sky-700',   text: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/30', ring: 'ring-cyan-300 dark:ring-cyan-700', label: '利湿' },
  '调和营卫':   { gradient: 'from-pink-600 to-rose-700',  text: 'text-pink-700 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-900/30', ring: 'ring-pink-300 dark:ring-pink-700', label: '调和' },
  '通络止痛':   { gradient: 'from-slate-600 to-zinc-700', text: 'text-slate-700 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-900/30', ring: 'ring-slate-300 dark:ring-slate-700', label: '通络' },
}

function getTheme(cat?: string) {
  if (!cat) return { gradient: 'from-primary-600 to-secondary-600', text: 'text-neutral-600 dark:text-neutral-400', bg: 'bg-neutral-100 dark:bg-neutral-800', ring: 'ring-neutral-300', label: '方' }
  return CATEGORY_THEME[cat] ?? { gradient: 'from-primary-600 to-secondary-600', text: 'text-neutral-600 dark:text-neutral-400', bg: 'bg-neutral-100 dark:bg-neutral-800', ring: 'ring-neutral-300', label: cat.slice(0, 2) }
}

// 字号映射：small=0.8125rem, medium=0.9375rem (默认), large=1.0625rem
const FONT_SIZES = { small: 'text-sm', medium: 'text-base', large: 'text-lg' } as const
type FontSizeKey = keyof typeof FONT_SIZES

// ── 阅读时间计算 ──────────────────────────────────────────────
function calcReadingTime(charCount: number): string {
  const minutes = Math.max(1, Math.ceil(charCount / 350))
  return minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)}小时${minutes % 60}分钟`
}

// ── 提取目录项 ────────────────────────────────────────────────
interface TocItem {
  id: string
  text: string
  level: 1 | 2 | 3
}
function extractToc(content: string): TocItem[] {
  const items: TocItem[] = []
  const lines = content.split('\n')
  lines.forEach((line, i) => {
    const h1 = line.match(/^#\s+(.+)$/)
    const h2 = line.match(/^##\s+(.+)$/)
    const h3 = line.match(/^###\s+(.+)$/)
    if (h1) items.push({ id: `toc-${i}`, text: h1[1].trim(), level: 1 })
    else if (h2) items.push({ id: `toc-${i}`, text: h2[1].trim(), level: 2 })
    else if (h3) items.push({ id: `toc-${i}`, text: h3[1].trim(), level: 3 })
  })
  return items
}

// ── 分享弹窗 ────────────────────────────────────────────────
function ShareDialog({ open, onClose, caseTitle }: { open: boolean; onClose: () => void; caseTitle: string }) {
  if (!open) return null
  const shareUrl = window.location.href
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"  role="button" tabIndex={0} onClick={onClose} />
      <Card className="relative w-full max-w-sm rounded-2xl shadow-2xl border-neutral-200 dark:border-neutral-700">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-text-primary">分享案例</h3>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              <X size={14} />
            </button>
          </div>
          <p className="text-xs text-text-muted mb-4">将配方经验传递给更多需要的人</p>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={shareUrl} readOnly className="text-xs flex-1" />
              <Button size="sm" variant="secondary" onClick={() => {
                navigator.clipboard.writeText(shareUrl)
                useToastStore.getState().addToast({ type: 'success', message: '链接已复制到剪贴板' })
              }}>
                <Copy size={14} />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Share2, color: 'text-sky-500', bg: 'bg-sky-100 dark:bg-sky-900/30', label: 'Twitter' },
                { icon: Mail, color: 'text-primary-500', bg: 'bg-primary-100 dark:bg-primary-900/30', label: '邮件' },
                { icon: LinkIcon, color: 'text-success-500', bg: 'bg-success-100 dark:bg-success-900/30', label: '复制链接' },
              ].map(({ icon: Icon, color, bg, label }, i) => (
                <button key={i}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
                    label === '复制链接' ? '' : ''
                  }`}
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl)
                    onClose()
                    useToastStore.getState().addToast({ type: 'success', message: '链接已复制到剪贴板' })
                  }}
                >
                  <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center`}>
                    <Icon size={14} className={color} />
                  </div>
                  <span className="text-[10px] text-text-muted">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── 举报弹窗 ────────────────────────────────────────────────
function ReportDialog({ open, onClose, caseId }: { open: boolean; onClose: () => void; caseId: number }) {
  const addToast = useToastStore(s => s.addToast)
  const [reason, setReason] = useState('')
  const [reportType, setReportType] = useState('wrong_content')
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const handleSubmit = async () => {
    if (!reason.trim() || reason.length < 5) { addToast({ type: 'error', message: '请详细说明举报原因（至少5个字）' }); return }
    setSubmitting(true)
    try { await reportCase(Number(caseId), reason); addToast({ type: 'success', message: '举报已提交，我们将尽快处理' }); onClose() }
    catch { addToast({ type: 'error', message: '提交失败，请重试' }) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"  role="button" tabIndex={0} onClick={onClose} />
      <Card className="relative w-full max-w-sm rounded-2xl shadow-2xl border-neutral-200 dark:border-neutral-700">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-text-primary">举报案例</h3>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              <X size={14} />
            </button>
          </div>
          <p className="text-xs text-text-muted mb-4">帮助我们维护社区内容质量</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">举报类型</label>
              <select value={reportType} onChange={e => setReportType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="wrong_content">内容错误</option>
                <option value="inappropriate">不当内容</option>
                <option value="spam">垃圾广告</option>
                <option value="copyright">侵犯版权</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">详细说明</label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="请描述您举报的原因..." rows={3} maxLength={500} />
              <p className="text-xs text-text-muted mt-1">{reason.length}/500</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="secondary" size="sm" onClick={onClose} className="flex-1 rounded-xl">取消</Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting || reason.length < 5}
              className="flex-1 rounded-xl bg-error-500 hover:bg-error-600 text-white">
              {submitting ? '提交中...' : '提交举报'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── 删除确认弹窗 ─────────────────────────────────────────────
function DeleteDialog({ open, onClose, onConfirm, caseTitle }: {
  open: boolean; onClose: () => void; onConfirm: () => void; caseTitle: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"  role="button" tabIndex={0} onClick={onClose} />
      <Card className="relative w-full max-w-sm rounded-2xl shadow-2xl border-neutral-200 dark:border-neutral-700">
        <CardContent className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-error-100 dark:bg-error-900/30 flex items-center justify-center shrink-0">
              <Trash2 size={18} className="text-error-500" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">确认删除案例</h3>
              <p className="text-xs text-text-muted mt-0.5">此操作不可撤销，案例内容将被永久删除</p>
            </div>
          </div>
          <div className="bg-neutral-50 dark:bg-neutral-900 rounded-xl p-3 mb-4">
            <p className="text-sm text-text-secondary truncate">{caseTitle}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} className="flex-1 rounded-xl">取消</Button>
            <Button size="sm" onClick={() => { onConfirm(); onClose() }}
              className="flex-1 rounded-xl bg-error-500 hover:bg-error-600 text-white">确认删除</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── 评论组件 ────────────────────────────────────────────────
function CommentItem({
  comment, onReply, onLike, isLiked,
}: {
  comment: CaseComment
  onReply: (parentId: number, content: string) => void
  onLike: (commentId: number) => void
  isLiked: boolean
}) {
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')
  const colors = ['bg-primary-500', 'bg-secondary-500', 'bg-accent-500', 'bg-warning-500', 'bg-success-500']
  const colorIdx = Math.abs(Number(comment.id)) % colors.length

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800">
        <div className={`w-9 h-9 rounded-xl ${colors[colorIdx]} flex items-center justify-center shrink-0 text-white text-xs font-bold shadow-sm`}>
          {(comment.author || '用').slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm text-text-primary">{comment.author || '匿名用户'}</span>
            <span className="text-xs text-text-muted flex items-center gap-1"><Clock size={11} />{new Date(comment.created_at).toLocaleString('zh-CN')}</span>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{comment.content}</p>
          <div className="flex items-center gap-4 mt-2.5">
            <button
              onClick={() => onLike(Number(comment.id))}
              className={`inline-flex items-center gap-1 text-xs transition-colors ${
                isLiked ? 'text-error-500' : 'text-text-muted hover:text-error-500'
              }`}
            >
              <Heart size={12} className={isLiked ? 'fill-current' : ''} />{comment.likes || 0}
            </button>
            <button onClick={() => setShowReply(!showReply)} className="text-xs text-text-muted hover:text-primary-500 transition-colors">回复</button>
          </div>
        </div>
      </div>
      {showReply && (
        <div className="ml-12 flex gap-2">
          <Input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="写下回复..." className="flex-1 text-sm rounded-xl"
            onKeyDown={e => e.key === 'Enter' && replyText.trim() && (onReply(Number(comment.id), replyText), setReplyText(''), setShowReply(false))} />
          <Button size="sm" onClick={() => { if (replyText.trim()) { onReply(Number(comment.id), replyText); setReplyText(''); setShowReply(false) } }} disabled={!replyText.trim()} className="rounded-xl">发送</Button>
          <Button size="sm" variant="secondary" onClick={() => setShowReply(false)} className="rounded-xl">取消</Button>
        </div>
      )}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-12 space-y-2">
          {(comment.replies ?? []).map((r: CaseComment) => (
            <CommentItem key={r.id} comment={r} onReply={onReply} onLike={onLike} isLiked={false} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── 骨架屏 ──────────────────────────────────────────────────
function DetailSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-5 px-4 py-6">
      <Skeleton className="h-5 w-40 rounded-full" />
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-primary-900/20 dark:to-secondary-900/20 h-56" />
          <Skeleton className="h-8 w-3/4 rounded-xl" />
          <Skeleton className="h-4 w-full rounded-lg" />
          <Skeleton className="h-4 w-2/3 rounded-lg" />
          <div className="flex gap-3">
            <Skeleton className="h-9 w-20 rounded-xl" />
            <Skeleton className="h-9 w-20 rounded-xl" />
            <Skeleton className="h-9 w-20 rounded-xl" />
          </div>
          <div className="space-y-3 pt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/4 rounded" />
                  <Skeleton className="h-4 w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────
export function FormulaCaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const addToast = useToastStore(s => s.addToast)
  const contentRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [fontSize, setFontSize] = useState<FontSizeKey>('medium')
  const [likedCommentIds, setLikedCommentIds] = useState<Set<number>>(new Set())
  const [showToc, setShowToc] = useState(false)

  const { data: caseItem, isLoading } = useQuery({
    queryKey: ['formula-case', id],
    queryFn: () => getFormulaCase(Number(id)),
    enabled: !!id,
  })

  const { data: comments = [] } = useQuery({
    queryKey: ['case-comments', id],
    queryFn: () => getCaseComments(Number(id)),
    enabled: !!id,
  })

  const { data: relatedCases } = useQuery({
    queryKey: ['formula-cases-by-formula', caseItem?.formula_id],
    queryFn: () => getCasesByFormula(Number(caseItem!.formula_id as number)),
    enabled: !!caseItem?.formula_id,
  })

  // ── 排版数据 ──
  const readingTime = useMemo(() =>
    caseItem ? calcReadingTime((caseItem.content?.length || 0)) : null, [caseItem])

  const tocItems = useMemo(() =>
    caseItem ? extractToc(caseItem.content || '') : [], [caseItem])

  // 收集图片 URL
  const caseImages = useMemo(() => {
    if (!caseItem) return []
    const urls: string[] = []
    const imgRegex = /!\[.*?\]\((.*?)\)/g
    let m: RegExpExecArray | null
    while ((m = imgRegex.exec(caseItem.content || '')) !== null) urls.push(m[1])
    return urls
  }, [caseItem])

  // 阅读进度（视口固定指示条）
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      setProgress(scrollHeight > clientHeight ? Math.round((scrollTop / (scrollHeight - clientHeight)) * 100) : 0)
    }
    el.addEventListener('scroll', update, { passive: true })
    return () => el.removeEventListener('scroll', update)
  }, [])

  // Like case
  const likeMutation = useMutation({
    mutationFn: () => toggleCaseLike(Number(id)),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['formula-case', id] })
      const prev = queryClient.getQueryData(['formula-case', id]) as FormulaCase | undefined
      if (prev) queryClient.setQueryData(['formula-case', id], { ...prev, likes: prev.likes + 1 })
      return { prev }
    },
    onError: (_, __, ctx) => { if (ctx?.prev) queryClient.setQueryData(['formula-case', id], ctx.prev) },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['formula-case', id] }),
  })

  // Bookmark
  const bookmarkMutation = useMutation({
    mutationFn: () => toggleBookmark(Number(id)),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['formula-case', id] })
      const prev = queryClient.getQueryData(['formula-case', id]) as FormulaCase | undefined
      if (prev) queryClient.setQueryData(['formula-case', id], { ...prev, bookmarks: (prev.bookmarks || 0) + 1 })
      return { prev }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['formula-case', id] }),
  })

  // Comment
  const commentMutation = useMutation({
    mutationFn: (text: string) => createCaseComment(Number(id), { content: text }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['case-comments', id] }); setCommentText(''); setShowCommentInput(false); addToast({ type: 'success', message: '评论成功' }) },
    onError: () => addToast({ type: 'error', message: '发送失败' }),
  })

  // Delete
  const deleteMutation = useMutation({
    mutationFn: () => deleteFormulaCase(Number(id)),
    onSuccess: () => { addToast({ type: 'success', message: '案例已删除' }); navigate('/formulas/cases') },
  })

  const isOwner = caseItem?.created_by === user?.id
  const theme = getTheme(caseItem?.category ?? undefined)
  const topComments = comments.filter((c: CaseComment) => !c.parent_id)

  const handleCommentLike = (commentId: number) => {
    setLikedCommentIds(prev => {
      const next = new Set(prev)
      if (next.has(commentId)) next.delete(commentId)
      else next.add(commentId)
      return next
    })
  }

  if (isLoading) return <DetailSkeleton />
  if (!caseItem) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
          <FileText size={28} className="text-neutral-400" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">案例不存在</h2>
        <p className="text-sm text-text-muted mb-6">该案例可能已被删除或不存在</p>
        <Button variant="primary" onClick={() => navigate('/formulas/cases')} className="rounded-xl">
          <ArrowLeft size={15} className="mr-1.5" />返回案例库
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-default theme-transition">
      {/* Reading Progress Bar — viewport fixed */}
      <div className="fixed top-0 left-0 right-0 z-50 h-0.5 pointer-events-none">
        <div
          className="h-full bg-gradient-to-r from-primary-500 via-secondary-500 to-accent-500 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6 space-y-5">

        {/* ── 面包屑 ── */}
        <nav className="flex items-center gap-1.5 text-sm text-text-muted flex-wrap" aria-label="面包屑导航">
          <Link to="/formulas/cases" className="hover:text-primary-500 transition-colors flex items-center gap-1">
            <ArrowLeft size={13} />案例库
          </Link>
          <ChevronRight size={13} />
          {caseItem.category && (
            <span className="hover:text-primary-500 transition-colors cursor-pointer">{caseItem.category}</span>
          )}
          <ChevronRight size={13} />
          <span className="text-text-primary font-medium truncate max-w-[200px]">{caseItem.title}</span>
        </nav>

        {/* ── 双栏布局 ── */}
        <div className="grid lg:grid-cols-3 gap-5">

          {/* ═══ 主内容区 ═══ */}
          <div className="lg:col-span-2 space-y-5">

            {/* Hero Banner */}
            <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${theme.gradient} p-6 text-white shadow-lg`}>
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-8" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-8" />
              <div className="absolute top-4 right-8 w-16 h-16 border border-white/10 rounded-2xl rotate-12" />
              <div className="absolute bottom-8 left-16 w-8 h-8 border border-white/10 rounded-full" />

              <div className="relative">
                {/* Badges */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm border border-white/30 text-white shadow-sm`}>
                    {caseItem.category ?? '未分类'}
                  </span>
                  {caseItem.is_featured && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-warning-500/90 text-white backdrop-blur-sm">
                      <Award size={11} className="fill-white" />推荐案例
                    </span>
                  )}
                  {caseItem.generated_by_ai && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-sm border border-white/30 text-white">
                      <Sparkles size={11} />AI生成
                    </span>
                  )}
                </div>

                {/* Title — 设计系统 H2 级别 */}
                <h2 className="font-semibold leading-tight mb-3 text-white tracking-tight">
                  {caseItem.title}
                </h2>

                {/* Summary — body-lg */}
                <p className="text-body-lg text-white/85 mb-5 max-w-lg">
                  {caseItem.summary}
                </p>

                {/* Stats Row */}
                <div className="flex items-center gap-5 flex-wrap">
                  {[
                    { icon: Eye, val: caseItem.views, label: '浏览' },
                    { icon: Heart, val: caseItem.likes, label: '点赞' },
                    { icon: Bookmark, val: caseItem.bookmarks ?? 0, label: '收藏' },
                    { icon: MessageCircle, val: topComments.length, label: '评论' },
                    ...(readingTime ? [{ icon: Clock, val: readingTime, label: '' }] : []),
                    { icon: Calendar, val: new Date(caseItem.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }), label: '' },
                  ].map(({ icon: Icon, val, label }, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-white/80 text-body-sm">
                      <Icon size={14} className="shrink-0 opacity-80" />
                      <span className="font-semibold text-white">{val}</span>
                      {label && <span className="text-white/60 text-caption">{label}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tags */}
            {caseItem.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {caseItem.tags.map(tag => (
                  <span key={tag} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${theme.bg} ${theme.text} ring-1 ${theme.ring}`}>
                    <TagIcon size={10} />{tag}
                  </span>
                ))}
              </div>
            )}

            {/* ── 图片画廊 ── */}
            {caseImages.length > 0 && (
              <Card className="rounded-2xl border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                    <ImageIcon size={14} className="text-primary-500" />
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider">案例配图</span>
                    <span className="text-xs text-text-disabled ml-auto">{caseImages.length} 张</span>
                  </div>
                  <div className="flex gap-2 px-4 pb-4 overflow-x-auto scrollbar-hide">
                    {caseImages.map((url, i) => (
                      <img key={i} src={url} alt={`配图${i + 1}`} className="h-32 rounded-xl object-cover shrink-0 border border-neutral-200 dark:border-neutral-700 hover:opacity-90 transition-opacity cursor-zoom-in" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── 内容卡片 ── */}
            <Card className="rounded-2xl border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <CardContent ref={contentRef} className="p-6">
                {/* Section Header */}
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-5 rounded-full bg-primary-500 shrink-0" />
                    <h2 className="font-semibold text-text-primary text-body">案例内容</h2>
                  </div>
                  {/* 字号控制 & TOC 切换 */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setShowToc(!showToc)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                        showToc ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-500' : 'text-text-muted hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                      title="目录"
                    >
                      <List size={13} />
                    </button>
                    <span className="text-text-disabled text-xs px-0.5">/</span>
                    <button onClick={() => setFontSize('small')} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-xs font-medium ${fontSize === 'small' ? 'bg-neutral-200 dark:bg-neutral-700 text-text-primary' : 'text-text-muted hover:bg-neutral-100 dark:hover:bg-neutral-800'}`} title="小字">
                      <Minus size={13} />
                    </button>
                    <button onClick={() => setFontSize('medium')} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-xs font-bold ${fontSize === 'medium' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'text-text-muted hover:bg-neutral-100 dark:hover:bg-neutral-800'}`} title="中字">
                      M
                    </button>
                    <button onClick={() => setFontSize('large')} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-xs font-medium ${fontSize === 'large' ? 'bg-neutral-200 dark:bg-neutral-700 text-text-primary' : 'text-text-muted hover:bg-neutral-100 dark:hover:bg-neutral-800'}`} title="大字">
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                {/* TOC */}
                {showToc && tocItems.length > 0 && (
                  <div className="mb-5 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Hash size={13} className="text-primary-500" />
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">目录</span>
                    </div>
                    <ul className="space-y-1">
                      {tocItems.map((item, i) => (
                        <li key={i}>
                          <a href={`#${item.id}`} className={`flex items-center gap-2 text-sm text-text-secondary hover:text-primary-500 transition-colors py-1 ${
                            item.level === 1 ? 'font-medium pl-0' :
                            item.level === 2 ? 'pl-3' : 'pl-6 text-text-muted'
                          }`}>
                            <span className={`w-1 h-1 rounded-full shrink-0 ${
                              item.level === 1 ? 'bg-primary-500' : item.level === 2 ? 'bg-secondary-500' : 'bg-accent-500'
                            }`} />
                            {item.text}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Rendered content */}
                <div className={`${FONT_SIZES[fontSize]} text-text-secondary leading-[1.8] whitespace-pre-wrap`}
                  style={{ fontFamily: 'var(--font-sans)' }}>
                  {caseItem.content!.split('\n').map((line, i) => {
                    if (line.startsWith('# ')) return <h1 key={i} id={`toc-${i}`} className="font-semibold text-text-primary mt-6 mb-3 first:mt-0 tracking-tight">{line.slice(2)}</h1>
                    if (line.startsWith('## ')) return <h2 key={i} id={`toc-${i}`} className="font-semibold text-text-primary mt-5 mb-2 tracking-tight">{line.slice(3)}</h2>
                    if (line.startsWith('### ')) return <h3 key={i} id={`toc-${i}`} className="font-semibold text-text-primary mt-4 mb-1.5">{line.slice(4)}</h3>
                    if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-text-secondary py-0.5">{line.slice(2)}</li>
                    if (line.startsWith('|')) return null
                    if (line.startsWith('```')) return <code key={i} className="block my-2 px-3 py-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-950 text-sm font-mono text-neutral-700 dark:text-neutral-300 overflow-x-auto whitespace-pre">{line.slice(3).replace(/```$/, '')}</code>
                    if (line.trim() === '') return <br key={i} />
                    return <p key={i} className="mb-2.5 text-text-secondary">{line}</p>
                  })}
                </div>
              </CardContent>
            </Card>

            {/* ── Owner Actions ── */}
            {isOwner && (
              <div className="flex gap-2 flex-wrap">
                {caseItem.formula_id && (
                  <Link to={`/formulas/${caseItem.formula_id}`}>
                    <Button variant="outline" size="sm" className="rounded-xl">
                      <FileText size={14} className="mr-1.5" />查看配方
                    </Button>
                  </Link>
                )}
                <Button variant="danger" size="sm" className="rounded-xl"
                  onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 size={14} className="mr-1.5" />删除案例
                </Button>
              </div>
            )}

            {/* ── 相关案例 ── */}
            {relatedCases && relatedCases.filter(c => c.id !== caseItem.id).length > 0 && (
              <section aria-label="相关案例">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-text-primary flex items-center gap-2 text-body">
                    <TrendingUp size={16} className="text-primary-500" />相关案例
                  </h2>
                  <Link to={`/formulas/cases?formula_id=${caseItem.formula_id}`} className="text-xs text-primary-500 hover:text-primary-600 flex items-center gap-1 transition-colors">
                    查看全部 <ArrowRight size={12} />
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {relatedCases.filter(c => c.id !== caseItem.id).slice(0, 4).map(c => {
                    const ct = getTheme(c.category ?? undefined)
                    return (
                      <Link key={c.id} to={`/formulas/cases/${c.id}`} className="group block">
                        <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm hover:shadow-primary-500/5 transition-all duration-200">
                          <div className={`h-24 bg-gradient-to-br ${ct.gradient} flex items-center justify-center relative`}>
                            <span className="text-white/25 text-2xl font-bold select-none">{ct.label}</span>
                            <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-white/10" />
                          </div>
                          <div className="p-3">
                            <p className="font-medium text-sm text-text-primary truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{c.title}</p>
                            <p className="text-xs text-text-muted mt-1 line-clamp-1">{c.summary}</p>
                            <div className="flex items-center gap-2 mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
                              <span className="inline-flex items-center gap-0.5"><Eye size={10} />{c.views}</span>
                              <span className="inline-flex items-center gap-0.5"><Heart size={10} />{c.likes}</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── 评论 ── */}
            <Card className="rounded-2xl border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-text-primary flex items-center gap-2 text-body">
                    <MessageCircle size={16} className="text-primary-500" />
                    评论
                    <span className="text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-full">{topComments.length}</span>
                  </h2>
                  <Button variant="secondary" size="sm" onClick={() => setShowCommentInput(!showCommentInput)} className="rounded-xl">
                    发表评论
                  </Button>
                </div>

                {showCommentInput && (
                  <div className="mb-4 space-y-2">
                    <Textarea
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder="分享你的想法，交流配方经验..."
                      rows={3}
                      className="rounded-xl"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-muted">{commentText.length}/500</span>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => { setShowCommentInput(false); setCommentText('') }} variant="secondary" className="rounded-xl">取消</Button>
                        <Button size="sm" onClick={() => commentText.trim() && commentMutation.mutate(commentText)} disabled={!commentText.trim() || commentMutation.isPending} className="rounded-xl">
                          {commentMutation.isPending ? '发布中...' : '发布'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {topComments.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3">
                      <MessageCircle size={22} className="text-neutral-400" />
                    </div>
                    <p className="text-sm text-text-muted">暂无评论</p>
                    <p className="text-xs text-text-disabled mt-1">来发表第一条评论吧</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topComments.map((c: CaseComment) => (
                      <CommentItem
                        key={c.id}
                        comment={c}
                        onReply={(pid, content) => {
                          createCaseComment(Number(id), { content }).then(() => queryClient.invalidateQueries({ queryKey: ['case-comments', id] }))
                        }}
                        onLike={handleCommentLike}
                        isLiked={likedCommentIds.has(Number(c.id))}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ═══ 右侧边栏 ═══ */}
          <div className="space-y-4">

            {/* 互动卡片 */}
            <Card className="rounded-2xl border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 sticky top-4">
              <CardContent className="p-4">
                <p className="text-caption font-medium text-text-muted uppercase tracking-wider mb-3">互动操作</p>
                <div className="space-y-1.5">
                  {[
                    {
                      label: '点赞', sub: `${caseItem.likes} 次点赞`, icon: Heart, color: 'error',
                      bg: 'bg-error-100 dark:bg-error-900/20', hover: 'hover:bg-error-50 dark:hover:bg-error-900/20', text: 'text-error-500',
                      action: () => likeMutation.mutate(), pending: likeMutation.isPending,
                    },
                    {
                      label: '收藏', sub: `${caseItem.bookmarks ?? 0} 次收藏`, icon: Bookmark, color: 'primary',
                      bg: 'bg-primary-100 dark:bg-primary-900/20', hover: 'hover:bg-primary-50 dark:hover:bg-primary-900/20', text: 'text-primary-500',
                      action: () => bookmarkMutation.mutate(), pending: bookmarkMutation.isPending,
                    },
                    {
                      label: '分享', sub: '分享给好友', icon: Share2, color: 'secondary',
                      bg: 'bg-secondary-100 dark:bg-secondary-900/20', hover: 'hover:bg-secondary-50 dark:hover:bg-secondary-900/20', text: 'text-secondary-500',
                      action: () => setShowShareDialog(true), pending: false,
                    },
                    {
                      label: '举报', sub: '反馈问题', icon: Flag, color: 'warning',
                      bg: 'bg-warning-100 dark:bg-warning-900/20', hover: 'hover:bg-warning-50 dark:hover:bg-warning-900/20', text: 'text-warning-500',
                      action: () => setShowReportDialog(true), pending: false,
                    },
                  ].map(({ label, sub, icon: Icon, color, bg, hover, text, action, pending }, i) => (
                    <button
                      key={i}
                      onClick={action}
                      disabled={pending}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${hover} ${pending ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                        <Icon size={15} className={text} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-text-primary">{label}</p>
                        <p className="text-xs text-text-muted">{sub}</p>
                      </div>
                      {pending && (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin text-text-muted" />
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 案例信息卡片 */}
            <Card className="rounded-2xl border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <CardContent className="p-4">
                <p className="text-caption font-medium text-text-muted uppercase tracking-wider mb-3">案例信息</p>
                <div className="space-y-2.5">
                  {[
                    { icon: User, label: '作者', value: caseItem.creator_name || '未知用户' },
                    { icon: Calendar, label: '发布时间', value: new Date(caseItem.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) },
                    { icon: Eye, label: '浏览次数', value: `${caseItem.views} 次` },
                    { icon: Clock, label: '阅读时长', value: readingTime || '—' },
                    { icon: FileText, label: '配方来源', value: caseItem.formula_name || `配方 #${caseItem.formula_id}` },
                    { icon: TagIcon, label: '案例分类', value: caseItem.category || '未分类' },
                    { icon: Sparkles, label: '生成方式', value: caseItem.generated_by_ai ? 'AI 自动生成' : '人工编写' },
                  ].map(({ icon: Icon, label, value }, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                        <Icon size={13} className="text-text-muted" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-text-muted">{label}</p>
                        <p className="text-sm font-medium text-text-primary truncate">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 配方来源卡片 */}
            {caseItem.formula_id && (
              <Link to={`/formulas/${caseItem.formula_id}`} className="block group">
                <Card className="rounded-2xl border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/10 dark:to-secondary-900/10 hover:shadow-md hover:shadow-primary-500/10 transition-all duration-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-8 h-8 rounded-xl bg-primary-500 flex items-center justify-center shrink-0">
                        <FileText size={14} className="text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-caption text-primary-600 dark:text-primary-400 font-medium">配方来源</p>
                        <p className="text-sm font-semibold text-text-primary truncate">{caseItem.formula_name || `配方 #${caseItem.formula_id}`}</p>
                      </div>
                    </div>
                    <p className="text-xs text-text-muted mb-3">查看完整配方详情与配方分析</p>
                    <div className="flex items-center text-xs text-primary-500 font-medium group-hover:text-primary-600">
                      前往配方 <ArrowRight size={12} className="ml-1 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <DeleteDialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} onConfirm={() => deleteMutation.mutate()} caseTitle={caseItem.title} />
      <ShareDialog open={showShareDialog} onClose={() => setShowShareDialog(false)} caseTitle={caseItem.title} />
      <ReportDialog open={showReportDialog} onClose={() => setShowReportDialog(false)} caseId={Number(id)} />
    </div>
  )
}

export default FormulaCaseDetailPage
