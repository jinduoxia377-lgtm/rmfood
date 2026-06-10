/**
 * ConversationTags — 对话分类标签系统
 *
 * 功能：
 * - 为每个对话会话分配主题标签
 * - 预设专业标签库（配方研发、安全评估、法规咨询等）
 * - 支持自定义标签
 * - 标签颜色区分
 * - 标签搜索与筛选
 */
import React, { useState, useMemo, useCallback } from 'react'
import { Tag, Plus, X, Search, Palette } from 'lucide-react'

export interface ConversationTag {
  id: string
  name: string
  color: string     // Tailwind color class
  icon?: string     // 可选的简短标识
  count?: number    // 该标签下的会话数量
}

interface ConversationTagsProps {
  selectedTags: string[]
  onTagChange: (tags: string[]) => void
  availableTags?: ConversationTag[]
  onCreateTag?: (name: string) => ConversationTag
  compact?: boolean
  maxVisible?: number
}

// 预设专业标签库
const PRESET_TAGS: ConversationTag[] = [
  { id: 'formula-dev', name: '配方研发', color: 'bg-emerald-100 text-emerald-700 ring-emerald-500/20', icon: '⚗' },
  { id: 'safety-eval', name: '安全评估', color: 'bg-red-100 text-red-700 ring-red-500/20', icon: '🛡' },
  { id: 'regulation', name: '法规咨询', color: 'bg-blue-100 text-blue-700 ring-blue-500/20', icon: '📋' },
  { id: 'ingredient-query', name: '原料查询', color: 'bg-amber-100 text-amber-700 ring-amber-500/20', icon: '🌿' },
  { id: 'process-design', name: '工艺设计', color: 'bg-purple-100 text-purple-700 ring-purple-500/20', icon: '⚙' },
  { id: 'quality-control', name: '质量控制', color: 'bg-cyan-100 text-cyan-700 ring-cyan-500/20', icon: '✓' },
  { id: 'market-analysis', name: '市场分析', color: 'bg-orange-100 text-orange-700 ring-orange-500/20', icon: '📊' },
  { id: 'literature-review', name: '文献综述', color: 'bg-indigo-100 text-indigo-700 ring-indigo-500/20', icon: '📖' },
  { id: 'cost-analysis', name: '成本核算', color: 'bg-teal-100 text-teal-700 ring-teal-500/20', icon: '💰' },
  { id: 'general', name: '一般咨询', color: 'bg-gray-100 text-gray-700 ring-gray-500/20', icon: '?' },
]

const TAG_COLORS = [
  'bg-emerald-100 text-emerald-700 ring-emerald-500/20',
  'bg-blue-100 text-blue-700 ring-blue-500/20',
  'bg-purple-100 text-purple-700 ring-purple-500/20',
  'bg-amber-100 text-amber-700 ring-amber-500/20',
  'bg-red-100 text-red-700 ring-red-500/20',
  'bg-cyan-100 text-cyan-700 ring-cyan-500/20',
  'bg-pink-100 text-pink-700 ring-pink-500/20',
  'bg-teal-100 text-teal-700 ring-teal-500/20',
  'bg-orange-100 text-orange-700 ring-orange-500/20',
  'bg-indigo-100 text-indigo-700 ring-indigo-500/20',
]

export default function ConversationTags({
  selectedTags,
  onTagChange,
  availableTags = PRESET_TAGS,
  onCreateTag,
  compact = false,
  maxVisible = 6,
}: ConversationTagsProps) {
  const [showAll, setShowAll] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [newTagName, setNewTagName] = useState('')

  const filteredTags = useMemo(() => {
    if (!searchQuery) return availableTags
    const q = searchQuery.toLowerCase()
    return availableTags.filter(t => t.name.toLowerCase().includes(q))
  }, [availableTags, searchQuery])

  const displayedTags = showAll ? filteredTags : filteredTags.slice(0, maxVisible)

  const toggleTag = useCallback((tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onTagChange(selectedTags.filter(id => id !== tagId))
    } else {
      onTagChange([...selectedTags, tagId])
    }
  }, [selectedTags, onTagChange])

  const handleCreate = useCallback(() => {
    if (!newTagName.trim()) return
    const newTag: ConversationTag = {
      id: `custom-${Date.now()}`,
      name: newTagName.trim(),
      color: TAG_COLORS[availableTags.length % TAG_COLORS.length],
    }
    onCreateTag?.(newTag)
    onTagChange([...selectedTags, newTag.id])
    setNewTagName('')
    setShowCreate(false)
  }, [newTagName, availableTags.length, onCreateTag, onTagChange, selectedTags])

  if (compact) {
    // 紧凑模式：只显示已选标签
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {selectedTags.map(tagId => {
          const tag = availableTags.find(t => t.id === tagId)
          if (!tag) return null
          return (
            <span key={tag.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${tag.color}`}>
              {tag.name}
              <button onClick={(e) => { e.stopPropagation(); toggleTag(tag.id) }} className="hover:text-red-500">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">主题分类</span>
          {selectedTags.length > 0 && (
            <span className="text-[10px] text-primary-500 bg-primary-50 dark:bg-primary-900/20 px-1.5 py-0.5 rounded-full">
              {selectedTags.length}
            </span>
          )}
        </div>
        {!compact && (
          <div className="flex items-center gap-1">
            {/* 搜索 */}
            <div className="relative">
              <Search className="w-3 h-3 absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索标签..."
                className="pl-5 pr-2 py-1 text-[10px] rounded-md border border-gray-200 dark:border-gray-700 bg-transparent w-24 focus:w-32 transition-all focus:outline-none focus:ring-1 focus:ring-primary-500/30"
              />
            </div>
            {/* 新建标签 */}
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-500 transition-colors"
              title="新建标签"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 标签网格 */}
      <div className="flex flex-wrap gap-1.5">
        {displayedTags.map(tag => {
          const isSelected = selectedTags.includes(tag.id)
          return (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer
                ${isSelected
                  ? `${tag.color} ring-1 shadow-sm`
                  : 'bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
            >
              {isSelected && <Palette className="w-3 h-3 opacity-60" />}
              {tag.name}
            </button>
          )
        })}
      </div>

      {/* 展开/收起 */}
      {filteredTags.length > maxVisible && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-[10px] text-primary-500 hover:text-primary-600 transition-colors"
        >
          {showAll ? '收起' : `展开全部 (${filteredTags.length})`}
        </button>
      )}

      {/* 新建标签表单 */}
      {showCreate && (
        <div className="flex items-center gap-1.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
          <input
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="输入新标签名称..."
            autoFocus
            className="flex-1 px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
          />
          <button onClick={handleCreate} className="px-2 py-1 text-xs bg-primary-500 text-white rounded-md hover:bg-primary-600">
            确定
          </button>
          <button onClick={() => setShowCreate(false)} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">
            取消
          </button>
        </div>
      )}
    </div>
  )
}

export { PRESET_TAGS, TAG_COLORS }
