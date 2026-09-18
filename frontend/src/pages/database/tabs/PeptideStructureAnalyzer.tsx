/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 肽链结构分析器 — 基于 PepLink 的序列↔SMILES 双向转换
 * 增强版：完整的活性预测、安全性评估、风味分析
 */
import { useState, useCallback, useEffect } from 'react';
import { peptideStructureService } from '@/services/professional/peptideStructureService';
import { Button, Input, Card, Badge } from '@/components/ui';
import { Beaker, ArrowRightLeft, Dna, ShieldCheck, Activity, FlaskConical, AlertCircle, CheckCircle } from 'lucide-react';

// ─── 类型定义 ───
interface SequenceToSmilesRequest {
  sequence: string;
  n_terminal?: string;
  c_terminal?: string;
  unusual_aaminos?: Array<{ position: number; name: string }>;
  intrachain_bonds?: Array<{ type: string; residues: string[] }>;
  output_format?: string;
}

interface SMILESResult {
  success: boolean;
  sequence: string;
  smiles?: string;
  selfies?: string;
  error_message?: string;
}

interface ActivityScore {
  score: number;
  level: 'high' | 'medium' | 'low' | 'none';
}

interface SafetyInfo {
  food_score: number;
  is_allergen: boolean;
  is_toxic: boolean;
  digestibility: string;
}

interface TasteInfo {
  bitterness: number;
  umami: number;
}

interface SourceInfo {
  food?: string;
  database?: string;
  references: string[];
}

interface PeptideAnalysisResult {
  sequence: string;
  smiles?: string;
  selfies?: string;
  molecular_weight: number;
  isoelectric_point: number;
  hydrophobicity: number;
  ace_inhibition: ActivityScore;
  antioxidant: ActivityScore;
  antimicrobial: ActivityScore;
  safety: SafetyInfo;
  taste: TasteInfo;
  source: SourceInfo;
  analysis_time: string;
}

