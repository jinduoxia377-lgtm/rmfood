/**
 * RealAIAvatar — 真实 AI 头像组件（三级降级）
 *
 * 降级链路：
 * 1. 后端 StyleGAN2 真实人脸（/auth/me/avatar/generate-real）
 * 2. 本地 Canvas AI 头像（品牌渐变 + 药草叶 SVG，不依赖外部服务）
 * 3. 品牌渐变 + Leaf 图标（最终兜底）
 *
 * 生成后转换为对象 URL 并在「模块级缓存」中保存，同一会话内头像保持稳定。
 */
import { useEffect, useState } from 'react';
import { Leaf } from 'lucide-react';
import { AIAvatarFallback } from './AIAvatarFallback';
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
  const [backendFailed, setBackendFailed] = useState(false);

  // 若其他实例已生成缓存，通过 effect 同步（避免 render 期间 setState 导致无限重渲染）
  useEffect(() => {
    if (cachedAIAvatarUrl && !url) {
      setUrl(cachedAIAvatarUrl);
    }
  }, [cachedAIAvatarUrl, url]);

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
        if (!cancelled) setBackendFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sizeClass = size === 'md' ? 'h-10 w-10' : 'h-8 w-8';

  // 1. 后端真实头像成功 → 渲染图片
  if (url && !backendFailed) {
    return (
      <img
        src={url}
        alt="AI 研发助手"
        data-testid="real-ai-avatar"
        className={`${sizeClass} flex-shrink-0 rounded-full object-cover ring-1 ring-border ${className}`}
      />
    );
  }

  // 2. 后端不可用 → 渲染本地 Canvas AI 头像（品牌渐变 + 药草叶）
  if (backendFailed) {
    return <AIAvatarFallback size={size} className={className} />;
  }

  // 3. 加载中 → 品牌渐变 + Leaf 图标（与用户头像同尺寸）
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