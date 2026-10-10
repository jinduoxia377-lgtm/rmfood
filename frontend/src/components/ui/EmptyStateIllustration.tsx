/**
 * RMFOOD — 增强版空状态插画组件
 *
 * 支持多种场景预设 + 自定义插画（SVG 内联）
 * 每个场景有独特的图标 + 配色 + 默认文案
 *
 * 使用示例:
 * <EmptyStateIllustration type="no-formulas" />
 * <EmptyStateIllustration type="search-empty" action={<Button>...</Button>} />
 * <EmptyStateIllustration type="custom" icon={<MyIcon />} title="自定义" />
 */
import type { ReactNode } from'react'
import { cn } from'@/lib/utils'
import {
 FlaskConical, TestTubes, Search, Inbox, Brain, GitBranch,
 Bell, Shield, FileText, Clock, AlertTriangle, WifiOff,
 Database, Sparkles, Users, PackageOpen,
} from'lucide-react'

/* ═══════════════════════════════════════════
 场景类型定义
 ═══════════════════════════════════════════ */

export type EmptyStateType =
 |'no-formulas'
 |'no-experiments'
 |'search-empty'
 |'no-notifications'
 |'no-workflows'
 |'no-comments'
 |'no-data'
 |'network-error'
 |'no-results'
 |'no-permission'
 |'no-audit-logs'
 |'no-users'
 |'ai-empty'
 |'no-attachments'
 |'no-versions'
 |'custom'

interface EmptyStateIllustrationProps {
 /** 场景类型 */
 type?: EmptyStateType
 /** 自定义图标（type=custom 时使用，也可覆盖预设图标） */
 icon?: ReactNode
 /** 标题 */
 title?: string
 /** 描述 */
 description?: string
 /** 操作按钮区域 */
 action?: ReactNode
 /** 自定义类名 */
 className?: string
 /** 尺寸：sm 适合内嵌区域，md 适合全页面 */
 size?:'sm' |'md'
}

/* ═══════════════════════════════════════════
 场景预设配置
 ═══════════════════════════════════════════ */

interface SceneConfig {
 icon: ReactNode
 title: string
 description: string
 /** 插画背景渐变 */
 bgGradient: string
 /** 图标颜色 */
 iconColor: string
}

