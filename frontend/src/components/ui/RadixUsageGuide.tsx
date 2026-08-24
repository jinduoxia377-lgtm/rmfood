/**
 * RMFOOD 设计系统 — Radix Themes 组件使用示例
 *
 * Phase 3: 展示如何在页面中使用 Radix Themes 组件
 */
import React from 'react'
import { Button, Badge, Card, Text } from './RadixComponents'
import { Card as ShadcnCard } from './shadcn/card'

export function RadixDemo() {
  return (
    <div className="space-y-4 p-4">
      {/* Radix Button */}
      <div className="flex gap-2">
        <Button variant="solid">Solid Button</Button>
        <Button variant="soft">Soft Button</Button>
        <Button variant="outline">Outline Button</Button>
        <Button variant="ghost">Ghost Button</Button>
      </div>

      {/* Radix Badge */}
      <div className="flex gap-2">
        <Badge variant="default">Default</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="error">Error</Badge>
        <Badge variant="info">Info</Badge>
        <Badge variant="success" dot>Dot</Badge>
      </div>

      {/* Radix Card */}
      <div className="grid grid-cols-2 gap-4">
        <Card hoverable className="p-4">
          <Text size="4" weight="bold">Hoverable Card</Text>
          <Text size="2" color="gray">Card with hover shadow effect</Text>
        </Card>
        <Card glass className="p-4">
          <Text size="4" weight="bold">Glass Card</Text>
          <Text size="2" color="gray">Card with glassmorphism effect</Text>
        </Card>
      </div>

      {/* Comparison with shadcn */}
      <div className="border-t pt-4">
        <Text size="3" weight="bold">shadcn/ui 对比</Text>
        <ShadcnCard className="mt-2">
          <ShadcnCard.Header>
            <ShadcnCard.Title>shadcn Card</ShadcnCard.Title>
            <ShadcnCard.Description>传统 shadcn 组件</ShadcnCard.Description>
          </ShadcnCard.Header>
          <ShadcnCard.Content>内容区域</ShadcnCard.Content>
        </ShadcnCard>
      </div>
    </div>
  )
}

export default RadixDemo
