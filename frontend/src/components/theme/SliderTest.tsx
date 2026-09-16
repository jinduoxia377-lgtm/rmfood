import React, { useState } from 'react'

export const SliderTest: React.FC = () => {
  const [value, setValue] = useState(50)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = parseInt(e.target.value, 10)
    console.log('Slider changed:', newVal, e.target.value)
    setValue(newVal)
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-medium mb-4">滑块测试</h3>
      <div className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground">测试滑块 1 (原生)</label>
          <input
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={handleChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm mt-1 block">值: {value}</span>
        </div>
        
        <div>
          <label className="text-sm text-muted-foreground">测试滑块 2 (自定义)</label>
          <input
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={handleChange}
            className="w-full h-2 bg-blue-500 rounded-lg cursor-pointer"
            style={{ accentColor: 'rgb(59, 130, 246)' }}
          />
          <span className="text-sm mt-1 block">值: {value}</span>
        </div>
        
        <div className="pt-4 border-t">
          <button 
            onClick={() => { console.log('Button clicked'); alert('按钮点击!') }}
            className="px-4 py-2 bg-primary-500 text-white rounded"
          >
            测试按钮
          </button>
        </div>
      </div>
    </div>
  )
}
