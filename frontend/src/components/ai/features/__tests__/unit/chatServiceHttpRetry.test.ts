/**
 * chatService 流式 HTTP 可恢复状态码自动重试测试（根因修复）
 *
 * 背景：此前自动重试只覆盖 catch 中的网络异常，HTTP 502/503/500/429 走
 * `!response.ok → handleStreamError → return` 分支不会重试，导致用户
 * 「首次失败、重复输入才成功」。本测试验证修复后 502 会自动重试一次。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { chatService } from '@/components/ai/features/services/chatService'

// 非流式/RAG 检索路径依赖 axios api（@/api/client）；测试中 mock 掉，
// 避免 buildRagContext → searchChunks 触发真实网络请求导致偶发失败/超时。
vi.mock('@/api/client', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: [] }),
    get: vi.fn().mockResolvedValue({ data: [] }),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

function sseResponse(content: string): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

function httpErrorResponse(status: number): Response {
  return new Response(JSON.stringify({ detail: { message: 'AI 服务暂时不可用' } }), { status })
}

describe('sendMessageStream HTTP 状态码自动重试', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    document.cookie = 'csrf_token=test_csrf_token; path=/'
    // 私有方法 isAuthenticated 置为 true
    vi.spyOn(chatService as unknown as { isAuthenticated: () => boolean }, 'isAuthenticated').mockReturnValue(true)
    // @ts-expect-error 清理 pending 状态
    chatService.pendingRequest.clear?.()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('首次返回 502 时自动重试一次，第二次成功收到完整流', async () => {
    let fetchCalls = 0
    fetchMock = vi.fn(async (_url: unknown, _init?: RequestInit) => {
      fetchCalls += 1
      // 第 1 次：chat stream 返回 502（无前置 GET，因 csrf_token 已在 cookie）
      if (fetchCalls === 1) return httpErrorResponse(502)
      // 第 2 次：重试成功，返回 SSE
      return sseResponse('{"blocks":[{"type":"header","data":{"title":"测试配方"}}]}')
    })
    vi.stubGlobal('fetch', fetchMock)

    const chunks: string[] = []
    for await (const chunk of chatService.sendMessageStream('帮我设计配方')) {
      if (chunk.content) chunks.push(chunk.content)
      if (chunk.done) break
    }

    expect(fetchCalls).toBe(2)
    expect(chunks.join('')).toContain('测试配方')
  })

  it('503 也会自动重试', async () => {
    let fetchCalls = 0
    fetchMock = vi.fn(async () => {
      fetchCalls += 1
      if (fetchCalls === 1) return httpErrorResponse(503)
      return sseResponse('OK')
    })
    vi.stubGlobal('fetch', fetchMock)

    for await (const chunk of chatService.sendMessageStream('x')) {
      if (chunk.done) break
    }
    expect(fetchCalls).toBe(2)
  })

  it('422（画像超长等参数问题）也会自动重试', async () => {
    let fetchCalls = 0
    fetchMock = vi.fn(async () => {
      fetchCalls += 1
      if (fetchCalls === 1) return httpErrorResponse(422)
      return sseResponse('OK')
    })
    vi.stubGlobal('fetch', fetchMock)

    for await (const chunk of chatService.sendMessageStream('x')) {
      if (chunk.done) break
    }
    expect(fetchCalls).toBe(2)
  })

  it('401 不自动重试（认证错误直接走错误处理）', async () => {
    const errorSpy = vi.spyOn(chatService as unknown as { handleError: (e: Error, q: string) => void }, 'handleError').mockImplementation(() => {})
    let fetchCalls = 0
    fetchMock = vi.fn(async () => {
      fetchCalls += 1
      return httpErrorResponse(401)
    })
    vi.stubGlobal('fetch', fetchMock)

    let thrown = false
    try {
      for await (const chunk of chatService.sendMessageStream('x')) {
        void chunk
      }
    } catch {
      thrown = true
    }
    // 401 不重试：只请求 1 次，且错误被抛出（由外层 UI 处理）
    expect(fetchCalls).toBe(1)
    expect(thrown).toBe(true)
    expect(errorSpy).toHaveBeenCalled()
  })
})