// ─── 评分等级颜色 ───
function getScoreColor(score: number): string {
  if (score >= 0.8) return 'text-green-600 dark:text-green-400';
  if (score >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function getScoreBg(score: number): string {
  if (score >= 0.8) return 'bg-green-100 dark:bg-green-900/30';
  if (score >= 0.5) return 'bg-yellow-100 dark:bg-yellow-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
}

function getActivityBadge(level: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (level) {
    case 'high': return 'success';
    case 'medium': return 'warning';
    case 'low': return 'danger';
    default: return 'neutral';
  }
}

// ─── 评分进度条组件 ───
function ScoreProgress({ label, score, colorClass }: { label: string; score: number; colorClass: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--text-secondary,#6B7280)] dark:text-[var(--text-secondary-dark,#9CA3AF)]">{label}</span>
        <span className={`font-medium ${colorClass}`}>{(score * 100).toFixed(1)}%</span>
      </div>
      <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${
            score >= 0.8 ? 'bg-green-500' :
            score >= 0.5 ? 'bg-yellow-500' :
            score > 0 ? 'bg-red-500' : 'bg-neutral-400'
          }`}
          style={{ width: `${score * 100}%` }}
        />
      </div>
    </div>
  );
}

// ─── 主组件 ───
export default function PeptideStructureAnalyzer() {
  const [sequence, setSequence] = useState('');
  const [nTerminal, setNTerminal] = useState('');
  const [cTerminal, setCTerminal] = useState('');
  const [result, setResult] = useState<PeptideAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'analyze' | 'convert'>('analyze');
  const [initialized, setInitialized] = useState(false);

  // 初始化 CSRF
  useEffect(() => {
    peptideStructureService.init().then(() => setInitialized(true));
  }, []);

  // 完整分析
  const handleAnalyze = useCallback(async () => {
    if (!sequence || sequence.length < 2) {
      setError('请输入至少2个氨基酸的序列');
      return;
    }
    if (sequence.length > 100) {
      setError('序列长度不能超过100个氨基酸');
      return;
    }
    
    // 验证序列格式
    const validPattern = /^[ACDEFGHIKLMNPQRSTVYW]+$/;
    if (!validPattern.test(sequence.toUpperCase())) {
      setError('序列包含无效字符，请使用标准单字母氨基酸代码');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await peptideStructureService.analyzePeptide(sequence.toUpperCase());
      setResult(res as unknown as PeptideAnalysisResult);
    } catch (e: any) {
      setError(e.message || '分析失败');
    } finally {
      setLoading(false);
    }
  }, [sequence]);

  // 序列转 SMILES
  const handleConvert = useCallback(async () => {
    if (!sequence || sequence.length < 2) {
      setError('请输入至少2个氨基酸的序列');
      return;
    }
    
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await peptideStructureService.sequenceToSmiles({
        sequence: sequence.toUpperCase(),
        n_terminal: nTerminal || undefined,
        c_terminal: cTerminal || undefined,
      });
      if (res.smiles) {
        setResult({
          sequence: res.sequence || sequence.toUpperCase(),
          smiles: res.smiles,
          selfies: res.selfies,
          molecular_weight: 0,
          isoelectric_point: 0,
          hydrophobicity: 0,
          ace_inhibition: { score: 0, level: 'none' },
          antioxidant: { score: 0, level: 'none' },
          antimicrobial: { score: 0, level: 'none' },
          safety: { food_score: 0, is_allergen: false, is_toxic: false, digestibility: 'N/A' },
          taste: { bitterness: 0, umami: 0 },
          source: { food: undefined, database: undefined, references: [] },
          analysis_time: new Date().toISOString(),
        } as PeptideAnalysisResult);
      }
    } catch (e: any) {
      setError(e.message || '转换失败');
    } finally {
      setLoading(false);
    }
  }, [sequence, nTerminal, cTerminal]);

  // 清空结果
  const handleClear = useCallback(() => {
    setSequence('');
    setNTerminal('');
    setCTerminal('');
    setResult(null);
    setError(null);
  }, []);

  // 快速测试序列
  const quickSequences = ['AC', 'VLGYT', 'LLPGTFVDNQKF', 'RPYPIP'];

  return (
    <div className="space-y-4">
      {/* 输入区域 */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-[var(--text-primary,#111827)] dark:text-[var(--text-primary-dark,#F9FAFB)]">
            肽序列输入
          </h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab('analyze')}
              className={activeTab === 'analyze' ? 'bg-primary/10 border-primary' : ''}
            >
              <FlaskConical className="w-3.5 h-3.5 mr-1" />
              完整分析
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab('convert')}
              className={activeTab === 'convert' ? 'bg-primary/10 border-primary' : ''}
            >
              <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
              结构转换
            </Button>
          </div>
        </div>

        {/* 序列输入 */}
        <div className="space-y-2">
          <label className="text-xs text-[var(--text-secondary,#6B7280)] dark:text-[var(--text-secondary-dark,#9CA3AF)]">
            氨基酸序列
          </label>
          <Input
            value={sequence}
            onChange={(e) => setSequence(e.target.value.toUpperCase())}
            placeholder="例如: ACDEFG 或 VLGYT"
            className="font-mono text-sm"
            maxLength={100}
          />
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs text-[var(--text-muted,#9A9A9F)]">快速测试:</span>
            {quickSequences.map((seq) => (
              <button
                key={seq}
                onClick={() => setSequence(seq)}
                className="px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                {seq}
              </button>
            ))}
          </div>
        </div>

        {/* 修饰输入（仅结构转换模式） */}
        {activeTab === 'convert' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-[var(--text-secondary,#6B7280)] dark:text-[var(--text-secondary-dark,#9CA3AF)]">
                N端修饰
              </label>
              <Input
                value={nTerminal}
                onChange={(e) => setNTerminal(e.target.value.toUpperCase())}
                placeholder="例如: ACT (乙酰化)"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[var(--text-secondary,#6B7280)] dark:text-[var(--text-secondary-dark,#9CA3AF)]">
                C端修饰
              </label>
              <Input
                value={cTerminal}
                onChange={(e) => setCTerminal(e.target.value.toUpperCase())}
                placeholder="例如: AMD (酰胺化)"
                className="font-mono text-sm"
              />
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button
            onClick={handleAnalyze}
            disabled={loading || !sequence}
            className="flex-1"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                分析中...
              </span>
            ) : (
              <>
                <Beaker className="w-4 h-4 mr-1" />
                {activeTab === 'analyze' ? '完整分析' : '序列转SMILES'}
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleClear} disabled={loading}>
            清空
          </Button>
        </div>
      </Card>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* 结果展示 */}
      {result && (
        <div className="space-y-4">
          {/* 基本信息 */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-[var(--text-primary,#111827)] dark:text-[var(--text-primary-dark,#F9FAFB)] mb-3 flex items-center gap-2">
              <Dna className="w-4 h-4 text-primary" />
              基本信息
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-[var(--text-muted,#9A9A9F)]">序列</div>
                <div className="font-mono text-sm font-medium">{result.sequence}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted,#9A9A9F)]">分子量</div>
                <div className="text-sm font-medium">{result.molecular_weight.toFixed(2)} Da</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted,#9A9A9F)]">等电点</div>
                <div className="text-sm font-medium">{result.isoelectric_point.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted,#9A9A9F)]">疏水性</div>
                <div className="text-sm font-medium">{result.hydrophobicity.toFixed(4)}</div>
              </div>
            </div>
            {result.smiles && (
              <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                <div className="text-xs text-[var(--text-muted,#9A9A9F)] mb-1">SMILES</div>
                <div className="font-mono text-xs break-all text-[var(--text-secondary,#6B7280)] dark:text-[var(--text-secondary-dark,#9CA3AF)]">
                  {result.smiles}
                </div>
              </div>
            )}
          </Card>

          {/* 活性预测 */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-[var(--text-primary,#111827)] dark:text-[var(--text-primary-dark,#F9FAFB)] mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              活性预测
            </h3>
            <div className="space-y-3">
              <ScoreProgress
                label="ACE抑制活性"
                score={result.ace_inhibition.score}
                colorClass={getScoreColor(result.ace_inhibition.score)}
              />
              <ScoreProgress
                label="抗氧化活性"
                score={result.antioxidant.score}
                colorClass={getScoreColor(result.antioxidant.score)}
              />
              <ScoreProgress
                label="抗菌活性"
                score={result.antimicrobial.score}
                colorClass={getScoreColor(result.antimicrobial.score)}
              />
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              <Badge variant={getActivityBadge(result.ace_inhibition.level)}>
                ACE抑制: {result.ace_inhibition.level}
              </Badge>
              <Badge variant={getActivityBadge(result.antioxidant.level)}>
                抗氧化: {result.antioxidant.level}
              </Badge>
              <Badge variant={getActivityBadge(result.antimicrobial.level)}>
                抗菌: {result.antimicrobial.level}
              </Badge>
            </div>
          </Card>

          {/* 安全性评估 */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-[var(--text-primary,#111827)] dark:text-[var(--text-primary-dark,#F9FAFB)] mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              安全性评估
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">{result.safety.food_score.toFixed(0)}</div>
                <div className="text-xs text-[var(--text-muted,#9A9A9F)]">食品安全评分</div>
              </div>
              <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                <div className={`text-2xl font-bold ${result.safety.is_allergen ? 'text-red-500' : 'text-green-500'}`}>
                  {result.safety.is_allergen ? '是' : '否'}
                </div>
                <div className="text-xs text-[var(--text-muted,#9A9A9F)]">过敏原</div>
              </div>
              <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                <div className={`text-2xl font-bold ${result.safety.is_toxic ? 'text-red-500' : 'text-green-500'}`}>
                  {result.safety.is_toxic ? '是' : '否'}
                </div>
                <div className="text-xs text-[var(--text-muted,#9A9A9F)]">毒性</div>
              </div>
              <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                <div className="text-2xl font-bold text-primary capitalize">
                  {result.safety.digestibility}
                </div>
                <div className="text-xs text-[var(--text-muted,#9A9A9F)]">消化性</div>
              </div>
            </div>
          </Card>

          {/* 风味预测 */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-[var(--text-primary,#111827)] dark:text-[var(--text-primary-dark,#F9FAFB)] mb-3">
              风味预测
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-secondary,#6B7280)] dark:text-[var(--text-secondary-dark,#9CA3AF)]">苦味</span>
                  <span className="font-medium">{(result.taste.bitterness * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${result.taste.bitterness * 100}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-secondary,#6B7280)] dark:text-[var(--text-secondary-dark,#9CA3AF)]">鲜味</span>
                  <span className="font-medium">{(result.taste.umami * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${result.taste.umami * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* 分析时间 */}
          <div className="text-xs text-[var(--text-muted,#9A9A9F)] text-right">
            分析时间: {new Date(result.analysis_time).toLocaleString()}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {!result && !error && (
        <div className="text-center py-12 text-[var(--text-muted,#9A9A9F)]">
          <Dna className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">输入肽序列进行结构分析与活性预测</p>
          <p className="text-xs mt-1">支持 420 种非天然氨基酸和 296 种末端修饰</p>
        </div>
      )}
    </div>
  );
}
