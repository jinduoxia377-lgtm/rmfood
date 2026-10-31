/**
 * 零售产品对比弹窗
 *
 * 对比用户勾选的 1-6 款市售产品：
 * 表格行 = 字段（品牌/剂型/分类/价格/规格/功效/目标人群/关键成分/过敏原/生态评分/数据来源），
 * 表格列 = 产品。
 *
 * 使用 shadcn/Radix Dialog + 原生 table（配合 @/components/ui 的
 * TableHeader/TableBody/TableRow/TableCell 原语），支持横向滚动。
 */
import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Badge,
  EmptyState,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui'
import { Columns3, PackageSearch } from 'lucide-react'
import type { RetailProductDetail } from '../../../api/searchNew'

export interface RetailProductCompareModalProps {
  /** 是否显示弹窗 */
  visible: boolean
  /** 用户勾选用于对比的产品列表（1-6 款；为空时展示空状态） */
  products: RetailProductDetail[]
  /** 关闭回调 */
  onClose: () => void
}

/** 将任意 JSON 值格式化为可读文本（关键成分展示用） */
function formatValue(value: unknown): string {
  if (value == null) return '-'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** 字符串数组 → 顿号分隔文本 */
function formatList(items?: string[]): string {
  if (!items || items.length === 0) return '-'
  return items.join('、')
}

/** 生态评分等级 → Badge variant */
function getEcoscoreVariant(grade?: string | null): 'success' | 'info' | 'primary' | 'warning' | 'default' {
  switch ((grade ?? '').toLowerCase()) {
    case 'a': return 'success'
    case 'b': return 'info'
    case 'c': return 'primary'
    case 'd': return 'warning'
    default: return 'default'
  }
}

/** 价格渲染：¥ + 非 CNY 币种后缀 */
function renderPrice(product: RetailProductDetail): string {
  if (product.price == null) return '-'
  const currency = product.currency && product.currency !== 'CNY' ? ` ${product.currency}` : ''
  return `¥${Number(product.price).toFixed(2)}${currency}`
}

/** 规格渲染：优先 package_size，再补充净重/容量 */
function renderSpec(product: RetailProductDetail): string {
  const parts = [
    product.package_size,
    product.weight_g != null ? `${product.weight_g} g` : null,
    product.volume_ml != null ? `${product.volume_ml} ml` : null,
  ].filter((item): item is string => Boolean(item))
  return parts.length > 0 ? parts.join(' / ') : '-'
}

/** 功效渲染：小徽章列表 */
function renderEffects(product: RetailProductDetail): React.ReactNode {
  if (!product.effects || product.effects.length === 0) return '-'
  return (
    <div className="flex flex-wrap gap-1">
      {product.effects.map((effect) => (
        <Badge key={effect} variant="secondary" className="whitespace-nowrap">
          {effect}
        </Badge>
      ))}
    </div>
  )
}

/** 关键成分渲染：key_ingredients JSON 对象，取前 5 项 */
function renderKeyIngredients(product: RetailProductDetail): React.ReactNode {
  const ingredients = product.key_ingredients ?? {}
  const entries = Object.entries(ingredients).slice(0, 5)
  if (entries.length === 0) return '-'
  return (
    <ul className="space-y-1.5">
      {entries.map(([key, value]) => (
        <li key={key} className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-foreground">{key}</span>
          <span className="text-xs text-muted-foreground break-all">{formatValue(value)}</span>
        </li>
      ))}
    </ul>
  )
}

/** 过敏原渲染：红色徽章列表 */
function renderAllergens(product: RetailProductDetail): React.ReactNode {
  if (!product.allergens_tags || product.allergens_tags.length === 0) return '-'
  return (
    <div className="flex flex-wrap gap-1">
      {product.allergens_tags.map((tag) => (
        <Badge key={tag} variant="destructive" className="whitespace-nowrap">
          {tag}
        </Badge>
      ))}
    </div>
  )
}

/** 生态评分渲染 */
function renderEcoscore(product: RetailProductDetail, ecoscoreLabel: string): React.ReactNode {
  if (!product.ecoscore_grade) return '-'
  return (
    <Badge variant={getEcoscoreVariant(product.ecoscore_grade)}>
      {ecoscoreLabel} {product.ecoscore_grade.toUpperCase()}
    </Badge>
  )
}

const RetailProductCompareModal: React.FC<RetailProductCompareModalProps> = ({
  visible,
  products,
  onClose,
}) => {
  const { t } = useTranslation()
  const rp = (key: string) => t(`pages.database.retailProduct.compare.${key}`)

  // 对比字段定义（行顺序固定）
  const fieldDefs: { key: string; label: string; render: (product: RetailProductDetail) => React.ReactNode }[] = [
    { key: 'brand', label: rp('fieldBrand'), render: (p) => p.brand || '-' },
    { key: 'formulation_type', label: rp('fieldFormulation'), render: (p) => p.formulation_type || '-' },
    { key: 'category', label: rp('fieldCategory'), render: (p) => p.category || p.sub_category || '-' },
    { key: 'price', label: rp('fieldPrice'), render: renderPrice },
    { key: 'package_size', label: rp('fieldSpec'), render: renderSpec },
    { key: 'effects', label: rp('fieldEffects'), render: renderEffects },
    { key: 'target_population', label: rp('fieldTargetPopulation'), render: (p) => formatList(p.target_population) },
    { key: 'key_ingredients', label: rp('fieldKeyIngredients'), render: renderKeyIngredients },
    { key: 'allergens_tags', label: rp('fieldAllergens'), render: renderAllergens },
    { key: 'ecoscore_grade', label: rp('fieldEcoscore'), render: (p) => renderEcoscore(p, rp('ecoscore')) },
    { key: 'source', label: rp('fieldSource'), render: (p) => p.source || 'openfoodfacts_api' },
  ]

  return (
    <Dialog open={visible} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        maxWidth="1100px"
        className="max-w-[1100px]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Columns3 className="h-4 w-4" aria-hidden="true" />
            {rp('title')}
            {products.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                {t('pages.database.retailProduct.compare.selectedCount', { count: products.length })}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto px-6 pb-6 pt-2">
          {products.length === 0 ? (
            <EmptyState
              icon={<PackageSearch size={48} strokeWidth={1.5} />}
              title={rp('emptyTitle')}
              description={rp('emptyDescription')}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] caption-bottom text-sm">
                <TableHeader>
                  <tr className="border-b transition-colors">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap w-28">
                      {rp('fieldColumn')}
                    </th>
                    {products.map((product) => (
                      <th
                        key={product.id}
                        className="h-12 px-4 text-left align-middle font-medium text-foreground min-w-[180px] max-w-[220px]"
                      >
                        <span className="block truncate" title={product.product_name}>
                          {product.product_name || t('pages.database.retailProduct.compare.productFallback', { id: product.id })}
                        </span>
                        {product.brand && (
                          <span className="block truncate text-xs font-normal text-muted-foreground mt-0.5">
                            {product.brand}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </TableHeader>
                <TableBody>
                  {fieldDefs.map((field) => (
                    <TableRow key={field.key}>
                      <TableCell className="align-top font-medium text-muted-foreground whitespace-nowrap bg-muted/30">
                        {field.label}
                      </TableCell>
                      {products.map((product) => (
                        <TableCell key={product.id} className="align-top">
                          {field.render(product)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default RetailProductCompareModal