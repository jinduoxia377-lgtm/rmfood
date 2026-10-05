import React, { Component } from 'react';
import type { ReactNode } from 'react';
import type { ProfessionalComponentProps } from "../../../types/professional";
import zhCN from '@/i18n/zh-CN';

const t = (key: string): string => {
  const keys = key.split('.');
  let value: any = zhCN.translation;
  for (const k of keys) {
    value = value?.[k];
  }
  return value || key;
};

export class ProfessionalBaseComponent<P = {}, S = {}> extends Component<P & ProfessionalComponentProps, S> {
  protected isMountedRef = false;

  constructor(props: P & ProfessionalComponentProps) {
    super(props);
    this.state = {} as S;
  }

  componentDidMount() {
    this.isMountedRef = true;
  }

  componentWillUnmount() {
    this.isMountedRef = false;
  }

  protected handleError(error: Error | string): void {
    const errorMessage = typeof error === 'string' ? error : error.message;

    if (this.props.onError && typeof this.props.onError === 'function') {
      const errorObj = error instanceof Error ? error : new Error(errorMessage);
      this.props.onError(errorObj);
    }
  }

  protected formatNumber(value: number, decimals = 2): string {
    return value.toFixed(decimals);
  }

  protected formatPercentage(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }

  protected formatMolecularWeight(weight: number): string {
    if (weight >= 1000) {
      return `${(weight / 1000).toFixed(2)} kDa`;
    }
    return `${weight.toFixed(2)} Da`;
  }

  protected formatDosage(amount: number, unit: string): string {
    return `${this.formatNumber(amount)} ${unit}`;
  }

  protected getCompatibilityLevelColor(level: string): string {
    const colorMap: Record<string, string> = {
      excellent: 'var(--color-primary-400)',
      good: 'var(--color-primary-400)',
      moderate: '#D97706',
      poor: '#EA580C',
      contraindicated: '#FF3B30',
    };
    return colorMap[level] || '#6b7280';
  }

  protected getSeverityColor(severity: string): string {
    const colorMap: Record<string, string> = {
      info: 'var(--color-secondary-500)',
      warning: '#D97706',
      critical: '#FF3B30',
    };
    return colorMap[severity] || '#6b7280';
  }

  protected getBioactivityColor(bioactivity: string): string {
    const colorMap: Record<string, string> = {
      antioxidant: 'var(--color-accent-500)',
      'anti-inflammatory': '#D946EF',
      antimicrobial: '#14b8a6',
      antihypertensive: 'var(--color-info-600)',
      antidiabetic: '#D97706',
      anticancer: '#FF3B30',
      immunomodulatory: 'var(--color-primary-400)',
      neuroprotective: '#6366f1',
    };
    return colorMap[bioactivity] || '#6b7280';
  }

  protected renderLoadingIndicator(): ReactNode {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-neutral-600">{t('common.loading')}</span>
      </div>
    );
  }

  protected renderError(error: string | null): ReactNode {
    return (
      <div className="bg-error-50 border border-red-200 rounded-lg p-4 m-4">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-error-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-error-800 font-medium">{t('common.error')}</span>
        </div>
        <p className="mt-2 text-error-700">{error}</p>
      </div>
    );
  }

  protected renderEmptyState(message: string = t('common.noData')): ReactNode {
    return (
      <div className="bg-slate-50 border border-neutral-200 rounded-lg p-8 text-center">
        <svg className="w-12 h-12 text-neutral-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-neutral-600">{message}</p>
      </div>
    );
  }

  protected renderConfidenceBadge(confidence: number): ReactNode {
    const percentage = Math.round(confidence * 100);
    let colorClass = 'bg-neutral-100 text-neutral-800';

    if (percentage >= 80) {
      colorClass = 'bg-success-100 text-success-800';
    } else if (percentage >= 60) {
      colorClass = 'bg-yellow-100 text-yellow-800';
    } else {
      colorClass = 'bg-error-100 text-error-800';
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {percentage}%
      </span>
    );
  }

  protected renderToxicityBadge(toxicity: string): ReactNode {
    let colorClass = 'bg-neutral-100 text-neutral-800';

    switch (toxicity) {
      case 'none':
        colorClass = 'bg-success-100 text-success-800';
        break;
      case 'low':
        colorClass = 'bg-secondary-100 text-secondary-800';
        break;
      case 'moderate':
        colorClass = 'bg-yellow-100 text-yellow-800';
        break;
      case 'high':
        colorClass = 'bg-error-100 text-error-800';
        break;
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {toxicity === 'none' ? '无毒' :
         toxicity === 'low' ? '低毒' :
         toxicity === 'moderate' ? '中毒' :
         toxicity === 'high' ? '高毒' : toxicity}
      </span>
    );
  }

  protected renderPropertyBadge(nature: string): ReactNode {
    const colorMap: Record<string, string> = {
      cold: 'bg-secondary-100 text-secondary-800',
      cool: 'bg-cyan-100 text-cyan-800',
      neutral: 'bg-neutral-100 text-neutral-800',
      warm: 'bg-orange-100 text-orange-800',
      hot: 'bg-error-100 text-error-800',
    };

    const labelMap: Record<string, string> = {
      cold: '寒',
      cool: '凉',
      neutral: '平',
      warm: '温',
      hot: '热',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorMap[nature] || colorMap.neutral}`}>
        {labelMap[nature] || nature}
      </span>
    );
  }

  protected renderResearchStatusBadge(status: string): ReactNode {
    const colorMap: Record<string, string> = {
      validated: 'bg-success-100 text-success-800',
      preliminary: 'bg-yellow-100 text-yellow-800',
      hypothetical: 'bg-secondary-100 text-secondary-800',
      discovered: 'bg-accent-100 text-accent-800',
    };

    const labelMap: Record<string, string> = {
      validated: '已验证',
      preliminary: '初步研究',
      hypothetical: '假说阶段',
      discovered: '新发现',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorMap[status] || colorMap.preliminary}`}>
        {labelMap[status] || status}
      </span>
    );
  }

  protected formatChineseDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected formatScientificName(name: string): string {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }

  protected truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  protected getComponentClassName(): string {
    return this.props.className || '';
  }

  protected getComponentStyle(): React.CSSProperties {
    return this.props.style || {};
  }

  render(): ReactNode {
    if (this.props.loading) {
      return this.renderLoadingIndicator();
    }

    if (this.props.error) {
      return this.renderError(this.props.error);
    }

    return null;
  }
}

export default ProfessionalBaseComponent;
