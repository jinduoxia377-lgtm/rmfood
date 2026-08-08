/**
 * 滑块组件
 * 用于选择数值范围
 */
import * as React from 'react'

interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  className?: string
  disabled?: boolean
}

export function Slider({ value, min, max, step = 1, onChange, className = '', disabled = false }: SliderProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(event.target.value)
    onChange(newValue)
  }

  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className={`relative w-full ${className}`}>
      <div
        className="absolute top-1/2 left-0 h-2 w-full -translate-y-1/2 rounded-full bg-neutral-200 dark:bg-neutral-700"
        style={{ width: '100%' }}
      />
      <div
        className="absolute top-1/2 left-0 h-2 -translate-y-1/2 rounded-full bg-primary-500"
        style={{ width: `${percentage}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className="
          relative w-full h-2 bg-transparent appearance-none cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-primary-500
          disabled:opacity-50 disabled:cursor-not-allowed
        "
        style={{
          background: 'transparent',
        }}
      />
    </div>
  )
}

export type { SliderProps }
