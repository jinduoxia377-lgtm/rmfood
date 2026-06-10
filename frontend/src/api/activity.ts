/**
 * 活动统计 API
 */
import api from './client'

export interface TimelineEvent {
  id: number
  type: 'formula' | 'experiment'
  title: string
  status: string
  created_at: string
  event: string
}

export interface TodoItem {
  id: number
  type: 'review_formula' | 'active_experiment' | 'planned_experiment'
  title: string
  detail: string
  priority: 'high' | 'medium' | 'low'
  created_at: string
}

export interface ReviewQueueItem {
  id: number
  name: string
  code: string
  creator_name: string
  target_effects: string[]
  submitted_at: string
}

export const activityApi = {
  timeline: (days = 7, signal?: AbortSignal) =>
    api.get<{ items: TimelineEvent[]; total: number }>('/activity/timeline', { params: { days }, signal }).then((r) => r.data),

  todos: (signal?: AbortSignal) =>
    api.get<{ items: TodoItem[]; total: number }>('/activity/todos', { signal }).then((r) => r.data),

  reviewQueue: (signal?: AbortSignal) =>
    api.get<{ items: ReviewQueueItem[]; total: number }>('/activity/review-queue', { signal }).then((r) => r.data),
}
