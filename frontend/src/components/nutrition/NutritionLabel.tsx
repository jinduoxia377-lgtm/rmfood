/**
 * 营养成分表组件 — GB 28050-2011 标准格式
 *
 * E2E测试建议：使用Playwright测试组件渲染、交互和主题切换 — GB 28050-2011 标准格式
 *
 * 显示：能量、蛋白质、脂肪、饱和脂肪、碳水化合物、糖、膳食纤维、钠
 * 双列：每100g + 每份，含 NRV%
 */
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface NutritionLabelData {
  per_100g: Record<string, number>
  per_serving: Record<string, number>
  nrv_percentages: Record<string, number>
  label_items: Array<{
    nutrient: string
    unit: string
    is_mandatory: boolean
    per_100g: number
    per_serving: number | null
    nrv_percent: number | null
    claim?: string
  }>
  serving_info: { serving_size_g: number; servings_per_container: number }
  energy_check: { match: boolean; calculated_kj: number; listed_kj: number }
  claims: string[]
  warnings: string[]
}

interface NutritionLabelProps {
  data: NutritionLabelData
  showServing?: boolean
  compact?: boolean
  className?: string
}

const NUTRIENT_NAMES_CN: Record<string, string> = {
  energy: '能量',
  protein: '蛋白质',
  fat: '脂肪',
  saturated_fat: '饱和脂肪',
  carbohydrate: '碳水化合物',
  sugar: '糖',
  dietary_fiber: '膳食纤维',
  sodium: '钠',
  calcium: '钙',
  iron: '铁',
}

export function NutritionLabel({
  data,
  showServing = true,
  compact = false,
  className,
}: NutritionLabelProps) {
  const [expanded, setExpanded] = useState(false)
  const servingSize = data.serving_info?.serving_size_g ?? 100

  // 可选营养素（默认收起）
  const optionalItems = data.label_items.filter((item) => !item.is_mandatory)
  const mandatoryItems = data.label_items.filter((item) => item.is_mandatory)

  return (
    <div className={cn('nutrition-label', className)}>
      {/* 标题栏 */}
      <div className="nutrition-label-header">
        <h3 className="nutrition-label-title">营养成分表</h3>
        <div className="nutrition-label-meta">
          <span>每份 {servingSize}g</span>
          {showServing && (
            <span className="nutrition-label-divider">|</span>
          )}
          <span>{data.serving_info?.servings_per_container ?? 1}份/容器</span>
        </div>
      </div>

      {/* 表格 */}
      <table className="nutrition-label-table">
        <thead>
          <tr>
            <th className="col-nutrient">营养成分</th>
            <th className="col-per100g">
              每100<span className="unit-label">g</span>
            </th>
            <th className="col-nrv">NRV%</th>
            {showServing && (
              <th className="col-perServing">
                每份<span className="unit-label">({servingSize}g)</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {mandatoryItems.map((item) => (
            <NutritionRow key={item.nutrient} item={item} showServing={showServing} compact={compact} />
          ))}

          {/* 可选营养素（可展开） */}
          {optionalItems.length > 0 && (
            <>
              <tr>
                <td colSpan={showServing ? 4 : 3}>
                  <button
                    className="nutrition-label-toggle"
                    onClick={() => setExpanded((v) => !v)}
                  >
                    {expanded ? '▲ 收起可选项目' : '▼ 展开可选项目'}
                  </button>
                </td>
              </tr>
              {expanded &&
                optionalItems.map((item) => (
                  <NutritionRow
                    key={item.nutrient}
                    item={item}
                    showServing={showServing}
                    compact={compact}
                  />
                ))}
            </>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={showServing ? 4 : 3} className="footnote">
              * NRV = 营养素参考值（GB 28050-2011）
            </td>
          </tr>
        </tfoot>
      </table>

      {/* 营养声称 */}
      {data.claims.length > 0 && (
        <div className="nutrition-label-claims">
          <div className="nutrition-label-claims-label">营养声称</div>
          <div className="nutrition-label-claims-list">
            {data.claims.map((claim) => (
              <span key={claim} className="claim-badge">
                {claim}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 警告 */}
      {data.warnings.length > 0 && (
        <div className="nutrition-label-warnings">
          {data.warnings.map((w, i) => (
            <p key={i} className="warning-text">
              ⚠ {w}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 单行组件 ───────────────────────────────────────────────

interface NutritionRowProps {
  item: {
    nutrient: string
    unit: string
    is_mandatory: boolean
    per_100g: number
    per_serving: number | null
    nrv_percent: number | null
    claim?: string
  }
  showServing: boolean
  compact: boolean
}

function NutritionRow({ item, showServing, compact }: NutritionRowProps) {
  const cnName = NUTRIENT_NAMES_CN[item.nutrient] || item.nutrient
  const nrvColor =
    item.nrv_percent != null
      ? item.nrv_percent >= 30
        ? 'text-danger-600 dark:text-danger-600'
        : item.nrv_percent >= 15
        ? 'text-warning-600 dark:text-warning-700'
        : 'text-success-600 dark:text-success-600'
      : ''

  return (
    <tr className={cn('nutrition-row', !item.is_mandatory && 'optional-row')}>
      <td className="nutrient-name">
        <span>{cnName}</span>
        {item.claim && <span className="claim-tag">{item.claim}</span>}
      </td>
      <td className="nutrient-value">
        {formatValue(item.per_100g, item.unit)}
      </td>
      <td className={cn('nrv-cell', nrvColor)}>
        {item.nrv_percent != null ? `${item.nrv_percent}%` : '—'}
      </td>
      {showServing && (
        <td className="nutrient-value">
          {item.per_serving != null
            ? formatValue(item.per_serving, item.unit)
            : '—'}
        </td>
      )}
    </tr>
  )
}

function formatValue(value: number, unit: string): string {
  if (value === 0) return `0 ${unit}`
  const num = Math.round(value * 100) / 100
  return `${num} ${unit}`
}
