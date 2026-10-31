/**
 * 零售产品详情弹窗（深度版）
 *
 * 五个 Tab：基本信息 / 营养成分 / 食品安全 / 成分表 / 市场信息。
 * 基于 shadcn/Radix Tabs，展示 OpenFoodFacts 实时/缓存产品与平台参考数据的完整信息。
 */
import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Text,
  Tooltip,
} from '@/components/ui'
import {
  Info,
  FileText,
  AlertTriangle,
  Tags,
  ShoppingCart,
  Globe,
  Database,
  ShieldCheck,
  Star,
  ExternalLink,
} from 'lucide-react'
import type { RetailProductDetail } from '../../../api/searchNew'

interface RetailProductDetailModalProps {
  visible: boolean
  product: RetailProductDetail | null
  onClose: () => void
}

/** 将 OFF 标签（如 en:vitamin-c）转成可读名 */
function readableTag(tag?: string): string {
  if (!tag) return ''
  return tag.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ')
}

/** 根据营养素键推断单位 */
function inferUnit(key: string): string {
  const lower = key.toLowerCase()
  if (lower.includes('mg')) return 'mg'
  if (lower.includes('µg') || lower.includes('ug')) return 'µg'
  if (lower.includes('kcal')) return 'kcal'
  if (lower.includes('kj')) return 'kJ'
  return 'g'
}

