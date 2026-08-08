import { logger } from '@/utils/safeLogger';
import React, { Component } from 'react';
import type { ReactNode } from 'react';
import { ProfessionalBaseComponent } from './ProfessionalBaseComponent';
import { TCMService } from '@/services/professional/tcmService';
import type { TCMHerb, TCMChemistry } from '@/services/professional/tcmService';
import type { ProfessionalComponentProps } from '@/types/professional';

interface IngredientAnalyzerProps extends ProfessionalComponentProps {
  onAnalysisComplete?: (herb: TCMHerb) => void;
  onExport?: (data: ExportData) => void;
}

interface IngredientAnalyzerState {
  searchQuery: string;
  selectedHerb: TCMHerb | null;
  herbs: TCMHerb[];
  chemistry: TCMChemistry | null;
  loading: boolean;
  error: string | null;
  searchLoading: boolean;
  activeTab: 'overview' | 'chemistry' | 'targets' | 'diseases';
  showStructureModal: boolean;
  selectedCompound: TCMChemistry | null;
}

interface ExportData {
  herb: TCMHerb | null;
  chemistry: TCMChemistry | null;
  exportTime: string;
  format: 'json' | 'csv' | 'pdf';
}

class IngredientAnalyzer extends ProfessionalBaseComponent<IngredientAnalyzerProps, IngredientAnalyzerState> {
  private tcmService: TCMService;

  constructor(props: IngredientAnalyzerProps) {
    super(props);
    this.tcmService = new TCMService();
    this.state = {
      searchQuery: '',
      selectedHerb: null,
      herbs: [],
      chemistry: null,
      loading: false,
      error: null,
      searchLoading: false,
      activeTab: 'overview',
      showStructureModal: false,
      selectedCompound: null,
    };
  }

  private handleSearch = async (): Promise<void> => {
    const { searchQuery } = this.state;
    if (!searchQuery.trim()) {
      this.setState({ error: '请输入搜索关键词' });
      return;
    }

    this.setState({ searchLoading: true, error: null });
    try {
      const result = await this.tcmService.searchHerbs({
        keyword: searchQuery,
        pageSize: 20,
      });
      this.setState({
        herbs: result.herbs,
        searchLoading: false,
      });
    } catch (error) {
      this.handleError(error as Error);
      this.setState({ searchLoading: false });
    }
  };

  private handleHerbSelect = (herb: TCMHerb): void => {
    this.setState({
      selectedHerb: herb,
      chemistry: herb.chemistry,
      loading: false,
      activeTab: 'overview',
    });
    if (this.props.onAnalysisComplete) {
      this.props.onAnalysisComplete(herb);
    }
  };

  private handleCompoundClick = (compound: TCMChemistry): void => {
    this.setState({
      showStructureModal: true,
      selectedCompound: compound,
    });
  };

  private closeStructureModal = (): void => {
    this.setState({
      showStructureModal: false,
      selectedCompound: null,
    });
  };

  private handleExport = (format: 'json' | 'csv' | 'pdf'): void => {
    const { selectedHerb, chemistry } = this.state;
    const exportData: ExportData = {
      herb: selectedHerb,
      chemistry,
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
      case 'pdf':
        this.exportAsPDF(exportData);
        break;
    }
  };

  private exportAsJSON(data: ExportData): void {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    this.downloadFile(blob, `ingredient-analysis-${Date.now()}.json`);
  }

