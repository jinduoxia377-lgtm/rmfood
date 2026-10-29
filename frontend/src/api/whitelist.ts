/**
 * 白名单申请 API
 *
 * 对接后端契约（docs/whitelist-apply-development-plan.md 3.2）:
 * - POST /auth/whitelist/apply        提交申请（强制邮箱验证码）
 * - POST /auth/whitelist/verify-code  校验 6 位验证码
 * - POST /auth/whitelist/resend-code  60s 冷却重发验证码
 * - GET  /auth/whitelist/status       凭状态 token 查询申请状态
 */
import api from './client'

export interface WhitelistApplyParams {
  email: string
  fullName?: string
  organization?: string
  reason?: string
  source?: 'whitelist_page' | 'login'
  lang?: string
  captchaId: string
  captchaAnswer: string
}

export interface CaptchaResult {
  captcha_id: string
  image_base64: string
  server_time: string
}

export interface WhitelistApplyResult {
  request_id: number
  status_token: string
  email_verified: boolean
  server_time: string
  cooldown_until: string | null
  /** 仅开发环境（ENV=development）返回，用于无 SMTP 时本地测试；生产环境为 null */
  dev_verify_code?: string | null
}

export interface WhitelistStatusResult {
  request_id: number
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  submitted_at: string | null
  review_deadline: string | null
  approved_at: string | null
  reject_reason: string | null
  cooldown_until: string | null
  server_time: string
}

export const whitelistApi = {
  /** 获取人机验证码（图片 + captcha_id） */
  getCaptcha: () =>
    api.get<CaptchaResult>('/auth/whitelist/captcha').then((r) => r.data),

  /** 提交白名单申请（含人机验证），成功后向邮箱发送验证码 */
  apply: (data: WhitelistApplyParams) =>
    api
      .post<WhitelistApplyResult>('/auth/whitelist/apply', {
        email: data.email,
        full_name: data.fullName,
        organization: data.organization,
        reason: data.reason,
        source: data.source ?? 'whitelist_page',
        lang: data.lang ?? 'zh-CN',
        captcha_id: data.captchaId,
        captcha_answer: data.captchaAnswer,
      })
      .then((r) => r.data),

  /** 校验 6 位邮箱验证码 */
  verifyCode: (requestId: number, code: string) =>
    api
      .post<{ request_id: number; status: string; review_deadline: string | null; server_time: string }>(
        '/auth/whitelist/verify-code',
        { request_id: requestId, code },
      )
      .then((r) => r.data),

  /** 60s 冷却后重发验证码 */
  resendCode: (requestId: number, lang?: string) =>
    api
      .post<{ retry_after: number; server_time: string }>('/auth/whitelist/resend-code', {
        request_id: requestId,
        lang: lang ?? 'zh-CN',
      })
      .then((r) => r.data),

  /** 凭状态 token 查询申请状态 */
  getStatus: (token: string) =>
    api
      .get<WhitelistStatusResult>('/auth/whitelist/status', { params: { token } })
      .then((r) => r.data),
}