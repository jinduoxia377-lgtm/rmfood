import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  required,
  children,
  className,
}) => {
  /* A-26：原来的 <label> 既没有 htmlFor、也不包裹控件，等于一个「什么都不标注」的
     视觉文字 —— 它下面所有 input / textarea 在可访问性树里都是匿名的
     （WCAG 4.1.2，实测 /settings 的「简介」textarea 被判为无可读名称）。
     这里用 useId 生成标签 id，再克隆唯一的子元素挂上 aria-labelledby，
     一次性让所有 FormField 用法都获得正确名称；子元素若自带 aria-label /
     aria-labelledby 则不覆盖，尊重调用方更精确的语义。 */
  const labelId = React.useId();
  const child = React.isValidElement(children)
    ? (children.props as Record<string, unknown>)?.['aria-label'] ||
      (children.props as Record<string, unknown>)?.['aria-labelledby']
      ? children
      : React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
          'aria-labelledby': labelId,
        })
    : children;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        id={labelId}
        className="block text-sm font-medium text-[var(--text-primary)]"
      >
        {label}
        {required && <span className="text-danger-500 ml-1">*</span>}
      </label>
      {child}
      {error && (
        <div className="flex items-center gap-1 text-sm text-danger-500 mt-1">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