const SCENES: Record<EmptyStateType, SceneConfig> = {
'no-formulas': {
 icon: <FlaskConical size={40} strokeWidth={1.3} />,
 title:'暂无配方',
 description:'点击下方按钮创建你的第一个药食同源配方',
 bgGradient:'from-primary-50 to-success-50 dark:from-primary-950/30 dark:to-success-950/20',
 iconColor:'text-primary-400 dark:text-primary-700',
 },
'no-experiments': {
 icon: <TestTubes size={40} strokeWidth={1.3} />,
 title:'暂无实验',
 description:'为你的配方创建实验验证方案',
 bgGradient:'from-accent-50 to-accent-50 dark:from-accent-950/30 dark:to-accent-950/20',
 iconColor:'text-accent-400 dark:text-accent-700',
 },
'search-empty': {
 icon: <Search size={40} strokeWidth={1.3} />,
 title:'未找到结果',
 description:'尝试更换关键词或调整搜索条件',
 bgGradient:'from-neutral-50 to-neutral-50 dark:from-neutral-900/30 dark:to-neutral-900/20',
 iconColor:'text-text-disabled',
 },
'no-notifications': {
 icon: <Bell size={40} strokeWidth={1.3} />,
 title:'没有新通知',
 description:'所有消息都已处理完毕',
 bgGradient:'from-warning-50 to-warning-50 dark:from-warning-950/30 dark:to-warning-950/20',
 iconColor:'text-warning-300 dark:text-warning-700',
 },
'no-workflows': {
 icon: <GitBranch size={40} strokeWidth={1.3} />,
 title:'暂无工作流',
 description:'工作流将展示配方研发的完整管线',
 bgGradient:'from-info-50 to-secondary-50 dark:from-info-950/30 dark:to-secondary-950/20',
 iconColor:'text-info-400 dark:text-info-700',
 },
'no-comments': {
 icon: <Inbox size={40} strokeWidth={1.3} />,
 title:'暂无评论',
 description:'成为第一个发表评论的人',
 bgGradient:'from-primary-50 to-success-50 dark:from-primary-950/30 dark:to-success-950/20',
 iconColor:'text-primary-400 dark:text-primary-700',
 },
'no-data': {
 icon: <Database size={40} strokeWidth={1.3} />,
 title:'暂无数据',
 description:'该模块暂时没有任何数据',
 bgGradient:'from-neutral-50 to-neutral-100 dark:from-neutral-900/30 dark:to-neutral-900/20',
 iconColor:'text-text-disabled',
 },
'network-error': {
 icon: <WifiOff size={40} strokeWidth={1.3} />,
 title:'网络连接失败',
 description:'请检查网络连接后重试',
 bgGradient:'from-danger-50 to-error-50 dark:from-danger-950/30 dark:to-error-950/20',
 iconColor:'text-danger-400 dark:text-danger-700',
 },
'no-results': {
 icon: <PackageOpen size={40} strokeWidth={1.3} />,
 title:'内容为空',
 description:'当前筛选条件下没有匹配的内容',
 bgGradient:'from-neutral-50 to-neutral-50 dark:from-neutral-900/30 dark:to-neutral-900/20',
 iconColor:'text-text-disabled',
 },
'no-permission': {
 icon: <Shield size={40} strokeWidth={1.3} />,
 title:'没有访问权限',
 description:'你当前的角色无法访问此内容',
 bgGradient:'from-danger-50 to-danger-50 dark:from-danger-950/30 dark:to-danger-950/20',
 iconColor:'text-danger-400 dark:text-danger-700',
 },
'no-audit-logs': {
 icon: <FileText size={40} strokeWidth={1.3} />,
 title:'暂无审计日志',
 description:'系统操作记录将在这里显示',
 bgGradient:'from-neutral-50 to-neutral-50 dark:from-neutral-900/30 dark:to-neutral-900/20',
 iconColor:'text-text-disabled',
 },
'no-users': {
 icon: <Users size={40} strokeWidth={1.3} />,
 title:'暂无用户',
 description:'邀请团队成员加入平台',
 bgGradient:'from-accent-50 to-secondary-50 dark:from-accent-950/30 dark:to-secondary-950/20',
 iconColor:'text-accent-400 dark:text-accent-700',
 },
'ai-empty': {
 icon: <Sparkles size={40} strokeWidth={1.3} />,
 title:'AI 助手就绪',
 description:'输入你的问题，AI 将为你提供专业分析',
 bgGradient:'from-warning-50 to-warning-50 dark:from-warning-950/30 dark:to-warning-950/20',
 iconColor:'text-warning-400 dark:text-warning-700',
 },
'no-attachments': {
 icon: <PackageOpen size={40} strokeWidth={1.3} />,
 title:'暂无附件',
 description:'上传文件以关联到此项目',
 bgGradient:'from-neutral-50 to-neutral-50 dark:from-neutral-900/30 dark:to-neutral-900/20',
 iconColor:'text-text-disabled',
 },
'no-versions': {
 icon: <Clock size={40} strokeWidth={1.3} />,
 title:'暂无版本历史',
 description:'配方编辑后版本记录将在这里显示',
 bgGradient:'from-success-50 to-info-50 dark:from-success-950/30 dark:to-info-950/20',
 iconColor:'text-success-400 dark:text-success-700',
 },
'custom': {
 icon: <Inbox size={40} strokeWidth={1.3} />,
 title:'暂无内容',
 description:'',
 bgGradient:'from-neutral-50 to-neutral-50 dark:from-neutral-900/30 dark:to-neutral-900/20',
 iconColor:'text-text-disabled',
 },
}

/* ═══════════════════════════════════════════
 EmptyStateIllustration 组件
 ═══════════════════════════════════════════ */

export function EmptyStateIllustration({
 type ='custom',
 icon: customIcon,
 title: customTitle,
 description: customDescription,
 action,
 className,
 size ='md',
}: EmptyStateIllustrationProps) {
 const scene = SCENES[type]
 const isSmall = size ==='sm'

 const displayIcon = customIcon ?? scene.icon
 const displayTitle = customTitle ?? scene.title
 const displayDescription = customDescription ?? (scene.description || undefined)

 return (
 <div className={cn(
'flex flex-col items-center justify-center text-center',
 isSmall ?'py-8 px-4' :'py-16 px-4',
 className,
 )}>
 {/* 插画区域 */}
 <div className={cn(
'relative flex items-center justify-center rounded-full mb-5',
'bg-gradient-to-br',
 scene.bgGradient,
 isSmall ?'w-16 h-16' :'w-24 h-24',
 )}>
 {/* 装饰圈 */}
 <div className={cn(
'absolute inset-0 rounded-full border-2 border-dashed opacity-30 animate-[spin_20s_linear_infinite]',
 isSmall ?'inset-[-6px]' :'inset-[-10px]',
 scene.iconColor,
 )} />
 {/* 图标 */}
 <div className={cn('relative z-10', scene.iconColor)}>
 {displayIcon}
 </div>
 </div>

 {/* 文字 */}
 <h3 className={cn(
'font-semibold text-text-primary',
 isSmall ?'text-sm' :'text-base',
 )}>
 {displayTitle}
 </h3>

 {displayDescription && (
 <p className={cn(
'mt-1.5 text-text-muted leading-relaxed',
 isSmall ?'text-xs max-w-xs' :'text-sm max-w-sm',
 )}>
 {displayDescription}
 </p>
 )}

 {/* 操作区域 */}
 {action && <div className={cn(isSmall ?'mt-3' :'mt-5')}>{action}</div>}
 </div>
 )
}
