import { render, screen, fireEvent } from '@testing-library/react'
import { PersonalizedRecommendations } from '@/components/ai/PersonalizedRecommendations'
import { useUserPreferenceStore } from '@/stores/userPreferenceStore'
import type { GenerationHistory } from '@/stores/userPreferenceStore'

vi.mock('@/stores/userPreferenceStore')

const mockHistory: GenerationHistory[] = [
  {
    id: 'gen_1',
    effects: ['增强免疫', '抗氧化'],
    ingredients: ['枸杞', '黄芪', '党参'],
    scores: { synergy: 0.85, taste: 0.78, stability: 0.82, overall: 0.82 },
    generator: 'neural',
    createdAt: Date.now() - 86400000,
    liked: true,
  },
  {
    id: 'gen_2',
    effects: ['降血压', '改善睡眠'],
    ingredients: ['酸枣仁', '黄芪'],
    scores: { synergy: 0.75, taste: 0.68, stability: 0.72, overall: 0.72 },
    generator: 'rule',
    createdAt: Date.now() - 172800000,
    liked: false,
  },
]

describe('PersonalizedRecommendations', () => {
  const mockGetPersonalizedRecommendations = vi.fn()
  const mockToggleHistoryLike = vi.fn()
  const mockAddRecommendationFeedback = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useUserPreferenceStore as unknown as vi.Mock).mockReturnValue({
      getPersonalizedRecommendations: mockGetPersonalizedRecommendations,
      toggleHistoryLike: mockToggleHistoryLike,
      addRecommendationFeedback: mockAddRecommendationFeedback,
      preferences: {
        frequentEffects: ['增强免疫', '降血压', '抗氧化'],
        favoriteIngredients: ['枸杞', '黄芪'],
        tasteProfile: { sweetness: 0.5, bitterness: 0.3, astringency: 0.2, umami: 0.4 },
        safetyLevel: 0.8,
        budgetRange: { min: 0, max: 1000 },
        lastUpdated: Date.now(),
      },
    })
  })

  it('renders empty state when no recommendations', () => {
    mockGetPersonalizedRecommendations.mockReturnValue([])

    render(<PersonalizedRecommendations />)

    expect(screen.getByText('个性化推荐')).toBeInTheDocument()
    expect(screen.getByText('系统将学习您的偏好，为您推荐更符合需求的配方')).toBeInTheDocument()
  })

  it('renders frequent effects when no recommendations', () => {
    mockGetPersonalizedRecommendations.mockReturnValue([])
    ;(useUserPreferenceStore as unknown as vi.Mock).mockReturnValue({
      getPersonalizedRecommendations: mockGetPersonalizedRecommendations,
      toggleHistoryLike: mockToggleHistoryLike,
      addRecommendationFeedback: mockAddRecommendationFeedback,
      preferences: {
        frequentEffects: ['增强免疫', '降血压'],
        favoriteIngredients: [],
        tasteProfile: { sweetness: 0.5, bitterness: 0.3, astringency: 0.2, umami: 0.4 },
        safetyLevel: 0.8,
        budgetRange: { min: 0, max: 1000 },
        lastUpdated: Date.now(),
      },
    })

    render(<PersonalizedRecommendations />)

    expect(screen.getByText('常用功效：')).toBeInTheDocument()
    expect(screen.getByText('增强免疫')).toBeInTheDocument()
    expect(screen.getByText('降血压')).toBeInTheDocument()
  })

  it('renders recommendations when available', () => {
    mockGetPersonalizedRecommendations.mockReturnValue(mockHistory)

    render(<PersonalizedRecommendations maxDisplay={2} />)

    expect(screen.getByText('为您推荐')).toBeInTheDocument()
    expect(screen.getByText('基于您的历史偏好')).toBeInTheDocument()
  })

  it('displays correct number of recommendations based on maxDisplay', () => {
    mockGetPersonalizedRecommendations.mockReturnValue(mockHistory)

    render(<PersonalizedRecommendations maxDisplay={1} />)

    expect(screen.getByText('#1')).toBeInTheDocument()
  })

  it('calls onSelectRecommendation when recommendation is clicked', () => {
    const mockOnSelect = vi.fn()
    mockGetPersonalizedRecommendations.mockReturnValue(mockHistory)

    render(<PersonalizedRecommendations onSelectRecommendation={mockOnSelect} />)

    const recommendation = screen.getByText('增强免疫').closest('.cursor-pointer')
    if (recommendation) {
      fireEvent.click(recommendation)
      expect(mockOnSelect).toHaveBeenCalledWith(mockHistory[0])
    }
  })

  it('toggles like when thumbs up button is clicked', () => {
    const mockOnSelect = vi.fn()
    mockGetPersonalizedRecommendations.mockReturnValue(mockHistory)

    render(<PersonalizedRecommendations onSelectRecommendation={mockOnSelect} />)

    const likeButton = screen.getAllByTitle('喜欢')[0]
    fireEvent.click(likeButton)

    expect(mockAddRecommendationFeedback).toHaveBeenCalledWith({
      recommendationId: mockHistory[0].id,
      liked: true,
      timestamp: expect.any(Number),
    })
  })

  it('toggles dislike when thumbs down button is clicked', () => {
    const mockOnSelect = vi.fn()
    mockGetPersonalizedRecommendations.mockReturnValue(mockHistory)

    render(<PersonalizedRecommendations onSelectRecommendation={mockOnSelect} />)

    const dislikeButton = screen.getAllByTitle('不喜欢')[0]
    fireEvent.click(dislikeButton)

    expect(mockAddRecommendationFeedback).toHaveBeenCalledWith({
      recommendationId: mockHistory[0].id,
      liked: false,
      timestamp: expect.any(Number),
    })
  })

  it('displays ingredient count correctly', () => {
    mockGetPersonalizedRecommendations.mockReturnValue(mockHistory)

    render(<PersonalizedRecommendations />)

    expect(screen.getByText('3种原料')).toBeInTheDocument()
    expect(screen.getByText('2种原料')).toBeInTheDocument()
  })

  it('displays scores correctly', () => {
    mockGetPersonalizedRecommendations.mockReturnValue(mockHistory)

    render(<PersonalizedRecommendations />)

    expect(screen.getByText('0.82')).toBeInTheDocument()
    expect(screen.getByText('0.72')).toBeInTheDocument()
  })

  it('shows view more button when recommendations exceed maxDisplay', () => {
    mockGetPersonalizedRecommendations.mockReturnValue(mockHistory)

    render(<PersonalizedRecommendations maxDisplay={1} />)

    expect(screen.getByText('查看更多推荐 (1)')).toBeInTheDocument()
  })

  it('displays correct generator type', () => {
    mockGetPersonalizedRecommendations.mockReturnValue(mockHistory)

    render(<PersonalizedRecommendations />)

    expect(screen.getByText('neural')).toBeInTheDocument()
    expect(screen.getByText('rule')).toBeInTheDocument()
  })
})
