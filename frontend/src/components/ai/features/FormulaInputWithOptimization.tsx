import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  GitBranch,
  FileText,
  Settings2,
  Play,
  RotateCcw,
  Download,
  CheckCircle2,
  AlertTriangle,
  Info,
  Zap,
  Dna,
  BarChart3,
  Target,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Save,
  FolderOpen,
  Square,
} from 'lucide-react';
import { FormulaIngredientInput } from './FormulaIngredientInput';
import type { FormulaIngredient, FormulaTemplate } from './FormulaIngredientInput/types';
import { PRESET_TEMPLATES } from './FormulaIngredientInput/types';
import { formatForNSGAII, calculateDosages } from './FormulaIngredientInput/utils';
import { NSGAIIOptimizer, type NSGAIIParams, type NSGAIIResult, type NSGAIIProgress, type Individual, type Ingredient } from './FormulaIngredientInput/nsga2';
import './FormulaInputWithOptimization.css';

interface FormulaInputWithOptimizationProps {
  className?: string;
}

export const FormulaInputWithOptimization: React.FC<FormulaInputWithOptimizationProps> = ({
  className,
}) => {
  const [activeTab, setActiveTab] = useState('input');
  const [ingredients, setIngredients] = useState<FormulaIngredient[]>([]);
  const [totalWeight, setTotalWeight] = useState(100);
  const [selectedTemplate, setSelectedTemplate] = useState<FormulaTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<NSGAIIResult | null>(null);
  const [populationSize, setPopulationSize] = useState(60);
  const [generations, setGenerations] = useState(50);
  const [mutationRate, setMutationRate] = useState(15);
  const [crossoverRate, setCrossoverRate] = useState(85);
  const [eliteRate, setEliteRate] = useState(10);
  const [candidateCount, setCandidateCount] = useState(10);
  const [useLocalOptimizer, setUseLocalOptimizer] = useState(true);
  const [currentGeneration, setCurrentGeneration] = useState(0);
  const [progress, setProgress] = useState<number>(0);
  const [expandedCandidate, setExpandedCandidate] = useState<number | null>(null);

  const logsContainerRef = useRef<HTMLDivElement>(null);
  const optimizerRef = useRef<NSGAIIOptimizer | null>(null);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setLogs((prev) => [...prev, `[${time}] ${message}`]);
  }, []);

  const handleSubmit = useCallback(async (data: ReturnType<typeof formatForNSGAII>) => {
    setLogs([]);
    setResult(null);
    setIsLoading(true);
    setCurrentGeneration(0);
    setProgress(0);

    try {
      addLog('🧬 初始化 NSGA-II 多目标优化引擎...');
      addLog(`📊 种群大小=${populationSize}, 代数=${generations}, 精英保留=${eliteRate}%`);
      addLog(`🔧 变异率=${mutationRate}%, 交叉率=${crossoverRate}%`);

      const nsga2Ingredients = data.ingredients.map((ing) => {
        const params: Record<string, number> = {};
        const ingParams = ing.parameters as Record<string, number | null>;
        for (const key in ingParams) {
          params[key] = ingParams[key] ?? 0;
        }
        return {
          id: ing.id,
          name: ing.name,
          dosage: ing.dosage,
          parameters: params,
        };
      });

      const params: NSGAIIParams = {
        populationSize,
        generations,
        mutationRate,
        crossoverRate,
        eliteRatio: eliteRate,
        count: candidateCount,
      };

      const optimizer = new NSGAIIOptimizer(params, nsga2Ingredients, data.total_weight);
      optimizerRef.current = optimizer;

      addLog('🚀 开始多目标优化...');

      const optimizationResult = await optimizer.optimize((prog: NSGAIIProgress) => {
        setCurrentGeneration(prog.generation);
        setProgress(Math.round((prog.generation / generations) * 100));
        if (prog.generation % 5 === 0 || prog.generation === generations) {
          addLog(`📈 第 ${prog.generation} 代：最佳适应度=${prog.best_fitness.toFixed(4)}, 平均=${prog.avg_fitness.toFixed(4)}, 多样性=${prog.diversity.toFixed(4)}`);
        }
      });

      addLog('✅ 多目标优化完成！');
      addLog(`🎉 生成 ${optimizationResult.candidates.length} 个候选方案`);
      addLog(`⏱️ 执行时间: ${optimizationResult.execution_time_ms}ms`);
      addLog(`🏆 Pareto前沿个体数: ${optimizationResult.pareto_front.length}`);

      const formattedResult = {
        ...optimizationResult,
        candidates: optimizationResult.candidates.map((cand: Individual) => ({
          ...cand,
          ingredients: cand.ingredients.map((ing: Ingredient) => ({
            ...ing,
            name_cn: ing.name,
          })),
        })),
        pareto_front: optimizationResult.pareto_front.map((cand: Individual) => ({
          ...cand,
          ingredients: cand.ingredients.map((ing: Ingredient) => ({
            ...ing,
            name_cn: ing.name,
          })),
        })),
      };

      setResult(formattedResult as unknown as NSGAIIResult);
      setActiveTab('results');
    } catch (error) {
      addLog(`❌ 优化失败：${(error as Error).message}`);
    } finally {
      optimizerRef.current = null;
      setIsLoading(false);
    }
  }, [addLog, populationSize, generations, mutationRate, crossoverRate, eliteRate, candidateCount]);

  const handleLoadTemplate = useCallback((template: FormulaTemplate) => {
    setSelectedTemplate(template);
    const calculated = calculateDosages(template.ingredients, template.totalWeight);
    setIngredients(calculated);
    setTotalWeight(template.totalWeight);
    addLog(`📋 已加载模板: ${template.name}`);
  }, [addLog]);

  const handleClearAll = useCallback(() => {
    setIngredients([]);
    setTotalWeight(100);
    setSelectedTemplate(null);
    setResult(null);
    setLogs([]);
    setCurrentGeneration(0);
    setProgress(0);
    addLog('🗑️ 已清空所有数据');
  }, [addLog]);

  const handleStopOptimization = useCallback(() => {
    optimizerRef.current?.stop();
    setIsLoading(false);
    addLog('⏹️ 优化已手动停止');
  }, [addLog]);

  const handleResetParams = useCallback(() => {
    setPopulationSize(60);
    setGenerations(50);
    setMutationRate(15);
    setCrossoverRate(85);
    setEliteRate(10);
    setCandidateCount(10);
    addLog('🔄 参数已重置为默认值');
  }, [addLog]);

  const handleSaveResult = useCallback(() => {
    if (!result) return;
    const dataStr = JSON.stringify(result, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nsga2-result-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('💾 优化结果已保存');
  }, [result, addLog]);

  const getCategoryBadgeVariant = (category: string): BadgeVariant => {
    const variants: Record<string, BadgeVariant> = {
      '补益类': 'success',
      '清热类': 'info',
      '活血类': 'danger',
      '安神类': 'warning',
      '利水类': 'info',
    };
    return variants[category] || 'neutral';
  };

  const getRankBadgeVariant = (rank: number): BadgeVariant => {
    if (rank === 1) return 'warning';
    if (rank === 2) return 'neutral';
    if (rank === 3) return 'danger';
    return 'neutral';
  };

  const getScoreColor = (key: string): string => {
    const colors: Record<string, string> = {
      efficacy: 'text-primary-600',
      safety: 'text-secondary-600',
      taste: 'text-warning-600',
      cost: 'text-accent-600',
      synergy: 'text-cyan-600',
      stability: 'text-rose-600',
      overall_fitness: 'text-primary-600',
    };
    return colors[key] || 'text-neutral-600';
  };

  const handlePopulationChange = (value: string) => {
    setPopulationSize(Math.min(300, Math.max(10, parseInt(value) || 60)));
  };

  const handleGenerationsChange = (value: string) => {
    setGenerations(Math.min(200, Math.max(5, parseInt(value) || 50)));
  };

  const handleCandidateCountChange = (value: string) => {
    setCandidateCount(Math.min(30, Math.max(1, parseInt(value) || 10)));
  };

  return (
    <div className={`formula-optimization-container ${className || ''}`}>
      <div className="main-header">
        <div className="header-content">
          <div className="logo-wrapper">
            <div className="logo-icon">
              <GitBranch className="icon" />
            </div>
          </div>
          <div className="header-text">
            <h1 className="title">多目标优化 (NSGA-II)</h1>
            <p className="subtitle">基于Pareto最优前沿的中药配方优化系统</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="tabs-wrapper">
        <TabsList className="tabs-header">
          <TabsTrigger value="input">配方输入</TabsTrigger>
          <TabsTrigger value="params">参数设置</TabsTrigger>
          <TabsTrigger value="results">运行结果</TabsTrigger>
        </TabsList>

        <TabsContent value="input">
          <div className="input-section">
            <Card className="template-section">
              <CardContent>
                <h3 className="section-title">
                  <FileText className="section-icon" />
                  预设配方模板
                </h3>
                <div className="template-grid">
                  {PRESET_TEMPLATES.map((template) => (
                    <div
                      key={template.id}
                      className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                       role="button" tabIndex={0} onClick={() => handleLoadTemplate(template)}
                    >
                      <div className="template-header">
                        <Badge variant={getCategoryBadgeVariant(template.category)}>
                          {template.category}
                        </Badge>
                      </div>
                      <h4 className="template-name">{template.name}</h4>
                      <p className="template-desc">{template.description}</p>
                      <div className="template-meta">
                        <span>{template.ingredients.length}种成分</span>
                        <span className="divider">|</span>
                        <span>总重{template.totalWeight}g</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="input-card">
              <CardContent>
                <FormulaIngredientInput
                  ingredients={ingredients}
                  setIngredients={setIngredients}
                  totalWeight={totalWeight}
                  setTotalWeight={setTotalWeight}
                  onSubmit={handleSubmit}
                  disabled={isLoading}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="params">
          <Card className="params-card">
            <CardContent>
              <h3 className="section-title">
                <Settings2 className="section-icon" />
                算法参数配置
              </h3>
              
              <div className="params-grid">
                <div className="param-item">
                  <label>种群大小</label>
                  <input
                    type="number"
                    value={populationSize}
                    onChange={(e) => handlePopulationChange(e.target.value)}
                    min="10"
                    max="300"
                  />
                  <span className="param-desc">每代个体数量，建议50-100</span>
                </div>
                <div className="param-item">
                  <label>进化代数</label>
                  <input
                    type="number"
                    value={generations}
                    onChange={(e) => handleGenerationsChange(e.target.value)}
                    min="5"
                    max="200"
                  />
                  <span className="param-desc">最大迭代次数，建议30-100</span>
                </div>
                <div className="param-item">
                  <label>变异率</label>
                  <input
                    type="range"
                    value={mutationRate}
                    onChange={(e) => setMutationRate(parseInt(e.target.value))}
                    min={1}
                    max={50}
                  />
                  <span className="param-value">{mutationRate}%</span>
                  <span className="param-desc">基因变异概率，建议5-20%</span>
                </div>
                <div className="param-item">
                  <label>交叉率</label>
                  <input
                    type="range"
                    value={crossoverRate}
                    onChange={(e) => setCrossoverRate(parseInt(e.target.value))}
                    min={10}
                    max={100}
                  />
                  <span className="param-value">{crossoverRate}%</span>
                  <span className="param-desc">个体交叉概率，建议70-90%</span>
                </div>
                <div className="param-item">
                  <label>精英保留</label>
                  <input
                    type="range"
                    value={eliteRate}
                    onChange={(e) => setEliteRate(parseInt(e.target.value))}
                    min={5}
                    max={40}
                  />
                  <span className="param-value">{eliteRate}%</span>
                  <span className="param-desc">最优个体保留比例</span>
                </div>
                <div className="param-item">
                  <label>候选数量</label>
                  <input
                    type="number"
                    value={candidateCount}
                    onChange={(e) => handleCandidateCountChange(e.target.value)}
                    min="1"
                    max="30"
                  />
                  <span className="param-desc">输出的Top-N方案数</span>
                </div>
              </div>

              <div className="params-actions">
                <Button variant="secondary" onClick={handleResetParams}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  重置参数
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="params-card mt-4">
            <CardContent>
              <h3 className="section-title">
                <Info className="section-icon" />
                NSGA-II算法说明
              </h3>
              <div className="algorithm-info">
                <div className="info-item">
                  <div className="info-icon">
                    <Dna className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="info-content">
                    <h4>非支配排序</h4>
                    <p>基于Pareto支配关系对种群进行分层排序，识别最优前沿</p>
                  </div>
                </div>
                <div className="info-item">
                  <div className="info-icon">
                    <BarChart3 className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div className="info-content">
                    <h4>拥挤度计算</h4>
                    <p>衡量个体在目标空间中的密度，保持种群多样性</p>
                  </div>
                </div>
                <div className="info-item">
                  <div className="info-icon">
                    <Target className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="info-content">
                    <h4>精英保留</h4>
                    <p>保留最优个体直接进入下一代，加速收敛</p>
                  </div>
                </div>
                <div className="info-item">
                  <div className="info-icon">
                    <TrendingUp className="w-5 h-5 text-warning-600" />
                  </div>
                  <div className="info-content">
                    <h4>多目标优化</h4>
                    <p>同时优化功效、安全、成本、协同、稳定五个目标</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          <div className="results-section">
            {result ? (
              <div className="result-content">
                <div className="result-actions">
                  <Button onClick={handleSaveResult}>
                    <Save className="w-4 h-4 mr-2" />
                    保存结果
                  </Button>
                  <Button variant="secondary" onClick={handleClearAll}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    重新优化
                  </Button>
                </div>

                <Card className="result-summary">
                  <CardContent>
                    <h3 className="section-title">优化结果摘要</h3>
                    <div className="summary-stats">
                      <div className="stat-item">
                        <span className="stat-value">{result.candidates.length}</span>
                        <span className="stat-label">候选方案</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{result.total_generations}</span>
                        <span className="stat-label">总代数</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{result.execution_time_ms}ms</span>
                        <span className="stat-label">执行时间</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{result.pareto_front.length}</span>
                        <span className="stat-label">Pareto前沿</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="result-details">
                  <CardContent>
                    <h3 className="section-title">候选配方列表</h3>
                    <div className="candidates-list">
                      {result.candidates.map((candidate: any, index: number) => (
                        <div key={index} className="candidate-item">
                          <div className="candidate-header"  role="button" tabIndex={0} onClick={() => setExpandedCandidate(expandedCandidate === index ? null : index)}>
                            <div className="candidate-info">
                              <span className="candidate-rank">方案 {index + 1}</span>
                              <Badge variant={getRankBadgeVariant(candidate.rank)}>
                                Pareto Rank {candidate.rank}
                              </Badge>
                            </div>
                            <button className="expand-btn">
                              {expandedCandidate === index ? (
                                <ChevronUp className="w-5 h-5" />
                              ) : (
                                <ChevronDown className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                          
                          <div className="candidate-ingredients">
                            {candidate.ingredients?.map((ing: any, i: number) => (
                              <span key={i} className="ingredient-tag">
                                {ing.name_cn || ing.name}: {ing.dosage.toFixed(2)}g
                              </span>
                            ))}
                          </div>
                          
                          <div className="candidate-scores">
                            {Object.entries(candidate.objective_scores || {}).map(
                              ([key, value]: [string, unknown]) => (
                                <div key={key} className="score-item">
                                  <span className="score-label">{getScoreLabel(key)}</span>
                                  <span className={`score-value ${getScoreColor(key)}`}>
                                    {typeof value === 'number' ? value.toFixed(4) : String(value)}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                          
                          {expandedCandidate === index && (
                            <div className="candidate-details">
                              <div className="detail-row">
                                <span className="detail-label">拥挤度:</span>
                                <span className="detail-value">{candidate.crowding_distance?.toFixed(4) || 'N/A'}</span>
                              </div>
                              <div className="detail-row">
                                <span className="detail-label">成分总数:</span>
                                <span className="detail-value">{candidate.ingredients?.length || 0}种</span>
                              </div>
                              <div className="detail-row">
                                <span className="detail-label">总剂量:</span>
                                <span className="detail-value">
                                  {candidate.ingredients?.reduce((sum: number, ing: any) => sum + (ing.dosage || 0), 0).toFixed(2)}g
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {result.convergence_history && result.convergence_history.length > 0 && (
                  <Card className="convergence-card">
                    <CardContent>
                      <h3 className="section-title">
                        <TrendingUp className="section-icon" />
                        收敛曲线
                      </h3>
                      <div className="convergence-chart">
                        <div className="chart-container">
                          <div className="chart-y-axis">
                            <span>1.0</span>
                            <span>0.75</span>
                            <span>0.5</span>
                            <span>0.25</span>
                            <span>0</span>
                          </div>
                          <div className="chart-area">
                            <svg viewBox={`0 0 ${result.convergence_history.length * 40} 100`} preserveAspectRatio="none" className="chart-svg">
                              <defs>
                                <linearGradient id="fitnessGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                  <stop offset="0%" stopColor="var(--color-primary-500)" stopOpacity="0.3" />
                                  <stop offset="100%" stopColor="var(--color-primary-500)" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              <path
                                d={`M ${result.convergence_history.map((h: NSGAIIProgress, i: number) => `${i * 40},${100 - h.best_fitness * 100}`).join(' L ')}`}
                                fill="none"
                                stroke="var(--color-primary-600)"
                                strokeWidth="2"
                                className="chart-line"
                              />
                              <path
                                d={`M 0,100 L ${result.convergence_history.map((h: NSGAIIProgress, i: number) => `${i * 40},${100 - h.best_fitness * 100}`).join(' L ')} L ${(result.convergence_history.length - 1) * 40},100 Z`}
                                fill="url(#fitnessGradient)"
                              />
                              {result.convergence_history.filter((_: NSGAIIProgress, i: number) => i % 5 === 0).map((h: NSGAIIProgress, i: number) => (
                                <circle
                                  key={i}
                                  cx={result.convergence_history.findIndex((x: NSGAIIProgress) => x.generation === h.generation) * 40}
                                  cy={100 - h.best_fitness * 100}
                                  r="4"
                                  fill="var(--color-primary-600)"
                                />
                              ))}
                            </svg>
                            <div className="chart-x-axis">
                              {result.convergence_history.filter((_: NSGAIIProgress, i: number) => i % Math.max(1, Math.floor(result.convergence_history.length / 10)) === 0).map((h: NSGAIIProgress) => (
                                <span key={h.generation}>{h.generation}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="convergence-legend">
                          <div className="legend-item">
                            <div className="legend-color" style={{ backgroundColor: 'var(--color-primary-600)' }} />
                            <span>最佳适应度</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : logs.length > 0 ? (
              <Card className="logs-card">
                <CardContent>
                  <h3 className="section-title">运行日志</h3>
                  {isLoading && (
                    <div className="progress-bar-container">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="progress-text">
                        第 {currentGeneration}/{generations} 代 ({progress}%)
                      </span>
                      <button
                        onClick={handleStopOptimization}
                        className="ml-auto px-3 py-1 rounded-lg text-xs font-medium bg-error-500/10 text-error-600 dark:text-error-400 border border-error-200 dark:border-error-800 hover:bg-error-500/20 transition-colors flex items-center gap-1"
                      >
                        <Square className="w-3 h-3" />
                        停止
                      </button>
                    </div>
                  )}
                  <div ref={logsContainerRef} className="logs-container">
                    {logs.map((log, index) => (
                      <div key={index} className="log-item">
                        {log}
                      </div>
                    ))}
                    {isLoading && (
                      <div className="loading-indicator">
                        <LoadingSpinner size="sm" />
                        <span>优化中...</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="empty-results">
                <CardContent>
                  <div className="empty-content">
                    <GitBranch className="empty-icon" />
                    <h3>暂无运行结果</h3>
                    <p>请先在"配方输入"标签页中输入配方，然后点击"提交优化"按钮</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

function getScoreLabel(key: string): string {
  const labels: Record<string, string> = {
    efficacy: '功效',
    safety: '安全',
    taste: '口感',
    cost: '成本',
    synergy: '协同',
    stability: '稳定',
    overall_fitness: '综合适应度',
  };
  return labels[key] || key;
}
