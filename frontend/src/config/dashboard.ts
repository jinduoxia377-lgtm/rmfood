import { logger } from '@/utils/safeLogger';

/**
 * 仪表盘配置管理系统
 * 支持个性化配置、布局管理、多视图切换
 */

export interface CardConfig {
  id: string;
  type: CardType;
  title: string;
  description?: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
  isVisible: boolean;
  theme?: 'light' | 'dark' | 'system';
  config?: Record<string, unknown>;
}

export type CardType =
  | 'stats-formulas'
  | 'stats-experiments'
  | 'stats-in-progress'
  | 'stats-completed'
  | 'chart-trends'
  | 'chart-formula-pie'
  | 'chart-experiment-bar'
  | 'quick-actions'
  | 'recent-formulas'
  | 'recent-experiments'
  | 'todos'
  | 'review-queue'
  | 'activity-timeline'
  | 'kpi-dashboard'
  | 'team-activity'
  | 'ai-insights'
  | 'ai-analysis'
  | 'websocket-status'
  | 'real-time-sync'
  | 'team-dashboard-share'
  | 'team-online-status'
  | 'change-history'
  | 'template-manager'
  | 'export-manager'
  | 'api-integration'

export type AccessLevel = 'view' | 'edit' | 'admin'

export interface DashboardShare {
  id: string;
  dashboardId: string;
  userId: string;
  userEmail: string;
  userName: string;
  accessLevel: AccessLevel;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardLayout {
  id: string;
  name: string;
  isDefault: boolean;
  cards: CardConfig[];
  createdAt: string;
  updatedAt: string;
  // 共享相关字段
  isShared: boolean;
  ownerId: string;
  ownerName: string;
  shares: DashboardShare[];
  lastModifiedBy: string;
  lastModifiedAt: string;
}

export const DEFAULT_CARDS: CardConfig[] = [
  { id: 'c1', type: 'stats-formulas', title: '配方总数', position: { x: 0, y: 0 }, size: { w: 1, h: 1 }, isVisible: true },
  { id: 'c2', type: 'stats-experiments', title: '实验总数', position: { x: 1, y: 0 }, size: { w: 1, h: 1 }, isVisible: true },
  { id: 'c3', type: 'stats-in-progress', title: '进行中实验', position: { x: 2, y: 0 }, size: { w: 1, h: 1 }, isVisible: true },
  { id: 'c4', type: 'stats-completed', title: '完成实验', position: { x: 3, y: 0 }, size: { w: 1, h: 1 }, isVisible: true },
  { id: 'c5', type: 'chart-trends', title: '研发趋势', position: { x: 0, y: 1 }, size: { w: 2, h: 1 }, isVisible: true },
  { id: 'c6', type: 'chart-formula-pie', title: '配方状态分布', position: { x: 2, y: 1 }, size: { w: 1, h: 1 }, isVisible: true },
  { id: 'c7', type: 'chart-experiment-bar', title: '实验状态统计', position: { x: 3, y: 1 }, size: { w: 1, h: 1 }, isVisible: true },
  { id: 'c8', type: 'quick-actions', title: '快捷操作', position: { x: 1, y: 2 }, size: { w: 1, h: 1 }, isVisible: true },
  { id: 'c9', type: 'recent-formulas', title: '最近配方', position: { x: 0, y: 3 }, size: { w: 1, h: 1 }, isVisible: true },
  { id: 'c10', type: 'recent-experiments', title: '最近实验', position: { x: 1, y: 3 }, size: { w: 1, h: 1 }, isVisible: true },
  { id: 'c11', type: 'todos', title: '待办事项', position: { x: 0, y: 4 }, size: { w: 1, h: 1 }, isVisible: true },
  { id: 'c12', type: 'review-queue', title: '待审核配方', position: { x: 1, y: 4 }, size: { w: 1, h: 1 }, isVisible: true },
  { id: 'c13', type: 'activity-timeline', title: '最近动态', position: { x: 2, y: 4 }, size: { w: 1, h: 1 }, isVisible: true },
  { id: 'c14', type: 'ai-analysis', title: 'AI分析面板', position: { x: 0, y: 2 }, size: { w: 2, h: 1 }, isVisible: false },
]

export const DEFAULT_LAYOUT: DashboardLayout = {
  id: 'default',
  name: '默认视图',
  isDefault: true,
  cards: DEFAULT_CARDS,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  // 共享相关字段
  isShared: false,
  ownerId: 'current-user',
  ownerName: '当前用户',
  shares: [],
  lastModifiedBy: 'current-user',
  lastModifiedAt: new Date().toISOString(),
}

export const CARD_CATALOG = {
  default: [
    { type: 'stats-formulas' as const, name: '配方总数', description: '显示所有配方的总数', icon: 'FlaskConical' },
    { type: 'stats-experiments' as const, name: '实验总数', description: '显示所有实验的总数', icon: 'TestTubes' },
    { type: 'stats-in-progress' as const, name: '进行中实验', description: '显示当前进行中的实验', icon: 'TrendingUp' },
    { type: 'stats-completed' as const, name: '完成实验', description: '显示已完成的实验数量', icon: 'CheckCircle2' },
    { type: 'chart-trends' as const, name: '研发趋势', description: '显示配方和实验的时间趋势', icon: 'BarChart3' },
    { type: 'chart-formula-pie' as const, name: '配方状态分布', description: '饼图展示各状态配方占比', icon: 'PieChart' },
    { type: 'chart-experiment-bar' as const, name: '实验状态统计', description: '条形图展示各状态实验数量', icon: 'BarChart2' },
    { type: 'quick-actions' as const, name: '快捷操作', description: '常用功能快捷入口', icon: 'Plus' },
    { type: 'recent-formulas' as const, name: '最近配方', description: '显示最近创建或更新的配方', icon: 'Clock' },
    { type: 'recent-experiments' as const, name: '最近实验', description: '显示最近创建或更新的实验', icon: 'Activity' },
    { type: 'todos' as const, name: '待办事项', description: '显示待处理的任务清单', icon: 'ClipboardList' },
    { type: 'review-queue' as const, name: '待审核配方', description: '显示需要审核的配方', icon: 'AlertTriangle' },
    { type: 'activity-timeline' as const, name: '最近动态', description: '显示系统活动时间线', icon: 'History' },
  ],
  premium: [
    { type: 'kpi-dashboard' as const, name: 'KPI监控面板', description: '关键绩效指标实时监控', icon: 'Target' },
    { type: 'team-activity' as const, name: '团队活动', description: '团队成员协作活动展示', icon: 'Users' },
    { type: 'ai-insights' as const, name: 'AI智能洞察', description: '基于数据的智能分析与建议', icon: 'Brain' },
    { type: 'websocket-status' as const, name: 'WebSocket状态', description: '实时连接状态监控', icon: 'Socket' },
    { type: 'real-time-sync' as const, name: '实时数据同步', description: '数据变更实时同步演示', icon: 'RefreshCw' },
    { type: 'team-dashboard-share' as const, name: '团队共享管理', description: '管理仪表板共享和权限', icon: 'Share2' },
    { type: 'team-online-status' as const, name: '团队在线状态', description: '显示实时在线协作者', icon: 'Users' },
    { type: 'change-history' as const, name: '变更历史', description: '记录所有修改操作', icon: 'History' },
    { type: 'template-manager' as const, name: '模板管理', description: '导入/导出仪表板模板', icon: 'FileText' },
    { type: 'export-manager' as const, name: '数据导出', description: '多格式数据导出管理', icon: 'Download' },
    { type: 'api-integration' as const, name: 'API集成', description: '第三方服务集成管理', icon: 'Settings' },
    { type: 'ai-analysis' as const, name: 'AI分析面板', description: '配方智能分析与推荐', icon: 'Brain' },
  ],
}

class DashboardConfigManager {
  private static STORAGE_KEY = 'rmfood_dashboard_configs'
  private static CURRENT_LAYOUT_KEY = 'rmfood_current_layout'

