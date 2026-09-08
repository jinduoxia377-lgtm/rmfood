/**
 * 将底层错误信息（含英文 / 堆栈 / HTTP 码）转译为面向用户的友好中文提示。
 *
 * 与 chatService.classifyError 的分类保持一致，但仅用于"展示层"，
 * 避免把原始异常文本、堆栈或英文报错直接暴露给用户。
 */

export function toFriendlyErrorMessage(raw: unknown): string {
  const text = (raw instanceof Error ? raw.message : String(raw ?? '')).toLowerCase()

  if (!text) return '对话服务暂时不可用，请稍后重试。'

  // 网络不可达：后端未启动 / 代理失败 / 请求中断
  if (
    text.includes('failed to fetch') ||
    text.includes('err_aborted') ||
    text.includes('aborted') ||
    text.includes('networkerror') ||
    text.includes('无法连接') ||
    text.includes('网络不可达')
  ) {
    return '无法连接到 AI 服务，请检查网络或后端服务是否正常后重试。'
  }

  // 超时
  if (text.includes('timeout') || text.includes('超时')) {
    return '网络连接超时，请稍后重试。'
  }

  // AI 服务配置错误（API Key 无效 / 缺失）
  if (
    text.includes('ai服务配置错误') ||
    text.includes('api_key_invalid') ||
    text.includes('api key 无效')
  ) {
    return 'AI 服务未正确配置：API Key 无效或缺失，请在「配置管理」中检查。'
  }

  // 登录会话过期
  if (text.includes('401') || text.includes('unauthorized') || text.includes('认证失败') || text.includes('未授权')) {
    return '登录会话已过期，请重新登录后继续。'
  }

  // 权限不足（403）
  if (text.includes('403') || text.includes('forbidden') || text.includes('权限')) {
    return '权限不足，请重新登录后重试。'
  }

  // 限流
  if (text.includes('429') || text.includes('请求过于频繁')) {
    return '请求过于频繁，请稍等片刻后再发送。'
  }

  // 服务器错误
  if (text.includes('500') || text.includes('服务器错误') || text.includes('server error')) {
    return '服务器暂时无法处理请求，请稍后重试。'
  }

  // 流式中断
  if (text.includes('流式') || text.includes('stream') || text.includes('中断')) {
    return 'AI 响应在传输过程中被中断，请重新生成。'
  }

  return '对话服务暂时不可用，请稍后重试。'
}
