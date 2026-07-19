/**
 * RMFOOD 设计系统 — StatCard 统计卡片
 * 统一 Dashboard 统计数字展示，消除重复代码
 */
import { type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

type StatVariant = 'primary' | 'secondary' | 'info' | 'success' | 'warning';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  variant?: StatVariant;
  className?: string;
}

const variantStyles: Record<StatVariant, { iconBg: string; iconColor: string }> = {
  primary: { iconBg: 'bg-primary-100 dark:bg-primary-900/30', iconColor: 'text-primary-600 dark:text-primary-400' },
  secondary: { iconBg: 'bg-violet-100 dark:bg-violet-900/30', iconColor: 'text-violet-600 dark:text-violet-400' },
  info: { iconBg: 'bg-secondary-100 dark:bg-secondary-900/30', iconColor: 'text-secondary-600 dark:text-secondary-400' },
  success: { iconBg: 'bg-success-100 dark:bg-success-900/30', iconColor: 'text-success-600 dark:text-success-400' },
  warning: { iconBg: 'bg-warning-100 dark:bg-warning-900/30', iconColor: 'text-warning-600 dark:text-warning-400' },
};

export function StatCard({ label, value, icon: Icon, variant = 'primary', className }: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card hoverable className={cn('h-full px-6 py-4', className)}>
      <div className="flex flex-col h-full">
        <p className="text-caption mb-4 text-text-secondary">{label}</p>
        <div className="flex items-center justify-between flex-1">
          <div className="flex items-center gap-4">
            <p className="text-display font-semibold text-text-primary">{value}</p>
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', styles.iconBg)}>
              <Icon size={20} className={styles.iconColor} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export type { StatCardProps, StatVariant };
