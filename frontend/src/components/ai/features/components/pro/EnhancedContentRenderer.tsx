/**
 * EnhancedContentRenderer — 增强内容渲染组件
 *
 * 自动检测AI回复中的结构化片段，将其渲染为专业可视化组件：
 * - 功效成分占比表 → 条形图 + 占比卡片
 * - 配方特色总结列表 → 特色卡片网格
 * - 君臣佐使表 → 结构化角色卡片
 *
 * @version 1.0.0
 */
import React, { useMemo } from 'react'
import { BarChart3, PieChart, Award, Shield, Leaf, Star, Target, Sparkles } from 'lucide-react'

interface EnhancedContentRendererProps {
  content: string
  children: React.ReactNode
}

// 解析占比数据
function parseRatioTable(content: string): { labels: string[]; values: number[] } | null {
  const sectionMatch = content.match(/(?:###\s*)?二、功效成分占比[\s\S]*?(?=###|$)/)
  if (!sectionMatch) return null

  const section = sectionMatch[0]
  const labels: string[] = []
  const values: number[] = []

  const lines = section.split('\n')
  let inTable = false
  for (const line of lines) {
    if (line.includes('|') && line.includes('占比')) { inTable = true; continue }
    if (!inTable || !line.includes('|') || line.includes('---')) continue

    const cells = line.split('|').filter(Boolean).map(c => c.trim())
    if (cells.length >= 3) {
      const name = cells[0].replace(/\*\*/g, '').trim()
      const ratio = cells[2] || cells[1] || ''
      const num = parseFloat(ratio.replace('%', ''))
      if (name && !isNaN(num)) {
        labels.push(name)
        values.push(num)
      }
    }
  }
  return labels.length > 0 ? { labels, values } : null
}

// 解析特色总结列表
function parseFeatureSummary(content: string): string[] {
  const sectionMatch = content.match(/(?:###\s*)?三、配方特色总结[\s\S]*?(?=###|$)/)
  if (!sectionMatch) return []

  const section = sectionMatch[0]
  const features: string[] = []
  for (const line of section.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('*') || trimmed.startsWith('-') || trimmed.startsWith('1.') || trimmed.startsWith('2.') || trimmed.startsWith('3.') || trimmed.startsWith('4.') || trimmed.startsWith('5.')) {
      const text = trimmed.replace(/^[\d.]*\s*[\*\-]\s*/, '').trim()
      if (text.length > 5) features.push(text)
    }
  }
  return features
}

const FEATURE_ICONS = [Award, Shield, Leaf, Star, Target, Sparkles]
const FEATURE_COLORS = [
  'from-primary-500 to-secondary-600',
  'from-success-500 to-success-600',
  'from-warning-500 to-warning-600',
  'from-accent-500 to-accent-600',
  'from-danger-500 to-danger-600',
  'from-info-500 to-info-600',
]

export function EnhancedRatioChart({ content }: { content: string }) {
  const data = useMemo(() => parseRatioTable(content), [content])
  if (!data || data.labels.length === 0) return null

  const maxVal = Math.max(...data.values, 1)

  return (
    <div className="mt-4 p-4 bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="w-5 h-5 text-primary-500" />
        <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">功效成分占比分析</h4>
      </div>

      {/* 条形图 */}
      <div className="space-y-2.5">
        {data.labels.map((label, i) => {
          const pct = data.values[i] || 0
          const barWidth = (pct / maxVal) * 100
          return (
            <div key={i}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-neutral-700 dark:text-neutral-300 truncate mr-2">{label}</span>
                <span className="text-primary-700 dark:text-primary-700 font-bold">{pct}%</span>
              </div>
              <div className="w-full h-3 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-700"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* 卡片汇总 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        {data.labels.map((label, i) => (
          <div key={i} className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-2.5 text-center">
            <div className="text-lg font-bold text-primary-700 dark:text-primary-700">
              {data.values[i]}%
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function EnhancedFeatureCards({ content }: { content: string }) {
  const features = useMemo(() => parseFeatureSummary(content), [content])
  if (features.length === 0) return null

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2">
        <Award className="w-5 h-5 text-warning-500" />
        <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">配方特色总结</h4>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {features.slice(0, 6).map((text, i) => {
          const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length]
          const grad = FEATURE_COLORS[i % FEATURE_COLORS.length]
          return (
            <div key={i} className="group relative overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700
              bg-white dark:bg-neutral-800/50 hover:shadow-md transition-all duration-300"
            >
              <div className="flex gap-3 p-3">
                <div className={`flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center shadow-sm`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed line-clamp-3">
                    {text}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function EnhancedRoleCards({ content }: { content: string }) {
  const sectionMatch = useMemo(() => content.match(/(?:###\s*)?一、君臣佐使配伍解析[\s\S]*?(?=###|$)/), [content])
  if (!sectionMatch) return null

  const rows: { role: string; name: string; pct: string; effect: string }[] = []
  const lines = sectionMatch[0].split('\n')
  let inTable = false
  for (const line of lines) {
    if (line.includes('|') && line.includes('角色')) { inTable = true; continue }
    if (!inTable || !line.includes('|') || line.includes('---')) continue
    const cells = line.split('|').filter(Boolean).map(c => c.trim())
    if (cells.length >= 5) {
      rows.push({
        role: cells[0].replace(/\*\*/g, '').trim(),
        name: cells[1].replace(/\*\*/g, '').trim(),
        pct: cells[2].trim(),
        effect: (cells[4] || cells[5] || '').substring(0, 60),
      })
    }
  }

  if (rows.length === 0) return null

  const roleColors: Record<string, string> = {
    '君': 'from-error-500 to-danger-600',
    '臣': 'from-secondary-500 to-accent-600',
    '佐': 'from-warning-500 to-warning-600',
    '使': 'from-success-500 to-success-600',
  }
  const roleIcons: Record<string, string> = {
    '君': '君',
    '臣': '臣',
    '佐': '佐',
    '使': '使',
  }

  return (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {rows.map((row, i) => {
        const firstChar = row.role.charAt(0)
        const grad = roleColors[firstChar] || 'from-neutral-400 to-neutral-500'
        return (
          <div key={i} className="rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden
            bg-white dark:bg-neutral-800/50 hover:shadow-md transition-all duration-300"
          >
            <div className={`bg-gradient-to-r ${grad} px-3 py-1.5 flex items-center justify-between`}>
              <span className="text-xs font-bold text-white">{row.role}</span>
              <span className="text-xs text-white/80">{row.pct}</span>
            </div>
            <div className="p-3">
              <div className="text-sm font-bold text-neutral-800 dark:text-neutral-200 truncate">{row.name}</div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">{row.effect}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function EnhancedContentRenderer({ content, children }: EnhancedContentRendererProps) {
  return (
    <div>
      {children}
      <EnhancedRoleCards content={content} />
      <EnhancedRatioChart content={content} />
      <EnhancedFeatureCards content={content} />
    </div>
  )
}
