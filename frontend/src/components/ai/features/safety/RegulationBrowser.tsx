import { useState, useMemo, useCallback } from 'react'
import { Card, Button, Badge, Input, Alert, Tooltip } from '@/components/ui'
import { useOperationFeedback } from '@/hooks/useOperationFeedback'
import Fuse from 'fuse.js'

interface Region {
  id: string
  name: string
  flag: string
  standards: string[]
}

interface RegulationCategory {
  id: string
  name: string
  description: string
}

interface LimitRequirement {
  substanceName: string
  maxUsage: string
  conditions?: string
  remarks?: string
}

interface RegulationDetail {
  id: string
  number: string
  fullName: string
  region: string
  category: string
  issuingAgency: string
  effectiveDate: string
  lastRevised: string
  status: 'active' | 'pending_update' | 'deprecated' | 'new'
  scope: string
  limits: LimitRequirement[]
  testMethods: string[]
  exceptions: string[]
  relatedRegulations: string[]
  versionHistory: {
    version: string
    date: string
    changes: string[]
  }[]
  pdfUrl?: string
}

interface RegulationUpdate {
  id: string
  regulationId: string
  regulationName: string
  summary: string
  effectiveDate: string
  isRead: boolean
  createdAt: number
}

interface ComplianceIndicatorProps {
  regulationId: string
  status: 'compliant' | 'pending' | 'non_compliant'
  summary?: string
  onClick?: () => void
}

interface RegulationBrowserProps {
  regulations?: RegulationDetail[]
  updates?: RegulationUpdate[]
  onRegulationSelect?: (regulation: RegulationDetail) => void
  onUpdateMarkRead?: (updateIds: string[]) => void
  className?: string
}

const REGIONS: Region[] = [
  { id: 'cn', name: '中国', flag: '🇨🇳', standards: ['GB 标准', 'GB/T 标准', 'NY/T 标准'] },
  { id: 'us', name: '美国', flag: '🇺🇸', standards: ['FDA GRAS', 'CFR 21', 'FDA Guidance'] },
  { id: 'eu', name: '欧盟', flag: '🇪🇺', standards: ['EFSA', 'REACH', 'EC No'] },
  { id: 'jp', name: '日本', flag: '🇯🇵', standards: ['厚生省告示', 'JIS 标准', '食品卫生法'] },
  { id: 'kr', name: '韩国', flag: '🇰🇷', standards: ['KFDA', '食品公典', 'KFDA 告示'] },
  { id: 'international', name: '国际标准', flag: '🌐', standards: ['ISO', 'Codex Alimentarius', 'WHO/FAO'] },
]

const CATEGORIES: RegulationCategory[] = [
  { id: 'food_additives', name: '食品添加剂限量标准', description: '各类食品添加剂的最大使用量及限制条件' },
  { id: 'contact_materials', name: '食品接触材料标准', description: '包装材料、容器等的迁移限量要求' },
  { id: 'cosmetics', name: '化妆品原料标准', description: '化妆品禁限用物质清单及要求' },
  { id: 'medicine_food', name: '药食同源物质标准', description: '既是食品又是中药材的物质目录' },
  { id: 'pesticide_residue', name: '农药残留限量', description: '农产品中农药最大残留限量' },
  { id: 'microbial_limits', name: '微生物限度标准', description: '食品中微生物指标及检验方法' },
]

