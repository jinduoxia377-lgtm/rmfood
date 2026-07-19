import React from 'react';
import { recognizeIntent, INTENT_NAMES } from './intentRecognizer';
import type { IntentType } from './intentRecognizer';
import IngredientAnalyzer from './IngredientAnalyzer';
import PeptideAnalyzer from './PeptideAnalyzer';
import { TCMService } from '@/services/professional/tcmService';
import { PeptideService } from '@/services/professional/peptideService';

interface AnalysisMessageRendererProps {
  messageContent: string;
  onAnalysisComplete?: () => void;
}

interface AnalysisResult {
  intent: IntentType;
  confidence: number;
  data?: any;
}

const tcmService = new TCMService();
const peptideService = PeptideService.getInstance();

export const AnalysisMessageRenderer: React.FC<AnalysisMessageRendererProps> = ({
  messageContent,
  onAnalysisComplete,
}) => {
  const [analysisResult, setAnalysisResult] = React.useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const analyzeMessage = async () => {
      setIsAnalyzing(true);
      setError(null);

      try {
        const intentResult = recognizeIntent(messageContent);

        setAnalysisResult({
          intent: intentResult.intent,
          confidence: intentResult.confidence,
        });

        if (onAnalysisComplete) {
          onAnalysisComplete();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '分析失败');
      } finally {
        setIsAnalyzing(false);
      }
    };

    if (messageContent) {
      analyzeMessage();
    }
  }, [messageContent, onAnalysisComplete]);

  if (isAnalyzing) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-neutral-600">正在分析意图...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error-50 border border-red-200 rounded-lg p-4">
        <p className="text-error-800">分析错误: {error}</p>
      </div>
    );
  }

  if (!analysisResult) {
    return null;
  }

  const { intent, confidence } = analysisResult;

  if (confidence < 0.5 || intent === 'unknown') {
    return null;
  }

  const renderAnalysisComponent = () => {
    switch (intent) {
      case 'ingredient_analysis':
        return (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 bg-secondary-100 text-secondary-800 rounded-full text-sm font-medium">
                {INTENT_NAMES[intent]} ({(confidence * 100).toFixed(0)}%)
              </span>
            </div>
            <IngredientAnalyzer />
          </div>
        );

      case 'peptide_analysis':
        return (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 bg-accent-100 text-accent-800 rounded-full text-sm font-medium">
                {INTENT_NAMES[intent]} ({(confidence * 100).toFixed(0)}%)
              </span>
            </div>
            <PeptideAnalyzer />
          </div>
        );

      default:
        return null;
    }
  };

  return renderAnalysisComponent();
};

export default AnalysisMessageRenderer;
