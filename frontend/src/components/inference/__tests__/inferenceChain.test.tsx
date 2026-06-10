import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import InferenceChainVisualizer from '../InferenceChainVisualizer';
import { 
  InferenceChain, 
  InferenceStepType, 
  InferenceStepStatus,
  ToolType 
} from '@/types/inference';

const mockInferenceChain: InferenceChain = {
  id: 'test-chain-001',
  title: '配方分析推理链',
  description: '分析用户查询并生成配方建议的推理过程',
  steps: [
    {
      id: 'step-1',
      type: InferenceStepType.THOUGHT,
      status: InferenceStepStatus.SUCCESS,
      index: 0,
      title: 'Step1: Understand User',
      content: 'User asks about antioxidant formula.',
      confidence: 0.95,
      executionTime: 12,
      createdAt: Date.now(),
    },
    {
      id: 'step-2',
      type: InferenceStepType.ACTION,
      status: InferenceStepStatus.SUCCESS,
      index: 1,
      title: 'Step2: Search Ingredients',
      content: 'Search database for antioxidant ingredients',
      toolCall: {
        toolType: ToolType.DATABASE_QUERY,
        toolName: '成分搜索工具',
        parameters: [{ name: 'efficacy', type: 'string', value: 'antioxidant' }],
        toolId: 'tool-search-001',
      },
      toolResult: {
        toolCallId: 'tool-search-001',
        success: true,
        message: 'Found ingredients',
        data: { ingredients: ['Ginseng', 'Astragalus'] },
        executionTime: 45,
      },
      confidence: 0.92,
      executionTime: 48,
      createdAt: Date.now(),
    },
    {
      id: 'step-3',
      type: InferenceStepType.OBSERVATION,
      status: InferenceStepStatus.SUCCESS,
      index: 2,
      title: 'Step3: Analyze Results',
      content: 'Analysis shows multiple antioxidant ingredients.',
      confidence: 0.98,
      executionTime: 8,
      createdAt: Date.now(),
    },
    {
      id: 'step-4',
      type: InferenceStepType.SUMMARY,
      status: InferenceStepStatus.SUCCESS,
      index: 3,
      title: 'Step4: Generate Suggestion',
      content: 'Provide final formula recommendation.',
      confidence: 0.93,
      executionTime: 10,
      createdAt: Date.now(),
    },
  ],
  startStepId: 'step-1',
  endStepId: 'step-4',
  totalExecutionTime: 78,
  overallConfidence: 0.93,
  createdAt: Date.now(),
};

describe('InferenceChainVisualizer', () => {
  it('should render the inference chain title and description', () => {
    render(<InferenceChainVisualizer chain={mockInferenceChain} />);
    
    expect(screen.getByRole('heading', { name: '配方分析推理链' })).toBeInTheDocument();
    expect(screen.getByText('分析用户查询并生成配方建议的推理过程')).toBeInTheDocument();
  });

  it('should display statistics with total steps', () => {
    render(<InferenceChainVisualizer chain={mockInferenceChain} />);
    
    expect(screen.getByText('总步骤')).toBeInTheDocument();
    const statsElements = screen.getAllByText('4');
    expect(statsElements.length).toBeGreaterThan(0);
  });

  it('should render all step titles', () => {
    render(<InferenceChainVisualizer chain={mockInferenceChain} />);
    
    expect(screen.getAllByText('Step1: Understand User').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Step2: Search Ingredients').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Step3: Analyze Results').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Step4: Generate Suggestion').length).toBeGreaterThan(0);
  });

  it('should navigate between steps using next/prev buttons', async () => {
    render(<InferenceChainVisualizer chain={mockInferenceChain} />);
    
    const nextButton = screen.getByTitle('下一步');
    const prevButton = screen.getByTitle('上一步');
    
    expect(prevButton).toBeDisabled();
    
    fireEvent.click(nextButton);
    
    await waitFor(() => {
      expect(screen.getByTitle('上一步')).not.toBeDisabled();
    });
    
    fireEvent.click(prevButton);
    
    await waitFor(() => {
      expect(screen.getByTitle('上一步')).toBeDisabled();
    });
  });

  it('should filter steps by search query', async () => {
    render(<InferenceChainVisualizer chain={mockInferenceChain} />);
    
    const searchInput = screen.getByPlaceholderText('搜索步骤...');
    
    fireEvent.change(searchInput, { target: { value: 'Search' } });
    
    await waitFor(() => {
      expect(screen.getAllByText('Step2: Search Ingredients').length).toBeGreaterThan(0);
    });
    
    expect(screen.queryAllByText('Step1: Understand User').length).toBe(0);
  });

  it('should expand step on header click', async () => {
    render(<InferenceChainVisualizer chain={mockInferenceChain} />);
    
    const expandButtons = screen.getAllByRole('button');
    const firstExpandButton = expandButtons[0];
    
    fireEvent.click(firstExpandButton);
    
    await waitFor(() => {
      expect(screen.getByText('User asks about antioxidant formula.')).toBeInTheDocument();
    });
  });
});