const MOCK_REGULATIONS: RegulationDetail[] = [
  {
    id: '1',
    number: 'GB 2760-2014',
    fullName: '食品安全国家标准 食品添加剂使用标准',
    region: 'cn',
    category: 'food_additives',
    issuingAgency: '国家卫生健康委员会',
    effectiveDate: '2015-05-24',
    lastRevised: '2014-12-24',
    status: 'active',
    scope: '适用于各类食品中食品添加剂的使用',
    limits: [
      { substanceName: '苯甲酸', maxUsage: '0.2-1.0 g/kg', conditions: '按生产需要适量使用', remarks: '以苯甲酸计' },
      { substanceName: '山梨酸', maxUsage: '0.075-2.0 g/kg', conditions: '按生产需要适量使用', remarks: '以山梨酸计' },
    ],
    testMethods: ['GB/T 5009.29', 'GB/T 23495'],
    exceptions: [],
    relatedRegulations: ['GB 14880', 'GB 7718'],
    versionHistory: [
      { version: '2014版', date: '2014-12-24', changes: ['新增部分添加剂品种', '调整部分使用范围'] },
    ],
  },
  {
    id: '2',
    number: '21 CFR 184.1664',
    fullName: 'Affirmation of GRAS Status of Total Carotenoid Extract',
    region: 'us',
    category: 'food_additives',
    issuingAgency: 'U.S. Food and Drug Administration',
    effectiveDate: '2003-10-08',
    lastRevised: '2003-09-18',
    status: 'active',
    scope: 'Food additive as a color additive in foods',
    limits: [
      { substanceName: 'Total Carotenoid Extract', maxUsage: 'GMP', conditions: 'Good Manufacturing Practice', remarks: '' },
    ],
    testMethods: ['FDA Analytical Methods'],
    exceptions: [],
    relatedRegulations: ['21 CFR 73', '21 CFR 70'],
    versionHistory: [],
  },
  {
    id: '3',
    number: 'Regulation (EU) No 1333/2008',
    fullName: 'Food Additives - European Parliament and Council',
    region: 'eu',
    category: 'food_additives',
    issuingAgency: 'European Commission',
    effectiveDate: '2009-01-20',
    lastRevised: '2023-01-15',
    status: 'active',
    scope: 'Food additives authorized for use in foods in the EU',
    limits: [
      { substanceName: 'E210 (Benzoic acid)', maxUsage: 'As specified', conditions: 'Annex II', remarks: '' },
    ],
    testMethods: ['EN 12856', 'ISO 11063'],
    exceptions: [],
    relatedRegulations: ['Regulation (EC) No 1935/2004', 'Regulation (EU) No 1169/2011'],
    versionHistory: [
      { version: '2023 Amendment', date: '2023-01-15', changes: ['Updated Annex II with new additives'] },
    ],
  },
]

const MOCK_UPDATES: RegulationUpdate[] = [
  {
    id: 'u1',
    regulationId: '1',
    regulationName: 'GB 2760-2014 拟修订',
    summary: '新增 5 种食品添加剂，调整 12 种添加剂的使用范围和限量',
    effectiveDate: '2026-06-01',
    isRead: false,
    createdAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'u2',
    regulationId: '3',
    regulationName: 'EU No 1333/2008 更新通知',
    summary: '更新附录II，新增天然色素使用规定',
    effectiveDate: '2026-05-20',
    isRead: false,
    createdAt: Date.now() - 86400000 * 2,
  },
]

