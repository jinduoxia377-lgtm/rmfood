import React, { useState, useEffect } from 'react';
import { ProfessionalBaseComponent } from './ProfessionalBaseComponent';
import compatibilityService from '@/services/professional/compatibilityService';
import type {
  CompatibilityCheckResult,
  CompatibilitySuggestion,
  HerbCompatibilityInfo,
} from '@/services/professional/compatibilityService';
import { AlertTriangle, AlertCircle, CheckCircle, Plus, X, Trash2, BookOpen, Shield, Zap } from 'lucide-react';

interface CompatibilityAdvisorProps {
  initialHerbs?: string[];
  onAnalysisComplete?: () => void;
}

interface CompatibilityAdvisorState {
  herbs: string[];
  newHerb: string;
  result: CompatibilityCheckResult | null;
  selectedHerbInfo: HerbCompatibilityInfo | null;
  isLoading: boolean;
}

const HERB_SUGGESTIONS = [
  '人参',
  '黄芪',
  '当归',
  '甘草',
  '丹参',
  '半夏',
  '陈皮',
  '川芎',
  '白术',
  '茯苓',
  '干姜',
  '桂枝',
  '柴胡',
  '黄芩',
  '黄连',
  '麦冬',
  '五味子',
  '枸杞子',
  '菊花',
  '金银花',
  '连翘',
  '防风',
  '白芷',
  '薄荷',
];

export class CompatibilityAdvisor extends ProfessionalBaseComponent<
  CompatibilityAdvisorProps,
  CompatibilityAdvisorState
