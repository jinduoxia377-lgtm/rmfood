/**
 * SynergyChartBlock — 配伍关系图
 *
 * 展示君臣佐使层级关系或成分协同网络
 * 支持两种模式：hierarchy（层级树）/ network（关系图）
 */
import React, { useState } from 'react'
import { Network, GitBranch, TrendingUp } from 'lucide-react'
import type { SynergyChartData, SynergyNode, SynergyEdge } from '../types'

interface SynergyChartBlockProps {
  data: SynergyChartData
}

function SynergyChartBlock({ data }: SynergyChartBlockProps) {
  const { type = 'hierarchy', title, nodes = [], edges = [] } = data
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  const roleColors: Record<string, string> = {
    '君': 'text-primary-700 dark:text-primary-600 bg-primary-100 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700',
    '臣': 'text-secondary-600 dark:text-secondary-600 bg-secondary-100 dark:bg-secondary-900/30 border-secondary-300 dark:border-secondary-700',
    '佐': 'text-accent-600 dark:text-accent-600 bg-accent-100 dark:bg-accent-900/30 border-accent-300 dark:border-accent-700',
    '使': 'text-warning-600 dark:text-warning-600 bg-warning-100 dark:bg-warning-900/30 border-warning-300 dark:border-warning-700',
    '其他': 'text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700',
  }

  const roleLabels: Record<string, string> = {
    '君': '君',
    '臣': '臣',
    '佐': '佐',
    '使': '使',
    '其他': '其他',
  }

  // 按层级分组节点
  const levelGroups: Record<number, SynergyNode[]> = {}
  nodes.forEach(node => {
    const level = node.level ?? 0
    if (!levelGroups[level]) levelGroups[level] = []
    levelGroups[level].push(node)
  })

  const sortedLevels = Object.keys(levelGroups)
    .map(Number)
    .sort((a, b) => a - b)

  if (nodes.length === 0) {
    return (
      <div className="mb-3 last:mb-0 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 text-center">
        <Network className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-400 mb-2" />
        <p className="text-xs text-neutral-400 dark:text-neutral-400">暂无配伍数据</p>
      </div>
    )
  }

  return (
    <div className="mb-3 last:mb-0 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-primary-500" />
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            {title || '配伍关系'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {type === 'hierarchy' ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-600">
              层级模式
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-600">
              网络模式
            </span>
          )}
        </div>
      </div>

      {/* 图表内容 */}
      <div className="p-4">
        {type === 'hierarchy' ? (
          <div className="space-y-3">
            {sortedLevels.map((level) => {
              const levelNodes = levelGroups[level]
              return (
                <div key={level} className="flex justify-center gap-3 flex-wrap">
                  {levelNodes.map((node) => {
                    const isSelected = selectedNode === node.id
                    return (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNode(isSelected ? null : node.id)}
                        className={`px-3 py-2 rounded-lg border text-center transition-all duration-200 ${
                          isSelected
                            ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-neutral-900 scale-105'
                            : 'hover:shadow-md'
                        } ${roleColors[node.role] || roleColors['其他']}`}
                      >
                        <div className="text-xs font-bold">{node.label}</div>
                        <div className="text-[10px] opacity-75 mt-0.5">{roleLabels[node.role] || node.role}</div>
                      </button>
                    )
                  })}
                </div>
              )
            })}

            {/* 连接说明 */}
            {edges.length > 0 && (
              <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mb-2">配伍关系</div>
                <div className="space-y-1">
                  {edges.slice(0, 5).map((edge, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] text-neutral-600 dark:text-neutral-400">
                      <span className="font-medium">{edge.from}</span>
                      <TrendingUp className="w-3 h-3 text-primary-400" />
                      <span className="font-medium">{edge.to}</span>
                      {edge.type && (
                        <span className="ml-auto px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                          {edge.type}
                        </span>
                      )}
                    </div>
                  ))}
                  {edges.length > 5 && (
                    <div className="text-[10px] text-neutral-400 dark:text-neutral-400 italic">
                      ... 还有 {edges.length - 5} 条关系
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Network 模式简化展示 */
          <div className="space-y-2">
            {nodes.map((node) => (
              <div key={node.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                <span className={`px-2 py-1 rounded text-[10px] font-bold ${roleColors[node.role] || roleColors['其他']}`}>
                  {roleLabels[node.role]}
                </span>
                <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex-1">
                  {node.label}
                </span>
                {edges.filter(e => e.from === node.id || e.to === node.id).length > 0 && (
                  <span className="text-[10px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                    {edges.filter(e => e.from === node.id || e.to === node.id).length} 条关系
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SynergyChartBlock
