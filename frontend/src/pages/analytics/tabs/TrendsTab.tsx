/**
 * 趋势分析 Tab 组件
 * 提供时间序列数据分析、对比分析、预测功能
 */
import React, { useState } from 'react'
import {
  LineChart, TrendingUp, BarChart3,
  RefreshCw, Download, ArrowUpRight,
} from 'lucide-react'

interface FilterConfig {
  timeRange: '7d' | '30d' | '90d' | '1y'
  categories: string[]
  status: string[]
  users: string[]
}

type TrendView = 'time_series' | 'comparison' | 'forecast'

const TREND_VIEWS: { key: TrendView; label: string; icon: React.ElementType }[] = [
  { key: 'time_series', label: '时间序列', icon: LineChart },
  { key: 'comparison', label: '对比分析', icon: BarChart3 },
  { key: 'forecast', label: '趋势预测', icon: TrendingUp },
]

interface Props {
  filters: FilterConfig
}

export default function TrendsTab({ filters }: Props) {
  const [activeView, setActiveView] = useState<TrendView>('time_series')
  const [loading, setLoading] = useState(false)

  const handleRefresh = async () => {
    setLoading(true)
    // 模拟数据加载
    await new Promise(resolve => setTimeout(resolve, 1000))
    setLoading(false)
  }

  return (
    <div className="w-full space-y-6">
      {/* 视图切换工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-100/80 dark:bg-slate-800/80 rounded-lg p-0.5">
          {TREND_VIEWS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
                activeView === key
                  ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? '加载中...' : '刷新'}
          </button>
          <button className="px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            导出
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="min-h-[500px] bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
        {activeView === 'time_series' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <LineChart className="w-16 h-16 text-primary-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-text-primary">时间序列分析</h3>
              <p className="text-sm text-text-muted mt-2">查看数据随时间的变化趋势</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: '配方创建趋势', desc: '每日/每周/每月的配方创建数量变化', icon: LineChart },
                { title: '实验完成率', desc: '实验成功与失败的比例趋势', icon: TrendingUp },
                { title: '用户活跃度', desc: '用户登录和操作频率统计', icon: BarChart3 },
              ].map(({ title, desc, icon: Icon }) => (
                <div key={title} className="p-6 bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-950/20 dark:to-blue-950/20 rounded-xl border border-primary-100 dark:border-primary-900/30 hover:shadow-md transition-all cursor-pointer group">
                  <Icon className="w-10 h-10 text-primary-600 mb-3 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-text-primary mb-2">{title}</h4>
                  <p className="text-sm text-text-muted">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'comparison' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <BarChart3 className="w-16 h-16 text-blue-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-text-primary">对比分析</h3>
              <p className="text-sm text-text-muted mt-2">多维度数据对比和差异分析</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { title: '类别对比', desc: '不同产品类别的性能指标对比' },
                { title: '时间段对比', desc: '不同时间段的数据表现对比' },
                { title: '用户组对比', desc: '不同用户群体的行为模式对比' },
                { title: '状态对比', desc: '不同状态下的数据分布对比' },
              ].map(({ title, desc }) => (
                <div key={title} className="p-6 bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30 hover:shadow-md transition-all cursor-pointer">
                  <h4 className="font-bold text-text-primary mb-2">{title}</h4>
                  <p className="text-sm text-text-muted">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'forecast' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <TrendingUp className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-text-primary">趋势预测</h3>
              <p className="text-sm text-text-muted mt-2">基于历史数据的未来趋势预测</p>
            </div>

            <div className="bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-950/20 dark:to-cyan-950/20 rounded-xl p-8 border border-emerald-100 dark:border-emerald-900/30">
              <div className="max-w-2xl mx-auto text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-full mb-4">
                  <TrendingUp className="w-8 h-8 text-emerald-600" />
                </div>
                <h4 className="text-lg font-bold text-text-primary mb-2">AI 驱动的智能预测</h4>
                <p className="text-sm text-text-muted mb-6">
                  利用机器学习算法分析历史数据模式，提供未来趋势预测和异常检测预警
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-emerald-700 transition-colors">
                  启动预测模型
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
