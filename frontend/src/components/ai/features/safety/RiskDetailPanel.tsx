import { useState } from 'react'
import { Card, Button, Badge, Alert } from '@/components/ui'
import { useOperationFeedback } from '@/hooks/useOperationFeedback'

interface ScientificEvidence {
  source: string
  authors?: string
  year?: number
  conclusion: string
  url?: string
}

interface RegulationClause {
  articleNumber: string
  requirement: string
  limitValue?: number
  unit?: string
  actualValue?: number
  status: 'compliant' | 'non_compliant' | 'pending'
}

interface MitigationSuggestion {
  type: 'substitution' | 'process_improvement' | 'dosage_adjustment'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  estimatedImpact?: string
}

interface RelatedCase {
  productName: string
  issue: string
  date: string
  resolution: string
  source?: string
}

interface Reference {
  title: string
  authors: string
  year: number
  journal?: string
  doi?: string
  url?: string
}

interface RiskDetailPanelProps {
  isOpen: boolean
  onClose: () => void
  riskData: {
    title: string
    severity: 'critical' | 'high' | 'medium' | 'low'
    scope: string
    score: number
    scientificEvidence?: ScientificEvidence[]
    regulations?: RegulationClause[]
    suggestions?: MitigationSuggestion[]
    relatedCases?: RelatedCase[]
    references?: Reference[]
  }
  onExport?: () => void
  onMarkAsRead?: () => void
  onShare?: () => void
  className?: string
}

const SEVERITY_CONFIG = {
  critical: { color: 'text-red-600', bg: 'bg-red-100', badge: 'danger', icon: '🔴', label: '严重' },
  high: { color: 'text-orange-600', bg: 'bg-orange-100', badge: 'warning', icon: '🟠', label: '高' },
  medium: { color: 'text-yellow-600', bg: 'bg-yellow-100', badge: 'warning', icon: '🟡', label: '中等' },
  low: { color: 'text-green-600', bg: 'bg-green-100', badge: 'success', icon: '🟢', label: '低' },
}

