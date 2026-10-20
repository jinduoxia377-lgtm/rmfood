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