  private exportAsCSV(data: ExportData): void {
    if (!data.herb) return;

    const csvContent = [
      ['字段', '内容'],
      ['药材名称', data.herb.name],
      ['拉丁名称', data.herb.latinName],
      ['科属', data.herb.family],
      ['性味', data.herb.properties.flavor.join(', ')],
      ['归经', data.herb.properties.meridian.join(', ')],
      ['功效', data.herb.description],
      ['主治', data.herb.indications.join(', ')],
      ['用量', `${data.herb.dosage.amount} ${data.herb.dosage.unit}`],
      ['禁忌', data.herb.contraindications.join(', ')],
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    this.downloadFile(blob, `ingredient-analysis-${Date.now()}.csv`);
  }

  private exportAsPDF(data: ExportData): void {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const herbName = data.herb?.name || 'N/A'
    const herbCategory = data.herb?.family || ''
    const herbProps = data.herb?.properties?.nature || ''
    const herbFlavor = ''
    const chemName = data.chemistry?.name || 'N/A'

    const html = `
      <!DOCTYPE html><html><head><title>原料分析报告</title>
      <style>body{font-family:'Microsoft YaHei',sans-serif;padding:40px}
      table{width:100%;border-collapse:collapse;margin-top:20px}
      th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}
      th{background:#f5f5f5}</style></head>
      <body><h1>原料分析报告</h1>
      <p>导出时间: ${new Date().toLocaleString('zh-CN')}</p>
      <h2>草药: ${herbName}</h2>
      <table><thead><tr><th>类别</th><th>性质</th><th>味道</th></tr></thead>
      <tbody><tr><td>${herbCategory}</td><td>${herbProps}</td><td>${herbFlavor}</td></tr></tbody>
      </table>
      <h2>化学成分: ${chemName}</h2>
      </body></html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print(); printWindow.close() }, 500)
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

  private renderSearchSection(): ReactNode {
    const { searchQuery, searchLoading } = this.state;

    return (
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => this.setState({ searchQuery: e.target.value })}
            onKeyPress={(e) => e.key === 'Enter' && this.handleSearch()}
            placeholder="输入药材名称进行搜索..."
            className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={searchLoading}
          />
          <button
            onClick={this.handleSearch}
            disabled={searchLoading}
            className="px-6 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 disabled:bg-neutral-400 transition-colors"
          >
            {searchLoading ? '搜索中...' : '搜索'}
          </button>
        </div>
      </div>
    );
  }

  private renderHerbList(): ReactNode {
    const { herbs, searchLoading } = this.state;

    if (searchLoading) {
      return this.renderLoadingIndicator();
    }

    if (herbs.length === 0) {
      return this.renderEmptyState('请输入关键词搜索药材');
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {herbs.map((herb) => (
          <div
            key={herb.id}
            onClick={() => this.handleHerbSelect(herb)}
            className="p-4 bg-white border border-neutral-200 rounded-lg cursor-pointer hover:shadow-lg hover:border-blue-500 transition-all"
          >
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">{herb.name}</h3>
            <p className="text-sm text-neutral-600 italic mb-2">{herb.latinName}</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {herb.properties.flavor.map((flavor, idx) => (
                <span key={idx} className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
                  {flavor}
                </span>
              ))}
            </div>
            <p className="text-xs text-neutral-500">{herb.family}</p>
          </div>
        ))}
      </div>
    );
  }

  private renderHerbDetail(): ReactNode {
    const { selectedHerb, activeTab } = this.state;

    if (!selectedHerb) {
      return null;
    }

    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2">{selectedHerb.name}</h2>
              <p className="text-secondary-100 italic">{selectedHerb.latinName}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => this.handleExport('json')}
                className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors"
                title="导出JSON"
              >
                JSON
              </button>
              <button
                onClick={() => this.handleExport('csv')}
                className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors"
                title="导出CSV"
              >
                CSV
              </button>
              <button
                onClick={() => this.handleExport('pdf')}
                className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors"
                title="导出PDF"
              >
                PDF
              </button>
            </div>
          </div>
        </div>

        <div className="border-b border-neutral-200">
          <nav className="flex">
            {(['overview', 'chemistry', 'targets', 'diseases'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => this.setState({ activeTab: tab })}
                className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-secondary-600'
                    : 'border-transparent text-neutral-600 hover:text-neutral-800'
                }`}
              >
                {tab === 'overview'
                  ? '基本信息'
                  : tab === 'chemistry'
                    ? '化学成分'
                    : tab === 'targets'
                      ? '作用靶点'
                      : '相关疾病'}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && this.renderOverviewTab()}
          {activeTab === 'chemistry' && this.renderChemistryTab()}
          {activeTab === 'targets' && this.renderTargetsTab()}
          {activeTab === 'diseases' && this.renderDiseasesTab()}
        </div>
      </div>
    );
  }

  private renderOverviewTab(): ReactNode {
    const { selectedHerb } = this.state;
    if (!selectedHerb) return null;

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-3 text-neutral-900">基本信息</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-neutral-600 mb-1">科属</p>
              <p className="font-medium text-neutral-900">{selectedHerb.family}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-neutral-600 mb-1">性味</p>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded">
                  {selectedHerb.properties.nature}
                </span>
                {selectedHerb.properties.flavor.map((flavor, idx) => (
                  <span key={idx} className="px-3 py-1 bg-error-100 text-error-800 rounded">
                    {flavor}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-neutral-600 mb-1">归经</p>
              <div className="flex flex-wrap gap-2">
                {selectedHerb.properties.meridian.map((meridian, idx) => (
                  <span key={idx} className="px-3 py-1 bg-accent-100 text-accent-800 rounded">
                    {meridian}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-neutral-600 mb-1">毒性</p>
              <p className="font-medium text-neutral-900">{selectedHerb.properties.toxicity || '无'}</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3 text-neutral-900">功效描述</h3>
          <p className="text-neutral-700 leading-relaxed">{selectedHerb.description}</p>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3 text-neutral-900">主治症状</h3>
          <div className="flex flex-wrap gap-2">
            {selectedHerb.indications.map((indication, idx) => (
              <span key={idx} className="px-3 py-1 bg-secondary-100 text-secondary-800 rounded-lg text-sm">
                {indication}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3 text-neutral-900">用法用量</h3>
          <div className="bg-slate-50 p-4 rounded-lg">
            <p className="text-2xl font-bold text-secondary-600 mb-2">
              {selectedHerb.dosage.amount} {selectedHerb.dosage.unit}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedHerb.dosage.preparations.map((prep, idx) => (
                <span key={idx} className="px-3 py-1 bg-success-100 text-success-800 rounded text-sm">
                  {prep}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3 text-neutral-900">禁忌与副作用</h3>
          <div className="bg-error-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-error-900 mb-2">禁忌</h4>
            <ul className="list-disc list-inside text-error-800 space-y-1">
              {selectedHerb.contraindications.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
            <h4 className="font-semibold text-yellow-900 mb-2">副作用</h4>
            <ul className="list-disc list-inside text-yellow-800 space-y-1">
              {selectedHerb.sideEffects.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  private renderChemistryTab(): ReactNode {
    const { selectedHerb } = this.state;
    if (!selectedHerb?.chemistry) {
      return this.renderEmptyState('暂无化学成分数据');
    }

    const { chemistry } = selectedHerb;

    return (
      <div className="space-y-6">
        <div
          onClick={() => this.handleCompoundClick(chemistry)}
          className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 cursor-pointer hover:shadow-lg transition-shadow"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold text-neutral-900 mb-1">{chemistry.name}</h3>
              {chemistry.englishName && <p className="text-sm text-neutral-600 italic">{chemistry.englishName}</p>}
            </div>
            <span className="px-3 py-1 bg-success-600 text-white rounded-full text-sm">点击查看结构</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {chemistry.molecularFormula && (
              <div className="bg-white p-3 rounded">
                <p className="text-xs text-neutral-600 mb-1">分子式</p>
                <p className="font-mono text-sm font-semibold">{chemistry.molecularFormula}</p>
              </div>
            )}
            {chemistry.molecularWeight && (
              <div className="bg-white p-3 rounded">
                <p className="text-xs text-neutral-600 mb-1">分子量</p>
                <p className="font-semibold">{this.formatNumber(chemistry.molecularWeight, 2)} Da</p>
              </div>
            )}
            {chemistry.casNumber && (
              <div className="bg-white p-3 rounded">
                <p className="text-xs text-neutral-600 mb-1">CAS号</p>
                <p className="font-mono text-sm">{chemistry.casNumber}</p>
              </div>
            )}
            <div className="bg-white p-3 rounded">
              <p className="text-xs text-neutral-600 mb-1">靶点数量</p>
              <p className="font-semibold">{chemistry.targets.length}</p>
            </div>
          </div>
        </div>

        {chemistry.pathways.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 text-neutral-900">信号通路</h3>
            <div className="flex flex-wrap gap-2">
              {chemistry.pathways.map((pathway, idx) => (
                <span key={idx} className="px-4 py-2 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                  {pathway}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  private renderTargetsTab(): ReactNode {
    const { selectedHerb } = this.state;
    if (!selectedHerb?.chemistry?.targets) {
      return this.renderEmptyState('暂无靶点数据');
    }

    const { targets } = selectedHerb.chemistry;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-neutral-900">作用靶点 ({targets.length})</h3>
        <div className="grid gap-4">
          {targets.map((target, idx) => (
            <div key={idx} className="bg-white border border-neutral-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold text-neutral-900 mb-1">{target.geneName}</h4>
                  <p className="text-sm text-neutral-600">{target.geneSymbol}</p>
                </div>
                {target.affinity && (
                  <div className="text-right">
                    <p className="text-xs text-neutral-600">亲和力</p>
                    <p className="font-bold text-secondary-600">pIC50: {target.affinity}</p>
                  </div>
                )}
              </div>
              <div className="mb-3">
                <p className="text-sm text-neutral-700">{target.proteinName}</p>
                <p className="text-xs text-neutral-500 mt-1">UniProt: {target.uniprotId}</p>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {target.pathways.map((pathway, pIdx) => (
                  <span key={pIdx} className="px-2 py-1 bg-accent-100 text-accent-800 text-xs rounded">
                    {pathway}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {target.evidence.map((ev, eIdx) => (
                  <span key={eIdx} className="px-2 py-1 bg-neutral-100 text-neutral-700 text-xs rounded">
                    {ev}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  private renderDiseasesTab(): ReactNode {
    const { selectedHerb } = this.state;
    if (!selectedHerb?.chemistry?.diseases) {
      return this.renderEmptyState('暂无疾病数据');
    }

    const { diseases } = selectedHerb.chemistry;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-neutral-900">相关疾病 ({diseases.length})</h3>
        <div className="grid gap-4">
          {diseases.map((disease, idx) => (
            <div key={idx} className="bg-white border border-neutral-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-semibold text-neutral-900">{disease.diseaseName}</h4>
                {this.renderConfidenceBadge(
                  disease.evidenceLevel === 'Strong'
                    ? 0.9
                    : disease.evidenceLevel === 'Moderate'
                      ? 0.7
                      : disease.evidenceLevel === 'Weak'
                        ? 0.5
                        : 0.3,
                )}
              </div>
              {disease.omimId && <p className="text-sm text-neutral-600 mb-2">OMIM: {disease.omimId}</p>}
              <div className="mb-2">
                <p className="text-xs text-neutral-600">相关靶点: {disease.relatedTargets}个</p>
                <p className="text-xs text-neutral-600">证据等级: {disease.evidenceLevel}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-neutral-800">作用机制:</p>
                <ul className="list-disc list-inside text-sm text-neutral-700">
                  {disease.mechanisms.map((mech, mIdx) => (
                    <li key={mIdx}>{mech}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  private renderStructureModal(): ReactNode {
    const { showStructureModal, selectedCompound } = this.state;

    if (!showStructureModal || !selectedCompound) {
      return null;
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-neutral-200 p-6 flex justify-between items-center">
            <div>
              <h2 className="h2 text-neutral-900">{selectedCompound.name}</h2>
              {selectedCompound.englishName && <p className="text-neutral-600 italic">{selectedCompound.englishName}</p>}
            </div>
            <button onClick={this.closeStructureModal} className="text-neutral-500 hover:text-neutral-700 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {selectedCompound.molecularFormula && (
                <div className="bg-secondary-50 p-4 rounded-lg">
                  <p className="text-sm text-neutral-600 mb-1">分子式</p>
                  <p className="text-2xl font-mono font-bold text-secondary-900">{selectedCompound.molecularFormula}</p>
                </div>
              )}
              {selectedCompound.molecularWeight && (
                <div className="bg-success-50 p-4 rounded-lg">
                  <p className="text-sm text-neutral-600 mb-1">分子量</p>
                  <p className="text-2xl font-bold text-success-900">
                    {this.formatNumber(selectedCompound.molecularWeight, 2)} Da
                  </p>
                </div>
              )}
              {selectedCompound.casNumber && (
                <div className="bg-accent-50 p-4 rounded-lg">
                  <p className="text-sm text-neutral-600 mb-1">CAS号</p>
                  <p className="text-xl font-mono font-semibold text-accent-900">{selectedCompound.casNumber}</p>
                </div>
              )}
              {selectedCompound.structure && (
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-neutral-600 mb-1">结构类型</p>
                  <p className="text-xl font-semibold text-orange-900">{selectedCompound.structure}</p>
                </div>
              )}
            </div>

            {selectedCompound.smiles && (
              <div className="bg-slate-50 p-4 rounded-lg mb-6">
                <p className="text-sm text-neutral-600 mb-2">SMILES结构</p>
                <p className="font-mono text-sm text-neutral-900 break-all bg-white p-3 rounded border">
                  {selectedCompound.smiles}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedCompound.absorption && (
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-yellow-900 mb-2">吸收</h4>
                  <p className="text-sm text-neutral-700">{selectedCompound.absorption}</p>
                </div>
              )}
              {selectedCompound.distribution && (
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-indigo-900 mb-2">分布</h4>
                  <p className="text-sm text-neutral-700">{selectedCompound.distribution}</p>
                </div>
              )}
              {selectedCompound.metabolism && (
                <div className="bg-pink-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-pink-900 mb-2">代谢</h4>
                  <p className="text-sm text-neutral-700">{selectedCompound.metabolism}</p>
                </div>
              )}
              {selectedCompound.excretion && (
                <div className="bg-cyan-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-cyan-900 mb-2">排泄</h4>
                  <p className="text-sm text-neutral-700">{selectedCompound.excretion}</p>
                </div>
              )}
              {selectedCompound.halfLife && (
                <div className="bg-teal-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-teal-900 mb-2">半衰期</h4>
                  <p className="text-sm text-neutral-700">{selectedCompound.halfLife}</p>
                </div>
              )}
              {selectedCompound.toxicity && (
                <div className="bg-error-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-error-900 mb-2">毒性</h4>
                  <p className="text-sm text-neutral-700">{selectedCompound.toxicity}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  public render(): ReactNode {
    const { loading, error, selectedHerb } = this.state;

    return (
      <div className={this.getComponentClassName()} style={this.getComponentStyle()}>
        <div className="max-w-7xl mx-auto p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-neutral-900 mb-2">中药材成分分析</h1>
            <p className="text-neutral-600">搜索和分析中药材的化学成分、作用靶点和相关疾病</p>
          </div>

          {error && this.renderError(error)}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 text-neutral-900">药材搜索</h2>
                {this.renderSearchSection()}
                {this.renderHerbList()}
              </div>
            </div>

            <div className="lg:col-span-2">
              {loading
                ? this.renderLoadingIndicator()
                : selectedHerb
                  ? this.renderHerbDetail()
                  : this.renderEmptyState('请从左侧选择一个药材进行分析')}
            </div>
          </div>

          {this.renderStructureModal()}
        </div>
      </div>
    );
  }
}

export default IngredientAnalyzer;
