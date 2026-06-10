/**
 * 配方功能测试页面
 * 用于测试配方相关组件的功能
 */
import { useState } from 'react'
import { Share2, Star, Calculator, TestTube } from 'lucide-react'
import { Button, PageHeader, Tabs, TabsList, TabsTrigger, TabsContent, Card, CardContent, CardHeader, CardTitle, Divider } from '@/components/ui'

// 导入新创建的组件
import { ShareFormula } from './components/ShareFormula'
import { FormulaRating } from './components/FormulaRating'
import { FormulaCostAnalysis } from './components/FormulaCostAnalysis'
import { logger } from '@/utils/safeLogger';


// 测试数据
const testFormula = {
  id: 123,
  name: '补气养血配方',
  ingredients: [
    { name: '黄芪', dosage: '15g', estimatedCost: 0, category: '补气药', isFoodHomology: false },
    { name: '当归', dosage: '10g', estimatedCost: 0, category: '补血药', isFoodHomology: false },
    { name: '枸杞', dosage: '10g', estimatedCost: 0, category: '补阴药', isFoodHomology: true },
    { name: '红枣', dosage: '10g', estimatedCost: 0, category: '补气药', isFoodHomology: true },
    { name: '蜂蜜', dosage: '5g', estimatedCost: 0, category: '其他', isFoodHomology: true },
  ],
  totalWeight: 50,
}

const emptyFormula = {
  id: 456,
  name: '空配方',
  ingredients: [],
  totalWeight: 0,
}

export function FormulaTestPage() {
  const [activeTab, setActiveTab] = useState('share')
  const [showShareModal, setShowShareModal] = useState(false)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 animate-page-enter">
      {/* Header */}
      <PageHeader
        title="配方功能测试"
        description="测试配方相关组件的功能和边界条件"
      />

      {/* Tabs */}
      <Tabs defaultValue="share" value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto pb-2">
          <TabsList className="min-w-max">
            <TabsTrigger value="share" icon={<Share2 size={16} />}>
              分享功能
            </TabsTrigger>
            <TabsTrigger value="rating" icon={<Star size={16} />}>
              评分系统
            </TabsTrigger>
            <TabsTrigger value="cost" icon={<Calculator size={16} />}>
              成本分析
            </TabsTrigger>
            <TabsTrigger value="empty" icon={<TestTube size={16} />}>
              边界测试
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 分享功能测试 */}
        <TabsContent value="share" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>分享功能测试</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <h4 className="font-medium mb-2">测试配方</h4>
                  <p>配方ID: {testFormula.id}</p>
                  <p>配方名称: {testFormula.name}</p>
                </div>
                <Button
                  variant="primary"
                  icon={<Share2 size={16} />}
                  onClick={() => setShowShareModal(true)}
                >
                  测试分享功能
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 评分系统测试 */}
        <TabsContent value="rating" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>评分系统测试</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <h4 className="font-medium mb-2">测试配方</h4>
                  <p>配方ID: {testFormula.id}</p>
                  <p>配方名称: {testFormula.name}</p>
                </div>
                <FormulaRating
                  formulaId={testFormula.id}
                  formulaName={testFormula.name}
                  onRatingChange={(rating) => {
                    logger.info('Rating changed:', rating)
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 成本分析测试 */}
        <TabsContent value="cost" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>成本分析测试</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <h4 className="font-medium mb-2">测试配方</h4>
                  <p>配方ID: {testFormula.id}</p>
                  <p>配方名称: {testFormula.name}</p>
                  <p>总重量: {testFormula.totalWeight}g</p>
                </div>
                <FormulaCostAnalysis
                  ingredients={testFormula.ingredients}
                  totalWeight={testFormula.totalWeight}
                  onCostOptimization={(suggestions) => {
                    logger.info('Cost optimization suggestions:', suggestions)
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 边界测试 */}
        <TabsContent value="empty" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>边界条件测试</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3">空配方测试</h4>
                  <FormulaCostAnalysis
                    ingredients={emptyFormula.ingredients}
                    totalWeight={emptyFormula.totalWeight}
                  />
                </div>

                <Divider />

                <div>
                  <h4 className="font-medium mb-3">评分系统边界测试</h4>
                  <p className="text-sm text-slate-500 mb-4">
                    测试评分系统在各种边界条件下的表现，包括：
                  </p>
                  <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
                    <li>首次评分</li>
                    <li>修改评分</li>
                    <li>添加/修改评价内容</li>
                    <li>评分总数为0的情况</li>
                  </ul>
                </div>

                <Divider />

                <div>
                  <h4 className="font-medium mb-3">分享功能边界测试</h4>
                  <p className="text-sm text-slate-500 mb-4">
                    测试分享功能在各种边界条件下的表现，包括：
                  </p>
                  <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
                    <li>二维码加载失败</li>
                    <li>剪贴板复制失败</li>
                    <li>不同平台分享</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 分享模态框 */}
      <ShareFormula
        formulaId={testFormula.id}
        formulaName={testFormula.name}
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
    </div>
  )
}

export default FormulaTestPage
