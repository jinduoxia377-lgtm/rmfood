/**
 * API 类型定义测试
 * 验证类型定义的完整性和正确性
 */
import type { 
  ApiResponse,
  PaginatedResponse,
  Formula,
  AIModel,
  AcademicReport,
  User,
  Notification 
} from '@/types/api'

describe('API Types', () => {
  describe('ApiResponse', () => {
    it('should create valid success response', () => {
      const response: ApiResponse<string> = {
        success: true,
        data: 'test',
        message: 'Success'
      }
      
      expect(response.success).toBe(true)
      expect(response.data).toBe('test')
    })

    it('should create valid error response', () => {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Something went wrong'
      }
      
      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
    })
  })

  describe('PaginatedResponse', () => {
    it('should create valid paginated response', () => {
      const response: PaginatedResponse<{ id: string }> = {
        items: [{ id: '1' }, { id: '2' }],
        total: 10,
        page: 1,
        pageSize: 2,
        totalPages: 5
      }
      
      expect(response.items).toHaveLength(2)
      expect(response.totalPages).toBe(5)
    })
  })

  describe('Formula type', () => {
    it('should create valid formula object', () => {
      const formula: Formula = {
        id: '1',
        name: 'Test Formula',
        status: 'draft',
        category: 'health',
        tags: ['tag1', 'tag2'],
        ingredients: [
          { id: 'ing-1', name: 'Ingredient 1', dosage: '100mg', role: 'monarch' },
          { id: 'ing-2', name: 'Ingredient 2', dosage: '50mg', role: 'minister' }
        ],
        effects: ['Effect 1'],
        scores: { synergy: 85, taste: 90, stability: 88, overall: 87.7 },
        creatorId: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      expect(formula.ingredients).toHaveLength(2)
      expect(formula.scores.overall).toBeGreaterThan(80)
    })
  })

  describe('AIModel type', () => {
    it('should create valid AI model config', () => {
      const model: AIModel = {
        id: 'model-1',
        name: 'GPT-4',
        type: 'llm',
        provider: 'OpenAI',
        version: '4.0',
        status: 'online',
        config: {
          temperature: 0.7,
          maxTokens: 2000,
          parameters: {}
        }
      }

      expect(model.type).toBe('llm')
      expect(model.config.temperature).toBeLessThan(1)
    })
  })

  describe('AcademicReport type', () => {
    it('should create valid academic report', () => {
      const report: AcademicReport = {
        id: 'report-1',
        title: 'Research Paper',
        abstract: 'This is a test abstract',
        type: 'research',
        chapters: [
          {
            id: 'ch-1',
            title: 'Introduction',
            order: 1,
            content: 'Introduction content',
            type: 'introduction'
          }
        ],
        references: [],
        authorId: 'user-1',
        status: 'draft',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      expect(report.chapters).toHaveLength(1)
      expect(report.chapters[0].type).toBe('introduction')
    })
  })

  describe('User type', () => {
    it('should create valid user object', () => {
      const user: User = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        displayName: 'Test User',
        role: 'admin',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      expect(user.role).toBe('admin')
      expect(user.isActive).toBe(true)
    })
  })

  describe('Notification type', () => {
    it('should create valid notification', () => {
      const notification: Notification = {
        id: 'notif-1',
        userId: 'user-1',
        title: 'New Message',
        message: 'You have a new message',
        type: 'info',
        read: false,
        createdAt: '2024-01-01T00:00:00Z'
      }

      expect(notification.read).toBe(false)
      expect(notification.type).toBe('info')
    })
  })
})
