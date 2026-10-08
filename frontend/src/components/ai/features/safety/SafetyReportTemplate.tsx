import { useState, useRef, useCallback, useMemo } from 'react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import {
  Card,
  Button,
  Badge,
  Input,
  Alert,
} from '@/components/ui'
import { useOperationFeedback } from '@/hooks/useOperationFeedback'
import type { SafetyCheckResult } from '@/types'


import { logger } from '@/utils/safeLogger';
interface ReportSection {
  id: string
  title: string
  required: boolean
  content?: string
}

interface ReportTemplate {
  id: string
  name: string
  description: string
  icon: string
  category: string
  sections: ReportSection[]
}

interface ReportData {
  productName: string
  preparer: string
  date: string
  version: string
  companyLogo?: string
  watermark?: string
  safetyResult?: SafetyCheckResult
  ingredients?: {
    name: string
    concentration?: string
    riskScore: number
    status: 'compliant' | 'warning' | 'non_compliant'
    notes?: string
  }[]
  executiveSummary?: string
  testMethods?: string
  riskAssessment?: string
  complianceStatement?: string
  improvementActions?: string
  conclusion?: string
  signature?: string
  appendices?: string[]
  references?: string[]
  glossary?: { term: string; definition: string }[]
}

interface SafetyReportTemplateProps {
  onReportGenerated?: (reportData: ReportData, format: string) => void
  initialData?: Partial<ReportData>
  className?: string
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'fda_gras',
    name: 'FDA GRAS 通知报告',
    description: '美国FDA一般公认安全(GRAS)通知格式',
    icon: '🇺🇸',
    category: '国际标准',
    sections: [
      { id: 'cover', title: '报告封面', required: true },
      { id: 'toc', title: '目录', required: true },
      { id: 'executive_summary', title: '执行摘要', required: true },
      { id: 'identity', title: '物质身份信息', required: true },
      { id: 'intended_use', title: '预期用途', required: true },
      { id: 'safety_assessment', title: '安全评估', required: true },
      { id: 'toxicology_data', title: '毒理学数据', required: true },
      { id: 'conclusion', title: '结论与签名', required: true },
    ],
  },
  {
    id: 'nmpa_new_food',
    name: 'NMPA 新食品原料申报',
    description: '中国新食品原料申报标准格式',
    icon: '🇨🇳',
    category: '国内标准',
    sections: [
      { id: 'cover', title: '报告封面', required: true },
      { id: 'toc', title: '目录', required: true },
      { id: 'executive_summary', title: '执行摘要', required: true },
      { id: 'basic_info', title: '基本信息', required: true },
      { id: 'production_process', title: '生产工艺', required: true },
      { id: 'quality_specs', title: '质量规格', required: true },
      { id: 'safety_evaluation', title: '安全性评价', required: true },
      { id: 'conclusion', title: '结论与签名', required: true },
    ],
  },
  {
    id: 'efsa_safety',
    name: 'EFSA 安全评估报告',
    description: '欧盟食品安全局(EFSA)安全评估格式',
    icon: '🇪🇺',
    category: '国际标准',
    sections: [
      { id: 'cover', title: '报告封面', required: true },
      { id: 'toc', title: '目录', required: true },
      { id: 'abstract', title: '摘要', required: true },
      { id: 'background', title: '背景介绍', required: true },
      { id: 'chemical_identity', title: '化学特性', required: true },
      { id: 'exposure_assessment', title: '暴露评估', required: true },
      { id: 'toxicological', title: '毒理学研究', required: true },
      { id: 'risk_characterization', title: '风险特征描述', required: true },
      { id: 'conclusion', title: '结论', required: true },
    ],
  },
  {
    id: 'iso22000_haccp',
    name: 'ISO 22000 HACCP 报告',
    description: '食品安全管理体系HACCP分析报告',
    icon: '🌐',
    category: '管理体系',
    sections: [
      { id: 'cover', title: '报告封面', required: true },
      { id: 'scope', title: '范围与应用', required: true },
      { id: 'hazard_analysis', title: '危害分析', required: true },
      { id: 'ccp_identification', title: '关键控制点识别', required: true },
      { id: 'monitoring_plan', title: '监控计划', required: true },
      { id: 'corrective_actions', title: '纠正措施', required: true },
      { id: 'verification', title: '验证程序', required: true },
      { id: 'records', title: '记录保持', required: true },
    ],
  },
  {
    id: 'internal_audit',
    name: '企业内部安全审查',
    description: '企业内部安全合规审查报告',
    icon: '🏢',
    category: '企业标准',
    sections: [
      { id: 'cover', title: '报告封面', required: true },
      { id: 'overview', title: '审查概述', required: true },
      { id: 'methodology', title: '审查方法', required: true },
      { id: 'findings', title: '发现与结果', required: true },
      { id: 'risk_matrix', title: '风险矩阵', required: false },
      { id: 'recommendations', title: '改进建议', required: true },
      { id: 'action_plan', title: '行动计划', required: true },
      { id: 'appendix', title: '附录', required: false },
    ],
  },
  {
    id: 'custom',
    name: '自定义模板',
    description: '用户自定义报告结构',
    icon: '✏️',
    category: '自定义',
    sections: [
      { id: 'cover', title: '报告封面', required: true },
      { id: 'custom_1', title: '自定义章节1', required: true },
      { id: 'custom_2', title: '自定义章节2', required: false },
      { id: 'custom_3', title: '自定义章节3', required: false },
      { id: 'conclusion', title: '结论', required: true },
    ],
  },
]