const RetailProductDetailModal: React.FC<RetailProductDetailModalProps> = ({
  visible,
  product,
  onClose,
}) => {
  const { t } = useTranslation()
  const rp = (key: string): string => t(`pages.database.retailProduct.${key}`)

  if (!product) return null

  const ki = (product.key_ingredients ?? {}) as Record<string, unknown>
  const nutrition = ki.nutrition as Record<string, number | string> | undefined
  const novaGroup = ki.nova_group as number | undefined
  const nutritionGrade = ki.nutrition_grade as string | undefined
  const labels = (ki.labels as string[]) ?? []
  const countries = (ki.countries as string[]) ?? []
  const servingSize = ki.serving_size as string | undefined

  // 额外字段（后端部分字段未显式声明，通过索引访问）
  const extra = product as RetailProductDetail & Record<string, unknown>
  const barcode = (extra.external_id as string | undefined) ?? (extra.barcode as string | undefined)
  const sku = extra.sku as string | undefined
  const productLine = extra.product_line as string | undefined
  const monthlySales = extra.monthly_sales as number | null | undefined
  const regNumber = extra.reg_number as string | undefined
  const regType = extra.reg_type as string | undefined
  const approvedRegion = extra.approved_region as string | undefined
  const updatedAt = (extra.crawl_timestamp as string | undefined) ?? (extra.updated_at as string | undefined)
  const allergens = (product.allergens_tags ?? []).map(readableTag)
  const additives = (product.additives_tags ?? []).map(readableTag)
  const traces = (product.traces_tags ?? []).map(readableTag)
  const contaminants = (product.contaminants ?? []).map(readableTag)

  // 数据来源徽标
  const origin = (product.data_origin ?? '').toLowerCase()
  const isLocalReference =
    origin === 'local_reference' || (product.source ?? '').toLowerCase() === 'manual'
  const sourceBadge =
    origin === 'internet_realtime' ? (
      <Badge variant="warning">{rp('originRealtimeBadge')}</Badge>
    ) : origin === 'internet_cache' ? (
      <Badge variant="info">{rp('originCacheBadge')}</Badge>
    ) : (
      <Badge>{rp('originLocalBadge')}</Badge>
    )

  const getEcoscoreVariant = (grade?: string): 'success' | 'warning' | 'destructive' | 'default' => {
    switch (grade) {
      case 'a': return 'success'
      case 'b': return 'success'
      case 'c': return 'warning'
      case 'd': return 'warning'
      case 'e': return 'destructive'
      default: return 'default'
    }
  }

  /** 基本信息行渲染器 */
  const renderInfoRow = (label: string, value?: React.ReactNode) => {
    if (value === undefined || value === null || value === '') return null
    return (
      <div className="flex justify-between gap-4 py-1.5 border-b border-border/60 text-sm">
        <span className="text-muted-foreground shrink-0">{label}</span>
        <span className="font-medium text-right break-words">{value}</span>
      </div>
    )
  }

  /** 营养成分行 */
  const renderNutritionRows = () => {
    if (!nutrition || Object.keys(nutrition).length === 0) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
          <Database className="h-4 w-4" />
          {isLocalReference ? rp('detailLocalNoNutrition') : rp('detailNoData')}
        </div>
      )
    }
    const entries = Object.entries(nutrition)
    // 前 8 项为主营养素（能量/蛋白质/脂肪/碳水等），其余折叠在“全部营养”内
    const mainKeys = ['energy-kcal', 'energy', 'fat', 'saturated-fat', 'carbohydrates', 'sugars', 'fiber', 'proteins', 'salt', 'sodium']
    const main = entries.filter(([k]) => mainKeys.includes(k.toLowerCase()))
    const rest = entries.filter(([k]) => !mainKeys.includes(k.toLowerCase()))
    const renderRow = ([key, value]: [string, number | string]) => (
      <div key={key} className="flex justify-between py-1 border-b border-border/50 text-sm">
        <span className="text-muted-foreground capitalize">{key.replace(/-/g, ' ')}</span>
        <span className="font-medium">
          {typeof value === 'number' ? Number(value).toFixed(1) : value} {inferUnit(key)}
        </span>
      </div>
    )
    return (
      <div className="text-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{rp('detailNutritionPer100g')}</span>
          {nutritionGrade && (
            <Badge variant={['a', 'b'].includes(nutritionGrade) ? 'success' : 'warning'}>
              {rp('detailNutritionGrade')}: {nutritionGrade.toUpperCase()}
            </Badge>
          )}
        </div>
        {main.length > 0 && <div>{main.map(renderRow)}</div>}
        {rest.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground select-none">
              全部营养（{rest.length}）
            </summary>
            <div className="mt-1">{rest.map(renderRow)}</div>
          </details>
        )}
      </div>
    )
  }

  /** 成分表：结构化配料 + 原文 */
  const renderIngredients = () => {
    const ingredientsArray = ki.ingredients as Array<{ text?: string; id?: string; percent?: number }> | undefined
    const ingredientsText =
      (ki.ingredients_text as string | undefined) || product.full_ingredients || ''
    return (
      <div className="space-y-3 text-sm">
        {ingredientsArray && ingredientsArray.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <Text className="font-medium">{rp('detailIngredientsLabel')}</Text>
              <Badge variant="secondary">{ingredientsArray.length} {rp('detailIngredientCount')}</Badge>
            </div>
            <div className="flex flex-wrap gap-1">
              {ingredientsArray.map((ing, idx) => (
                <Badge key={`${ing.id ?? ing.text ?? idx}`} variant="outline" className="capitalize">
                  {ing.text ?? ing.id ?? ''}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {ingredientsText ? (
          <div className="rounded-md border border-border p-3 bg-background/50 max-h-[240px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {ingredientsText}
          </div>
        ) : (
          <div className="text-muted-foreground py-4 text-center">{rp('detailNoData')}</div>
        )}
      </div>
    )
  }

  /** 市场信息 */
  const renderMarket = () => {
    return (
      <div className="text-sm">
        <div className="flex items-center gap-2 py-1.5 border-b border-border/60">
          <span className="text-muted-foreground">{rp('detailDataSource')}:</span>
          {sourceBadge}
          <span className="text-xs text-muted-foreground ml-auto break-all">{product.source || '-'}</span>
        </div>
        {renderInfoRow(rp('detailDataQuality'), product.data_quality != null ? `${(product.data_quality * 100).toFixed(0)}%` : '-')}
        {renderInfoRow(rp('detailBarcode'), barcode)}
        {renderInfoRow(rp('detailSku'), sku)}
        {renderInfoRow(rp('detailProductLine'), productLine)}
        {renderInfoRow(rp('detailMonthlySales'), monthlySales != null ? `${monthlySales}` : undefined)}
        {renderInfoRow(rp('detailReviewCount'), product.review_count != null ? `${product.review_count}` : undefined)}
        {renderInfoRow(rp('detailRegNumber'), regNumber)}
        {renderInfoRow(rp('detailRegType'), regType)}
        {renderInfoRow(rp('detailApprovedRegion'), approvedRegion)}
        {renderInfoRow(rp('detailCountries'), countries.length > 0 ? countries.map(readableTag).join(', ') : undefined)}
        {renderInfoRow(rp('detailSalesChannels'), product.sales_channels && product.sales_channels.length > 0 ? product.sales_channels.join(', ') : undefined)}
        {renderInfoRow(rp('detailUpdatedAt'), updatedAt ? String(updatedAt).slice(0, 10) : undefined)}
      </div>
    )
  }

  return (
    <Dialog open={visible} onOpenChange={onClose}>
      <DialogContent className="max-w-[820px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-8">{product.product_name || '产品详情'}</DialogTitle>
        </DialogHeader>

        {/* 头部信息：品牌 / 分类 / 来源 / 评分 */}
        <div className="mb-[var(--space-apple-md)]">
          <div className="flex flex-wrap gap-3 items-start">
            {product.image_urls && product.image_urls.length > 0 && (
              <img
                src={product.image_urls[0]}
                alt={product.product_name}
                className="max-w-[140px] max-h-[120px] object-contain rounded-md border border-border"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div className="space-y-2 min-w-[200px] flex-1">
              <div className="flex flex-wrap gap-2 items-center">
                {sourceBadge}
                {product.brand && <Badge variant="default">{product.brand}</Badge>}
                {product.category && <Badge>{product.category}</Badge>}
                {product.formulation_type && <Badge variant="success">{product.formulation_type}</Badge>}
              </div>
              <div className="flex flex-wrap gap-2">
                {novaGroup != null && (
                  <Tooltip content={`NOVA ${novaGroup}`}>
                    <Badge variant={novaGroup <= 2 ? 'success' : novaGroup <= 3 ? 'warning' : 'destructive'}>
                      NOVA {novaGroup}
                    </Badge>
                  </Tooltip>
                )}
                {nutritionGrade && (
                  <Badge variant={['a', 'b'].includes(nutritionGrade) ? 'success' : 'warning'}>
                    {rp('detailNutritionGrade')}: {nutritionGrade.toUpperCase()}
                  </Badge>
                )}
                {product.ecoscore_grade && (
                  <Badge variant={getEcoscoreVariant(product.ecoscore_grade)}>
                    Eco-Score: {product.ecoscore_grade.toUpperCase()}
                  </Badge>
                )}
                {product.avg_rating != null && product.avg_rating > 0 && (
                  <Badge variant="secondary">
                    <Star className="h-3 w-3 mr-1 text-warning fill-warning" />
                    {Number(product.avg_rating).toFixed(1)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="w-full flex-wrap justify-start">
            <TabsTrigger value="basic"><Info className="h-3.5 w-3.5 mr-1" />{rp('detailTabBasic')}</TabsTrigger>
            <TabsTrigger value="nutrition"><FileText className="h-3.5 w-3.5 mr-1" />{rp('detailTabNutrition')}</TabsTrigger>
            <TabsTrigger value="safety"><ShieldCheck className="h-3.5 w-3.5 mr-1" />{rp('detailTabSafety')}</TabsTrigger>
            <TabsTrigger value="ingredients"><Tags className="h-3.5 w-3.5 mr-1" />{rp('detailTabIngredients')}</TabsTrigger>
            <TabsTrigger value="market"><ShoppingCart className="h-3.5 w-3.5 mr-1" />{rp('detailTabMarket')}</TabsTrigger>
          </TabsList>

          {/* 基本信息 */}
          <TabsContent value="basic" className="pt-3">
            <div className="text-sm">
              {renderInfoRow(rp('detailBrand'), product.brand)}
              {renderInfoRow(rp('detailCategory'), product.category)}
              {renderInfoRow(rp('detailSubCategory'), product.sub_category)}
              {renderInfoRow(rp('detailFormulation'), product.formulation_type)}
              {renderInfoRow(rp('detailPackage'), product.package_size)}
              {renderInfoRow(rp('detailVolume'), product.volume_ml ? `${product.volume_ml} ml` : undefined)}
              {renderInfoRow(rp('detailWeight'), product.weight_g ? `${product.weight_g} g` : undefined)}
              {renderInfoRow(rp('detailServingSize'), servingSize)}
              {renderInfoRow(rp('detailPrice'), product.price != null ? `${product.price} ${product.currency ?? 'CNY'}` : undefined)}
              {renderInfoRow(rp('detailRating'), product.avg_rating != null && product.avg_rating > 0 ? Number(product.avg_rating).toFixed(1) : undefined)}
              {renderInfoRow(rp('detailReviewCount'), product.review_count != null ? `${product.review_count}` : undefined)}
              {renderInfoRow(rp('detailBarcode'), barcode)}
              {renderInfoRow(rp('detailSku'), sku)}
              {renderInfoRow(rp('detailProductLine'), productLine)}
              {renderInfoRow(rp('detailLabels'), labels.length > 0 ? labels.map(readableTag).join(', ') : undefined)}
              {renderInfoRow(rp('detailEffects'), product.effects && product.effects.length > 0 ? product.effects.join('、') : undefined)}
              {renderInfoRow(rp('detailTargetPopulation'), product.target_population && product.target_population.length > 0 ? product.target_population.join('、') : undefined)}
              {renderInfoRow(rp('detailCountries'), countries.length > 0 ? countries.map(readableTag).join(', ') : undefined)}
              {!product.brand && !product.category && !product.formulation_type && !barcode && !product.price && (
                <div className="text-muted-foreground py-6 text-center">{rp('detailNoData')}</div>
              )}
            </div>
          </TabsContent>

          {/* 营养成分 */}
          <TabsContent value="nutrition" className="pt-3">
            {renderNutritionRows()}
          </TabsContent>

          {/* 食品安全 */}
          <TabsContent value="safety" className="pt-3">
            <div className="space-y-4 text-sm">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <Text className="font-medium">{rp('detailAllergens')}</Text>
                </div>
                {allergens.length > 0 ? (
                  <div className="flex flex-wrap gap-1">{allergens.map((a) => <Badge key={a} variant="destructive" className="capitalize">{a}</Badge>)}</div>
                ) : <div className="text-muted-foreground text-xs">{rp('detailNoData')}</div>}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Database className="h-4 w-4 text-warning" />
                  <Text className="font-medium">{rp('detailAdditives')}</Text>
                </div>
                {additives.length > 0 ? (
                  <div className="flex flex-wrap gap-1">{additives.map((a) => <Badge key={a} variant="warning" className="capitalize">{a}</Badge>)}</div>
                ) : <div className="text-muted-foreground text-xs">{rp('detailNoData')}</div>}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <Text className="font-medium">{rp('detailTraces')}</Text>
                </div>
                {traces.length > 0 ? (
                  <div className="flex flex-wrap gap-1">{traces.map((tr) => <Badge key={tr} variant="secondary" className="capitalize">{tr}</Badge>)}</div>
                ) : <div className="text-muted-foreground text-xs">{rp('detailNoData')}</div>}
              </div>
              {contaminants.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <Text className="font-medium">{rp('detailContaminants')}</Text>
                  </div>
                  <div className="flex flex-wrap gap-1">{contaminants.map((c) => <Badge key={c} variant="destructive" className="capitalize">{c}</Badge>)}</div>
                </div>
              )}
              {product.ecoscore_grade && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{rp('detailEcoscore')}:</span>
                  <Badge variant={getEcoscoreVariant(product.ecoscore_grade)}>Eco-Score {product.ecoscore_grade.toUpperCase()}</Badge>
                </div>
              )}
              {novaGroup != null && (
                <div className="flex items-center gap-2">
                  <Tags className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{rp('detailNova')}:</span>
                  <Badge variant={novaGroup <= 2 ? 'success' : novaGroup <= 3 ? 'warning' : 'destructive'}>NOVA {novaGroup}</Badge>
                </div>
              )}
              {!allergens.length && !additives.length && !traces.length && !contaminants.length && !product.ecoscore_grade && novaGroup == null && (
                <div className="text-muted-foreground py-4 text-center">
                  {isLocalReference ? rp('detailLocalNoSafety') : rp('detailSafetyNone')}
                </div>
              )}
            </div>
          </TabsContent>

          {/* 成分表 */}
          <TabsContent value="ingredients" className="pt-3">
            {renderIngredients()}
          </TabsContent>

          {/* 市场信息 */}
          <TabsContent value="market" className="pt-3">
            {renderMarket()}
          </TabsContent>
        </Tabs>

        {barcode && (
          <div className="mt-3 flex justify-end">
            <a
              href={`https://world.openfoodfacts.org/product/${encodeURIComponent(barcode)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              OpenFoodFacts
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default RetailProductDetailModal