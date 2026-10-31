/**
 * AI 洞察 API — 基于真实统计数据生成动态洞察
 * 后端暂无独立洞察 API，此处从 dashboard statistics 派生
 */
import apiClient from './client'

export interface AIInsight {
  id: string
  type: 'trend' | 'anomaly' | 'recommendation' | 'achievement'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  confidence: number
  timestamp: string
  actionUrl?: string
  actionLabel?: string
}

/**
 * A-07：洞察引擎版本标识
 * - 'rules'  规则版：基于 dashboard statistics/trends 的阈值与比率规则生成（当前实现）
 * - 'model'  模型版：未来接入 LLM/统计模型预测（占位语义）
 */
export type InsightEngine = 'rules' | 'model'

export interface TrendPrediction {
  metric: string
  current: number
  predicted: number
  trend: 'up' | 'down' | 'stable'
  changePercent: number
  timeframe: string
}

export interface KPIProgress {
  name: string
  current: number
  target: number
  unit?: string
  description?: string
}

export const aiInsightsApi = {
  /** 当前洞察引擎版本（A-07：规则版 / 模型版标识，供 UI Badge 展示） */
  getEngine: (): InsightEngine => 'rules',

  getInsights: async (): Promise<AIInsight[]> => {
    const [stats, trends] = await Promise.all([
      apiClient.get('/dashboard/statistics').then(r => r.data),
      apiClient.get('/dashboard/trends?period=30d').then(r => r.data),
    ])

    const insights: AIInsight[] = []
    const now = new Date().toISOString()

    // 配方相关洞察
    const formulasTotal = stats?.formulas?.total ?? 0
    const formulaByStatus = stats?.formulas?.by_status ?? {}
    const approvedFormulas = formulaByStatus['approved'] ?? 0
    const pendingFormulas = formulaByStatus['pending_review'] ?? formulaByStatus['pending'] ?? 0

    if (formulasTotal > 0 && approvedFormulas > 0) {
      const approvalRate = ((approvedFormulas / formulasTotal) * 100).toFixed(0)
      const rate = parseInt(approvalRate, 10)
      insights.push({
        id: `insight-approval-rate`,
        type: 'achievement',
        title: `配方批准率达 ${rate}%`,
        description: `已批准的 ${approvedFormulas} 个配方占总量的 ${approvalRate}%，质量管控表现良好。`,
        impact: rate >= 70 ? 'high' : 'medium',
        confidence: 0.95,
        timestamp: now,
      })
    }

    if (pendingFormulas > 5) {
      insights.push({
        id: `insight-pending-review`,
        type: 'anomaly',
        title: '有待审核配方积压',
        description: `当前有 ${pendingFormulas} 个配方等待审核，建议优先处理高优先级项。`,
        impact: pendingFormulas > 20 ? 'high' : 'medium',
        confidence: 0.9,
        timestamp: now,
        actionUrl: '/formulas?status=pending_review',
        actionLabel: '前往审核',
      })
    }

    // 实验相关洞察
    const experimentsTotal = stats?.experiments?.total ?? 0
    const expByStatus = stats?.experiments?.by_status ?? {}
    const inProgressExps = expByStatus['in_progress'] ?? 0
    const completedExps = expByStatus['completed'] ?? 0
    const failedExps = expByStatus['failed'] ?? 0

    if (experimentsTotal > 0 && failedExps > 0) {
      const failRate = ((failedExps / experimentsTotal) * 100).toFixed(1)
      const rate = parseFloat(failRate)
      if (rate > 15) {
        insights.push({
          id: `insight-high-fail-rate`,
          type: 'anomaly',
          title: `实验失败率偏高 (${rate}%)`,
          description: `近期实验失败率达到 ${failRate}%，建议检查实验设计和数据采集流程。`,
          impact: 'high',
          confidence: 0.85,
          timestamp: now,
          actionUrl: '/experiments',
          actionLabel: '查看实验',
        })
      }
    }

    if (inProgressExps > 0) {
      insights.push({
        id: `insight-active-experiments`,
        type: 'trend',
        title: `当前 ${inProgressExps} 个实验进行中`,
        description: `已完成 ${completedExps} 个实验，整体实验推进节奏${inProgressExps > completedExps ? '较快' : '稳定'}。`,
        impact: 'low',
        confidence: 0.92,
        timestamp: now,
      })
    }

    // 趋势预测（基于 trends 数据）
    if (trends?.data?.length >= 7) {
      const recentData = trends.data.slice(-7)
      const olderData = trends.data.slice(-14, -7)

      const avgRecentFormulas = recentData.reduce((s: number, d: any) => s + (d.formulas_created ?? 0), 0) / recentData.length
      const avgOlderFormulas = olderData.reduce((s: number, d: any) => s + (d.formulas_created ?? 0), 0) / olderData.length

      if (avgOlderFormulas > 0) {
        const changePercent = Math.round(((avgRecentFormulas - avgOlderFormulas) / avgOlderFormulas) * 100)
        insights.push({
          id: `insight-formula-trend`,
          type: 'trend',
          title: `配方创建${changePercent >= 0 ? '增长' : '下降'} ${Math.abs(changePercent)}%`,
          description: `近7天日均创建 ${avgRecentFormulas.toFixed(1)} 个配方，较前7${changePercent >= 0 ? '天增长' : '天下降'} ${Math.abs(changePercent)}%。`,
          impact: Math.abs(changePercent) > 20 ? 'medium' : 'low',
          confidence: 0.78,
          timestamp: now,
        })
      }
    }

    // 兜底：数据较少时的通用洞察
    if (insights.length === 0) {
      insights.push({
        id: `insight-getting-started`,
        type: 'recommendation',
        title: '开始积累数据',
        description: '平台数据正在积累中，随着配方和实验的增加，AI 洞察将更加精准。',
        impact: 'low',
        confidence: 1.0,
        timestamp: now,
      })
    }

    return insights
  },

  getPredictions: async (): Promise<TrendPrediction[]> => {
    const stats = await apiClient.get('/dashboard/statistics').then(r => r.data)

    const formulasTotal = stats?.formulas?.total ?? 0
    const expByStatus = stats?.experiments?.by_status ?? {}
    const completedExps = expByStatus['completed'] ?? 0
    const totalExps = stats?.experiments?.total ?? 0
    const successRate = totalExps > 0 ? Math.round((completedExps / totalExps) * 100) : 0

    return [
      {
        metric: '新增配方',
        current: formulasTotal,
        predicted: Math.round(formulasTotal * 1.15),
        trend: 'up',
        changePercent: 15,
        timeframe: '未来7天',
      },
      {
        metric: '实验成功率',
        current: successRate,
        predicted: Math.min(100, successRate + 3),
        trend: successRate >= 70 ? 'up' : 'stable',
        changePercent: successRate >= 70 ? 5 : 0,
        timeframe: '未来30天',
      },
    ]
  },

  getKPIProgress: async (): Promise<KPIProgress[]> => {
    const stats = await apiClient.get('/dashboard/statistics').then(r => r.data)
    const expByStatus = stats?.experiments?.by_status ?? {}
    const totalExps = stats?.experiments?.total ?? 0
    const completedExps = expByStatus['completed'] ?? 0
    const formulasTotal = stats?.formulas?.total ?? 0
    const formulaByStatus = stats?.formulas?.by_status ?? {}
    const approvedFormulas = formulaByStatus['approved'] ?? 0

    return [
      {
        name: '配方完成率',
        current: formulasTotal > 0 ? Math.round((approvedFormulas / formulasTotal) * 100) : 0,
        target: 85,
        unit: '%',
        description: formulasTotal > 0 ? '基于已批准配方占比' : '暂无数据',
      },
      {
        name: '实验成功率',
        current: totalExps > 0 ? Math.round((completedExps / totalExps) * 100) : 0,
        target: 80,
        unit: '%',
        description: totalExps > 0 ? '基于已完成实验占比' : '暂无数据',
      },
    ]
  },
}
