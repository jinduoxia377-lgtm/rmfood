import { logger } from '@/utils/safeLogger';

/**
 * Mock Analytics Data Service
 *
 * Provides realistic sample data for the analytics dashboard
 * when backend API is not available.
 *
 * Features:
 * - Realistic KPI metrics with trends
 * - Chart data with proper distributions
 * - Time-series data for 12 months
 * - Activity feed entries
 * - System health metrics
 */

export interface MockDashboardData {
  timestamp: string
  kpi: {
    id: string
    name: string
    value: number | string
    unit?: string
    change_percent: number | null
    change_direction: 'up' | 'down' | null
    target?: number | null
    icon?: string
    trend?: { date: string; value: number }[]
  }[]
  charts: Record<string, {
    chart_type: string
    title: string
    subtitle?: string
    labels: string[]
    datasets: {
      data: number[]
      label?: string
      borderColor?: string
      backgroundColor?: string | string[]
      fill?: boolean
      tension?: number
    }[]
  }>
  recent_activity: {
    type: string
    title: string
    timestamp: string | null
    author: string
    id: string
  }[]
  top_entities: Record<string, Record<string, any>[]>
  system_health: {
    cpu_usage_percent: number
    memory_usage_percent: number
    disk_usage_percent: number
    avg_response_time_ms: number
    error_rate_percent: number
    cache_hit_rate_percent: number
    uptime_seconds: number
    active_connections: number
  }
  available_filters: {
    categories: string[]
    statuses: string[]
    users: string[]
    tags: string[]
  }
}

function generateDateRange(days: number): string[] {
  const dates: string[] = []
  const now = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    dates.push(date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }))
  }

  return dates
}

function generateMonthlyLabels(months = 12): string[] {
  const labels: string[] = []
  const now = new Date()

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    labels.push(date.toLocaleDateString('zh-CN', { year: '2-digit', month: 'short' }))
  }

  return labels
}

function randomInRange(min: number, max: number, decimals = 0): number {
  const value = Math.random() * (max - min) + min
  return Number(value.toFixed(decimals))
}

function generateTrendData(points: number, baseValue: number, variance = 0.15): { date: string; value: number }[] {
  const dates = generateDateRange(points)
  let currentValue = baseValue

  return dates.map((date, index) => {
    const change = (Math.random() - 0.5) * 2 * variance * baseValue
    currentValue = Math.max(baseValue * 0.3, Math.min(baseValue * 1.8, currentValue + change))

    return {
      date,
      value: Math.round(currentValue),
    }
  })
}

