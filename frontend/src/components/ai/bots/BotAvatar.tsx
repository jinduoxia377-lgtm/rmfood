/**
 * BotAvatar — 具名 Bot 头像（专业规范版）
 *
 * 规范：
 * 1. 头像字段仅接受「图片地址」（http(s)://、/ 相对路径、data:image/…），
 *    有效时以 <img> 渲染真实图片（专业「调用图片」）。
 * 2. 无有效图片时，渲染「品牌渐变 + 角色能力对应 lucide 图标」的专业头像，
 *    全项目禁止使用 Emoji 表情包代替图标。
 * 3. 渐变背景由 bot.id / name 哈希决定，同一 Bot 在不同位置头像保持一致。
 */
import { Bot, Crown, FlaskConical, Scale, ShieldCheck, BookOpen, Brain, Microscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Bot as BotType } from './types';

/** 专业渐变头像池。
 *  注意：必须使用「不随暗色主题反转」的 Tailwind 默认色阶（emerald/sky/teal/violet/amber/rose…），
 *  若用 primary 或 accent 色阶，会在暗色模式下被提亮，白色图标对比度不足。 */
const AVATAR_GRADIENTS = [
  'from-emerald-600 to-violet-700',
  'from-sky-600 to-indigo-600',
  'from-teal-600 to-emerald-800',
  'from-violet-600 to-indigo-700',
  'from-amber-700 to-rose-700',
  'from-rose-600 to-pink-700',
] as const;

const SIZE_CLASSES = {
  xs: 'h-5 w-5',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
} as const;

const ICON_CLASSES = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
} as const;

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function isImageUrl(value: string): boolean {
  const v = value.trim();
  return /^https?:\/\//i.test(v) || v.startsWith('/') || v.startsWith('data:image/');
}

/** 根据角色与能力白名单返回专业语义图标元素（替代 Emoji 表情包） */
function getAvatarIcon(
  bot: Pick<BotType, 'avatar' | 'name' | 'id' | 'is_chief' | 'capabilities'> | null | undefined,
  size: keyof typeof ICON_CLASSES,
) {
  const cls = ICON_CLASSES[size];
  if (bot?.is_chief) return <Crown className={cls} aria-hidden="true" />;
  const caps = bot?.capabilities ?? [];
  if (caps.includes('generate_formula')) return <FlaskConical className={cls} aria-hidden="true" />;
  if (caps.includes('compliance_check')) return <Scale className={cls} aria-hidden="true" />;
  if (caps.includes('safety_assess')) return <ShieldCheck className={cls} aria-hidden="true" />;
  if (caps.includes('literature_search')) return <BookOpen className={cls} aria-hidden="true" />;
  if (caps.includes('generate_experiment_plan')) return <Microscope className={cls} aria-hidden="true" />;
  if (caps.includes('rag_retrieve') || caps.includes('qa_answer')) return <Brain className={cls} aria-hidden="true" />;
  return <Bot className={cls} aria-hidden="true" />;
}

export interface BotAvatarProps {
  bot?: Pick<BotType, 'avatar' | 'name' | 'id' | 'is_chief' | 'capabilities'> | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

export function BotAvatar({ bot, size = 'md', className }: BotAvatarProps) {
  const avatar = bot?.avatar?.trim() ?? '';
  const name = bot?.name?.trim() ?? '';
  const seed = String(bot?.id ?? name ?? '');
  const gradient = AVATAR_GRADIENTS[hashSeed(seed) % AVATAR_GRADIENTS.length];

  // 有效图片地址 → 专业调用图片渲染
  if (avatar && isImageUrl(avatar)) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border',
          SIZE_CLASSES[size],
          className,
        )}
      >
        <img
          src={avatar}
          alt={name ? `${name} 头像` : '智能体头像'}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </span>
    );
  }

  // 无图片 → 品牌渐变 + 角色图标（绝不渲染 Emoji / 文字首字符）
  return (
    <span
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-white',
        gradient,
        SIZE_CLASSES[size],
        className,
      )}
      role="img"
      aria-label={name ? `${name} 头像` : '智能体头像'}
    >
      {getAvatarIcon(bot, size)}
    </span>
  );
}