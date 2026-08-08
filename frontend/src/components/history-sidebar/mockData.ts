/**
 * Mock 数据 - 历史记录侧边栏
 */

import type { Conversation, Category, Tag } from './types'

// ── 分类数据 ──
export const categories: Category[] = [
  { id: 'all', name: '全部', icon: 'LayoutGrid', count: 42, color: '#6B7280' },
  { id: 'chat', name: 'AI 对话', icon: 'MessageSquare', count: 23, color: '#28A745' },
  { id: 'formula', name: '配方设计', icon: 'FlaskConical', count: 12, color: '#007AFF' },
  { id: 'report', name: '学术报告', icon: 'FileText', count: 5, color: '#AF52DE' },
  { id: 'search', name: '检索记录', icon: 'Search', count: 2, color: '#D97706' },
]

// ── 标签数据 ──
export const tags: Tag[] = [
  { id: 't1', name: '营养配方', color: '#28A745', count: 8 },
  { id: 't2', name: '护肤配方', color: '#007AFF', count: 12 },
  { id: 't3', name: 'AI生成', color: '#AF52DE', count: 15 },
  { id: 't4', name: '待审核', color: '#D97706', count: 3 },
  { id: 't5', name: '已完成', color: '#34C759', count: 20 },
  { id: 't6', name: '研究中', color: '#D946EF', count: 5 },
  { id: 't7', name: '紧急', color: '#FF3B30', count: 2 },
  { id: 't8', name: '客户需求', color: '#0891B2', count: 6 },
]