export function getMockAnalyticsData(): MockDashboardData {
  const now = new Date().toISOString()

  try {
    // KPI Metrics
    const kpi = [
      {
        id: 'total_formulas',
        name: '配方总数',
        value: 12847,
        unit: '个',
        change_percent: 12.5,
        change_direction: 'up' as const,
        target: 15000,
        icon: 'formula',
        trend: generateTrendData(30, 12500),
      },
      {
        id: 'total_experiments',
        name: '实验数量',
        value: 3456,
        unit: '次',
        change_percent: 8.3,
        change_direction: 'up' as const,
        target: 4000,
        icon: 'experiment',
        trend: generateTrendData(30, 3200),
      },
      {
        id: 'active_users',
        name: '活跃用户',
        value: 892,
        unit: '人',
        change_percent: -2.1,
        change_direction: 'down' as const,
        target: 1000,
        icon: 'users',
        trend: generateTrendData(30, 910),
      },
      {
        id: 'ai_generations',
        name: 'AI生成次数',
        value: 15678,
        unit: '次',
        change_percent: 45.7,
        change_direction: 'up' as const,
        target: 20000,
        icon: 'ai',
        trend: generateTrendData(30, 12000),
      },
      {
        id: 'storage_usage',
        name: '存储使用量',
        value: 68.5,
        unit: 'GB',
        change_percent: 5.2,
        change_direction: 'up' as const,
        target: 100,
        icon: 'storage',
        trend: generateTrendData(30, 65),
      },
    ]

    // Monthly Creation Trend (Area Chart)
    const monthlyLabels = generateMonthlyLabels(12)
    const monthlyCreationTrend = {
      chart_type: 'area',
      title: '月度创建趋势',
      subtitle: '过去12个月的配方和实验创建统计',
      labels: monthlyLabels,
      datasets: [
        {
          data: [856, 923, 1045, 1187, 1234, 1356, 1423, 1389, 1456, 1523, 1601, 1678],
          label: '新配方',
          borderColor: '#16A34A',
          fill: true,
          tension: 0.4,
        },
        {
          data: [234, 267, 298, 312, 345, 378, 401, 389, 423, 456, 489, 512],
          label: '新实验',
          borderColor: '#007AFF',
          fill: true,
          tension: 0.4,
        },
        {
          data: [89, 102, 134, 156, 178, 201, 223, 245, 267, 289, 312, 334],
          label: 'AI生成',
          borderColor: '#9333EA',
          fill: true,
          tension: 0.4,
        },
      ],
    }

    // Formula Status Distribution (Pie Chart)
    const formulaStatusDistribution = {
      chart_type: 'pie',
      title: '配方状态分布',
      labels: ['草稿', '审核中', '已发布', '已归档'],
      datasets: [{
        data: [2341, 1876, 7234, 1396],
        backgroundColor: ['#9CA3AF', '#D97706', '#16A34A', '#6B7280'],
      }],
    }

    // Category Breakdown (Horizontal Bar)
    const categoryBreakdown = {
      chart_type: 'horizontal_bar',
      title: '类别分析',
      labels: ['功能性食品', '保健品', '营养补充剂', '药食同源', '特医食品', '其他'],
      datasets: [{
        data: [3456, 2789, 2134, 1890, 1567, 1011],
        backgroundColor: ['#16A34A', '#007AFF', '#9333EA', '#D97706', '#FF3B30', '#6B7280'],
      }],
    }

    // Recent Activity
    const activities = [
      { type: 'formula', title: '创建了新配方：高蛋白营养棒配方v2.3', timestamp: new Date(Date.now() - 120000).toISOString(), author: '张研发', id: 'act-1' },
      { type: 'experiment', title: '完成了实验：抗氧化活性测试-批次#20260502', timestamp: new Date(Date.now() - 1800000).toISOString(), author: '李实验', id: 'act-2' },
      { type: 'ai_generation', title: 'AI生成了3个配方建议方案', timestamp: new Date(Date.now() - 3600000).toISOString(), author: 'AI助手', id: 'act-3' },
      { type: 'formula', title: '更新了配方：低GI代餐粉（审核通过）', timestamp: new Date(Date.now() - 7200000).toISOString(), author: '王配方', id: 'act-4' },
      { type: 'experiment', title: '启动了新实验：稳定性加速测试', timestamp: new Date(Date.now() - 10800000).toISOString(), author: '赵测试', id: 'act-5' },
      { type: 'formula', title: '归档了过期配方：2024春季限定版', timestamp: new Date(Date.now() - 14400000).toISOString(), author: '系统自动', id: 'act-6' },
      { type: 'ai_generation', title: '批量优化了12个配方的营养成分', timestamp: new Date(Date.now() - 21600000).toISOString(), author: 'AI助手', id: 'act-7' },
      { type: 'experiment', title: '导出了实验报告：毒理学评估-完整版', timestamp: new Date(Date.now() - 25200000).toISOString(), author: '孙分析', id: 'act-8' },
      { type: 'formula', title: '创建了配方副本：经典养生茶饮（用于修改）', timestamp: new Date(Date.now() - 28800000).toISOString(), author: '周产品', id: 'act-9' },
      { type: 'experiment', title: '上传了实验数据：感官评价-第3轮', timestamp: new Date(Date.now() - 36000000).toISOString(), author: '郑数据', id: 'act-10' },
    ]

    // Top Entities
    const topEntities = {
      popularFormulas: [
        { name: '高蛋白营养棒', views: 1234, exports: 89, rating: 4.8 },
        { name: '低GI代餐粉', views: 987, exports: 76, rating: 4.7 },
        { name: '益生菌固体饮料', views: 876, exports: 65, rating: 4.9 },
        { name: '胶原蛋白肽饮品', views: 765, exports: 54, rating: 4.6 },
        { name: '人参皂苷提取物', views: 654, exports: 43, rating: 4.8 },
      ],
      activeResearchers: [
        { name: '张研发', formulas: 45, experiments: 23, ai_generations: 156 },
        { name: '李实验', formulas: 38, experiments: 67, ai_generations: 89 },
        { name: '王配方', formulas: 52, experiments: 12, ai_generations: 234 },
        { name: '赵测试', formulas: 23, experiments: 89, ai_generations: 45 },
        { name: '孙分析', formulas: 31, experiments: 34, ai_generations: 67 },
      ],
      trendingIngredients: [
        { name: '胶原蛋白肽', usage_count: 2345, growth_rate: 18.5 },
        { name: '人参皂苷', usage_count: 1876, growth_rate: 12.3 },
        { name: '乳清蛋白', usage_count: 1654, growth_rate: 9.8 },
        { name: '膳食纤维', usage_count: 1543, growth_rate: 8.2 },
        { name: '益生菌', usage_count: 1432, growth_rate: 15.6 },
      ],
    }

    // System Health (使用驼峰命名，稍后映射到下划线格式)
    const systemHealth = {
      cpu_usage_percent: randomInRange(35, 65, 1),
      memory_usage_percent: randomInRange(55, 75, 1),
      disk_usage_percent: randomInRange(40, 60, 1),
      avg_response_time_ms: randomInRange(120, 280, 0),
      error_rate_percent: randomInRange(0.1, 0.8, 2),
      cache_hit_rate_percent: randomInRange(85, 98, 1),
      uptime_seconds: 86400 * 7 + randomInRange(0, 86400), // ~7 days
      active_connections: randomInRange(50, 150, 0),
    }

    // Available Filters (使用驼峰命名，稍后映射到下划线格式)
    const availableFilters = {
      categories: ['功能性食品', '保健品', '营养补充剂', '药食同源', '特医食品', '运动营养', '儿童营养', '老年营养'],
      statuses: ['草稿', '审核中', '已发布', '已归档', '已拒绝'],
      users: ['张研发', '李实验', '王配方', '赵测试', '孙分析', '周产品', '郑数据', '吴质量', '钱运营'],
      tags: ['高蛋白', '低糖', '有机', '无添加', '素食', '清真', '临床验证', '专利技术'],
    }

    // 构建返回对象 - 显式映射所有字段以确保类型安全
    return {
      timestamp: now,
      kpi,
      charts: {
        monthly_creation_trend: monthlyCreationTrend,
        formula_status_distribution: formulaStatusDistribution,
        category_breakdown: categoryBreakdown,
      },
      recent_activity: activities,
      top_entities: topEntities,
      system_health: systemHealth,
      available_filters: availableFilters,
    }

  } catch (error) {
    logger.error('[MockAnalyticsData] Error generating mock data:', error)

    // 返回最小可用数据集以防止页面崩溃
    return {
      timestamp: now,
      kpi: [],
      charts: {},
      recent_activity: [],
      top_entities: {},
      system_health: {
        cpu_usage_percent: 0,
        memory_usage_percent: 0,
        disk_usage_percent: 0,
        avg_response_time_ms: 0,
        error_rate_percent: 0,
        cache_hit_rate_percent: 0,
        uptime_seconds: 0,
        active_connections: 0,
      },
      available_filters: {
        categories: [],
        statuses: [],
        users: [],
        tags: [],
      },
    }
  }
}

/**
 * Simulate API delay for realistic loading experience
 */
export async function fetchMockDashboardData(
  delayMs = 800,
): Promise<MockDashboardData> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(getMockAnalyticsData())
    }, delayMs)
  })
}

/**
 * Generate mock export data in various formats
 */
export function getMockExportData(format: 'csv' | 'excel' | 'pdf') {
  const data = getMockAnalyticsData()

  if (format === 'csv') {
    const headers = ['日期', '新配方', '新实验', 'AI生成']
    const rows = data.charts.monthly_creation_trend.labels.map((label, idx) => {
      const dataset = data.charts.monthly_creation_trend.datasets
      return [
        label,
        dataset[0]?.data[idx] || 0,
        dataset[1]?.data[idx] || 0,
        dataset[2]?.data[idx] || 0,
      ]
    })

    return { headers, rows, filename: `rmfood-analytics-export-${new Date().toISOString().split('T')[0]}.csv` }
  }

  return { data, filename: `rmfood-analytics-report-${new Date().toISOString().split('T')[0]}` }
}

export default {
  getMockAnalyticsData,
  fetchMockDashboardData,
  getMockExportData,
}