> {
  constructor(props: CompatibilityAdvisorProps) {
    super(props);
    this.state = {
      herbs: props.initialHerbs || [],
      newHerb: '',
      result: null,
      selectedHerbInfo: null,
      isLoading: false,
    };
  }

  componentDidMount() {
    if (this.state.herbs.length > 0) {
      this.checkCompatibility();
    }
    if (this.props.onAnalysisComplete) {
      this.props.onAnalysisComplete();
    }
  }

  private setLoading = (loading: boolean) => {
    this.setState({ isLoading: loading });
  };

  private async checkCompatibility() {
    if (this.state.herbs.length < 2) {
      this.setState({ result: null });
      return;
    }

    this.setLoading(true);
    try {
      const result = await compatibilityService.checkHerbCompatibility(this.state.herbs);
      this.setState({ result });
    } catch (error) {
      this.handleError(error instanceof Error ? error : String(error));
    } finally {
      this.setLoading(false);
    }
  }

  private addHerb = () => {
    const herb = this.state.newHerb.trim();
    if (herb && !this.state.herbs.includes(herb)) {
      const newHerbs = [...this.state.herbs, herb];
      this.setState({ herbs: newHerbs, newHerb: '' }, () => {
        this.checkCompatibility();
      });
    }
  };

  private removeHerb = (herbToRemove: string) => {
    const newHerbs = this.state.herbs.filter((h) => h !== herbToRemove);
    this.setState({ herbs: newHerbs }, () => {
      this.checkCompatibility();
    });
  };

  private clearAllHerbs = () => {
    this.setState({ herbs: [], result: null });
  };

  private async showHerbInfo(herbName: string) {
    this.setLoading(true);
    try {
      const info = await compatibilityService.getHerbCompatibilityInfo(herbName);
      this.setState({ selectedHerbInfo: info });
    } catch (error) {
      this.handleError(error instanceof Error ? error : String(error));
    } finally {
      this.setLoading(false);
    }
  }

  private closeHerbInfo = () => {
    this.setState({ selectedHerbInfo: null });
  };

  private renderHerbTag(herb: string) {
    return (
      <span
        key={herb}
        className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[var(--color-success-surface)] to-[var(--color-success-surface-deep)] text-white rounded-full text-sm font-medium shadow-sm hover:shadow-md transition-shadow cursor-pointer"
         role="button" tabIndex={0} onClick={() => this.showHerbInfo(herb)}
      >
        <span>{herb}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            this.removeHerb(herb);
          }}
          className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white dark:bg-neutral-900/20 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </span>
    );
  }

  private renderSuggestion(suggestion: CompatibilitySuggestion) {
    const typeStyles = {
      avoid: 'bg-error-50 border-error-200',
      caution: 'bg-warning-50 border-warning-200',
      recommend: 'bg-success-50 border-success-200',
    };

    const iconStyles = {
      avoid: 'bg-error-100 text-error-600',
      caution: 'bg-warning-100 text-warning-600',
      recommend: 'bg-success-100 text-success-600',
    };

    const icons = {
      avoid: <AlertTriangle className="w-5 h-5" />,
      caution: <AlertCircle className="w-5 h-5" />,
      recommend: <CheckCircle className="w-5 h-5" />,
    };

    const labels = {
      avoid: '禁忌配伍',
      caution: '谨慎配伍',
      recommend: '推荐配伍',
    };

    return (
      <div key={suggestion.id} className={`p-4 rounded-xl border ${typeStyles[suggestion.type]} mb-3`}>
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconStyles[suggestion.type]}`}
          >
            {icons[suggestion.type]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${iconStyles[suggestion.type]}`}>
                {labels[suggestion.type]}
              </span>
            </div>
            <p className="text-neutral-800 dark:text-neutral-200 text-sm">
              <span className="font-medium">{suggestion.herb1}</span>
              <span className="mx-2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">+</span>
              <span className="font-medium">{suggestion.herb2}</span>
              <span className="mx-2">-</span>
              {suggestion.description}
            </p>
            {suggestion.alternative && (
              <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-2">
                建议替代：<span className="text-success-600 font-medium">{suggestion.alternative}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { herbs, newHerb, result, selectedHerbInfo, isLoading } = this.state;

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-success-600"></div>
          <span className="ml-3 text-neutral-600 dark:text-neutral-400">正在检测配伍...</span>
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-100 dark:border-neutral-800 overflow-hidden">
        <div className="bg-gradient-to-r from-warning-500 to-warning-500 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white dark:bg-neutral-900/20 flex items-center justify-center">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">中药配伍检测</h2>
              <p className="text-warning-100 text-sm">检测中药之间的配伍禁忌和协同作用</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={newHerb}
                  onChange={(e) => this.setState({ newHerb: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && this.addHerb()}
                  placeholder="输入中药名称..."
                  className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  list="herb-suggestions"
                />
                <datalist id="herb-suggestions">
                  {HERB_SUGGESTIONS.map((herb) => (
                    <option key={herb} value={herb} />
                  ))}
                </datalist>
              </div>
              <button
                onClick={this.addHerb}
                disabled={!newHerb.trim()}
                className="px-4 py-2 bg-success-500 text-white rounded-lg hover:bg-success-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span>添加</span>
              </button>
            </div>

            {herbs.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">{herbs.map((herb) => this.renderHerbTag(herb))}</div>
            )}

            {herbs.length > 0 && (
              <button
                onClick={this.clearAllHerbs}
                className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-error-500 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                清空全部
              </button>
            )}
          </div>

          {herbs.length > 0 && herbs.length < 2 && (
            <div className="text-center py-8 bg-neutral-50 dark:bg-neutral-850 rounded-lg">
              <AlertCircle className="w-12 h-12 mx-auto text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-3" />
              <p className="text-neutral-500 dark:text-neutral-400">请至少添加两种中药进行配伍检测</p>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              <div
                className={`p-4 rounded-xl ${
                  result.compatible ? 'bg-success-50 border border-success-200' : 'bg-error-50 border border-error-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {result.compatible ? (
                    <CheckCircle className="w-8 h-8 text-success-600" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-error-600" />
                  )}
                  <div>
                    <h3 className={`font-semibold ${result.compatible ? 'text-success-800' : 'text-error-800'}`}>
                      {result.compatible ? '配伍安全' : '存在配伍禁忌'}
                    </h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{result.summary}</p>
                  </div>
                </div>
              </div>

              {(result.conflicts.length > 0 || result.warnings.length > 0) && (
                <div>
                  <h4 className="font-medium text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-error-500" />
                    配伍禁忌
                  </h4>
                  {[...result.conflicts, ...result.warnings]
                    .map((suggestion: any) => ({
                      ...suggestion,
                      type: suggestion.severity === 'high' ? ('avoid' as const) : ('caution' as const),
                    }))
                    .map((s: CompatibilitySuggestion) => this.renderSuggestion(s))}
                </div>
              )}

              {result.suggestions.filter((s: CompatibilitySuggestion) => s.type === 'recommend').length > 0 && (
                <div>
                  <h4 className="font-medium text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-success-500" />
                    协同增效建议
                  </h4>
                  {result.suggestions
                    .filter((s: CompatibilitySuggestion) => s.type === 'recommend')
                    .map((s: CompatibilitySuggestion) => this.renderSuggestion(s))}
                </div>
              )}
            </div>
          )}

          {!result && herbs.length >= 2 && (
            <div className="text-center py-8 bg-neutral-50 dark:bg-neutral-850 rounded-lg">
              <BookOpen className="w-12 h-12 mx-auto text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-3" />
              <p className="text-neutral-500 dark:text-neutral-400">点击检测按钮查看配伍结果</p>
            </div>
          )}
        </div>

        {selectedHerbInfo && (
          <div className="border-t border-neutral-100 dark:border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-900 dark:text-white">{selectedHerbInfo.herbName} - 配伍信息</h3>
              <button onClick={this.closeHerbInfo} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {selectedHerbInfo.opposites.length > 0 && (
                <div className="bg-error-50 rounded-lg p-4">
                  <h4 className="font-medium text-error-800 mb-2">十八反</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedHerbInfo.opposites.map((herb: string) => (
                      <span key={herb} className="px-2 py-1 bg-error-100 text-error-700 rounded text-sm">
                        {herb}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedHerbInfo.fears.length > 0 && (
                <div className="bg-warning-50 rounded-lg p-4">
                  <h4 className="font-medium text-warning-800 mb-2">十九畏</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedHerbInfo.fears.map((herb: string) => (
                      <span key={herb} className="px-2 py-1 bg-warning-100 text-warning-700 rounded text-sm">
                        {herb}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedHerbInfo.enhances.length > 0 && (
                <div className="bg-success-50 rounded-lg p-4">
                  <h4 className="font-medium text-success-800 mb-2">相须相使</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedHerbInfo.enhances.map((herb: string) => (
                      <span key={herb} className="px-2 py-1 bg-success-100 text-success-700 rounded text-sm">
                        {herb}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default CompatibilityAdvisor;