// ── 对话数据生成 ──
const generateConversations = (): Conversation[] => {
  const now = new Date()

  const conversations: Conversation[] = [
    // 置顶对话
    {
      id: 'c1',
      title: '多肽配方优化方案',
      content: '用户需要针对敏感肌肤的多肽配方，要求温和不刺激，同时具备保湿和抗皱效果...',
      category: categories[1],
      tags: ['t2', 't3', 't5'],
      createdAt: new Date(now.getTime() - 86400000 * 2),
      updatedAt: new Date(now.getTime() - 3600000),
      unreadCount: 3,
      status: 'pinned',
      type: 'formula',
    },
    {
      id: 'c2',
      title: 'AI 智能助手 - 最新配方建议',
      content: '基于您的需求，我推荐以下配方方案...',
      category: categories[2],
      tags: ['t3', 't5'],
      createdAt: new Date(now.getTime() - 86400000),
      updatedAt: new Date(now.getTime() - 1800000),
      unreadCount: 0,
      status: 'pinned',
      type: 'chat',
    },
    // 普通对话
    {
      id: 'c3',
      title: '美白精华配方分析',
      content: '分析现有美白精华配方的成分比例和功效...',
      category: categories[2],
      tags: ['t2', 't6'],
      createdAt: new Date(now.getTime() - 86400000 * 3),
      updatedAt: new Date(now.getTime() - 7200000),
      unreadCount: 1,
      status: 'active',
      type: 'formula',
    },
    {
      id: 'c4',
      title: '2024年度研究报告',
      content: '基于本年度研究成果的综合报告...',
      category: categories[3],
      tags: ['t5'],
      createdAt: new Date(now.getTime() - 86400000 * 5),
      updatedAt: new Date(now.getTime() - 86400000 * 2),
      unreadCount: 0,
      status: 'active',
      type: 'report',
    },
    {
      id: 'c5',
      title: '数据库检索 - 中草药',
      content: '检索到相关中草药成分156种...',
      category: categories[4],
      tags: ['t1'],
      createdAt: new Date(now.getTime() - 86400000 * 7),
      updatedAt: new Date(now.getTime() - 86400000 * 6),
      unreadCount: 0,
      status: 'active',
      type: 'search',
    },
    {
      id: 'c6',
      title: '儿童营养配方研发',
      content: '针对3-6岁儿童的营养补充配方...',
      category: categories[2],
      tags: ['t1', 't4'],
      createdAt: new Date(now.getTime() - 86400000 * 10),
      updatedAt: new Date(now.getTime() - 86400000 * 8),
      unreadCount: 5,
      status: 'active',
      type: 'formula',
    },
    {
      id: 'c7',
      title: '抗衰面霜配方讨论',
      content: '关于抗衰面霜的配方改进讨论...',
      category: categories[1],
      tags: ['t2', 't6'],
      createdAt: new Date(now.getTime() - 86400000 * 14),
      updatedAt: new Date(now.getTime() - 86400000 * 12),
      unreadCount: 0,
      status: 'active',
      type: 'chat',
    },
    {
      id: 'c8',
      title: '客户定制配方需求',
      content: '客户要求定制一款针对油性肌肤的控油配方...',
      category: categories[2],
      tags: ['t2', 't8'],
      createdAt: new Date(now.getTime() - 86400000 * 15),
      updatedAt: new Date(now.getTime() - 86400000 * 14),
      unreadCount: 2,
      status: 'active',
      type: 'formula',
    },
    {
      id: 'c9',
      title: '原料安全性评估报告',
      content: '新型原料的安全性评估报告...',
      category: categories[3],
      tags: ['t5'],
      createdAt: new Date(now.getTime() - 86400000 * 20),
      updatedAt: new Date(now.getTime() - 86400000 * 18),
      unreadCount: 0,
      status: 'archived',
      type: 'report',
    },
    {
      id: 'c10',
      title: '旧配方存档',
      content: '2023年度旧配方存档...',
      category: categories[2],
      tags: ['t7'],
      createdAt: new Date(now.getTime() - 86400000 * 30),
      updatedAt: new Date(now.getTime() - 86400000 * 28),
      unreadCount: 0,
      status: 'archived',
      type: 'formula',
    },
    {
      id: 'c11',
      title: '市场竞品分析',
      content: '针对市场上同类产品的竞品分析报告...',
      category: categories[3],
      tags: ['t5'],
      createdAt: new Date(now.getTime() - 86400000 * 45),
      updatedAt: new Date(now.getTime() - 86400000 * 40),
      unreadCount: 0,
      status: 'archived',
      type: 'report',
    },
    {
      id: 'c12',
      title: 'AI 生成的保湿配方',
      content: 'AI 自动生成的保湿配方建议...',
      category: categories[1],
      tags: ['t2', 't3'],
      createdAt: new Date(now.getTime() - 86400000 * 60),
      updatedAt: new Date(now.getTime() - 86400000 * 58),
      unreadCount: 0,
      status: 'archived',
      type: 'chat',
    },
  ]

  return conversations
}

export const mockConversations = generateConversations()

// ── 默认配置 ──
export const defaultConfig = {
  collapsible: true,
  defaultCollapsed: false,
  width: 280,
  collapsedWidth: 48,
  showTagFilter: true,
  showCategoryFilter: true,
  showSearch: true,
}

// ── 生成更多数据用于性能测试 ──
export const generateLargeDataset = (count = 1000): Conversation[] => {
  const now = new Date()
  const result: Conversation[] = []

  for (let i = 0; i < count; i++) {
    const statuses: ('active' | 'archived' | 'pinned')[] = ['active', 'archived', 'pinned']
    const types: ('chat' | 'formula' | 'report' | 'search')[] = ['chat', 'formula', 'report', 'search']

    result.push({
      id: `c_${i}`,
      title: `对话 ${i + 1}: ${['配方设计', 'AI对话', '学术报告', '数据检索'][i % 4]}`,
      content: `这是第 ${i + 1} 条对话的内容预览...`,
      category: categories[1 + (i % 4)],
      tags: tags.slice(0, Math.min(3, i % 5 + 1)).map(t => t.id),
      createdAt: new Date(now.getTime() - 86400000 * (i % 30)),
      updatedAt: new Date(now.getTime() - 3600000 * (i % 24)),
      unreadCount: i % 7 === 0 ? Math.floor(Math.random() * 5) : 0,
      status: statuses[Math.floor(Math.random() * 3)],
      type: types[i % 4],
    })
  }

  return result
}
