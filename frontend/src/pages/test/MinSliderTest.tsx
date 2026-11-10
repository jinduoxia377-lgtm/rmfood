import React from 'react'
import { logger } from '@/utils/safeLogger'

export const MinSliderTest: React.FC = () => {
  let changeCount = 0

  const handleChange = (e: any) => {
    changeCount++
    logger.log('INPUT CHANGE EVENT FIRED!', e.target.value, 'count:', changeCount)
    alert('滑块事件触发! 值: ' + e.target.value + ', 次数: ' + changeCount)
  }

  const handleClick = () => {
    logger.debug('BUTTON CLICKED!')
    alert('按钮被点击!')
  }

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>最简化滑块测试</h1>
      
      <div style={{ marginBottom: '30px', padding: '20px', border: '2px solid red' }}>
        <h3 style={{ margin: '0 0 10px 0' }}>测试 1: 按钮点击</h3>
        <button 
          onClick={handleClick}
          style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
        >
          点击我
        </button>
      </div>

      <div style={{ marginBottom: '30px', padding: '20px', border: '2px solid green' }}>
        <h3 style={{ margin: '0 0 10px 0' }}>测试 2: 原生 range input</h3>
        <input
          type="range"
          min="0"
          max="100"
          defaultValue="50"
          onChange={handleChange}
          style={{ width: '100%', height: '30px', cursor: 'pointer' }}
          aria-label="测试 2: 原生 range input"
        />
        <p style={{ margin: '10px 0 0 0' }}>尝试拖动这个滑块</p>
      </div>

      <div style={{ padding: '20px', border: '2px solid blue' }}>
        <h3 style={{ margin: '0 0 10px 0' }}>测试 3: div 包裹的 range</h3>
        <div style={{ padding: '20px', background: '#f0f0f0' }}>
          <input
            type="range"
            min="0"
            max="100"
            defaultValue="50"
            onChange={handleChange}
            style={{ width: '100%', cursor: 'pointer' }}
            aria-label="测试 3: div 包裹的 range"
          />
        </div>
      </div>

      <div style={{ marginTop: '30px', padding: '20px', background: '#ffffcc' }}>
        <h3 style={{ margin: '0 0 10px 0' }}>说明</h3>
        <ul style={{ marginLeft: '20px' }}>
          <li>如果按钮能点击但滑块不能 → CSS 或样式问题</li>
          <li>如果按钮也不能点击 → 全局事件问题</li>
          <li>查看浏览器控制台 (F12) 确认日志输出</li>
        </ul>
      </div>
    </div>
  )
}
