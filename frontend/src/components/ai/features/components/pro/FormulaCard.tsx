/**
 * FormulaCard — 配方交互卡片
 *
 * 当 AI 回复包含配方时，渲染为结构化卡片：
 * - 君臣佐使结构可视化
 * - 原料用量表格
 * - 功效标签
 * - 一键保存/导出/优化
 */
import React, { useState } from 'react'
import { Crown, Shield, Hand, Handshake, Download, Save, Plus, ChevronDown, ChevronUp } from 'lucide-react'

export interface FormulaIngredient {
  name: string
  dosage: string
  role: '君' | '臣' | '佐' | '使'
  purpose: string
}

export interface FormulaData {
  name: string
  description: string
  ingredients: FormulaIngredient[]
  effects: string[]
  usage?: string
  precautions?: string[]
}

const ROLE_CONFIG = {
  '君': { icon: Crown, label: '君药', color: 'text-error-600', bg: 'bg-error-50 dark:bg-error-900/20', border: 'border-red-200 dark:border-red-800' },
  '臣': { icon: Shield, label: '臣药', color: 'text-secondary-600', bg: 'bg-secondary-50 dark:bg-secondary-900/20', border: 'border-blue-200 dark:border-blue-800' },
  '佐': { icon: Hand, label: '佐药', color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20', border: 'border-emerald-200 dark:border-emerald-800' },
  '使': { icon: Handshake, label: '使药', color: 'text-accent-600', bg: 'bg-accent-50 dark:bg-accent-900/20', border: 'border-purple-200 dark:border-purple-800' },
}

export default function FormulaCard({ data }: { data: FormulaData }) {
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="border border-primary-200 dark:border-primary-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-900 shadow-sm my-3">
      {/* 头部 */}
      <div className="bg-gradient-to-r from-primary-50 to-primary-100/50 dark:from-primary-900/30 dark:to-primary-800/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-800 flex items-center justify-center">
              <Crown className="w-4 h-4 text-primary-600 dark:text-primary-300" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{data.name}</h4>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-1">{data.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleSave}
              className={`p-1.5 rounded-lg transition-all ${saved ? 'bg-success-100 text-success-600' : 'hover:bg-white/60 text-neutral-400 hover:text-neutral-600'}`}
              title={saved ? '已保存' : '保存配方'}
            >
              {saved ? <Download className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-white/60 text-neutral-400 hover:text-neutral-600 transition-colors">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 功效标签 */}
        <div className="flex flex-wrap gap-1 mt-2">
          {data.effects.map((ef, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary-100/80 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-medium">
              {ef}
            </span>
          ))}
        </div>
      </div>

      {/* 配方结构 */}
      {expanded && (
        <div className="px-4 py-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.ingredients.map((ing, i) => {
              const cfg = ROLE_CONFIG[ing.role]
              const Icon = cfg.icon
              return (
                <div key={i} className={`${cfg.bg} ${cfg.border} border rounded-lg p-2.5`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                    <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 ml-1">{ing.name}</span>
                    <span className="text-[11px] text-neutral-400 ml-auto">{ing.dosage}</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{ing.purpose}</p>
                </div>
              )
            })}
          </div>

          {data.usage && (
            <div className="text-xs text-neutral-600 dark:text-neutral-400 bg-slate-50 dark:bg-neutral-800 rounded-lg p-2.5">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">用法：</span>{data.usage}
            </div>
          )}

          {data.precautions && data.precautions.length > 0 && (
            <div className="text-[11px] text-warning-600 dark:text-warning-400 bg-warning-50 dark:bg-warning-900/20 rounded-lg p-2.5">
              <span className="font-medium">⚠️ 注意事项</span>
              <ul className="mt-1 space-y-0.5">
                {data.precautions.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}

          {/* 操作栏 */}
          <div className="flex items-center gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800">
            <button className="text-[11px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100 transition-colors">
              <Save className="w-3 h-3" /> 保存到配方库
            </button>
            <button className="text-[11px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 transition-colors">
              <Plus className="w-3 h-3" /> 创建实验
            </button>
            <button className="text-[11px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 transition-colors">
              <Download className="w-3 h-3" /> 导出 PDF
            </button>
          </div>
        </div>
      )}

      {/* 折叠提示 */}
      {!expanded && (
        <button onClick={() => setExpanded(true)}
          className="w-full py-1.5 text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 bg-slate-50/50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center justify-center gap-1"
        >
          <ChevronDown className="w-3 h-3" /> 展开配方详情
        </button>
      )}
    </div>
  )
}
