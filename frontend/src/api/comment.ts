/**
 * 评论 API
 */
import api from './client'

export interface Comment {
  id: number
  formula_id: number | null
  experiment_id: number | null
  user_id: number
  content: string
  parent_id: number | null
  is_internal: boolean
  created_at: string
  updated_at: string
  author_name: string | null
  author_role: string | null
  replies_count: number
  like_count?: number
  is_liked?: boolean
}

export interface CommentLikeResponse {
  comment_id: number
  like_count: number
  is_liked: boolean
}

export interface CommentCreatePayload {
  formula_id?: number
  experiment_id?: number
  content: string
  parent_id?: number
  is_internal?: boolean
}

export const commentApi = {
  list: (params: { formula_id?: number; experiment_id?: number; include_internal?: boolean; page?: number; page_size?: number }) =>
    api
      .get<{ items: Comment[]; total: number }>('/comments', { params })
      .then((r) => r.data),

  getReplies: (commentId: number) =>
    api.get<Comment[]>(`/comments/${commentId}/replies`).then((r) => r.data),

  create: (data: CommentCreatePayload) =>
    api.post<Comment>('/comments', data).then((r) => r.data),

  update: (id: number, content: string) =>
    api.put(`/comments/${id}`, { content }).then((r) => r.data),

  delete: (id: number) =>
    api.delete(`/comments/${id}`),

  like: (commentId: number) =>
    api.post<CommentLikeResponse>(`/comments/${commentId}/like`).then((r) => r.data),

  unlike: (commentId: number) =>
    api.delete<CommentLikeResponse>(`/comments/${commentId}/like`).then((r) => r.data),

  getLikes: (commentId: number) =>
    api.get<CommentLikeResponse>(`/comments/${commentId}/likes`).then((r) => r.data),
}
