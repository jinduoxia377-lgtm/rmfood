/**
 * RMFOOD 设计系统 — Radix Components 使用示例
 */
import React from 'react'
import { RadixBadge, RadixText } from './RadixComponents'

export function RadixUsageGuide() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Radix Components 使用指南</h2>
      
      <div>
        <h3 className="font-semibold">Badge 示例</h3>
        <div className="flex gap-2 mt-2">
          <RadixBadge variant="default">Default</RadixBadge>
          <RadixBadge variant="success">Success</RadixBadge>
          <RadixBadge variant="warning">Warning</RadixBadge>
          <RadixBadge variant="error">Error</RadixBadge>
          <RadixBadge variant="info">Info</RadixBadge>
        </div>
      </div>

      <div>
        <h3 className="font-semibold">Text 示例</h3>
        <RadixText size="7" weight="bold">标题</RadixText>
        <RadixText size="4" weight="medium">副标题</RadixText>
        <RadixText size="2" color="gray">正文</RadixText>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold">说明</h3>
        <p className="text-sm text-gray-600 mt-2">
          - Button 和 Card 组件继续使用 shadcn/ui 实现（功能更丰富）
          - Badge 和 Text 使用 Radix Themes 原生实现
          - 所有组件保持向后兼容
        </p>
      </div>
    </div>
  )
}

export default RadixUsageGuide
