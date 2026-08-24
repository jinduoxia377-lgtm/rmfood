/**
 * RMFOOD 设计系统 — Radix Components 演示页面
 *
 * 展示所有 Radix Components 的使用方式
 * 新页面使用此文件作为参考模板
 */
'use client'

import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Button as RadixButton,
  Badge as RadixBadge,
  Card as RadixCard,
  Text as RadixText,
} from '@/components/ui/RadixComponents'
import { Button, Badge, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { Sparkles, Settings, Bell, User, CheckCircle, AlertCircle, Info } from 'lucide-react'

export default function RadixDemoPage() {
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated p-6 space-y-8">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <RadixText size="7" weight="bold" color="gray">
            Radix UI Themes 演示
          </RadixText>
          <RadixText size="3" color="gray">
            展示新版设计系统的组件用法
          </RadixText>
        </div>
        <Link to="/dashboard">
          <RadixButton variant="outline">返回仪表盘</RadixButton>
        </Link>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Button 组件演示 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section>
        <RadixText size="5" weight="bold" className="mb-4">Button 按钮组件</RadixText>
        <RadixCard className="p-6 space-y-6">
          {/* 变体示例 */}
          <div>
            <RadixText size="2" weight="medium" color="gray" className="mb-3">变体 Variants</RadixText>
            <div className="flex flex-wrap gap-3">
              <RadixButton variant="solid">Solid</RadixButton>
              <RadixButton variant="soft">Soft</RadixButton>
              <RadixButton variant="outline">Outline</RadixButton>
              <RadixButton variant="ghost">Ghost</RadixButton>
            </div>
          </div>

          {/* 尺寸示例 */}
          <div>
            <RadixText size="2" weight="medium" color="gray" className="mb-3">尺寸 Sizes</RadixText>
            <div className="flex items-center gap-3">
              <RadixButton size="1">小</RadixButton>
              <RadixButton size="2">中</RadixButton>
              <RadixButton size="3">大</RadixButton>
            </div>
          </div>

          {/* 状态示例 */}
          <div>
            <RadixText size="2" weight="medium" color="gray" className="mb-3">状态 States</RadixText>
            <div className="flex flex-wrap gap-3">
              <RadixButton disabled>禁用</RadixButton>
              <RadixButton loading>加载中...</RadixButton>
              <RadixButton
                variant="solid"
                onClick={() => {
                  setLoading(true)
                  setTimeout(() => setLoading(false), 2000)
                }}
                loading={loading}
              >
                点击加载
              </RadixButton>
            </div>
          </div>

          {/* 与 shadcn Button 对比 */}
          <div className="border-t pt-4">
            <RadixText size="2" weight="medium" color="gray" className="mb-3">shadcn Button 对比</RadixText>
            <div className="flex flex-wrap gap-3">
              <Button>shadcn Default</Button>
              <Button variant="secondary">shadcn Secondary</Button>
              <Button variant="outline">shadcn Outline</Button>
              <Button variant="ghost">shadcn Ghost</Button>
              <Button variant="ai">shadcn AI</Button>
            </div>
          </div>
        </RadixCard>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Badge 组件演示 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section>
        <RadixText size="5" weight="bold" className="mb-4">Badge 徽章组件</RadixText>
        <RadixCard className="p-6 space-y-6">
          {/* 变体示例 */}
          <div>
            <RadixText size="2" weight="medium" color="gray" className="mb-3">变体 Variants</RadixText>
            <div className="flex flex-wrap gap-3">
              <RadixBadge variant="default">Default</RadixBadge>
              <RadixBadge variant="success">Success</RadixBadge>
              <RadixBadge variant="warning">Warning</RadixBadge>
              <RadixBadge variant="error">Error</RadixBadge>
              <RadixBadge variant="info">Info</RadixBadge>
            </div>
          </div>

          {/* 带点示例 */}
          <div>
            <RadixText size="2" weight="medium" color="gray" className="mb-3">带点 Dot</RadixText>
            <div className="flex flex-wrap gap-3">
              <RadixBadge variant="success" dot>在线</RadixBadge>
              <RadixBadge variant="warning" dot>忙碌</RadixBadge>
              <RadixBadge variant="error" dot>离线</RadixBadge>
            </div>
          </div>

          {/* 与 shadcn Badge 对比 */}
          <div className="border-t pt-4">
            <RadixText size="2" weight="medium" color="gray" className="mb-3">shadcn Badge 对比</RadixText>
            <div className="flex flex-wrap gap-3">
              <Badge>shadcn Default</Badge>
              <Badge variant="success">shadcn Success</Badge>
              <Badge variant="destructive">shadcn Destructive</Badge>
              <Badge variant="secondary">shadcn Secondary</Badge>
            </div>
          </div>
        </RadixCard>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Card 组件演示 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section>
        <RadixText size="5" weight="bold" className="mb-4">Card 卡片组件</RadixText>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 基本卡片 */}
          <RadixCard className="p-6">
            <RadixText size="4" weight="bold">基本卡片</RadixText>
            <RadixText size="2" color="gray" className="mt-2">
              标准 Radix Card 组件，无边框样式
            </RadixText>
          </RadixCard>

          {/* 悬停效果 */}
          <RadixCard hoverable className="p-6">
            <RadixText size="4" weight="bold">悬停效果</RadixText>
            <RadixText size="2" color="gray" className="mt-2">
              鼠标悬停时显示阴影效果
            </RadixText>
          </RadixCard>

          {/* Glassmorphism */}
          <RadixCard glass className="p-6">
            <RadixText size="4" weight="bold">毛玻璃效果</RadixText>
            <RadixText size="2" color="gray" className="mt-2">
              backdrop-blur 背景模糊效果
            </RadixText>
          </RadixCard>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Text 组件演示 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section>
        <RadixText size="5" weight="bold" className="mb-4">Text 文本组件</RadixText>
        <RadixCard className="p-6 space-y-6">
          {/* 字号 */}
          <div>
            <RadixText size="2" weight="medium" color="gray" className="mb-3">字号 Sizes (1-7)</RadixText>
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

          {/* 颜色 */}
          <div className="border-t pt-4">
            <RadixText size="2" weight="medium" color="gray" className="mb-3">颜色 Colors</RadixText>
            <div className="space-y-2">
              <RadixText color="gray">灰色文本 (默认)</RadixText>
              <RadixText color="mint">薄荷绿文本</RadixText>
              <RadixText color="orange">橙色文本</RadixText>
              <RadixText color="red">红色文本</RadixText>
            </div>
          </div>
        </RadixCard>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 实际应用场景 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section>
        <RadixText size="5" weight="bold" className="mb-4">实际应用场景</RadixText>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 通知卡片 */}
          <RadixCard hoverable className="p-6">
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
                  <RadixButton size="1" variant="solid">查看详情</RadixButton>
                  <RadixButton size="1" variant="ghost">忽略</RadixButton>
                </div>
              </div>
            </div>
          </RadixCard>

          {/* 统计卡片 */}
          <RadixCard hoverable className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <RadixText size="2" color="gray">总配方数</RadixText>
                <RadixText size="7" weight="bold" className="mt-1">1,234</RadixText>
                <RadixText size="1" color="mint" className="mt-1">
                  ↑ 12% 较上月
                </RadixText>
              </div>
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary-600" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t flex gap-2">
              <RadixBadge variant="success">有效 1,180</RadixBadge>
              <RadixBadge variant="warning">待审核 34</RadixBadge>
              <RadixBadge variant="error">已拒绝 20</RadixBadge>
            </div>
          </RadixCard>

          {/* 用户信息卡片 */}
          <RadixCard hoverable className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-lg">
                张
              </div>
              <div className="flex-1">
                <RadixText size="4" weight="bold">张工程师</RadixText>
                <RadixText size="2" color="gray">高级配方师 | 研发部</RadixText>
                <div className="flex gap-2 mt-2">
                  <RadixBadge variant="info">在线</RadixBadge>
                  <RadixBadge variant="success">活跃</RadixBadge>
                </div>
              </div>
              <RadixButton size="1" variant="ghost" icon={<Settings className="w-4 h-4" />} />
            </div>
          </RadixCard>

          {/* 错误提示卡片 */}
          <RadixCard className="p-6 border border-error-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-error-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-error-600" />
              </div>
              <div className="flex-1">
                <RadixText size="4" weight="bold" color="red">连接失败</RadixText>
                <RadixText size="2" color="gray" className="mt-1">
                  无法连接到后端服务，请检查网络连接后重试
                </RadixText>
                <div className="mt-4">
                  <RadixButton variant="solid" size="1">重试连接</RadixButton>
                </div>
              </div>
            </div>
          </RadixCard>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 使用说明 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section>
        <RadixText size="5" weight="bold" className="mb-4">使用说明</RadixText>
        <RadixCard className="p-6">
          <div className="space-y-4">
            <div>
              <RadixText size="3" weight="medium">何时使用 Radix Components</RadixText>
              <RadixText size="2" color="gray" className="mt-1">
                • 新功能开发时，优先使用 Radix Components
                • 需要简洁 API 和主题集成的场景
                • 统计卡片、通知、标签等展示型组件
              </RadixText>
            </div>
            <div className="border-t pt-4">
              <RadixText size="3" weight="medium">何时继续使用 shadcn/ui</RadixText>
              <RadixText size="2" color="gray" className="mt-1">
                • 复杂交互组件（Dialog、Select、Tabs）
                • 需要更多定制化选项的场景
                • 已有的功能代码
              </RadixText>
            </div>
            <div className="border-t pt-4">
              <RadixText size="3" weight="medium">迁移策略</RadixText>
              <RadixText size="2" color="gray" className="mt-1">
                • 新页面：直接使用 Radix Components
                • 现有页面：保持不变，渐进式替换
                • 组件对比：参考 RadixUsageGuide.tsx
              </RadixText>
            </div>
          </div>
        </RadixCard>
      </section>
    </div>
  )
}
