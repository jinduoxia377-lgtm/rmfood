/**
 * RMFOOD 设计系统 — Radix Components 演示页面
 *
 * 展示所有 Radix Components 的使用方式
 * 新页面使用此文件作为参考模板
 */
'use client'

import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge as RadixBadge, Text as RadixText } from '@/components/ui/RadixComponents'
import { Button, Badge, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { Sparkles, Settings, Bell, User, CheckCircle, AlertCircle, Info } from 'lucide-react'

export default function RadixDemoPage() {
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated p-6 space-y-8">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          {/* A-47：这里原本是 <RadixText> 默认渲染的 <span>，视觉上是页面主标题但语义上不是标题，
              既缺 h1（WCAG 1.3.1）又会被量具判成「疑似标题非 h 标签」。RadixText 支持 as 透传，
              直接用 as="h1" 补齐语义，字号字重完全不变。 */}
          <RadixText as="h1" size="7" weight="bold" color="gray">
            Radix UI Themes 演示
          </RadixText>
          <RadixText size="3" color="gray">
            展示新版设计系统的组件用法
          </RadixText>
        </div>
        <Link to="/dashboard">
          <Button variant="outline">返回仪表盘</Button>
        </Link>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Button 组件演示 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section>
        <RadixText size="5" weight="bold" className="mb-4">Button 按钮组件</RadixText>
        <Card className="p-6 space-y-6">
          {/* 变体示例 */}
          <div>
            <RadixText size="2" weight="medium" color="gray" className="mb-3">变体 Variants</RadixText>
            <div className="flex flex-wrap gap-3">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="ai">AI Button</Button>
            </div>
          </div>

          {/* 状态示例 */}
          <div>
            <RadixText size="2" weight="medium" color="gray" className="mb-3">状态 States</RadixText>
            <div className="flex flex-wrap gap-3">
              <Button disabled>禁用</Button>
              <Button loading>加载中...</Button>
              <Button
                variant="primary"
                onClick={() => {
                  setLoading(true)
                  setTimeout(() => setLoading(false), 2000)
                }}
                loading={loading}
              >
                点击加载
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Badge 组件演示 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section>
        <RadixText size="5" weight="bold" className="mb-4">Badge 徽章组件</RadixText>
        <Card className="p-6 space-y-6">
          {/* shadcn Badge */}
          <div>
            <RadixText size="2" weight="medium" color="gray" className="mb-3">shadcn Badge</RadixText>
            <div className="flex flex-wrap gap-3">
              <Badge>Default</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="secondary">Secondary</Badge>
            </div>
          </div>

          {/* Radix Badge */}
          <div className="border-t pt-4">
            <RadixText size="2" weight="medium" color="gray" className="mb-3">Radix Badge</RadixText>
            <div className="flex flex-wrap gap-3">
              <RadixBadge variant="default">Default</RadixBadge>
              <RadixBadge variant="success">Success</RadixBadge>
              <RadixBadge variant="warning">Warning</RadixBadge>
              <RadixBadge variant="error">Error</RadixBadge>
              <RadixBadge variant="info">Info</RadixBadge>
            </div>
          </div>
        </Card>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Text 组件演示 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section>
        <RadixText size="5" weight="bold" className="mb-4">Text 文本组件</RadixText>
        <Card className="p-6 space-y-6">
          {/* Radix Text */}
          <div>
            <RadixText size="2" weight="medium" color="gray" className="mb-3">Radix Text Sizes</RadixText>
            <div className="space-y-2">
              <RadixText size="1">Size 1 - 超小文本</RadixText>
              <RadixText size="2">Size 2 - 小文本</RadixText>
              <RadixText size="3">Size 3 - 中等文本</RadixText>
              <RadixText size="4">Size 4 - 大文本</RadixText>
              <RadixText size="5">Size 5 - 超大文本</RadixText>
              <RadixText size="6">Size 6 - 特大文本</RadixText>
              <RadixText size="7">Size 7 - 巨无霸文本</RadixText>
            </div>
          </div>

          {/* 字重 */}
          <div className="border-t pt-4">
            <RadixText size="2" weight="medium" color="gray" className="mb-3">字重 Weights</RadixText>
            <div className="space-y-2">
              <RadixText weight="regular">Regular weight text</RadixText>
              <RadixText weight="medium">Medium weight text</RadixText>
              <RadixText weight="bold">Bold weight text</RadixText>
            </div>
          </div>
        </Card>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 实际应用场景 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section>
        <RadixText size="5" weight="bold" className="mb-4">实际应用场景</RadixText>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 通知卡片 */}
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-success-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-success-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <RadixText size="4" weight="bold">配方审核通过</RadixText>
                  <RadixBadge variant="success" dot>新</RadixBadge>
                </div>
                <RadixText size="2" color="gray" className="mt-1">
                  您的配方「营养强化饮料A」已通过审核，发布时间：2小时前
                </RadixText>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="primary">查看详情</Button>
                  <Button size="sm" variant="ghost">忽略</Button>
                </div>
              </div>
            </div>
          </Card>

          {/* 统计卡片 */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <RadixText size="2" color="gray">总配方数</RadixText>
                <RadixText size="7" weight="bold" className="mt-1">1,234</RadixText>
                <RadixText size="1" color="mint" className="mt-1">
                  ↑ 12% 较上月
                </RadixText>
              </div>
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary-700" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t flex gap-2">
              <Badge variant="success">有效 1,180</Badge>
              <Badge variant="warning">待审核 34</Badge>
              <Badge variant="destructive">已拒绝 20</Badge>
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}
