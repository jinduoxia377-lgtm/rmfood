import React, { Component } from 'react';
import type { ReactNode } from 'react';
import { ProfessionalBaseComponent } from './ProfessionalBaseComponent';
import {
  PeptideService,
} from '@/services/professional/peptideService';
import type {
  PeptideAnalysis,
  BioactivityPrediction,
  StructurePrediction,
} from '@/services/professional/peptideService';
import type { ProfessionalComponentProps } from '@/types/professional';

interface PeptideAnalyzerProps extends ProfessionalComponentProps {
  onAnalysisComplete?: (analysis: PeptideAnalysis) => void;
  onExport?: (data: ExportData) => void;
}

interface PeptideAnalyzerState {
  sequence: string;
  analysis: PeptideAnalysis | null;
  bioactivityPredictions: BioactivityPrediction[];
  structurePrediction: StructurePrediction | null;
  loading: boolean;
  error: string | null;
  validationError: string | null;
  activeTab: 'properties' | 'composition' | 'bioactivity' | 'structure';
  showCompositionChart: boolean;
}

interface ExportData {
  sequence: string;
  analysis: PeptideAnalysis | null;
  bioactivityPredictions: BioactivityPrediction[];
  structurePrediction: StructurePrediction | null;
  exportTime: string;
  format: 'json' | 'csv' | 'txt';
}

class PeptideAnalyzer extends ProfessionalBaseComponent<PeptideAnalyzerProps, PeptideAnalyzerState> {
  private peptideService: PeptideService;

  constructor(props: PeptideAnalyzerProps) {
    super(props);
    this.peptideService = PeptideService.getInstance();
    this.state = {
      sequence: '',
      analysis: null,
      bioactivityPredictions: [],
      structurePrediction: null,
      loading: false,
      error: null,
      validationError: null,
      activeTab: 'properties',
      showCompositionChart: false,
    };
  }

  private validateSequence(sequence: string): boolean {
    const validAminoAcids = new Set([
      'A', 'R', 'N', 'D', 'C', 'E', 'Q', 'G', 'H', 'I',
      'L', 'K', 'M', 'F', 'P', 'S', 'T', 'W', 'Y', 'V',
    ]);

    const upperSeq = sequence.toUpperCase().replace(/\s/g, '');

    if (!upperSeq) {
      this.setState({ validationError: '请输入多肽序列' });
      return false;
    }

    for (const char of upperSeq) {
      if (!validAminoAcids.has(char)) {
        this.setState({ validationError: `无效的氨基酸: ${char}` });
        return false;
      }
    }

    if (upperSeq.length < 2) {
      this.setState({ validationError: '序列长度至少为2个氨基酸' });
      return false;
    }

    if (upperSeq.length > 100) {
      this.setState({ validationError: '序列长度不能超过100个氨基酸' });
      return false;
    }

    this.setState({ validationError: null });
    return true;
  }

  private handleAnalyze = (): void => {
    const { sequence } = this.state;

    if (!this.validateSequence(sequence)) {
      return;
    }

    this.setState({ loading: true, error: null });

    try {
      const analysis = this.peptideService.analyzePeptide(sequence);
      const bioactivityPredictions = this.peptideService.predictBioactivity(sequence);
      const structurePrediction = this.peptideService.predictStructure(sequence);

      this.setState({
        analysis,
        bioactivityPredictions,
        structurePrediction,
        loading: false,
        activeTab: 'properties',
      });

      if (this.props.onAnalysisComplete) {
        this.props.onAnalysisComplete(analysis);
      }
    } catch (error) {
      this.handleError(error as Error);
      this.setState({ loading: false });
    }
  };

  private handleClear = (): void => {
    this.setState({
      sequence: '',
      analysis: null,
      bioactivityPredictions: [],
      structurePrediction: null,
      loading: false,
      error: null,
      validationError: null,
      activeTab: 'properties',
    });
  };