function ComplianceIndicator({ status, summary, onClick }: ComplianceIndicatorProps) {
  const config = {
    compliant: { icon: '✅', color: 'text-success-600', bg: 'bg-success-100', label: '已通过' },
    pending: { icon: '⏳', color: 'text-yellow-600', bg: 'bg-yellow-100', label: '待审核' },
    non_compliant: { icon: '❌', color: 'text-error-600', bg: 'bg-error-100', label: '不合规' },
  }

  const currentConfig = config[status]

  return (
    <Tooltip content={summary || currentConfig.label} position="top">
      <div
        onClick={onClick}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${currentConfig.bg} ${currentConfig.color}`}
      >
        <span>{currentConfig.icon}</span>
        <span>{currentConfig.label}</span>
      </div>
    </Tooltip>
  )
}

export function RegulationBrowser({
  regulations = MOCK_REGULATIONS,
  updates = MOCK_UPDATES,
  onRegulationSelect,
  onUpdateMarkRead,
  className = '',
}: RegulationBrowserProps) {
  const [selectedRegion, setSelectedRegion] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRegulation, setSelectedRegulation] = useState<RegulationDetail | null>(null)
  const [showUpdatesPanel, setShowUpdatesPanel] = useState(false)
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'region'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const feedback = useOperationFeedback()

  const fuse = useMemo(() => new Fuse(regulations, {
    keys: ['number', 'fullName', 'scope', 'issuingAgency'],
    threshold: 0.3,
    includeScore: true,
  }), [regulations])

  const filteredRegulations = useMemo(() => {
    let result = regulations

    if (selectedRegion !== 'all') {
      result = result.filter(r => r.region === selectedRegion)
    }

    if (selectedCategory !== 'all') {
      result = result.filter(r => r.category === selectedCategory)
    }

    if (searchQuery.trim()) {
      const searchResults = fuse.search(searchQuery.trim())
      result = searchResults.map(result => result.item)
    }

    result = [...result].sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'date':
          comparison = new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime()
          break
        case 'name':
          comparison = a.number.localeCompare(b.number)
          break
        case 'region':
          comparison = a.region.localeCompare(b.region)
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [regulations, selectedRegion, selectedCategory, searchQuery, sortBy, sortOrder, fuse])

  const unreadUpdatesCount = useMemo(
    () => updates.filter(u => !u.isRead).length,
    [updates],
  )

  const handleMarkAllAsRead = useCallback(() => {
    const unreadIds = updates.filter(u => !u.isRead).map(u => u.id)
    onUpdateMarkRead?.(unreadIds)
    feedback.showSuccess('已标记', `${unreadIds.length} 条更新已标记为已读`)
  }, [updates, onUpdateMarkRead, feedback])

  const handleDownloadPDF = useCallback((regulation: RegulationDetail) => {
    if (regulation.pdfUrl) {
      window.open(regulation.pdfUrl, '_blank')
      feedback.showInfo('下载开始', `正在下载 ${regulation.number}`)
    } else {
      feedback.showWarning('暂无文件', '该法规的 PDF 文件暂未上传')
    }
  }, [feedback])

  const getStatusBadge = (status: RegulationDetail['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">✅ 有效</Badge>
      case 'pending_update':
        return <Badge variant="warning">⚠️ 待更新</Badge>
      case 'deprecated':
        return <Badge variant="neutral" className="line-through">❌ 已废止</Badge>
      case 'new':
        return <Badge variant="info">🆕 新增</Badge>
      default:
        return null
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            📚 法规浏览器
          </h2>

          <div className="relative">
            <button
              onClick={() => setShowUpdatesPanel(!showUpdatesPanel)}
              className="relative p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              🔔
              {unreadUpdatesCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-error-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {unreadUpdatesCount}
                </span>
              )}
            </button>

            {showUpdatesPanel && (
              <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                  <h3 className="font-semibold">法规更新通知</h3>
                  <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead}>
                    全部标记已读
                  </Button>
                </div>

                <div className="overflow-y-auto max-h-80">
                  {updates.length > 0 ? (
                    updates.map(update => (
                      <div
                        key={update.id}
                        className={`p-4 border-b border-neutral-100 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800 cursor-pointer ${
                          !update.isRead ? 'bg-secondary-50 dark:bg-secondary-900/10' : ''
                        }`}
                        onClick={() => {
                          onUpdateMarkRead?.([update.id])
                          const reg = regulations.find(r => r.id === update.regulationId)
                          if (reg) {
                            setSelectedRegulation(reg)
                            onRegulationSelect?.(reg)
                          }
                          setShowUpdatesPanel(false)
                        }}
                      >
                        <div className="flex items-start gap-2">
                          {!update.isRead && (
                            <span className="w-2 h-2 bg-secondary-500 rounded-full mt-2 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm text-neutral-900 dark:text-neutral-100 truncate">
                              {update.regulationName}
                            </h4>
                            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2">
                              {update.summary}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500">
                              <span>生效日期: {update.effectiveDate}</span>
                              <span>•</span>
                              <span>{Math.floor((Date.now() - update.createdAt) / 86400000)} 天前</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-neutral-500">
                      暂无更新通知
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                地区筛选
              </label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
              >
                <option value="all">全部地区</option>
                {REGIONS.map(region => (
                  <option key={region.id} value={region.id}>
                    {region.flag} {region.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                类型筛选
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
              >
                <option value="all">全部类型</option>
                {CATEGORIES.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                搜索
              </label>
              <Input
                placeholder="搜索法规编号、名称、CAS号..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <h4 className="text-xs font-semibold text-neutral-500 mb-2">快捷统计</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-600">有效法规:</span>
                  <span className="font-medium">{regulations.filter(r => r.status === 'active').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">待更新:</span>
                  <span className="font-medium text-yellow-600">{regulations.filter(r => r.status === 'pending_update').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">新增:</span>
                  <span className="font-medium text-secondary-600">{regulations.filter(r => r.status === 'new').length}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {!selectedRegulation ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    共找到 {filteredRegulations.length} 条法规
                  </p>
                  <div className="flex gap-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                      className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-600 rounded"
                    >
                      <option value="date">按生效日期</option>
                      <option value="name">按编号</option>
                      <option value="region">按地区</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                      className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-600 rounded hover:bg-slate-50"
                    >
                      {sortOrder === 'asc' ? '↑ 升序' : '↓ 降序'}
                    </button>
                  </div>
                </div>

                <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-neutral-800">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300">法规编号</th>
                        <th className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300">名称</th>
                        <th className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300">地区</th>
                        <th className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300">生效日期</th>
                        <th className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300">状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {filteredRegulations.map(regulation => (
                        <tr
                          key={regulation.id}
                          className="hover:bg-slate-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedRegulation(regulation)
                            onRegulationSelect?.(regulation)
                          }}
                        >
                          <td className="px-4 py-3 font-mono text-secondary-600 dark:text-secondary-400">
                            {regulation.number}
                          </td>
                          <td className="px-4 py-3 max-w-xs truncate" title={regulation.fullName}>
                            {regulation.fullName.length > 40
                              ? regulation.fullName.substring(0, 40) + '...'
                              : regulation.fullName
                            }
                          </td>
                          <td className="px-4 py-3">
                            {REGIONS.find(r => r.id === regulation.region)?.flag || ''} {REGIONS.find(r => r.id === regulation.region)?.name || ''}
                          </td>
                          <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                            {regulation.effectiveDate}
                          </td>
                          <td className="px-4 py-3">
                            {getStatusBadge(regulation.status)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredRegulations.length === 0 && (
                    <div className="p-12 text-center text-neutral-500">
                      未找到匹配的法规，请调整筛选条件或搜索关键词
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedRegulation(null)}
                  >
                    ← 返回列表
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownloadPDF(selectedRegulation)}
                    >
                      📥 下载 PDF
                    </Button>
                  </div>
                </div>

                <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-6 space-y-6">
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                          {selectedRegulation.fullName}
                        </h3>
                        <p className="text-lg font-mono text-secondary-600 dark:text-secondary-400 mt-1">
                          {selectedRegulation.number}
                        </p>
                      </div>
                      {getStatusBadge(selectedRegulation.status)}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg">
                      <div>
                        <p className="text-xs text-neutral-500">发布机构</p>
                        <p className="text-sm font-medium mt-1">{selectedRegulation.issuingAgency}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">生效日期</p>
                        <p className="text-sm font-medium mt-1">{selectedRegulation.effectiveDate}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">最新修订</p>
                        <p className="text-sm font-medium mt-1">{selectedRegulation.lastRevised}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">适用范围</p>
                        <p className="text-sm font-medium mt-1 line-clamp-2">{selectedRegulation.scope}</p>
                      </div>
                    </div>
                  </div>

                  {selectedRegulation.limits.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                        📋 限量要求
                      </h4>
                      <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 dark:bg-neutral-800">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium">物质名称</th>
                              <th className="px-4 py-2 text-left font-medium">最大使用量</th>
                              <th className="px-4 py-2 text-left font-medium">限制条件</th>
                              <th className="px-4 py-2 text-left font-medium">备注</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {selectedRegulation.limits.map((limit, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-2 font-medium">{limit.substanceName}</td>
                                <td className="px-4 py-2">{limit.maxUsage}</td>
                                <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{limit.conditions || '-'}</td>
                                <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{limit.remarks || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {selectedRegulation.testMethods.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                        🔬 检测方法参考
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedRegulation.testMethods.map((method, idx) => (
                          <Badge key={idx} variant="neutral">{method}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedRegulation.exceptions.length > 0 && (
                    <Alert variant="warning">
                      <p className="font-medium">⚠️ 例外情况说明</p>
                      <ul className="mt-2 list-disc list-inside text-sm space-y-1">
                        {selectedRegulation.exceptions.map((exception: string, idx: number) => (
                          <li key={idx}>{exception}</li>
                        ))}
                      </ul>
                    </Alert>
                  )}

                  {selectedRegulation.relatedRegulations.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                        🔗 相关法规链接
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedRegulation.relatedRegulations.map((relatedId, idx) => {
                          const relatedReg = regulations.find(r => r.number === relatedId)
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                if (relatedReg) {
                                  setSelectedRegulation(relatedReg)
                                  onRegulationSelect?.(relatedReg)
                                }
                              }}
                              className="px-3 py-1 text-sm text-secondary-600 dark:text-secondary-400 border border-blue-300 dark:border-blue-700 rounded hover:bg-secondary-50 dark:hover:bg-secondary-900/20 transition-colors"
                            >
                              {relatedId}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {selectedRegulation.versionHistory.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                        📜 历史版本对比
                      </h4>
                      <div className="space-y-3">
                        {selectedRegulation.versionHistory.map((version, idx) => (
                          <div key={idx} className="p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">{version.version}</span>
                              <span className="text-xs text-neutral-500">{version.date}</span>
                            </div>
                            <ul className="list-disc list-inside text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
                              {version.changes.map((change, changeIdx) => (
                                <li key={changeIdx}>{change}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

export type {
  RegulationBrowserProps,
  RegulationDetail,
  Region,
  RegulationCategory,
  LimitRequirement,
  RegulationUpdate,
  ComplianceIndicatorProps,
}
