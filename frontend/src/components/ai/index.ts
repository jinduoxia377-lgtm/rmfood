/**
 * AI模块 — 统一导出入口
 *
 * 模块分组: ChatTab(对话) | Generate(生成) | Safety(安全)
 *           Peptide(肽) | Charts(图表) | Config(配置)
 *
 * @version 3.0.0
 */

// 智能对话
export { ChatTab } from './features/ChatTab'

// 配方生成
export { GenerateTab } from './features/GenerateTab'
export { AIGenerator } from './AIGenerator'
export { NeuralGeneratePanel } from './NeuralGeneratePanel'
export { NeuralResultCard } from './NeuralResultCard'
export { GenerationProgressPanel } from './GenerationProgressPanel'
export { FormulaWizard } from './features/FormulaWizard'
export { TemplateGallery } from './TemplateGallery'
export { MultiCandidateCompare } from './MultiCandidateCompare'

// 安全检查
export { SafetyTab } from './features/SafetyTab'

// 功效分析
export { SynergyTab } from './features/SynergyTab'
export { PatentSynergyDetails } from './PatentSynergyDetails'

// 口感/稳定性
export { TastePredictTab } from './features/TastePredictTab'
export { StabilityPredictTab } from './features/StabilityPredictTab'

// 肽分析
export { AdvancedPeptideAnalyzer } from './AdvancedPeptideAnalyzer'
export { AdvancedPeptideDesign } from './AdvancedPeptideDesign'

// 配置
export { ApiKeyConfigPanel } from './ApiKeyConfigPanel'
export { ModelSelector } from './ModelSelector'
export { ModelConfigPanel } from './ModelConfigPanel'
export { ParameterAdjustPanel } from './ParameterAdjustPanel'

// 推荐/优化
export { AIRecommendationSidebar } from './AIRecommendationSidebar'
export { PersonalizedRecommendations } from './PersonalizedRecommendations'
export { OptimizationAdvisor } from './OptimizationAdvisor'
export { PromptOptimizer } from './PromptOptimizer'

// 图表
export { RadarChart } from './charts/RadarChart'
export { BarChart } from './charts/BarChart'
export { PieChart } from './charts/PieChart'
export { ScoreCards } from './charts/ScoreCards'

// 学术报告
export { AcademicReportEnhanced } from './AcademicReportEnhanced'
export { FormulaAcademicReport } from './FormulaAcademicReport'
