/**
 * 可称重批记录清单组件
 * 用于打印和实际操作时的称量指导
 */
import { useState } from 'react'
import { Printer, CheckCircle2, Circle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { cn } from '@/lib/utils'

interface IngredientRow {
  id: number
  name: string
  specified_dosage_mg: number
  scaled_dosage_mg: number
  unit: string
  batch_code?: string
  checked?: boolean
}

interface BatchWeightListProps {
  formulaName: string
  formulaCode: string
  targetWeightKg: number
  scaleFactor: number
  ingredients: IngredientRow[]
  onCheck?: (index: number, checked: boolean) => void
}

export default function BatchWeightList({
  formulaName,
  formulaCode,
  targetWeightKg,
  scaleFactor,
  ingredients,
  onCheck,
}: BatchWeightListProps) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set())

  const handleCheck = (index: number) => {
    const next = new Set(checkedItems)
    if (next.has(index)) {
      next.delete(index)
    } else {
      next.add(index)
    }
    setCheckedItems(next)
    onCheck?.(index, next.has(index))
  }

  const allChecked = ingredients.length > 0 && checkedItems.size === ingredients.length

  return (
    <Card className="print-ready">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">批记录单</CardTitle>
            <div className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1 space-y-0.5">
              <div>配方: <span className="font-mono font-medium">{formulaCode}</span> — {formulaName}</div>
              <div>目标产量: <span className="font-medium">{targetWeightKg.toFixed(3)} kg</span></div>
              <div>放大倍数: <span className="font-medium">{scaleFactor.toFixed(2)}×</span></div>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 transition-colors"
          >
            <Printer size={14} />
            打印
          </button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-700">
              <th className="text-left py-2 px-2 w-8"></th>
              <th className="text-left py-2 px-2">序号</th>
              <th className="text-left py-2 px-2">原料名称</th>
              <th className="text-right py-2 px-2">配方用量(mg)</th>
              <th className="text-right py-2 px-2 font-semibold text-primary">称量(g)</th>
              <th className="text-left py-2 px-2">原料批号</th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((ing, idx) => (
              <tr
                key={ing.id}
                className={cn(
                  'border-b border-neutral-100 dark:border-neutral-800 transition-colors',
                  checkedItems.has(idx) && 'bg-success-50 dark:bg-success-300/15',
                )}
              >
                <td className="py-2 px-2 text-center">
                  <button
                    onClick={() => handleCheck(idx)}
                    className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                      checkedItems.has(idx)
                        ? 'bg-success-500 border-success-500 text-white'
                        : 'border-neutral-300 dark:border-neutral-600 hover:border-primary',
                    )}
                  >
                    {checkedItems.has(idx) && <CheckCircle2 size={12} />}
                  </button>
                </td>
                <td className="py-2 px-2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{idx + 1}</td>
                <td className="py-2 px-2 font-medium">{ing.name}</td>
                <td className="py-2 px-2 text-right text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-mono">
                  {ing.specified_dosage_mg?.toFixed(1)}
                </td>
                <td className="py-2 px-2 text-right font-mono font-semibold text-primary">
                  {(ing.scaled_dosage_mg / 1000).toFixed(3)}
                </td>
                <td className="py-2 px-2">
                  {ing.batch_code ? (
                    <span className="font-mono text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{ing.batch_code}</span>
                  ) : (
                    <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-200 dark:border-neutral-700">
              <td colSpan={4} className="py-2 px-2 text-right font-medium">
                合计称量:
              </td>
              <td className="py-2 px-2 text-right font-mono font-bold text-lg">
                {(ingredients.reduce((sum, ing) => sum + (ing.scaled_dosage_mg || 0), 0) / 1000).toFixed(3)} g
              </td>
              <td className="py-2 px-2"></td>
            </tr>
          </tfoot>
        </table>

        {/* All checked confirmation */}
        {allChecked && (
          <div className="mt-4 p-3 bg-success-50 dark:bg-success-300/20 rounded-lg flex items-center gap-2 text-sm text-success-700 dark:text-success-700">
            <CheckCircle2 size={16} />
            所有原料已称量完毕
          </div>
        )}
      </CardContent>
    </Card>
  )
}
