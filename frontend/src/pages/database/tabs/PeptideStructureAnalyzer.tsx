/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 肽链结构分析器 — 基于 PepLink 的序列↔SMILES 双向转换
 */
import { useState, useCallback, useEffect } from 'react';
import { peptideStructureService } from '@/services/professional/peptideStructureService';
import { Button, Input, Card, Badge } from '@/components/ui';
import { Beaker, ArrowRightLeft, Dna, ShieldCheck, Activity } from 'lucide-react';

// ─── 类型定义 ───
interface PeptideAnalysisResult {
  sequence: string;
  smiles?: string;
  molecular_weight: number;
  isoelectric_point: number;
  hydrophobicity: number;
  ace_inhibition: { score: number; level: string };
  antioxidant: { score: number; level: string };
  antimicrobial: { score: number; level: string };
  safety: { food_score: number; is_allergen: boolean; is_toxic: boolean; digestibility: string };
  taste: { bitterness: number; umami: number };
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

// ─── 主组件 ───
export default function PeptideStructureAnalyzer() {
  const [sequence, setSequence] = useState('');
  const [nTerminal, setNTerminal] = useState('');
  const [cTerminal, setCTerminal] = useState('');
  const [result, setResult] = useState<PeptideAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // 初始化 CSRF
  useEffect(() => {
    peptideStructureService.init().then(() => setInitialized(true));
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!sequence || sequence.length < 2) {
      setError('请输入至少2个氨基酸的序列');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await peptideStructureService.analyzePeptide(sequence.toUpperCase());
      setResult(res as unknown as Parameters<typeof setResult>[0]);
    } catch (e: any) {
      setError(e.message || '分析失败');
    } finally {
      setLoading(false);
    }
  }, [sequence]);

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
          molecular_weight: 0,
          isoelectric_point: 0,
          hydrophobicity: 0,
          ace_inhibition: { score: 0, level: 'N/A' },
          antioxidant: { score: 0, level: 'N/A' },
          antimicrobial: { score: 0, level: 'N/A' },
          safety: { food_score: 0, is_allergen: false, is_toxic: false, digestibility: 'N/A' },
          taste: { bitterness: 0, umami: 0 },
          analysis_time: new Date().toISOString(),
        } as any);
      }
    } catch (e: any) {
      setError(e.message || '转换失败');
    } finally {
      setLoading(false);
    }
  }, [sequence, nTerminal, cTerminal]);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Beaker className="w-5 h-5 text-primary-500" />
        <h2 className="text-base font-semibold">肽链结构分析器</h2>
      </div>

      {/* 输入区域 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-3">
          <label className="text-xs text-[var(--text-muted,#9A9A9F)] mb-1 block">肽序列</label>
          <Input
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            placeholder="例如: ACDEFG 或 VLGYT"
            className="font-mono"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted,#9A9A9F)] mb-1 block">N端修饰</label>
          <Input
            value={nTerminal}
            onChange={(e) => setNTerminal(e.target.value)}
            placeholder="如 ACT（乙酰化）"
            className="font-mono text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted,#9A9A9F)] mb-1 block">C端修饰</label>
          <Input
            value={cTerminal}
            onChange={(e) => setCTerminal(e.target.value)}
            placeholder="如 AMD（酰胺化）"
            className="font-mono text-sm"
          />
        </div>
        <div className="flex items-end gap-2">
          <Button variant="primary" onClick={handleConvert} disabled={loading} className="flex-1 gap-1.5">
            <ArrowRightLeft className="w-4 h-4" />
            序列转 SMILES
          </Button>
          <Button variant="secondary" onClick={handleAnalyze} disabled={loading} className="flex-1 gap-1.5">
            <Activity className="w-4 h-4" />
            完整分析
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* 结果展示 */}
      {result && result.smiles && (
        <div className="space-y-3">
          {/* SMILES 结果 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-[var(--text-muted,#9A9A9F)] mb-1">序列</div>
              <div className="font-mono text-sm p-2 rounded bg-neutral-100 dark:bg-neutral-800">{result.sequence}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted,#9A9A9F)] mb-1">SMILES</div>
              <div className="font-mono text-xs p-2 rounded bg-neutral-100 dark:bg-neutral-800 break-all">
                {result.smiles}
              </div>
            </div>
          </div>

          {/* 分析结果 */}
          {result.molecular_weight > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <div className="text-xs text-[var(--text-muted,#9A9A9F)]">分子量</div>
                <div className="font-semibold">{result.molecular_weight.toFixed(2)} Da</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted,#9A9A9F)]">等电点</div>
                <div className="font-semibold">{result.isoelectric_point.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted,#9A9A9F)]">疏水性</div>
                <div className="font-semibold">{result.hydrophobicity.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted,#9A9A9F)]">食品评分</div>
                <div className={`font-bold ${getScoreColor(result.safety.food_score)}`}>
                  {result.safety.food_score.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* 活性预测 */}
          {result.molecular_weight > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className={`p-3 rounded-lg ${getScoreBg(result.ace_inhibition.score)}`}>
                <div className="text-xs text-[var(--text-muted,#9A9A9F)]">ACE抑制</div>
                <div className={`text-lg font-bold ${getScoreColor(result.ace_inhibition.score)}`}>
                  {result.ace_inhibition.score.toFixed(2)}
                </div>
                <div className="text-xs opacity-70">{result.ace_inhibition.level}</div>
              </div>
              <div className={`p-3 rounded-lg ${getScoreBg(result.antioxidant.score)}`}>
                <div className="text-xs text-[var(--text-muted,#9A9A9F)]">抗氧化</div>
                <div className={`text-lg font-bold ${getScoreColor(result.antioxidant.score)}`}>
                  {result.antioxidant.score.toFixed(2)}
                </div>
                <div className="text-xs opacity-70">{result.antioxidant.level}</div>
              </div>
              <div className={`p-3 rounded-lg ${getScoreBg(result.antimicrobial.score)}`}>
                <div className="text-xs text-[var(--text-muted,#9A9A9F)]">抗菌</div>
                <div className={`text-lg font-bold ${getScoreColor(result.antimicrobial.score)}`}>
                  {result.antimicrobial.score.toFixed(2)}
                </div>
                <div className="text-xs opacity-70">{result.antimicrobial.level}</div>
              </div>
            </div>
          )}

          {/* 安全性 */}
          {result.molecular_weight > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">食品安全评分</span>
              <Badge variant={result.safety.food_score >= 0.7 ? 'success' : result.safety.food_score >= 0.4 ? 'warning' : 'destructive'}>
                {result.safety.food_score.toFixed(2)}
              </Badge>
              {result.safety.is_allergen && (
                <Badge variant="destructive">过敏原</Badge>
              )}
              {result.safety.is_toxic && (
                <Badge variant="destructive">毒性</Badge>
              )}
              <span className="text-xs text-[var(--text-muted,#9A9A9F)]">消化性: {result.safety.digestibility}</span>
            </div>
          )}

          {/* 风味 */}
          {result.molecular_weight > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-[var(--text-muted,#9A9A9F)]">苦味</div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                  <div
                    className="bg-yellow-500 h-2 rounded-full"
                    style={{ width: `${result.taste.bitterness * 100}%` }}
                  />
                </div>
                <div className="text-xs text-right mt-0.5">{result.taste.bitterness.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted,#9A9A9F)]">鲜味</div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{ width: `${result.taste.umami * 100}%` }}
                  />
                </div>
                <div className="text-xs text-right mt-0.5">{result.taste.umami.toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {!result && !error && (
        <div className="text-center py-8 text-[var(--text-muted,#9A9A9F)]">
          <Dna className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">输入肽序列进行结构分析</p>
        </div>
      )}
    </Card>
  );
}