  private handleExport = (format: 'json' | 'csv' | 'txt'): void => {
    const { sequence, analysis, bioactivityPredictions, structurePrediction } = this.state;
    const exportData: ExportData = {
      sequence,
      analysis,
      bioactivityPredictions,
      structurePrediction,
      exportTime: new Date().toISOString(),
      format,
    };

    if (this.props.onExport) {
      this.props.onExport(exportData);
    }

    switch (format) {
      case 'json':
        this.exportAsJSON(exportData);
        break;
      case 'csv':
        this.exportAsCSV(exportData);
        break;
      case 'txt':
        this.exportAsTXT(exportData);
        break;
    }
  };

  private exportAsJSON(data: ExportData): void {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    this.downloadFile(blob, `peptide-analysis-${Date.now()}.json`);
  }

  private exportAsCSV(data: ExportData): void {
    if (!data.analysis) return;

    const csvContent = [
      ['属性', '值'],
      ['序列', data.sequence],
      ['长度', data.analysis.length.toString()],
      ['分子量 (Da)', data.analysis.molecularWeight.toString()],
      ['等电点 (pI)', data.analysis.isoelectricPoint.toString()],
      ['疏水性 (GRAVY)', data.analysis.hydrophobicity.toString()],
      ['pH 7.0电荷', data.analysis.chargeAtPH7.toString()],
      ['不稳定指数', data.analysis.instabilityIndex.toString()],
      ['脂肪族指数', data.analysis.aliphaticIndex.toString()],
      ['消光系数', data.analysis.extinctionCoefficient.toString()],
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    this.downloadFile(blob, `peptide-analysis-${Date.now()}.csv`);
  }

  private exportAsTXT(data: ExportData): void {
    let content = `多肽序列分析报告\n`;
    content += `生成时间: ${data.exportTime}\n`;
    content += `${'='.repeat(60)}\n\n`;

    content += `序列: ${data.sequence}\n\n`;

    if (data.analysis) {
      content += `【理化性质】\n`;
      content += `长度: ${data.analysis.length} 氨基酸\n`;
      content += `分子量: ${data.analysis.molecularWeight} Da\n`;
      content += `等电点: ${data.analysis.isoelectricPoint}\n`;
      content += `疏水性: ${data.analysis.hydrophobicity}\n`;
      content += `电荷 (pH 7.0): ${data.analysis.chargeAtPH7}\n`;
      content += `不稳定指数: ${data.analysis.instabilityIndex}\n`;
      content += `脂肪族指数: ${data.analysis.aliphaticIndex}\n\n`;
    }

    if (data.bioactivityPredictions.length > 0) {
      content += `【生物活性预测】\n`;
      data.bioactivityPredictions.forEach((pred, idx) => {
        content += `${idx + 1}. ${pred.type}\n`;
        content += `   置信度: ${(pred.confidence * 100).toFixed(1)}%\n`;
        content += `   机制: ${pred.mechanism}\n`;
        if (pred.predictedIC50) {
          content += `   预测IC50: ${pred.predictedIC50} μM\n`;
        }
        content += `\n`;
      });
    }

    if (data.structurePrediction) {
      content += `【结构预测】\n`;
      content += `预测结构: ${data.structurePrediction.predictedStructure}\n`;
      content += `置信度: ${(data.structurePrediction.confidence * 100).toFixed(1)}%\n\n`;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    this.downloadFile(blob, `peptide-analysis-${Date.now()}.txt`);
  }

  private downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private renderInputSection(): ReactNode {
    const { sequence, validationError } = this.state;

    return (
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-neutral-900">多肽序列输入</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            输入氨基酸序列
          </label>
          <textarea
            value={sequence}
            onChange={(e) => this.setState({ sequence: e.target.value.toUpperCase() })}
            placeholder="例如: LVGQDPVHPF"
            className={`w-full h-32 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 font-mono text-lg ${
              validationError ? 'border-red-500 focus:ring-red-500' : 'border-neutral-300 dark:border-neutral-700 focus:ring-blue-500'
            }`}
            disabled={this.state.loading}
          />
          {validationError && (
            <p className="mt-2 text-sm text-error-600 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {validationError}
            </p>
          )}
          <p className="mt-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            支持20种标准氨基酸 (A, R, N, D, C, E, Q, G, H, I, L, K, M, F, P, S, T, W, Y, V)
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={this.handleAnalyze}
            disabled={this.state.loading || !sequence.trim()}
            className="px-6 py-3 bg-secondary-container text-secondary-main rounded-lg hover:bg-secondary-container disabled:bg-neutral-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {this.state.loading ? '分析中...' : '开始分析'}
          </button>
          <button
            onClick={this.handleClear}
            disabled={this.state.loading}
            className="px-6 py-3 bg-neutral-200 text-neutral-800 rounded-lg hover:bg-neutral-300 disabled:bg-neutral-100 dark:bg-neutral-800 disabled:cursor-not-allowed transition-colors font-medium"
          >
            清空
          </button>
        </div>
      </div>
    );
  }

  private renderSequenceDisplay(): ReactNode {
    const { sequence } = this.state;

    if (!sequence) return null;

    const aminoAcidColors: Record<string, string> = {
      A: 'bg-success-200', R: 'bg-error-200', N: 'bg-secondary-200', D: 'bg-error-200',
      C: 'bg-yellow-200', E: 'bg-error-200', Q: 'bg-secondary-200', G: 'bg-neutral-200',
      H: 'bg-secondary-200', I: 'bg-success-200', L: 'bg-success-200', K: 'bg-error-200',
      M: 'bg-yellow-200', F: 'bg-success-200', P: 'bg-neutral-200', S: 'bg-neutral-200',
      T: 'bg-neutral-200', W: 'bg-accent-200', Y: 'bg-accent-200', V: 'bg-success-200',
    };

    return (
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-neutral-700 mb-2">序列预览</h3>
        <div className="flex flex-wrap gap-1">
          {sequence.split('').map((aa, idx) => (
            <span
              key={idx}
              className={`inline-flex items-center justify-center w-8 h-8 rounded text-sm font-semibold ${
                aminoAcidColors[aa] || 'bg-neutral-200'
              }`}
              title={this.peptideService.getAminoAcidInfo(aa)?.name || aa}
            >
              {aa}
            </span>
          ))}
        </div>
        <p className="text-xs text-neutral-600 mt-2">序列长度: {sequence.length} 氨基酸</p>
      </div>
    );
  }

  private renderPropertiesTab(): ReactNode {
    const { analysis } = this.state;
    if (!analysis) return null;

    const properties = [
      { label: '分子量', value: this.formatMolecularWeight(analysis.molecularWeight), color: 'blue' },
      { label: '等电点 (pI)', value: analysis.isoelectricPoint.toFixed(2), color: 'green' },
      { label: '疏水性 (GRAVY)', value: analysis.hydrophobicity.toFixed(3), color: 'purple' },
      { label: 'pH 7.0 电荷', value: analysis.chargeAtPH7.toFixed(3), color: 'red' },
      { label: '不稳定指数', value: analysis.instabilityIndex.toFixed(2), color: 'orange' },
      { label: '脂肪族指数', value: analysis.aliphaticIndex.toFixed(2), color: 'indigo' },
      { label: '消光系数', value: analysis.extinctionCoefficient.toString(), color: 'pink' },
    ];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((prop, idx) => (
            <div key={idx} className={`bg-${prop.color}-50 border border-${prop.color}-200 rounded-lg p-4`}>
              <p className="text-sm text-neutral-600 mb-1">{prop.label}</p>
              <p className={`text-2xl font-bold text-${prop.color}-900`}>{prop.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-neutral-900">二级结构预测</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-neutral-700">α-螺旋</span>
                <span className="text-sm font-semibold text-secondary-600">
                  {analysis.secondaryStructure.helix.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-3">
                <div
                  className="bg-secondary-600 h-3 rounded-full transition-all"
                  style={{ width: `${Math.min(analysis.secondaryStructure.helix, 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-neutral-700">β-折叠</span>
                <span className="text-sm font-semibold text-success-600">
                  {analysis.secondaryStructure.sheet.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-3">
                <div
                  className="bg-success-600 h-3 rounded-full transition-all"
                  style={{ width: `${Math.min(analysis.secondaryStructure.sheet, 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-neutral-700">无规卷曲</span>
                <span className="text-sm font-semibold text-orange-600">
                  {analysis.secondaryStructure.coil.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-3">
                <div
                  className="bg-orange-600 h-3 rounded-full transition-all"
                  style={{ width: `${Math.min(analysis.secondaryStructure.coil, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  private renderCompositionTab(): ReactNode {
    const { analysis } = this.state;
    if (!analysis) return null;

    const composition = Object.entries(analysis.aminoAcidComposition)
      .sort(([, a], [, b]) => b - a);

    const totalAA = analysis.length;
    const aminoAcidInfo = this.peptideService.getAllAminoAcidInfo();

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-neutral-900">氨基酸组成</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {composition.map(([aa, count]) => {
              const percentage = ((count / totalAA) * 100).toFixed(1);
              const info = aminoAcidInfo[aa];

              return (
                <div key={aa} className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold text-neutral-900">{aa}</span>
                    <span className="text-lg font-semibold text-secondary-600">{count}</span>
                  </div>
                  <p className="text-xs text-neutral-600 mb-1">{info?.name || aa}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-neutral-200 rounded-full h-2">
                      <div
                        className="bg-secondary-600 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-neutral-700">{percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-neutral-900">氨基酸分类统计</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-secondary-900 mb-2">疏水性氨基酸</h4>
              <div className="flex gap-2 flex-wrap">
                {['A', 'V', 'I', 'L', 'M', 'F', 'W'].filter(aa => analysis.aminoAcidComposition[aa])
                  .map(aa => (
                    <span key={aa} className="px-2 py-1 bg-secondary-200 text-secondary-900 rounded text-sm font-semibold">
                      {aa}
                    </span>
                  ))}
              </div>
            </div>
            <div className="bg-error-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-semibold text-error-900 mb-2">带电氨基酸</h4>
              <div className="flex gap-2 flex-wrap">
                {['R', 'K', 'H'].filter(aa => analysis.aminoAcidComposition[aa]).length > 0 && (
                  <div className="w-full">
                    <p className="text-xs text-error-700 mb-1">正电荷 (R, K, H):</p>
                    <div className="flex gap-2 flex-wrap">
                      {['R', 'K', 'H'].filter(aa => analysis.aminoAcidComposition[aa])
                        .map(aa => (
                          <span key={aa} className="px-2 py-1 bg-error-200 text-error-900 rounded text-sm font-semibold">
                            {aa}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
                {['D', 'E'].filter(aa => analysis.aminoAcidComposition[aa]).length > 0 && (
                  <div className="w-full mt-2">
                    <p className="text-xs text-error-700 mb-1">负电荷 (D, E):</p>
                    <div className="flex gap-2 flex-wrap">
                      {['D', 'E'].filter(aa => analysis.aminoAcidComposition[aa])
                        .map(aa => (
                          <span key={aa} className="px-2 py-1 bg-error-200 text-error-900 rounded text-sm font-semibold">
                            {aa}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-success-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-success-900 mb-2">极性氨基酸</h4>
              <div className="flex gap-2 flex-wrap">
                {['S', 'T', 'N', 'Q', 'Y', 'C'].filter(aa => analysis.aminoAcidComposition[aa])
                  .map(aa => (
                    <span key={aa} className="px-2 py-1 bg-success-200 text-success-900 rounded text-sm font-semibold">
                      {aa}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  private renderBioactivityTab(): ReactNode {
    const { bioactivityPredictions } = this.state;

    if (bioactivityPredictions.length === 0) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <svg className="w-12 h-12 text-yellow-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">未预测到生物活性</h3>
          <p className="text-sm text-yellow-700">
            根据当前序列特征，未能预测出常见的生物活性类型
          </p>
        </div>
      );
    }

    const bioactivityColors: Record<string, string> = {
      antioxidant: 'bg-accent-500',
      antihypertensive: 'bg-cyan-500',
      antimicrobial: 'bg-teal-500',
      immunomodulatory: 'bg-success-500',
      opioid: 'bg-pink-500',
      'collagen synthesis': 'bg-orange-500',
      antidiabetic: 'bg-yellow-500',
      'ACE inhibitory': 'bg-indigo-500',
    };

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-neutral-900">
          预测的生物活性 ({bioactivityPredictions.length})
        </h3>

        {bioactivityPredictions.map((prediction, idx) => (
          <div key={idx} className="bg-white dark:bg-neutral-900 border border-neutral-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-3 py-1 ${bioactivityColors[prediction.type] || 'bg-neutral-50 dark:bg-neutral-8000'} text-white rounded-full text-sm font-semibold`}>
                    {prediction.type}
                  </span>
                  {this.renderConfidenceBadge(prediction.confidence)}
                </div>
                <p className="text-neutral-700 leading-relaxed">{prediction.mechanism}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {prediction.predictedIC50 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-neutral-600 mb-1">预测IC50</p>
                  <p className="text-lg font-bold text-secondary-900">{prediction.predictedIC50} μM</p>
                </div>
              )}
              <div className="bg-success-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-neutral-600 mb-1">相关多肽</p>
                <p className="text-sm font-semibold text-success-900">
                  {prediction.relatedPeptides.length} 个
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <p className="text-xs text-neutral-600 mb-2">证据支持:</p>
              <p className="text-sm text-neutral-700">{prediction.evidence}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  private renderStructureTab(): ReactNode {
    const { structurePrediction, analysis } = this.state;
    if (!structurePrediction || !analysis) return null;

    const structureColors: Record<string, string> = {
      'H': 'bg-secondary',
      'E': 'bg-success-500',
      'C': 'bg-orange-500',
    };

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-indigo-900 mb-1">结构预测结果</h3>
              <p className="text-sm text-indigo-700">基于序列特征的结构预测</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-600 mb-1">预测置信度</p>
              <p className="text-2xl font-bold text-indigo-600">
                {(structurePrediction.confidence * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-medium text-neutral-700 mb-2">预测的二级结构</h4>
            <div className="flex flex-wrap gap-1">
              {structurePrediction.predictedStructure.split('').map((char, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-semibold text-white ${structureColors[char] || 'bg-neutral-50 dark:bg-neutral-8000'}`}
                  title={
                    char === 'H' ? 'α-螺旋' :
                    char === 'E' ? 'β-折叠' :
                    '无规卷曲'
                  }
                >
                  {char}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-secondary-600 mb-1">
                {analysis.secondaryStructure.helix.toFixed(0)}%
              </p>
              <p className="text-xs text-neutral-600">α-螺旋 (H)</p>
            </div>
            <div className="bg-success-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-success-600 mb-1">
                {analysis.secondaryStructure.sheet.toFixed(0)}%
              </p>
              <p className="text-xs text-neutral-600">β-折叠 (E)</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-orange-600 mb-1">
                {analysis.secondaryStructure.coil.toFixed(0)}%
              </p>
              <p className="text-xs text-neutral-600">无规卷曲 (C)</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 rounded-lg p-4">
            <h4 className="font-semibold text-neutral-900 mb-3">表面可及性</h4>
            <div className="space-y-2">
              {structurePrediction.surfaceAccessibility.slice(0, 10).map((value, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-neutral-600 w-8">AA {idx + 1}</span>
                  <div className="flex-1 bg-neutral-200 rounded-full h-2">
                    <div
                      className="bg-secondary-600 h-2 rounded-full"
                      style={{ width: `${value * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-neutral-700 w-12 text-right">
                    {(value * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
              {structurePrediction.surfaceAccessibility.length > 10 && (
                <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-center">
                  ... 共 {structurePrediction.surfaceAccessibility.length} 个氨基酸
                </p>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 rounded-lg p-4">
            <h4 className="font-semibold text-neutral-900 mb-3">柔性指数</h4>
            <div className="space-y-2">
              {structurePrediction.flexibilityIndex.slice(0, 10).map((value, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-neutral-600 w-8">AA {idx + 1}</span>
                  <div className="flex-1 bg-neutral-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        value > 0.6 ? 'bg-success-600' :
                        value > 0.4 ? 'bg-yellow-600' :
                        'bg-error-600'
                      }`}
                      style={{ width: `${value * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-neutral-700 w-12 text-right">
                    {value.toFixed(2)}
                  </span>
                </div>
              ))}
              {structurePrediction.flexibilityIndex.length > 10 && (
                <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-center">
                  ... 共 {structurePrediction.flexibilityIndex.length} 个氨基酸
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  private renderAnalysisResults(): ReactNode {
    const { analysis, activeTab } = this.state;

    if (!analysis) return null;

    return (
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2">分析结果</h2>
              <p className="text-secondary-100">序列长度: {analysis.length} 氨基酸</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => this.handleExport('json')}
                className="px-4 py-2 bg-white dark:bg-neutral-900 bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors text-sm"
                title="导出JSON"
              >
                JSON
              </button>
              <button
                onClick={() => this.handleExport('csv')}
                className="px-4 py-2 bg-white dark:bg-neutral-900 bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors text-sm"
                title="导出CSV"
              >
                CSV
              </button>
              <button
                onClick={() => this.handleExport('txt')}
                className="px-4 py-2 bg-white dark:bg-neutral-900 bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors text-sm"
                title="导出TXT"
              >
                TXT
              </button>
            </div>
          </div>
        </div>

        <div className="border-b border-neutral-200 dark:border-neutral-700">
          <nav className="flex">
            {(['properties', 'composition', 'bioactivity', 'structure'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => this.setState({ activeTab: tab })}
                className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-secondary-600'
                    : 'border-transparent text-neutral-600 hover:text-neutral-800'
                }`}
              >
                {tab === 'properties' ? '理化性质' :
                 tab === 'composition' ? '氨基酸组成' :
                 tab === 'bioactivity' ? '生物活性' : '结构预测'}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'properties' && this.renderPropertiesTab()}
          {activeTab === 'composition' && this.renderCompositionTab()}
          {activeTab === 'bioactivity' && this.renderBioactivityTab()}
          {activeTab === 'structure' && this.renderStructureTab()}
        </div>
      </div>
    );
  }

  public render(): ReactNode {
    const { loading, error, analysis } = this.state;

    return (
      <div className={this.getComponentClassName()} style={this.getComponentStyle()}>
        <div className="max-w-7xl mx-auto p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-neutral-900 mb-2">多肽序列分析</h1>
            <p className="text-neutral-600">
              输入氨基酸序列，分析理化性质、预测生物活性和结构特征
            </p>
          </div>

          {error && this.renderError(error)}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              {this.renderInputSection()}
              {this.renderSequenceDisplay()}
            </div>

            <div className="lg:col-span-2">
              {loading ? (
                this.renderLoadingIndicator()
              ) : analysis ? (
                this.renderAnalysisResults()
              ) : (
                this.renderEmptyState('请输入多肽序列开始分析')
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default PeptideAnalyzer;
