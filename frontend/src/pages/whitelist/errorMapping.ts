/**
 * 白名单模块错误码 → 用户可读文案（i18n）映射。
 *
 * 后端错误响应契约：HTTP 4xx/429 时 body 形如 { detail: { code, message, retry_after? } }。
 * 仅保留「按 code 映射到 i18n key」的逻辑，供申请页 / 验证码卡 / 重发共用，
 * 避免各组件各自 catch 后落入泛化文案（P2-9）。
 */

export interface WhitelistErrorDetail {
  code?: string
  message?: string
  retry_after?: number
}

type TFunc = (key: string, opts?: Record<string, unknown>) => string

/** 将 axios 错误响应映射为用户可读文案（按 code → i18n；未知 code 回退 detail.message / unknown / network） */
export function extractWhitelistErrorMessage(err: unknown, t: TFunc): string {
  const anyErr = err as { response?: { data?: { detail?: WhitelistErrorDetail } } }
  const detail = anyErr?.response?.data?.detail
  if (detail) {
    switch (detail.code) {
      case 'EMAIL_REGISTERED':
        return t('pages.whitelist.errors.alreadyRegistered')
      case 'ALREADY_APPLIED':
        return t('pages.whitelist.errors.alreadyApplied')
      case 'RATE_LIMITED':
      case 'COOLDOWN':
        return t('pages.whitelist.errors.rateLimited', { seconds: detail.retry_after ?? 60 })
      case 'INVALID_CAPTCHA':
        return t('pages.whitelist.errors.invalidCaptcha')
      case 'INVALID_CODE':
        return t('pages.whitelist.errors.invalidCode')
      case 'CODE_EXPIRED':
        return t('pages.whitelist.errors.codeExpired')
      case 'TOO_MANY_ATTEMPTS':
        return t('pages.whitelist.errors.tooManyAttempts')
      case 'ALREADY_VERIFIED':
        return t('pages.whitelist.errors.alreadyVerified')
      default:
        return detail.message ?? t('pages.whitelist.errors.unknown')
    }
  }
  return t('pages.whitelist.errors.network')
}
