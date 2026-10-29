import AcademicReportV2 from '@/services/academicReportServiceV2'
import { ReportModuleType } from '@/types/academicReportModules'
import type { AICandidate } from '@/types'

// Mock the feedback and error handler services
vi.mock('@/services/feedbackService', () => ({
  feedbackService: {
    startOperation: vi.fn(),
    showProgress: vi.fn(),
    updateProgress: vi.fn(),
    completeProgress: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    completeOperation: vi.fn(),
  },
}))

vi.mock('@/services/errorHandler', () => ({
  errorHandler: {
    validationError: vi.fn(),
    handleError: vi.fn(),
  },
  ErrorCategory: {
    RUNTIME: 'RUNTIME',
  },
}))

// Mock jsPDF
vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    text: vi.fn(),
    addPage: vi.fn(),
    save: vi.fn(),
    internal: {
      pageSize: {
        getWidth: vi.fn(() => 210),
        getHeight: vi.fn(() => 297),
      },
    },
    setFillColor: vi.fn(),
    rect: vi.fn(),
  })),
}))

describe('AcademicReportV2', () => {
  const mockCandidate: AICandidate = {
    id: 'cand-001',
    name: '测试配方',
    effects: [],
    formula_name: '测试配方',
    herb_combination: [],
    peptide_candidates: [],
    synergy_score: 0.8,
    safety_passed: true,
    safety_details: {},
    taste_score: 0.7,
    stability_score: 0.75,
    overall_score: 0.75,
  }

  const mockEffects = ['增强免疫', '抗氧化', '抗疲劳']

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize correctly with candidate and effects', () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      expect(report).toBeDefined()
    })

    it('should initialize with research report template by default', () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      const config = report.getConfig()
      expect(config.metadata.reportType).toBe('research_report')
    })
  })

  describe('Metadata Operations', () => {
    it('should update metadata correctly', () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      const newTitle = '新标题'
      const newAuthors = ['新作者1', '新作者2']
      
      report.updateMetadata({
        title: newTitle,
        authors: newAuthors,
      })

      const config = report.getConfig()
      expect(config.metadata.title).toBe(newTitle)
      expect(config.metadata.authors).toEqual(newAuthors)
    })

    it('should get current metadata', () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      const metadata = report.getMetadata()
      
      expect(metadata).toBeDefined()
      expect(metadata.title).toBeDefined()
      expect(metadata.authors).toBeDefined()
    })
  })

  describe('Module Configuration', () => {
    it('should get enabled modules', () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      const enabledModules = report.getEnabledModules()
      
      expect(enabledModules).toBeDefined()
      expect(enabledModules.length).toBeGreaterThan(0)
    })

    it('should only enable modules contained in the template (P1-1)', () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects, 'journal')
      const enabledModules = report.getEnabledModules()
      // 期刊论文模板不包含 LITERATURE_REVIEW 与 APPENDIX
      expect(enabledModules).not.toContain(ReportModuleType.LITERATURE_REVIEW)
      expect(enabledModules).not.toContain(ReportModuleType.APPENDIX)
      expect(enabledModules).toContain(ReportModuleType.ABSTRACT)
      expect(enabledModules).toContain(ReportModuleType.REFERENCES)
    })

    it('should update module configuration', () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      
      report.updateModuleConfig(ReportModuleType.ABSTRACT, {
        enabled: false,
      })

      const enabledModules = report.getEnabledModules()
      expect(enabledModules.includes(ReportModuleType.ABSTRACT)).toBe(false)
    })
  })

  describe('Template Operations', () => {
    it('should switch to journal template', () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      report.switchTemplate('journal')
      
      const config = report.getConfig()
      expect(config.metadata.reportType).toBe('journal')
    })

    it('should switch to thesis template', () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      report.switchTemplate('thesis')
      
      const config = report.getConfig()
      expect(config.metadata.reportType).toBe('thesis')
    })

    it('should reset generation state when switching template (P1-4)', async () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      await report.generateReport()
      expect(report.getState().status).toBe('success')

      report.switchTemplate('thesis')
      const state = report.getState()
      expect(state.status).toBe('idle')
      expect(state.progress).toBe(0)
      expect(state.completedModules).toEqual([])
    })
  })

  describe('Report Generation', () => {
    it('should generate report successfully', async () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      const result = await report.generateReport()
      
      expect(result).toBe(true)
    })

    it('should get state after generation', async () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      await report.generateReport()
      
      const state = report.getState()
      expect(state.status).toBe('success')
    })
  })

  describe('getGeneratedModules (P0-2)', () => {
    it('should return empty array before generation', () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      expect(report.getGeneratedModules()).toEqual([])
    })

    it('should return generated modules in enabled order after generation', async () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects, 'journal')
      await report.generateReport()

      const modules = report.getGeneratedModules()
      expect(modules.length).toBeGreaterThan(0)
      // 按启用顺序返回：首个应为 ABSTRACT
      expect(modules[0]!.type).toBe(ReportModuleType.ABSTRACT)
      // 不包含模板外模块
      expect(modules.some(m => m.type === ReportModuleType.APPENDIX)).toBe(false)
      // 数据为副本，修改返回数据不影响内部模块
      modules[0]!.data.content = '被修改的内容'
      const again = report.getGeneratedModules()
      expect(again[0]!.data.content).not.toBe('被修改的内容')
    })
  })

  describe('Export Operations', () => {
    it('should export Markdown', async () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      await report.generateReport()
      
      const markdown = report.exportMarkdown()
      expect(markdown).toBeDefined()
      expect(typeof markdown).toBe('string')
      expect(markdown.length).toBeGreaterThan(0)
    })

    it('should export Markdown without TOC', async () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      await report.generateReport()
      
      const markdown = report.exportMarkdown(false)
      expect(markdown).toBeDefined()
    })

    it('should export HTML', async () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      await report.generateReport()
      
      const html = report.exportHtml()
      expect(html).toBeDefined()
      expect(typeof html).toBe('string')
      expect(html.length).toBeGreaterThan(0)
      expect(html).toContain('<!DOCTYPE html>')
    })

    it('should export HTML without TOC', async () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      await report.generateReport()
      
      const html = report.exportHtml('html', false)
      expect(html).toBeDefined()
    })

    it('should export report successfully', async () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      await report.generateReport()
      
      const result = await report.exportReport('markdown')
      expect(result).toBe(true)
    })
  })

  describe('State Management', () => {
    it('should add state listener and notify', () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      const listener = vi.fn()
      
      const unsubscribe = report.addStateListener(listener)
      
      expect(unsubscribe).toBeDefined()
      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('Table Numbering', () => {
    it('should generate tables with sequential numbers', async () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      await report.generateReport()
      
      const html = report.exportHtml()
      // Check if tables have numbered titles
      expect(html).toContain('表1')
      expect(html).toContain('表2')
    })
  })

  describe('TOC Generation', () => {
    it('should include TOC in Markdown export', async () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      await report.generateReport()
      
      const markdown = report.exportMarkdown()
      expect(markdown).toContain('目录')
    })

    it('should include TOC in HTML export', async () => {
      const report = new AcademicReportV2(mockCandidate, mockEffects)
      await report.generateReport()
      
      const html = report.exportHtml()
      expect(html).toContain('目录')
    })
  })
})
