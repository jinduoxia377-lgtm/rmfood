/**
 * 零售产品详情弹窗 (shadcn/Radix 迁移版)
 *
 * 展示 OpenFoodFacts 产品的完整信息：基本信息、营养成分、食品安全、分类标签等。
 * 已迁移: antd → shadcn/ui + Radix UI
 */
import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Badge,
  Card,
  CardContent,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Text,
} from '@/components/ui'
import {
  Info,
  FileText,
  AlertTriangle,
  Tags,
  ShoppingCart,
  X,
} from 'lucide-react'
import type { RetailProductDetail } from '../../../api/searchNew'

interface RetailProductDetailModalProps {
  visible: boolean
  product: RetailProductDetail | null
  onClose: () => void
}

const RetailProductDetailModal: React.FC<RetailProductDetailModalProps> = ({
  visible,
  product,
  onClose,
}) => {
  if (!product) return null

  const nutrition = (product.key_ingredients as Record<string, unknown>)?.nutrition as
    | Record<string, unknown>
    | undefined
  const novaGroup = (product.key_ingredients as Record<string, unknown>)?.nova_group as
    | number
    | undefined
  const nutritionGrade = (product.key_ingredients as Record<string, unknown>)?.nutrition_grade as
    | string
    | undefined
  const labels = (product.key_ingredients as Record<string, unknown>)?.labels as
    | string[]
    | undefined
  const countries = (product.key_ingredients as Record<string, unknown>)?.countries as
    | string[]
    | undefined
  const servingSize = (product.key_ingredients as Record<string, unknown>)?.serving_size as
    | string
    | undefined

  const getEcoscoreColor = (grade?: string): 'green' | 'cyan' | 'blue' | 'yellow' | 'default' => {
    switch (grade) {
      case 'a': return 'green'
      case 'b': return 'cyan'
      case 'c': return 'blue'
      case 'd': return 'yellow'
      default: return 'default'
    }
  }

  const renderNutritionTable = () => {
    if (!nutrition || Object.keys(nutrition).length === 0) return <Text className="text-muted-foreground">暂无数据</Text>

    const rows = Object.entries(nutrition as Record<string, number>).map(([key, value]) => ({
      label: key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: `${Number(value ?? 0).toFixed(1)} g`,
    }))

    return (
      <div className="grid grid-cols-2 gap-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between border-b py-1">
            <span className="text-muted-foreground">{row.label}:</span>
            <span className="font-medium">{row.value}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Dialog open={visible} onOpenChange={onClose}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{product.product_name || '产品详情'}</DialogTitle>
        </DialogHeader>

        {/* 头部信息 */}
        <div className="mb-4">
          {product.image_urls && product.image_urls.length > 0 && (
            <img
              src={product.image_urls[0]}
              alt={product.product_name}
              className="max-w-[200px] max-h-[150px] object-contain mb-2"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">{product.brand}</Badge>
              {product.category && <Badge>{product.category}</Badge>}
              {product.formulation_type && <Badge variant="success">{product.formulation_type}</Badge>}
            </div>
            {novaGroup && (
              <Badge variant={novaGroup <= 2 ? 'success' : novaGroup <= 3 ? 'warning' : 'destructive'}>
                NOVA {novaGroup} ({novaGroup <= 2 ? '未加工' : novaGroup <= 3 ? '加工程度低' : '超加工食品'})
              </Badge>
            )}
            {nutritionGrade && (
              <Badge variant={['a', 'b'].includes(nutritionGrade) ? 'success' : ['c', 'd'].includes(nutritionGrade) ? 'warning' : 'default'}>
                营养等级: {nutritionGrade.toUpperCase()}
              </Badge>
            )}
            {product.ecoscore_grade && (
              <Badge variant={getEcoscoreColor(product.ecoscore_grade) === 'green' ? 'success' : getEcoscoreColor(product.ecoscore_grade) === 'yellow' ? 'warning' : 'default'}>
                生态评分: {product.ecoscore_grade.toUpperCase()}
              </Badge>
            )}
          </div>
        </div>

        <div className="border-t my-4" />

        {/* 折叠面板 → Accordion */}
        <Accordion type="multiple" defaultValue={['basic', 'nutrition', 'safety']}>
          <AccordionItem value="basic">
            <AccordionTrigger className="flex items-center gap-2 [&>svg]:size-4">
              <Info className="h-4 w-4" />
              <span>基本信息</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-1 text-sm">
                {product.package_size && (
                  <div className="flex justify-between"><span className="text-muted-foreground">规格:</span><span>{product.package_size}</span></div>
                )}
                {product.volume_ml && (
                  <div className="flex justify-between"><span className="text-muted-foreground">容量:</span><span>{product.volume_ml} ml</span></div>
                )}
                {product.weight_g && (
                  <div className="flex justify-between"><span className="text-muted-foreground">净重:</span><span>{product.weight_g} g</span></div>
                )}
                {servingSize && (
                  <div className="flex justify-between"><span className="text-muted-foreground">份量:</span><span>{servingSize}</span></div>
                )}
                {product.price != null && (
                  <div className="flex justify-between"><span className="text-muted-foreground">价格:</span><span>{product.price} {product.currency}</span></div>
                )}
                {product.avg_rating && (
                  <div className="flex justify-between"><span className="text-muted-foreground">评分:</span><span>{Number(product.avg_rating).toFixed(1)}</span></div>
                )}
                {product.review_count != null && (
                  <div className="flex justify-between"><span className="text-muted-foreground">评价数:</span><span>{product.review_count}</span></div>
                )}
                {labels && labels.length > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">认证标签:</span><span>{labels.join(', ')}</span></div>
                )}
                {countries && countries.length > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">销售地区:</span><span>{countries.join(', ')}</span></div>
                )}
                {product.sales_channels && product.sales_channels.length > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">销售渠道:</span><span>{product.sales_channels.join(', ')}</span></div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="nutrition">
            <AccordionTrigger className="flex items-center gap-2 [&>svg]:size-4">
              <FileText className="h-4 w-4" />
              <span>营养成分</span>
            </AccordionTrigger>
            <AccordionContent>
              {renderNutritionTable()}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="safety">
            <AccordionTrigger className="flex items-center gap-2 [&>svg]:size-4">
              <AlertTriangle className="h-4 w-4" />
              <span>食品安全</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {product.allergens_tags && product.allergens_tags.length > 0 && (
                  <div>
                    <Text className="font-medium">过敏原：</Text>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {product.allergens_tags.map((tag) => (
                        <Badge key={tag} variant="destructive">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {product.additives_tags && product.additives_tags.length > 0 && (
                  <div>
                    <Text className="font-medium">添加剂：</Text>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {product.additives_tags.map((tag) => (
                        <Badge key={tag} variant="warning">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {product.traces_tags && product.traces_tags.length > 0 && (
                  <div>
                    <Text className="font-medium">潜在交叉污染：</Text>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {product.traces_tags.map((tag) => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {!product.allergens_tags?.length && !product.additives_tags?.length && !product.traces_tags?.length && (
                  <Text className="text-muted-foreground">无安全警告信息</Text>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="ingredients">
            <AccordionTrigger className="flex items-center gap-2 [&>svg]:size-4">
              <Tags className="h-4 w-4" />
              <span>成分表</span>
            </AccordionTrigger>
            <AccordionContent>
              <Text className="text-sm line-clamp-5">{product.full_ingredients || '暂无成分数据'}</Text>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="market">
            <AccordionTrigger className="flex items-center gap-2 [&>svg]:size-4">
              <ShoppingCart className="h-4 w-4" />
              <span>市场信息</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">数据来源:</span><span>{product.source || 'openfoodfacts_api'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">数据质量:</span><span>{product.data_quality ? `${(product.data_quality * 100).toFixed(0)}%` : '-'}</span></div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DialogContent>
    </Dialog>
  )
}

export default RetailProductDetailModal
