/**
 * 图标工厂 — 根据名称字符串返回 Lucide 图标组件
 */
import { Microscope, Bot, BarChart3 } from 'lucide-react';
import type { LucideProps } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  Microscope,
  Bot,
  BarChart3,
};

/**
 * 根据字符串名称获取图标组件
 */
export function getIcon(name: string) {
  return iconMap[name] ?? Microscope;
}
