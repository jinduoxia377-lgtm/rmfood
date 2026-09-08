import React, { useState } from 'react'
import {
  BookOpen,
  ShieldCheck,
  Users,
  Clock,
  AlertCircle,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import type { AICandidate } from '@/api/ai'

// ─── 类型定义 ───

interface FormulaExplanationProps {
  candidate: AICandidate
  className?: string
}

// ─── 子组件 ───

function Section({
  icon,
  title,
  content,
  defaultOpen = true,
  className,
}: {
  icon: React.ReactNode
  title: string
  content: string
  defaultOpen?: boolean
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      <button
        className="w-full flex items-center gap-2 px-4 py-3 bg-muted/50 hover:bg-muted transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-primary">{icon}</span>
        <span className="text-sm font-medium flex-1 text-left">{title}</span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 py-3 text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
          {content}
        </div>
      )}
    </div>
  )
}

function HerbRoleBadge({ role }: { role: string }) {
  const colors = {
    '君药': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    '臣药': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    '佐药': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    '使药': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  }
  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded text-xs font-medium',
        colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-700',
      )}
    >
      {role}
    </span>
  )
}

// ─── 主组件 ───

export function FormulaExplanation({ candidate, className }: FormulaExplanationProps) {
  const explanation = candidate.explanation
  if (!explanation) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            配方解释
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">暂无配方解释数据</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* 标题区 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              {explanation.formula_name || candidate.formula_name || candidate.name}
            </CardTitle>
            {candidate.algorithm_info && (
              <span className="text-xs text-muted-foreground">
                {candidate.algorithm_info.strategy === 'ga' ? '遗传算法' :
                 candidate.algorithm_info.strategy === 'nsga2' ? 'NSGA-II' :
                 candidate.algorithm_info.strategy.toUpperCase()}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 结构分析 */}
          <Section
            icon={<Activity className="w-4 h-4" />}
            title="君臣佐使结构分析"
            content={explanation.structure_analysis}
          />

          {/* 机理说明 */}
          <Section
            icon={<ShieldCheck className="w-4 h-4" />}
            title="现代药理机制"
            content={explanation.mechanism_explanation}
          />

          {/* 协同分析 */}
          <Section
            icon={<Users className="w-4 h-4" />}
            title="配伍协同原理"
            content={explanation.synergistic_analysis}
          />

          {/* 适用人群 */}
          <Section
            icon={<Users className="w-4 h-4" />}
            title="适用人群"
            content={explanation.suitable_population}
            defaultOpen={false}
          />

          {/* 禁忌 */}
          <Section
            icon={<AlertCircle className="w-4 h-4 text-warning" />}
            title="禁忌与注意"
            content={explanation.contraindications}
            defaultOpen={false}
          />

          {/* 使用说明 */}
          <Section
            icon={<Clock className="w-4 h-4" />}
            title="服用建议"
            content={explanation.usage_instructions}
            defaultOpen={false}
          />

          {/* 监测建议 */}
          <Section
            icon={<Activity className="w-4 h-4" />}
            title="监测与迭代"
            content={explanation.monitoring_suggestions}
            defaultOpen={false}
          />
        </CardContent>
      </Card>

      {/* 药材角色标签 */}
      {candidate.herb_combination && candidate.herb_combination.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">配方组成</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {candidate.herb_combination.map((herb, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <HerbRoleBadge role={herb.role || '佐药'} />
                    <span className="text-sm font-medium">{herb.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {herb.dosage_g ? `${herb.dosage_g}g` : herb.dosage || ''}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 免责声明 */}
      <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
        <strong>免责声明：</strong>本配方建议为辅助调理参考，不能替代医师诊断与治疗。
        如有不适，请及时就医。孕妇、儿童、老年人及特殊体质人群请在医师指导下使用。
      </div>
    </div>
  )
}

// ─── 导出 ───

export default FormulaExplanation
