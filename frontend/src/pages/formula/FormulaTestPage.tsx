/**
 * 配方功能测试页面
 * 用于测试配方相关组件的功能
 */
import { useState } from 'react'
import {
  Share2, Star, Calculator, TestTube,
  FlaskConical, Activity, Shield, CheckCircle2, Zap, Thermometer,
} from 'lucide-react'
import { Button, PageHeader, Tabs, TabsList, TabsTrigger, TabsContent, Card, CardContent, CardHeader, CardTitle, Divider } from '@/components/ui'
import { formulaApi } from '@/api/formula'
import { logger } from '@/utils/safeLogger'

// 导入新创建的组件
import { ShareFormula } from './components/ShareFormula'
import { FormulaRating } from './components/FormulaRating'
import { FormulaCostAnalysis } from './components/FormulaCostAnalysis'

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

function AnalysisTestPanel({
  title,
  icon,
  runFn,
  runLabel,
}: {
  title: string
  icon: React.ReactNode
  runFn: () => Promise<any>
  runLabel: string
}) {
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRun = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const r = await runFn()
      setResult(r)
    } catch (e: any) {
      setError(e?.message || '请求失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-violet-500">{icon}</span>
        <h3 className="font-medium text-neutral-900 dark:text-white">{title}</h3>
      </div>
      <Button
        variant="primary"
        size="sm"
        icon={loading ? <FlaskConical size={14} className="animate-spin" /> : undefined}
        disabled={loading}
        onClick={handleRun}
      >
        {loading ? '运行中...' : runLabel}
      </Button>
      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800">
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        </div>
      )}
      {result && (
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
          <pre className="text-xs text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap font-mono">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
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
            <TabsTrigger value="analysis" icon={<FlaskConical size={16} />}>
              深度分析
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
                <div className="p-4 bg-slate-50 dark:bg-neutral-800/50 rounded-lg">
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
                <div className="p-4 bg-slate-50 dark:bg-neutral-800/50 rounded-lg">
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
                <div className="p-4 bg-slate-50 dark:bg-neutral-800/50 rounded-lg">
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

        {/* 深度分析测试 */}
        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>配方深度分析测试</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                <p className="text-sm text-violet-700 dark:text-violet-300">
                  以下测试将调用后端深度分析 API，需要有效的配方 ID。请确保已登录并选择有成分的配方。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AnalysisTestPanel
                  title="协同效应分析"
                  icon={<FlaskConical size={16} />}
                  runFn={() => formulaApi.analyzeFormulaSynergy(testFormula.id)}
                  runLabel="运行协同分析"
                />
                <AnalysisTestPanel
                  title="稳定性预测"
                  icon={<Thermometer size={16} />}
                  runFn={() => formulaApi.predictFormulaStability(testFormula.id)}
                  runLabel="运行稳定性预测"
                />
                <AnalysisTestPanel
                  title="风味预测"
                  icon={<Zap size={16} />}
                  runFn={() => formulaApi.predictFormulaTaste(testFormula.id)}
                  runLabel="运行风味预测"
                />
                <AnalysisTestPanel
                  title="效果预测 (PK/PD)"
                  icon={<Activity size={16} />}
                  runFn={() => formulaApi.predictFormulaEffect(testFormula.id)}
                  runLabel="运行效果预测"
                />
                <AnalysisTestPanel
                  title="兼容性检测"
                  icon={<CheckCircle2 size={16} />}
                  runFn={() => formulaApi.checkFormulaCompatibility(testFormula.id)}
                  runLabel="运行兼容性检测"
                />
                <AnalysisTestPanel
                  title="安全检查"
                  icon={<Shield size={16} />}
                  runFn={() => formulaApi.checkFormulaSafety(testFormula.id, { daily_dosage_g: 10, target_group: 'adult' })}
                  runLabel="运行安全检查"
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
                  <p className="text-sm text-neutral-500 mb-4">
                    测试评分系统在各种边界条件下的表现，包括：
                  </p>
                  <ul className="list-disc list-inside text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
                    <li>首次评分</li>
                    <li>修改评分</li>
                    <li>添加/修改评价内容</li>
                    <li>评分总数为0的情况</li>
                  </ul>
                </div>

                <Divider />

                <div>
                  <h4 className="font-medium mb-3">分享功能边界测试</h4>
                  <p className="text-sm text-neutral-500 mb-4">
                    测试分享功能在各种边界条件下的表现，包括：
                  </p>
                  <ul className="list-disc list-inside text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
                    <li>二维码加载失败</li>
                    <li>剪贴板复制失败</li>
                    <li>不同平台分享</li>
                  </ul>
                </div>

                <Divider />

                <div>
                  <h4 className="font-medium mb-3">深度分析边界测试</h4>
                  <p className="text-sm text-neutral-500 mb-4">
                    测试深度分析功能在边界条件下的行为：
                  </p>
                  <ul className="list-disc list-inside text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
                    <li>成分数为 0 的配方分析</li>
                    <li>成分数不足 2 个的协同分析</li>
                    <li>单成分配方的风味预测</li>
                    <li>网络请求失败的错误处理</li>
                    <li>超时和重试机制</li>
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
