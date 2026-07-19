import { useQuery } from '@tanstack/react-query'
import { aiInsightsApi } from '@/api/aiInsights'

export function useAIInsights() {
  return useQuery({
    queryKey: ['ai-insights'],
    queryFn: aiInsightsApi.getInsights,
    staleTime: 5 * 60_000,
  })
}

export function useAIPredictions() {
  return useQuery({
    queryKey: ['ai-predictions'],
    queryFn: aiInsightsApi.getPredictions,
    staleTime: 5 * 60_000,
  })
}

export function useKPIProgress() {
  return useQuery({
    queryKey: ['kpi-progress'],
    queryFn: aiInsightsApi.getKPIProgress,
    staleTime: 5 * 60_000,
  })
}
