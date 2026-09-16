import React, { useState } from 'react'

export const SimpleSlider: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(e.target.value, 10))
  }

  return (
    <div className="flex items-center gap-4 p-2 border rounded">
      <span className="text-sm w-32">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={handleChange}
        className="flex-1 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
        style={{ accentColor: '#3b82f6' }}
      />
      <span className="text-sm w-12 text-right">{value}</span>
    </div>
  )
}
