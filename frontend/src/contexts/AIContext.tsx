import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { AICandidate } from '@/types';

export interface FormulaVersion {
  id: string;
  formulaId: number;
  version: number;
  name: string;
  description?: string;
  snapshot: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AIContextValue {
  // 配方相关
  currentFormula: AICandidate | null;
  setCurrentFormula: (formula: AICandidate | null) => void;
  generateResult: AICandidate[] | null;
  setGenerateResult: (candidates: AICandidate[] | null) => void;
  selectedReport: AICandidate | null;
  setSelectedReport: (candidate: AICandidate | null) => void;

  // 聊天相关
  chatMessages: ChatMessage[];
  setChatMessages: (messages: ChatMessage[]) => void;
  addChatMessage: (message: ChatMessage) => void;

  // 版本管理相关
  formulaVersions: FormulaVersion[];
  setFormulaVersions: (versions: FormulaVersion[]) => void;
  selectedVersion: FormulaVersion | null;
  setSelectedVersion: (version: FormulaVersion | null) => void;

  // 模型相关
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  useLlm: boolean;
  setUseLlm: (use: boolean) => void;

  // UI状态
  viewMode: 'card' | 'compare';
  setViewMode: (mode: 'card' | 'compare') => void;
  selectedCompareIndex: number | undefined;
  setSelectedCompareIndex: (index: number | undefined) => void;

  // 面板状态
  showSharePanel: boolean;
  setShowSharePanel: (show: boolean) => void;
  showOptimizationAdvisor: boolean;
  setShowOptimizationAdvisor: (show: boolean) => void;
  paramPanelExpanded: boolean;
  setParamPanelExpanded: (expanded: boolean) => void;

  // 错误状态
  errorMessage: string | null;
  setErrorMessage: (message: string | null) => void;
  saveSuccess: { formulaId: number; formulaName: string } | null;
  setSaveSuccess: (success: { formulaId: number; formulaName: string } | null) => void;
}

const AIContext = createContext<AIContextValue | null>(null);

export function AIProvider({ children }: { children: ReactNode }) {
  // 配方相关
  const [currentFormula, setCurrentFormula] = useState<AICandidate | null>(null);
  const [generateResult, setGenerateResult] = useState<AICandidate[] | null>(null);
  const [selectedReport, setSelectedReport] = useState<AICandidate | null>(null);

  // 聊天相关
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // 版本管理相关
  const [formulaVersions, setFormulaVersions] = useState<FormulaVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<FormulaVersion | null>(null);

  // 模型相关
  const [selectedModel, setSelectedModel] = useState('formula_gpt');
  const [useLlm, setUseLlm] = useState(false);

  // UI状态
  const [viewMode, setViewMode] = useState<'card' | 'compare'>('card');
  const [selectedCompareIndex, setSelectedCompareIndex] = useState<number | undefined>(undefined);

  // 面板状态
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [showOptimizationAdvisor, setShowOptimizationAdvisor] = useState(false);
  const [paramPanelExpanded, setParamPanelExpanded] = useState(false);

  // 错误状态
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<{ formulaId: number; formulaName: string } | null>(null);

  const addChatMessage = useCallback((message: ChatMessage) => {
    setChatMessages((prev) => [...prev, message]);
  }, []);

  return (
    <AIContext.Provider
      value={{
        // 配方相关
        currentFormula,
        setCurrentFormula,
        generateResult,
        setGenerateResult,
        selectedReport,
        setSelectedReport,

        // 聊天相关
        chatMessages,
        setChatMessages,
        addChatMessage,

        // 版本管理相关
        formulaVersions,
        setFormulaVersions,
        selectedVersion,
        setSelectedVersion,

        // 模型相关
        selectedModel,
        setSelectedModel,
        useLlm,
        setUseLlm,

        // UI状态
        viewMode,
        setViewMode,
        selectedCompareIndex,
        setSelectedCompareIndex,

        // 面板状态
        showSharePanel,
        setShowSharePanel,
        showOptimizationAdvisor,
        setShowOptimizationAdvisor,
        paramPanelExpanded,
        setParamPanelExpanded,

        // 错误状态
        errorMessage,
        setErrorMessage,
        saveSuccess,
        setSaveSuccess,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAIContext() {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAIContext must be used within AIProvider');
  }
  return context;
}
