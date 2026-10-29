/**
 * Bot 对话服务（DS Bot 移植）
 *
 * 复用后端成熟对话链路：POST /ai/chat 与 /ai/chat/stream（SSE），
 * 请求体携带 bot_id，后端以 Bot 的人设+记忆+模型覆盖应答（评审 M2/R7）。
 */
import api from '@/api/client';
import { envConfig } from '@/config/env';

export interface BotChatResponse {
  content: string;
  role?: string;
  model?: string | null;
  formulas?: unknown[];
  thinking_steps?: Array<{ step: string; content: string; status: string; detail?: string }>;
  success?: boolean;
}

export interface BotChatHistoryItem {
  role: string;
  content: string;
}

export interface BotChatStreamHandlers {
  onMeta?: (model: string) => void;
  onContent: (chunk: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

/** 非流式 Bot 对话 */
export async function botChat(
  botId: number,
  question: string,
  history: BotChatHistoryItem[] = [],
): Promise<BotChatResponse> {
  const res = await api.post<BotChatResponse>('/ai/chat', {
    question,
    history,
    stream: false,
    bot_id: botId,
  });
  return res.data;
}

/** 流式 Bot 对话（SSE），返回 abort 函数 */
export function botChatStream(
  botId: number,
  question: string,
  history: BotChatHistoryItem[] = [],
  handlers: BotChatStreamHandlers,
): () => void {
  const controller = new AbortController();

  const request = async () => {
    try {
      const res = await fetch(`${envConfig.api.baseUrl}/ai/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          history,
          stream: true,
          bot_id: botId,
        }),
        credentials: 'include',
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Bot 对话失败 (${res.status}): ${text.slice(0, 200)}`);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error('无响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      // 当前 SSE event 名（`event: xxx`），仅在本次 data 行内有效，避免跨 chunk 残留
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          // SSE event 名与 data 分离：`event: meta` + `data: {...}`
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
            continue;
          }
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6).trim();
          if (!dataStr || dataStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(dataStr);
            if (currentEvent === 'meta' && parsed.model) {
              handlers.onMeta?.(parsed.model);
            } else if (currentEvent === 'content' && typeof parsed.content === 'string') {
              handlers.onContent(parsed.content);
            }
            // 该 data 行消费完成，清空 event 名，避免下一条裸 data 行误用上一事件的类型
            currentEvent = '';
          } catch {
            // 忽略无法解析的行
          }
        }
      }
      handlers.onDone();
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      handlers.onError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  void request();
  return () => controller.abort();
}