export function SafetyReportTemplate({
  onReportGenerated,
  initialData = {},
  className = '',
}: SafetyReportTemplateProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate>(REPORT_TEMPLATES[0])
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)
  const [activeSection, setActiveSection] = useState<string>('cover')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const reportRef = useRef<HTMLDivElement>(null)
  const feedback = useOperationFeedback()

  const [reportData, setReportData] = useState<ReportData>({
    productName: initialData.productName || '',
    preparer: initialData.preparer || '',
    date: initialData.date || new Date().toISOString().split('T')[0],
    version: initialData.version || '1.0',
    companyLogo: initialData.companyLogo || '',
    watermark: initialData.watermark || '',
    executiveSummary: initialData.executiveSummary || '',
    testMethods: initialData.testMethods || '',
    riskAssessment: initialData.riskAssessment || '',
    complianceStatement: initialData.complianceStatement || '',
    improvementActions: initialData.improvementActions || '',
    conclusion: initialData.conclusion || '',
    signature: initialData.signature || '',
    ...initialData,
  })

  const updateReportData = useCallback((field: keyof ReportData, value: string) => {
    setReportData(prev => ({ ...prev, [field]: value }))
  }, [])

  const generatePDF = useCallback(async () => {
    setIsGenerating(true)
    setGenerationProgress(0)

    try {
      const doc = new (require("jspdf").default || jsPDF)('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      let yPos = 20

      setGenerationProgress(10)

      doc.setFontSize(24)
      doc.text(reportData.productName || '安全检查报告', pageWidth / 2, yPos, { align: 'center' })
      yPos += 15

      doc.setFontSize(12)
      doc.setTextColor(100)
      if (reportData.preparer) {
        doc.text(`编制人: ${reportData.preparer}`, pageWidth / 2, yPos, { align: 'center' })
        yPos += 7
      }
      if (reportData.date) {
        doc.text(`日期: ${reportData.date}`, pageWidth / 2, yPos, { align: 'center' })
        yPos += 7
      }
      if (reportData.version) {
        doc.text(`版本: ${reportData.version}`, pageWidth / 2, yPos, { align: 'center' })
        yPos += 15
      }

      setGenerationProgress(30)

      if (reportData.watermark) {
        doc.setFontSize(60)
        doc.setTextColor(200, 200, 200)
        doc.text(reportData.watermark, pageWidth / 2, pageHeight / 2, {
          align: 'center',
          angle: 45,
        })
        doc.setTextColor(0)
      }

      doc.addPage()
      yPos = 20

      doc.setFontSize(18)
      doc.text('目录', 20, yPos)
      yPos += 15

      selectedTemplate.sections.forEach((section, index) => {
        doc.setFontSize(11)
        doc.text(`${index + 1}. ${section.title}`, 25, yPos)
        yPos += 8
      })

      setGenerationProgress(50)

      if (reportData.executiveSummary) {
        doc.addPage()
        yPos = 20
        doc.setFontSize(16)
        doc.text('执行摘要', 20, yPos)
        yPos += 12

        doc.setFontSize(10)
        const summaryLines = doc.splitTextToSize(reportData.executiveSummary, pageWidth - 40)
        doc.text(summaryLines, 20, yPos)
        yPos += summaryLines.length * 5 + 10
      }

      setGenerationProgress(70)

      if (initialData.ingredients && initialData.ingredients.length > 0) {
        doc.addPage()
        yPos = 20
        doc.setFontSize(16)
        doc.text('原料清单及检测结果', 20, yPos)
        yPos += 12

        const tableData = initialData.ingredients.map((ing, idx) => [
          (idx + 1).toString(),
          ing.name,
          ing.concentration || '-',
          ing.riskScore.toString(),
          ing.status === 'compliant' ? '✓ 合规' : ing.status === 'warning' ? '⚠ 警告' : '✗ 不合规',
          ing.notes || '-',
        ])

        ;(doc.autoTable({
          head: [['序号', '成分名称', '浓度', '风险评分', '状态', '备注']],
          body: tableData,
          startY: yPos,
          margin: { top: 10 },
          styles: { fontSize: 8 },
          headStyles: { fillColor: [59, 130, 246] },
        }))
      }

      setGenerationProgress(85)

      if (reportData.conclusion) {
        doc.addPage()
        yPos = 20
        doc.setFontSize(16)
        doc.text('结论与签名', 20, yPos)
        yPos += 12

        doc.setFontSize(10)
        const conclusionLines = doc.splitTextToSize(reportData.conclusion, pageWidth - 40)
        doc.text(conclusionLines, 20, yPos)
        yPos += conclusionLines.length * 5 + 30

        if (reportData.signature) {
          doc.line(pageWidth / 2 - 30, yPos, pageWidth / 2 + 30, yPos)
          yPos += 8
          doc.setFontSize(10)
          doc.text(`签名: ${reportData.signature}`, pageWidth / 2, yPos, { align: 'center' })
          yPos += 7
          doc.text(`日期: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPos, { align: 'center' })
        }
      }

      setGenerationProgress(100)

      await new Promise(resolve => setTimeout(resolve, 500))

      const pdfBlob = doc.output('blob')
      const url = URL.createObjectURL(pdfBlob)
      setPreviewUrl(url)
      setShowPreview(true)

      onReportGenerated?.(reportData, 'pdf')

      feedback.showSuccess('报告已生成', `${selectedTemplate.name} PDF 报告生成成功`)
    } catch (error) {
      logger.error('PDF generation error:', error)
      feedback.showError('生成失败', error instanceof Error ? error.message : 'PDF生成过程中出现错误')
    } finally {
      setIsGenerating(false)
      setGenerationProgress(0)
    }
  }, [reportData, selectedTemplate, initialData.ingredients, onReportGenerated, feedback])

  const exportToWord = useCallback(() => {
    feedback.showInfo('导出功能', 'Word导出功能开发中，当前仅支持PDF格式')
  }, [feedback])

  const exportToHTML = useCallback(() => {
    feedback.showInfo('导出功能', 'HTML导出功能开发中，当前仅支持PDF格式')
  }, [feedback])

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'cover':
        return (
          <div className="space-y-6 p-8 bg-white dark:bg-neutral-900 rounded-lg shadow-sm">
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-bold text-neutral-900">
                {selectedTemplate.name}
              </h1>
              <p className="text-lg text-neutral-600">{selectedTemplate.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-xl mx-auto mt-8">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">产品名称 *</label>
                <Input
                  value={reportData.productName}
                  onChange={(e) => updateReportData('productName', e.target.value)}
                  placeholder="请输入产品名称"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">编制人 *</label>
                <Input
                  value={reportData.preparer}
                  onChange={(e) => updateReportData('preparer', e.target.value)}
                  placeholder="请输入编制人姓名"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">日期 *</label>
                <Input
                  type="date"
                  value={reportData.date}
                  onChange={(e) => updateReportData('date', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">版本号</label>
                <Input
                  value={reportData.version}
                  onChange={(e) => updateReportData('version', e.target.value)}
                  placeholder="例如: 1.0"
                />
              </div>
            </div>

            <div className="max-w-xl mx-auto">
              <label className="block text-sm font-medium text-neutral-700 mb-1">水印文字</label>
              <Input
                value={reportData.watermark}
                onChange={(e) => updateReportData('watermark', e.target.value)}
                placeholder="可选：添加水印（如：机密、草稿等）"
              />
            </div>
          </div>
        )

      case 'executive_summary':
      case 'abstract':
        return (
          <div className="space-y-4 p-6 bg-white dark:bg-neutral-900 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold">
              {sectionId === 'executive_summary' ? '执行摘要' : '摘要'}
            </h3>
            <textarea
              value={reportData.executiveSummary}
              onChange={(e) => updateReportData('executiveSummary', e.target.value)}
              placeholder="请输入关键发现和建议的简要总结..."
              className="w-full h-48 px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )

      case 'findings':
      case 'safety_evaluation':
        return (
          <div className="space-y-6 p-6 bg-white dark:bg-neutral-900 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold">
              检测范围与方法
            </h3>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">检测方法</label>
              <textarea
                value={reportData.testMethods}
                onChange={(e) => updateReportData('testMethods', e.target.value)}
                placeholder="描述采用的检测方法和标准..."
                className="w-full h-32 px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg resize-none"
              />
            </div>

            {initialData.ingredients && initialData.ingredients.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">原料清单及检测结果</label>
                <div className="overflow-x-auto border border-neutral-300 dark:border-neutral-700 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-neutral-800">
                      <tr>
                        <th className="px-4 py-2 text-left">序号</th>
                        <th className="px-4 py-2 text-left">成分名称</th>
                        <th className="px-4 py-2 text-left">浓度</th>
                        <th className="px-4 py-2 text-left">风险评分</th>
                        <th className="px-4 py-2 text-left">状态</th>
                        <th className="px-4 py-2 text-left">备注</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {initialData.ingredients.map((ing, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2">{idx + 1}</td>
                          <td className="px-4 py-2 font-medium">{ing.name}</td>
                          <td className="px-4 py-2">{ing.concentration || '-'}</td>
                          <td className="px-4 py-2">
                            <Badge variant={
                              ing.riskScore >= 80 ? 'success' :
                              ing.riskScore >= 50 ? 'warning' : 'danger'
                            }>
                              {ing.riskScore}
                            </Badge>
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant={
                              ing.status === 'compliant' ? 'success' :
                              ing.status === 'warning' ? 'warning' : 'danger'
                            }>
                              {ing.status === 'compliant' ? '✓ 合规' :
                               ing.status === 'warning' ? '⚠ 警告' : '✗ 不合规'}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{ing.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )

      case 'risk_matrix':
      case 'risk_assessment':
      case 'risk_characterization':
        return (
          <div className="space-y-4 p-6 bg-white dark:bg-neutral-900 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold">风险评估</h3>
            <textarea
              value={reportData.riskAssessment}
              onChange={(e) => updateReportData('riskAssessment', e.target.value)}
              placeholder="详细的风险评估分析和矩阵..."
              className="w-full h-48 px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg resize-none"
            />
          </div>
        )

      case 'recommendations':
      case 'improvement_actions':
      case 'action_plan':
        return (
          <div className="space-y-4 p-6 bg-white dark:bg-neutral-900 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold">改进建议与行动计划</h3>
            <textarea
              value={reportData.improvementActions}
              onChange={(e) => updateReportData('improvementActions', e.target.value)}
              placeholder="列出具体的改进建议和实施计划..."
              className="w-full h-48 px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg resize-none"
            />
          </div>
        )

      case 'conclusion':
        return (
          <div className="space-y-6 p-6 bg-white dark:bg-neutral-900 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold">结论与签名</h3>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">结论</label>
              <textarea
                value={reportData.conclusion}
                onChange={(e) => updateReportData('conclusion', e.target.value)}
                placeholder="总结性结论和声明..."
                className="w-full h-32 px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg resize-none"
              />
            </div>

            <div className="border-t pt-6 mt-6">
              <div className="grid grid-cols-2 gap-8 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">审核人签名</label>
                  <Input
                    value={reportData.signature}
                    onChange={(e) => updateReportData('signature', e.target.value)}
                    placeholder="请输入签名或姓名"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">签署日期</label>
                  <Input
                    type="date"
                    value={new Date().toISOString().split('T')[0]}
                    disabled
                  />
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return (
          <div className="p-6 bg-white dark:bg-neutral-900 rounded-lg shadow-sm text-center text-neutral-500 py-12">
            <p>{selectedTemplate.sections.find(s => s.id === sectionId)?.title}</p>
            <p className="text-sm mt-2">该章节内容待完善</p>
          </div>
        )
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            📄 专业报告生成器
          </h2>

          <Button
            variant="secondary"
            onClick={() => setShowTemplateSelector(!showTemplateSelector)}
          >
            📋 切换模板
          </Button>
        </div>

        {showTemplateSelector && (
          <div className="mb-6 p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-slate-50 dark:bg-neutral-800">
            <h3 className="font-medium mb-3">选择报告模板</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {REPORT_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  onClick={() => {
                    setSelectedTemplate(template)
                    setShowTemplateSelector(false)
                    setActiveSection('cover')
                    feedback.showInfo('模板已切换', `已选择 ${template.name}`)
                  }}
                  className={`p-4 border rounded-lg text-left transition-all hover:border-blue-400 hover:shadow-md ${
                    selectedTemplate.id === template.id
                      ? 'border-blue-500 bg-secondary-50 dark:bg-secondary-900/20 ring-2 ring-blue-500'
                      : 'border-neutral-200 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{template.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-neutral-900 dark:text-neutral-100 truncate">
                        {template.name}
                      </h4>
                      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1 line-clamp-2">
                        {template.description}
                      </p>
                      <Badge variant="neutral" className="mt-2 text-[10px]">
                        {template.category}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!showPreview ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {selectedTemplate.sections.map(section => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
                      activeSection === section.id
                        ? 'bg-secondary-container text-secondary-main'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {section.title}
                    {section.required && <span className="ml-1 text-error-400">*</span>}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 ml-4 flex-shrink-0">
                <Button
                  onClick={generatePDF}
                  disabled={isGenerating || !reportData.productName || !reportData.preparer}
                  loading={isGenerating}
                >
                  🖨️ 生成 PDF
                </Button>
              </div>
            </div>

            {isGenerating && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm text-neutral-600 mb-2">
                  <span>正在生成报告...</span>
                  <span>{generationProgress}%</span>
                </div>
                <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary-600 transition-all duration-300"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div ref={reportRef} className="min-h-[600px]">
              {renderSectionContent(activeSection)}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">📋 报告预览</h3>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowPreview(false)}>
                  ← 返回编辑
                </Button>
                <Button variant="secondary" size="sm" onClick={() => window.open(previewUrl, '_blank')}>
                  🔍 全屏查看
                </Button>
                <Button size="sm" onClick={() => {
                  const link = document.createElement('a')
                  link.href = previewUrl
                  link.download = `${reportData.productName || '安全报告'}_${reportData.date}.pdf`
                  link.click()
                  feedback.showSuccess('下载完成', 'PDF报告已保存到本地')
                }}>
                  💾 下载 PDF
                </Button>
                <Button variant="ghost" size="sm" onClick={exportToWord}>
                  📝 导出 Word
                </Button>
                <Button variant="ghost" size="sm" onClick={exportToHTML}>
                  🌐 导出 HTML
                </Button>
              </div>
            </div>

            <Alert variant="info">
              报告已成功生成！您可以预览、下载或导出为其他格式。
            </Alert>

            <div className="border border-neutral-300 dark:border-neutral-600 rounded-lg overflow-hidden bg-white" style={{ height: '800px' }}>
              <iframe
                src={previewUrl}
                className="w-full h-full"
                title="报告预览"
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

export type { SafetyReportTemplateProps, ReportTemplate, ReportData, ReportSection }
