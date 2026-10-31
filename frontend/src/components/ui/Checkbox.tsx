'use client'

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
    onCheckedChange?: (checked: boolean) => void
    label?: string
    id?: string
    indeterminate?: boolean
  }
>(({ className, checked, onCheckedChange, label, id, indeterminate: _indeterminate, ...props }, ref) => {
  const handleChange = (nextChecked: boolean) => {
    onCheckedChange?.(nextChecked)
  }

  return (
    <div className="flex items-center gap-2">
      <CheckboxPrimitive.Root
        ref={ref}
        id={id}
        checked={checked}
        onCheckedChange={handleChange}
        /* A-21：原 Root 就是 16×16 的视觉方框 = 触控目标，远低于 WCAG 2.5.5
           的 44×44（实测表格行复选框 16×16 / 192×28）。
           做法：Root 撑到 44×44 作为命中区，用 -m-3.5 抵消外框尺寸变化
           （布局贡献仍是 16×16，视觉间距不变），真正的 16×16 方框下沉到
           内层 <span>，勾选态样式改为穿透到该 span。 */
        className={cn(
          'peer h-11 w-11 -m-3.5 shrink-0 grid place-items-center rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:[&>span]:bg-primary data-[state=checked]:[&>span]:text-primary-foreground data-[state=checked]:[&>span]:border-primary',
          className
        )}
        {...props}
      >
        <span className="h-4 w-4 shrink-0 rounded-sm border border-primary shadow flex items-center justify-center text-current transition-colors">
          <CheckboxPrimitive.Indicator
            className={cn('flex items-center justify-center text-current')}
          >
            <Check className="h-3 w-3" />
          </CheckboxPrimitive.Indicator>
        </span>
      </CheckboxPrimitive.Root>
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
        </label>
      )}
    </div>
  )
})
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
