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
  }
>(({ className, checked, onCheckedChange, label, id, ...props }, ref) => {
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
        /* A-21：同 components/ui/Checkbox.tsx——Root 撑到 44×44 作为命中区
           （-m-3.5 抵消布局），16×16 视觉方框下沉到内层 span。 */
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
