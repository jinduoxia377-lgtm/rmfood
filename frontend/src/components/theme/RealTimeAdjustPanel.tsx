import React, { useState, useEffect } from 'react'

export const RealTimeAdjustPanel: React.FC = () => {
  const [value, setValue] = useState(50)
  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    addLog('组件已加载')
  }, [])

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 20))
    console.log(msg)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = parseInt(e.target.value, 10)
    addLog(`滑块变化: ${e.type} → ${newVal}`)
    setValue(newVal)
  }

  const handleClick = () => {
    addLog('按钮被点击')
    alert('按钮点击成功！如果这个弹窗出现，说明鼠标事件正常。')
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-medium mb-4">实时调节测试</h3>
      
      <div className="space-y-4">
        <div>
          <button 
            onClick={handleClick}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            测试按钮点击
          </button>
        </div>
        
        <div>
          <p className="text-sm mb-2">测试滑块 1 (标准):</p>
          <input
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={handleChange}
            className="w-full h-2 bg-gray-300 rounded-lg"
          />
          <p className="text-sm mt-1">值: {value}</p>
        </div>
        
        <div>
          <p className="text-sm mb-2">测试滑块 2 (accentColor):</p>
          <input
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={handleChange}
            className="w-full h-2 rounded-lg"
            style={{ accentColor: '#3b82f6' }}
          />
          <p className="text-sm mt-1">值: {value}</p>
        </div>
        
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            如果按钮能点击但滑块不能拖动，请检查控制台日志和 DOM 结构。
          </p>
        </div>
      </div>
      
      {logs.length > 0 && (
        <div className="mt-4 p-2 bg-black text-green-400 text-xs font-mono rounded max-h-40 overflow-y-auto">
          {logs.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      )}
    </div>
  )
}
