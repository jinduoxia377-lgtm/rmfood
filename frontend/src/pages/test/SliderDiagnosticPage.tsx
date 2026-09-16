import React, { useState, useEffect } from 'react'

export const SliderDiagnosticPage: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([])
  const [values, setValues] = useState({ s1: 50, s2: 50, s3: 50 })
  const [browserInfo, setBrowserInfo] = useState('')

  useEffect(() => {
    setBrowserInfo(`UserAgent: ${navigator.userAgent}`)
  }, [])

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 30))
    console.log(msg)
  }

  const handleChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10)
    setValues(prev => ({ ...prev, [id]: val }))
    addLog(`Slider ${id}: ${e.type} → ${val}`)
  }

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">滑块诊断页面</h1>
      <p className="text-sm text-muted-foreground">{browserInfo}</p>
      
      <div className="space-y-4">
        <div className="p-4 border rounded-lg">
          <h3 className="font-medium mb-3">测试 1: 基础 range input</h3>
          <input
            type="range"
            min={0}
            max={100}
            value={values.s1}
            onChange={(e) => handleChange('s1', e)}
            className="w-full h-2 bg-gray-200 rounded-lg"
          />
          <p className="text-sm mt-1">值: {values.s1}</p>
        </div>

        <div className="p-4 border rounded-lg">
          <h3 className="font-medium mb-3">测试 2: 带 accentColor 样式</h3>
          <input
            type="range"
            min={0}
            max={100}
            value={values.s2}
            onChange={(e) => handleChange('s2', e)}
            className="w-full h-2 rounded-lg"
            style={{ accentColor: '#3b82f6' }}
          />
          <p className="text-sm mt-1">值: {values.s2}</p>
        </div>

        <div className="p-4 border rounded-lg">
          <h3 className="font-medium mb-3">测试 3: Webkit 自定义样式</h3>
          <input
            type="range"
            min={0}
            max={100}
            value={values.s3}
            onChange={(e) => handleChange('s3', e)}
            className="w-full h-2 rounded-lg"
            style={{
              WebkitAppearance: 'none',
              appearance: 'none',
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${values.s3}%, #d1d5db ${values.s3}%, #d1d5db 100%)`
            }}
          />
          <p className="text-sm mt-1">值: {values.s3}</p>
        </div>
      </div>

      <div className="p-4 bg-muted rounded-lg">
        <h3 className="font-medium mb-2">事件日志</h3>
        <div className="text-xs font-mono space-y-1 max-h-64 overflow-y-auto">
          {logs.map((log, i) => (
            <div key={i} className="text-green-600 dark:text-green-400">{log}</div>
          ))}
          {logs.length === 0 && <div className="text-muted-foreground">暂无日志 - 尝试拖动上方滑块</div>}
        </div>
      </div>

      <div className="pt-4 border-t text-sm">
        <h3 className="font-medium mb-2">诊断说明</h3>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>如果所有滑块都能拖动 → 浏览器正常，问题在 RealTimeAdjustPanel 实现</li>
          <li>如果只有部分滑块能拖动 → 可能是样式问题</li>
          <li>如果所有滑块都不能拖动 → 可能是浏览器或全局 CSS 问题</li>
          <li>查看上方日志确认事件是否触发</li>
        </ul>
      </div>
    </div>
  )
}