  static getAllLayouts(): DashboardLayout[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) {
        return [DEFAULT_LAYOUT]
      }
      const layouts = JSON.parse(stored)
      if (!Array.isArray(layouts)) {
        return [DEFAULT_LAYOUT]
      }
      // 确保所有布局都有共享相关的字段
      return layouts.map((layout: any) => {
        // 确保layout是对象
        if (typeof layout !== 'object' || layout === null) {
          return DEFAULT_LAYOUT
        }
        return {
          ...DEFAULT_LAYOUT,
          ...layout,
          // 确保共享相关字段存在
          isShared: Boolean(layout.isShared),
          ownerId: String(layout.ownerId || 'current-user'),
          ownerName: String(layout.ownerName || '当前用户'),
          shares: Array.isArray(layout.shares) ? layout.shares : [],
          lastModifiedBy: String(layout.lastModifiedBy || 'current-user'),
          lastModifiedAt: String(layout.lastModifiedAt || new Date().toISOString()),
          // 确保cards是数组
          cards: Array.isArray(layout.cards) ? layout.cards.map((card: any) => {
            if (typeof card !== 'object' || card === null) {
              return { id: `card-${Date.now()}`, type: 'stats-formulas', title: '配方总数', position: { x: 0, y: 0 }, size: { w: 1, h: 1 }, isVisible: true }
            }
            const allCardTypes = [...CARD_CATALOG.default, ...CARD_CATALOG.premium]
            const validType = allCardTypes.some(c => c.type === card.type) ? card.type : 'stats-formulas'
            const validTheme = typeof card.theme === 'string' && ['light', 'dark', 'system'].includes(card.theme) ? card.theme : undefined
            return {
              id: String(card.id || `card-${Date.now()}`),
              type: validType,
              title: String(card.title || '配方总数'),
              description: card.description ? String(card.description) : undefined,
              position: typeof card.position === 'object' && card.position !== null ? { x: Number(card.position.x || 0), y: Number(card.position.y || 0) } : { x: 0, y: 0 },
              size: typeof card.size === 'object' && card.size !== null ? { w: Number(card.size.w || 1), h: Number(card.size.h || 1) } : { w: 1, h: 1 },
              isVisible: Boolean(card.isVisible),
              theme: validTheme,
              config: typeof card.config === 'object' && card.config !== null ? card.config : undefined,
            }
          }) : DEFAULT_CARDS,
        }
      })
    } catch {
      return [DEFAULT_LAYOUT]
    }
  }

  static getCurrentLayout(): DashboardLayout {
    try {
      const all = this.getAllLayouts()
      const currentId = localStorage.getItem(this.CURRENT_LAYOUT_KEY)
      if (currentId && typeof currentId === 'string') {
        const found = all.find(l => l.id === currentId)
        if (found) return found
      }
      const defaultLayout = all.find(l => l.isDefault)
      return defaultLayout || DEFAULT_LAYOUT
    } catch {
      return DEFAULT_LAYOUT
    }
  }

  static saveLayout(layout: DashboardLayout): void {
    try {
      const all = this.getAllLayouts()
      const index = all.findIndex(l => l.id === layout.id)

      // 确保layout对象有效
      const validLayout: DashboardLayout = {
        id: String(layout.id),
        name: String(layout.name),
        isDefault: Boolean(layout.isDefault),
        cards: Array.isArray(layout.cards) ? layout.cards.map(card => {
          const allCardTypes = [...CARD_CATALOG.default, ...CARD_CATALOG.premium]
          const validType = allCardTypes.some(c => c.type === card.type) ? card.type : 'stats-formulas'
          const validTheme = typeof card.theme === 'string' && ['light', 'dark', 'system'].includes(card.theme) ? card.theme : undefined
          return {
            id: String(card.id),
            type: validType,
            title: String(card.title),
            description: card.description ? String(card.description) : undefined,
            position: typeof card.position === 'object' && card.position !== null ? { x: Number(card.position.x), y: Number(card.position.y) } : { x: 0, y: 0 },
            size: typeof card.size === 'object' && card.size !== null ? { w: Number(card.size.w), h: Number(card.size.h) } : { w: 1, h: 1 },
            isVisible: Boolean(card.isVisible),
            theme: validTheme,
            config: typeof card.config === 'object' && card.config !== null ? card.config : undefined,
          }
        }) : [],
        createdAt: String(layout.createdAt || new Date().toISOString()),
        updatedAt: new Date().toISOString(),
        isShared: Boolean(layout.isShared),
        ownerId: String(layout.ownerId || 'current-user'),
        ownerName: String(layout.ownerName || '当前用户'),
        shares: Array.isArray(layout.shares) ? layout.shares : [],
        lastModifiedBy: String(layout.lastModifiedBy || 'current-user'),
        lastModifiedAt: new Date().toISOString(),
      }

      if (index >= 0) {
        all[index] = validLayout
      } else {
        all.push(validLayout)
      }

      if (validLayout.isDefault) {
        all.forEach(l => {
          if (l.id !== validLayout.id) l.isDefault = false
        })
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all))
    } catch (e) {
      logger.error('Failed to save dashboard layout:', e)
    }
  }

  static switchLayout(layoutId: string): void {
    localStorage.setItem(this.CURRENT_LAYOUT_KEY, layoutId)
  }

  static createLayout(name: string, cards?: CardConfig[]): DashboardLayout {
    const newLayout: DashboardLayout = {
      id: `layout_${Date.now()}`,
      name,
      isDefault: false,
      cards: cards || [...DEFAULT_CARDS],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // 共享相关字段
      isShared: false,
      ownerId: 'current-user',
      ownerName: '当前用户',
      shares: [],
      lastModifiedBy: 'current-user',
      lastModifiedAt: new Date().toISOString(),
    }
    this.saveLayout(newLayout)
    return newLayout
  }

  static deleteLayout(layoutId: string): void {
    if (layoutId === 'default') return
    try {
      const all = this.getAllLayouts()
      const filtered = all.filter(l => l.id !== layoutId)
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered))

      const currentId = localStorage.getItem(this.CURRENT_LAYOUT_KEY)
      if (currentId === layoutId) {
        localStorage.removeItem(this.CURRENT_LAYOUT_KEY)
      }
    } catch (e) {
      logger.error('Failed to delete dashboard layout:', e)
    }
  }

  static exportLayouts(): string {
    const layouts = this.getAllLayouts()
    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      layouts,
    })
  }

  static importLayouts(data: string): boolean {
    try {
      const parsed = JSON.parse(data)
      if (!parsed.layouts || !Array.isArray(parsed.layouts)) {
        return false
      }
      const existing = this.getAllLayouts()
      const existingIds = new Set(existing.map(l => l.id))
      const newLayouts = parsed.layouts.map((l: DashboardLayout) => {
        if (existingIds.has(l.id)) {
          return {
            ...l,
            id: `imported_${Date.now()}_${l.id}`,
            // 确保共享相关字段存在
            isShared: l.isShared || false,
            ownerId: l.ownerId || 'current-user',
            ownerName: l.ownerName || '当前用户',
            shares: l.shares || [],
            lastModifiedBy: l.lastModifiedBy || 'current-user',
            lastModifiedAt: l.lastModifiedAt || new Date().toISOString(),
          }
        }
        return l
      })
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify([...existing, ...newLayouts]))
      return true
    } catch {
      return false
    }
  }

  // 共享相关方法
  static shareDashboard(dashboardId: string, userId: string, userEmail: string, userName: string, accessLevel: AccessLevel): void {
    try {
      const layouts = this.getAllLayouts()
      const dashboardIndex = layouts.findIndex(l => l.id === dashboardId)
      if (dashboardIndex >= 0) {
        const dashboard = layouts[dashboardIndex]
        const existingShareIndex = dashboard.shares.findIndex(s => s.userId === userId)

        if (existingShareIndex >= 0) {
          // 更新现有共享
          const existing = dashboard.shares[existingShareIndex]
          dashboard.shares[existingShareIndex] = {
            id: existing.id ?? crypto.randomUUID(),
            dashboardId: existing.dashboardId,
            userId: existing.userId,
            userEmail: existing.userEmail ?? '',
            userName: existing.userName ?? '',
            accessLevel,
            createdAt: existing.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } satisfies DashboardShare
        } else {
          // 添加新共享
          const newShare: DashboardShare = {
            id: `share_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            dashboardId: dashboardId ?? '',
            userId: userId ?? '',
            userEmail,
            userName,
            accessLevel,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          dashboard.shares.push(newShare)
        }

        dashboard.isShared = true
        dashboard.updatedAt = new Date().toISOString()
        dashboard.lastModifiedAt = new Date().toISOString()

        layouts[dashboardIndex] = dashboard
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(layouts))
      }
    } catch (error) {
      logger.error('Error sharing dashboard:', error)
    }
  }

  static removeShare(dashboardId: string, shareId: string): void {
    try {
      const layouts = this.getAllLayouts()
      const dashboardIndex = layouts.findIndex(l => l.id === dashboardId)
      if (dashboardIndex >= 0) {
        const dashboard = layouts[dashboardIndex]
        dashboard.shares = dashboard.shares.filter(s => s.id !== shareId)
        dashboard.isShared = dashboard.shares.length > 0
        dashboard.updatedAt = new Date().toISOString()
        dashboard.lastModifiedAt = new Date().toISOString()

        layouts[dashboardIndex] = dashboard
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(layouts))
      }
    } catch (error) {
      logger.error('Error removing share:', error)
    }
  }

  static getSharedDashboards(): DashboardLayout[] {
    try {
      const layouts = this.getAllLayouts()
      return layouts.filter(layout => layout.isShared)
    } catch (error) {
      logger.error('Error getting shared dashboards:', error)
      return []
    }
  }

  static getDashboardByUserId(userId: string): DashboardLayout[] {
    try {
      const layouts = this.getAllLayouts()
      return layouts.filter(layout =>
        layout.ownerId === userId ||
        layout.shares.some(share => share.userId === userId),
      )
    } catch (error) {
      logger.error('Error getting dashboards by user:', error)
      return []
    }
  }

  static updateShareAccess(dashboardId: string, shareId: string, accessLevel: AccessLevel): void {
    try {
      const layouts = this.getAllLayouts()
      const dashboardIndex = layouts.findIndex(l => l.id === dashboardId)
      if (dashboardIndex >= 0) {
        const dashboard = layouts[dashboardIndex]
        const shareIndex = dashboard.shares.findIndex(s => s.id === shareId)
        if (shareIndex >= 0) {
          const existing = dashboard.shares[shareIndex]
          dashboard.shares[shareIndex] = {
            id: existing.id ?? crypto.randomUUID(),
            dashboardId: existing.dashboardId,
            userId: existing.userId,
            userEmail: existing.userEmail ?? '',
            userName: existing.userName ?? '',
            accessLevel,
            createdAt: existing.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } satisfies DashboardShare
          dashboard.updatedAt = new Date().toISOString()
          dashboard.lastModifiedAt = new Date().toISOString()

          layouts[dashboardIndex] = dashboard
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(layouts))
        }
      }
    } catch (error) {
      logger.error('Error updating share access:', error)
    }
  }
}

export default DashboardConfigManager
