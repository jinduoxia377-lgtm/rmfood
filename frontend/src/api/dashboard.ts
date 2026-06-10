/**
 * 仪表盘 API 接口
 */
import apiClient from './client'

export interface DashboardStatistics {
  formulas: {
    total: number
    by_status: Record<string, number>
  }
  experiments: {
    total: number
    by_status: Record<string, number>
  }
  users: {
    total: number
    by_role: Record<string, number>
  }
  recent_activity: { date: string; formulas: number; experiments: number }[]
}

export interface DashboardTrends {
  period: string
  data: {
    date: string
    formulas_created: number
    experiments_created: number
    formulas_approved: number
  }[]
}

export const dashboardApi = {
  getStatistics: () =>
    apiClient.get<DashboardStatistics>('/dashboard/statistics').then((r) => r.data),
  getTrends: (period: '7d' | '30d' | '90d' = '30d') =>
    apiClient
      .get<DashboardTrends>(`/dashboard/trends?period=${period}`)
      .then((r) => r.data),
}
