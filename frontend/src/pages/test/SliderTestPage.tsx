import React, { useState } from 'react'
import { logger } from '@/utils/safeLogger'

export const SliderTestPage: React.FC = () => {
  const [values, setValues] = useState({ slider1: 50, slider2: 50, slider3: 50 })
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 20))
    logger.debug(msg)
  }

  const handleChange = (id: string, value: number) => {
    setValues(prev => ({ ...prev, [id]: value }))
    addLog(`Slider ${id} changed to ${value}`)
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">滑块测试页面</h1>
      
      <div className="p-4 border rounded-lg space-y-4">
        <h2 className="font-medium">测试 1: 基础滑块</h2>
        <input
          type="range"
          min={0}
          max={100}
          value={values.slider1}
          onChange={(e) => handleChange('slider1', parseInt(e.target.value))}
          className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
          aria-label="测试 1: 基础滑块"
        />
        <p>值: {values.slider1}</p>
      </div>

      <div className="p-4 border rounded-lg space-y-4">
        <h2 className="font-medium">测试 2: 带样式的滑块</h2>
        <input
          type="range"
          min={0}
          max={100}
          value={values.slider2}
          onChange={(e) => handleChange('slider2', parseInt(e.target.value))}
          className="w-full h-2 bg-secondary-500 rounded-lg cursor-pointer"
          style={{ accentColor: '#3b82f6' }}
          aria-label="测试 2: 带样式的滑块"
        />
        <p>值: {values.slider2}</p>
      </div>

      <div className="p-4 border rounded-lg space-y-4">
        <h2 className="font-medium">测试 3: 内联样式滑块</h2>
        <input
          type="range"
          min={0}
          max={100}
          value={values.slider3}
          onChange={(e) => handleChange('slider3', parseInt(e.target.value))}
          className="w-full h-2 rounded-lg cursor-pointer"
          style={{
            WebkitAppearance: 'none',
            appearance: 'none',
            height: '8px',
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${values.slider3}%, #d1d5db ${values.slider3}%, #d1d5db 100%)`,
            borderRadius: '4px',
            outline: 'none'
          }}
          aria-label="测试 3: 内联样式滑块"
        />
        <p>值: {values.slider3}</p>
      </div>

      <div className="p-4 bg-muted rounded-lg">
        <h2 className="font-medium mb-2">控制台日志</h2>
        <div className="text-xs font-mono space-y-1 max-h-48 overflow-y-auto">
          {logs.map((log, i) => (
            <div key={i} className="text-success-600">{log}</div>
          ))}
          {logs.length === 0 && <div className="text-muted-foreground">暂无日志</div>}
        </div>
      </div>

      <div className="pt-4 border-t text-sm text-muted-foreground">
        <p>如果以上滑块都能拖动，说明问题是 RealTimeAdjustPanel 特定实现的问题。</p>
        <p>请查看上方日志，确认滑块事件是否正常触发。</p>
      </div>
    </div>
  )
}