export function RiskDetailPanel({
  isOpen,
  onClose,
  riskData,
  onExport,
  onMarkAsRead,
  onShare,
  className = '',
}: RiskDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'evidence' | 'regulations' | 'suggestions' | 'cases'>('overview')
  const feedback = useOperationFeedback()

  if (!isOpen) return null

  const severityConfig = SEVERITY_CONFIG[riskData.severity]

  const tabs = [
    { id: 'overview', label: '概述' },
    { id: 'evidence', label: '科学依据', count: riskData.scientificEvidence?.length },
    { id: 'regulations', label: '法规条款', count: riskData.regulations?.length },
    { id: 'suggestions', label: '改进建议', count: riskData.suggestions?.length },
    { id: 'cases', label: '相关案例', count: riskData.relatedCases?.length },
  ]

  return (
    <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm ${className}`}>
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{severityConfig.icon}</span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {riskData.title}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={severityConfig.badge}>
                  {severityConfig.label}风险
                </Badge>
                <span className="text-sm text-gray-500">
                  评分: {riskData.score}/100
                </span>
                <span className="text-sm text-gray-400">|</span>
                <span className="text-sm text-gray-500">
                  影响: {riskData.scope}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative ${
                activeTab === tab.id
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <Alert variant={riskData.severity === 'critical' || riskData.severity === 'high' ? 'error' : 'warning'}>
                <p className="font-medium">风险概述</p>
                <p className="text-sm mt-1 text-gray-600 dark:text-gray-400">
                  该成分存在{severityConfig.label}程度的安全风险，需要采取相应的控制措施。
                  当前综合评分为 {riskData.score} 分，建议优先处理。
                </p>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">严重程度</h4>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${severityConfig.bg} ${severityConfig.color}`}>
                    {severityConfig.icon} {severityConfig.label}
                  </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">影响范围</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{riskData.scope}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'evidence' && (
            <div className="space-y-4">
              {riskData.scientificEvidence?.map((evidence, index) => (
                <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        {evidence.source}
                      </h4>
                      {evidence.authors && (
                        <p className="text-sm text-gray-500 mt-1">
                          作者: {evidence.authors} {evidence.year && `(${evidence.year})`}
                        </p>
                      )}
                      <p className="text-sm mt-2 text-gray-700 dark:text-gray-300">
                        {evidence.conclusion}
                      </p>
                    </div>
                    {evidence.url && (
                      <a
                        href={evidence.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-4 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 border border-blue-300 rounded hover:bg-blue-50"
                      >
                        查看原文
                      </a>
                    )}
                  </div>
                </div>
              )) || <p className="text-gray-500 text-center py-8">暂无科学依据数据</p>}
            </div>
          )}

          {activeTab === 'regulations' && (
            <div className="space-y-3">
              {riskData.regulations?.map((regulation, index) => (
                <div key={index} className={`p-4 border rounded-lg ${
                  regulation.status === 'compliant' ? 'border-green-300 bg-green-50 dark:bg-green-900/10' :
                  regulation.status === 'non_compliant' ? 'border-red-300 bg-red-50 dark:bg-red-900/10' :
                  'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/10'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={regulation.status === 'compliant' ? 'success' : regulation.status === 'non_compliant' ? 'danger' : 'warning'}>
                          {regulation.articleNumber}
                        </Badge>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {regulation.status === 'compliant' ? '✓ 合规' : regulation.status === 'non_compliant' ? '✗ 不合规' : '⏳ 待审核'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{regulation.requirement}</p>
                      {regulation.limitValue !== undefined && (
                        <div className="mt-2 text-sm">
                          <span className="text-gray-500">限值: </span>
                          <span className="font-medium">{regulation.limitValue} {regulation.unit || ''}</span>
                          {regulation.actualValue !== undefined && (
                            <>
                              <span className="mx-2 text-gray-400">|</span>
                              <span className="text-gray-500">实测: </span>
                              <span className={`font-medium ${
                                regulation.actualValue <= regulation.limitValue ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {regulation.actualValue} {regulation.unit || ''}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )) || <p className="text-gray-500 text-center py-8">暂无法规条款数据</p>}
            </div>
          )}

          {activeTab === 'suggestions' && (
            <div className="space-y-3">
              {riskData.suggestions?.map((suggestion, index) => (
                <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 transition-colors">
                  <div className="flex items-start gap-3">
                    <Badge variant={suggestion.priority === 'high' ? 'danger' : suggestion.priority === 'medium' ? 'warning' : 'success'}>
                      {suggestion.priority === 'high' ? '高优先级' : suggestion.priority === 'medium' ? '中优先级' : '低优先级'}
                    </Badge>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        {suggestion.type === 'substitution' ? '🔄 替代原料' :
                         suggestion.type === 'process_improvement' ? '⚙️ 工艺改进' :
                         '📊 用量调整'} - {suggestion.title}
                      </h4>
                      <p className="text-sm mt-1 text-gray-600 dark:text-gray-400">
                        {suggestion.description}
                      </p>
                      {suggestion.estimatedImpact && (
                        <p className="text-xs mt-2 text-blue-600 dark:text-blue-400">
                          预期效果: {suggestion.estimatedImpact}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )) || <p className="text-gray-500 text-center py-8">暂无改进建议</p>}
            </div>
          )}

          {activeTab === 'cases' && (
            <div className="space-y-3">
              {riskData.relatedCases?.map((caseItem, index) => (
                <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        {caseItem.productName}
                      </h4>
                      <p className="text-sm mt-1 text-gray-600 dark:text-gray-400">
                        问题: {caseItem.issue}
                      </p>
                      <p className="text-sm mt-1 text-gray-500">
                        解决方案: {caseItem.resolution}
                      </p>
                      <p className="text-xs mt-2 text-gray-400">
                        日期: {caseItem.date}
                      </p>
                    </div>
                    {caseItem.source && (
                      <span className="text-xs text-blue-600 ml-4">{caseItem.source}</span>
                    )}
                  </div>
                </div>
              )) || <p className="text-gray-500 text-center py-8">暂无相关案例</p>}
            </div>
          )}

          {riskData.references && riskData.references.length > 0 && activeTab === 'overview' && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-3">参考文献</h4>
              <div className="space-y-2">
                {riskData.references.map((ref, index) => (
                  <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                    [{index + 1}] {ref.authors} ({ref.year}). {ref.title}
                    {ref.journal && `. ${ref.journal}`}
                    {ref.doi && ` DOI: ${ref.doi}`}
                    {ref.url && (
                      <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 ml-2">
                        链接
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => {
              onExport?.()
              feedback.showInfo('导出详情', '风险详情报告已生成')
            }}>
              📄 导出详情
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              onMarkAsRead?.()
              feedback.showSuccess('标记成功', '已标记为已读')
            }}>
              ✓ 标记已读
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              onShare?.()
              feedback.showInfo('分享功能', '分享链接已复制到剪贴板')
            }}>
              📤 分享给团队
            </Button>
          </div>
          <Button onClick={onClose}>关闭</Button>
        </div>
      </Card>
    </div>
  )
}

export type { RiskDetailPanelProps, ScientificEvidence, RegulationClause, MitigationSuggestion, RelatedCase, Reference }
