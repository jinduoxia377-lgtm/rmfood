import { Card } from '@/components/ui';
import { ScoreRadarChart, ScoreCards } from './charts';
import type { AICandidate } from '@/api/ai';
import { PatentSynergyDetails } from './PatentSynergyDetails';
import { FormulaComposition } from './components/FormulaComposition';
import { PeptideInfo } from './components/PeptideInfo';
import { ContraindicationWarning } from './components/ContraindicationWarning';
import { EditIndicator } from './components/EditIndicator';
import { SimpleEditToolbar } from './components/SimpleEditToolbar';
import { CardHeader } from './components/CardHeader';
import { ActionButtons } from './components/ActionButtons';
import { useNeuralResultCard } from './hooks/useNeuralResultCard';
import { FormulaValidationModal } from '@/components/ai/features/components/FormulaValidationModal';

interface NeuralResultCardProps {
  candidate: AICandidate;
  index: number;
  generatorType?: string;
  onSaveSuccess?: (formulaId: number, candidateId: string) => void;
  onViewReport?: (candidate: AICandidate) => void;
  onEdit?: (candidate: AICandidate, index: number) => void;
  onSelect?: (candidate: AICandidate) => void;
  isSelected?: boolean;
  savedFormulas?: Map<string, { formulaId: number; savedAt: number }>;
  selectedEffects?: string[];
}

export function NeuralResultCard({
  candidate,
  index,
  generatorType,
  onSaveSuccess,
  onViewReport,
  onEdit,
  savedFormulas = new Map(),
  selectedEffects = [],
}: NeuralResultCardProps) {
  const {
    isSaving,
    isEditing,
    editedName,
    editedDescription,
    isAutoSaving,
    hasUnsavedChanges,
    historyIndex,
    historyStack,
    isAlreadySaved,
    nameInputRef,
    descriptionTextareaRef,
    handleUndo,
    handleRedo,
    handleReset,
    applyFormatting,
    enterEditMode,
    exitEditMode,
    saveEdit,
    saveToFormulaManager,
    handleNameChange,
    handleDescriptionChange,
    validationResult,
    validationModalOpen,
    setValidationModalOpen,
    setValidationResult,
    validationNotice,
    setValidationNotice,
  } = useNeuralResultCard({
    candidate,
    index,
    onSaveSuccess,
    onEdit,
    savedFormulas,
    selectedEffects,
  });

  return (
    <Card
      hoverable
      className={`relative overflow-hidden transition-all duration-300 ${isEditing ? 'ring-2 ring-primary-500 shadow-lg' : ''} group`}
      style={{ borderRadius: 'var(--radius-xl)' }}
    >
      {isEditing && <EditIndicator isAutoSaving={isAutoSaving} hasUnsavedChanges={hasUnsavedChanges} />}
      {validationNotice && (
        <div
          role="status"
          className="px-3 py-2 text-xs font-medium bg-warning-50 dark:bg-warning-300/15 text-warning-700 dark:text-warning-700 border-b border-warning-200 dark:border-warning-800"
        >
          ⚠ {validationNotice}
          <button
            className="ml-2 underline hover:opacity-80"
            onClick={() => setValidationNotice(null)}
            aria-label="关闭提示"
          >
            关闭
          </button>
        </div>
      )}
      <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-primary-500/8 via-primary-400/5 to-transparent rounded-bl-full -translate-y-1/3 translate-x-1/3 opacity-60" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-accent-500/5 to-transparent rounded-tr-full translate-y-1/2 -translate-x-1/2 opacity-40" />
      <div className={`relative p-6 space-y-5 ${isEditing ? 'pt-12' : ''}`}>
        <CardHeader
          isEditing={isEditing}
          editedName={editedName}
          safetyPassed={candidate.safety_passed ?? false}
          overallScore={candidate.overall_score}
          nameInputRef={nameInputRef as React.RefObject<HTMLInputElement>}
          onNameChange={handleNameChange}
          generatorType={generatorType}
        />
        {isEditing ? (
          <div className="space-y-3">
            <SimpleEditToolbar
              canUndo={historyIndex > 0}
              canRedo={historyIndex < historyStack.length - 1}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onFormat={applyFormatting}
              onReset={handleReset}
            />
            <textarea
              ref={descriptionTextareaRef}
              value={editedDescription}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              className="w-full min-h-[100px] p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none resize-none text-sm transition-all duration-200"
              style={{ color: 'var(--text-secondary)' }}
              placeholder="输入配方描述..."
            />
          </div>
        ) : (
          editedDescription && (
            <div className="relative">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {editedDescription}
              </p>
            </div>
          )
        )}
        <ScoreRadarChart
          synergyScore={candidate.synergy_score}
          tasteScore={candidate.taste_score}
          stabilityScore={candidate.stability_score}
          overallScore={candidate.overall_score}
        />
        <ScoreCards
          synergyScore={candidate.synergy_score}
          tasteScore={candidate.taste_score}
          stabilityScore={candidate.stability_score}
          overallScore={candidate.overall_score}
        />
        {candidate.patent_synergy_scores && (
          <PatentSynergyDetails patentSynergyScores={candidate.patent_synergy_scores} />
        )}
        {candidate.herb_combination && candidate.herb_combination.length > 0 && (
          <FormulaComposition herbCombination={candidate.herb_combination} />
        )}
        {candidate.peptide_candidates && candidate.peptide_candidates.length > 0 && (
          <PeptideInfo peptideCandidates={candidate.peptide_candidates} />
        )}
        <ContraindicationWarning contraindications={candidate.safety_details?.contraindications || []} />
        <ActionButtons
          isEditing={isEditing}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={isSaving}
          isAlreadySaved={isAlreadySaved}
          candidate={candidate}
          onEnterEdit={enterEditMode}
          onExitEdit={exitEditMode}
          onSaveEdit={saveEdit}
          onViewReport={onViewReport}
          onSaveToManager={saveToFormulaManager}
        />
      </div>

      {/* 成分级配方校验报告弹窗 */}
      <FormulaValidationModal
        open={validationModalOpen}
        result={validationResult}
        formulaName={typeof candidate.formula_name === 'string' ? candidate.formula_name : undefined}
        onConfirm={() => {
          // CRITICAL 阻断时确认按钮禁用，此回调实际只在 warnings 放行场景被触发；
          // 关闭弹窗后由用户重新点击「保存」完成落库。
          setValidationModalOpen(false)
          setValidationResult(null)
        }}
        onCancel={() => {
          setValidationModalOpen(false)
          setValidationResult(null)
        }}
      />
    </Card>
  );
}

export default NeuralResultCard;
