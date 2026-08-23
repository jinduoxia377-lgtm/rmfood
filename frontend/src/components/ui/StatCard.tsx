/**
 * RMFOOD 璁捐绯荤粺 鈥?StatCard 缁熻鍗＄墖
 * 缁熶竴 Dashboard 缁熻鏁板瓧灞曠ず锛屾秷闄ら噸澶嶄唬鐮? * 鏀寔 large 鍙樹綋鐢ㄤ簬绐佸嚭鏄剧ず涓昏鎸囨爣
 */
import { type LucideIcon } from'lucide-react';
import { Card } from'@/components/ui';
import { cn } from'@/lib/utils';

type StatVariant ='primary' |'secondary' |'info' |'success' |'warning';

interface StatCardProps {
 label: string;
 value: number | string;
 icon: LucideIcon;
 variant?: StatVariant;
 size?: 'default' |'large';
 className?: string;
}

const variantStyles: Record<StatVariant, { iconBg: string; iconColor: string }> = {
 primary: { iconBg:'bg-primary-100 dark:bg-primary-900/30', iconColor:'text-primary-600 dark:text-primary-400' },
 secondary: { iconBg:'bg-secondary-100 dark:bg-secondary-900/30', iconColor:'text-secondary-600 dark:text-secondary-400' },
 info: { iconBg:'bg-secondary-100 dark:bg-secondary-900/30', iconColor:'text-secondary-600 dark:text-secondary-400' },
 success: { iconBg:'bg-success-100 dark:bg-success-900/30', iconColor:'text-success-600 dark:text-success-400' },
 warning: { iconBg:'bg-warning-100 dark:bg-warning-900/30', iconColor:'text-warning-600 dark:text-warning-400' },
};

const sizeStyles = {
 default: { valueSize:'text-display', iconSize:'w-10 h-10', iconPixel:20 },
 large: { valueSize:'text-display-xl', iconSize:'w-12 h-12', iconPixel:24 },
};

export function StatCard({ label, value, icon: Icon, variant ='primary', size ='default', className }: StatCardProps) {
 const styles = variantStyles[variant];
 const sizeConfig = sizeStyles[size];

 return (
 <Card hoverable className={cn('h-full px-6 py-4', size ==='large' &&'py-6', className)}>
 <div className="flex flex-col h-full">
 <p className={cn('mb-3 text-text-secondary', size ==='large' &&'mb-4 text-body')}>{label}</p>
 <div className="flex items-center justify-between flex-1">
 <div className="flex items-center gap-4">
 <p className={cn('font-semibold text-text-primary', sizeConfig.valueSize)}>{value}</p>
 <div className={cn('flex items-center justify-center rounded-xl', styles.iconBg, sizeConfig.iconSize)}>
 <Icon size={sizeConfig.iconPixel} className={styles.iconColor} />
 </div>
 </div>
 </div>
 </div>
 </Card>
 );
}

export type { StatCardProps, StatVariant };

