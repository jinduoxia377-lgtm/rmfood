import React, { useState } from 'react'

export const TestSliderPage: React.FC = () => {
  const [value, setValue] = useState(50)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Test slider changed:', e.target.value)
    setValue(parseInt(e.target.value, 10))
  }

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">滑块测试</h1>
      
      <div className="space-y-6 p-4 border rounded">
        <div>
          <p className="text-sm mb-2">测试 1: 基础 range input</p>
          <input
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={handleChange}
            className="w-full h-2 bg-neutral-200 rounded-lg"
            aria-label="测试 1: 基础 range input"
          />
          <p className="text-sm mt-1">当前值: {value}</p>
        </div>
        
        <div>
          <p className="text-sm mb-2">测试 2: 带样式的 range input</p>
          <input
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={handleChange}
            className="w-full h-2 bg-secondary-500 rounded-lg cursor-pointer"
            style={{ accentColor: 'rgb(59, 130, 246)' }}
            aria-label="测试 2: 带样式的 range input"
          />
          <p className="text-sm mt-1">当前值: {value}</p>
        </div>
        
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            如果以上滑块能拖动，说明问题是 RealTimeAdjustPanel 特定实现的问题。
            请查看浏览器控制台是否有 "Test slider changed" 日志。
          </p>
        </div>
      </div>
    </div>
  )
}
