/**
 * 警告组件
 * 用于显示成功、错误、信息等提示信息
 */
import * as React from 'react'

interface AlertProps {
  children: React.ReactNode
  variant?: 'default' | 'destructive' | 'success' | 'warning' | 'info'
  className?: string
}

interface AlertTitleProps {
  children: React.ReactNode
  className?: string
}

interface AlertDescriptionProps {
  children: React.ReactNode
  className?: string
}

export function Alert({ children, variant = 'default', className = '' }: AlertProps) {
  const variantClasses = {
    default: 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800/40 text-primary-700 dark:text-primary-300',
    destructive: 'bg-danger-50 dark:bg-danger-500/10 border-danger-200 dark:border-danger-500/20 text-danger-600 dark:text-danger-400',
    success: 'bg-success-50 dark:bg-success-500/10 border-success-200 dark:border-success-500/20 text-success-600 dark:text-success-400',
    warning: 'bg-warning-50 dark:bg-warning-500/10 border-warning-200 dark:border-warning-500/20 text-warning-600 dark:text-warning-400',
    info: 'bg-info-50 dark:bg-info-500/10 border-info-200 dark:border-info-500/20 text-info-600 dark:text-info-400',
  }

  return (
    <div className={`flex items-center p-4 rounded-lg border ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  )
}

export function AlertTitle({ children, className = '' }: AlertTitleProps) {
  return (
    <h4 className={`font-medium ${className}`}>
      {children}
    </h4>
  )
}

export function AlertDescription({ children, className = '' }: AlertDescriptionProps) {
  return (
    <div className={`text-sm ${className}`}>
      {children}
    </div>
  )
}

export type { AlertProps, AlertTitleProps, AlertDescriptionProps }
