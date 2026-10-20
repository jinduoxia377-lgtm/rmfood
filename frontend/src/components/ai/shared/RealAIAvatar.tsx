/**
 * RealAIAvatar — 真实 AI 头像组件
 *
 * 复用项目既有「AI 真实头像」能力（后端代理 thispersondoesnotexist.com 的
 * StyleGAN2 真实人脸生成接口），在客户端拉取一张真实 AI 人脸：
 * - 生成后转换为对象 URL 并在「模块级缓存」中保存，同一会话内头像保持稳定；
 * - 接口不可用/未登录时优雅回退到品牌渐变 + Sparkles 图标。
 */
import { useEffect, useState } from 'react';
import { Leaf } from 'lucide-react';
import envConfig from '@/config/env';

/** 会话级缓存：同一页面会话内 AI 头像保持不变 */
let cachedAIAvatarUrl: string | null = null;

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^| )csrf_token=([^;]+)/);
  return match ? match[1] : '';
}

export interface RealAIAvatarProps {
  size?: 'sm' | 'md';
  className?: string;
}

export function RealAIAvatar({ size = 'sm', className = '' }: RealAIAvatarProps) {
  const [url, setUrl] = useState<string | null>(cachedAIAvatarUrl);
  const [failed, setFailed] = useState(false);

  // 若其他实例已生成缓存，render 期间同步使用（React 推荐模式，避免 effect 同步 setState）
  if (cachedAIAvatarUrl && !url) {
    setUrl(cachedAIAvatarUrl);
  }

  useEffect(() => {
    if (cachedAIAvatarUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const csrf = getCsrfToken();
        const res = await fetch(`${envConfig.api.baseUrl}/auth/me/avatar/generate-real`, {
          method: 'POST',
          credentials: 'include',
          headers: csrf ? { 'X-CSRF-Token': csrf } : undefined,
        });
        if (!res.ok) throw new Error('AI 头像生成失败');
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        cachedAIAvatarUrl = objectUrl;
        if (!cancelled) setUrl(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sizeClass = size === 'md' ? 'h-10 w-10' : 'h-8 w-8';

  if (url && !failed) {
    return (
      <img
        src={url}
        alt="AI 研发助手"
        data-testid="real-ai-avatar"
        className={`${sizeClass} flex-shrink-0 rounded-full object-cover ring-1 ring-border ${className}`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} flex-shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-[#10b981] text-white ${className}`}
      role="img"
      aria-label="AI 研发助手"
    >
      <Leaf className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}