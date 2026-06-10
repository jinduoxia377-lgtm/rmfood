import React, { useState, useEffect } from 'react';
import { ProfessionalBaseComponent } from './ProfessionalBaseComponent';
import { tcmService } from '@/services/professional';
import type { TCMHerb, TCMTarget, TCMDisease } from '@/services/professional';
import { BookOpen, Activity, Target, Pill, Heart, Brain, Leaf, ChevronDown, ChevronUp } from 'lucide-react';

interface EfficacyExplainerProps {
  herbName?: string;
  onAnalysisComplete?: () => void;
}

interface EfficacyExplainerState {
  herb: TCMHerb | null;
  selectedCategory: 'efficacy' | 'pharmacology' | 'clinical';
  expandedSections: Set<string>;
}

interface EfficacyCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  items: EfficacyItem[];
}

interface EfficacyItem {
  id: string;
  name: string;
  description: string;
  targets?: TCMTarget[];
  diseases?: TCMDisease[];
  evidenceLevel: 'strong' | 'moderate' | 'weak';
}

export class EfficacyExplainer extends ProfessionalBaseComponent<EfficacyExplainerProps, EfficacyExplainerState> {
  constructor(props: EfficacyExplainerProps) {
    super(props);
    this.state = {
      herb: null,
      selectedCategory: 'efficacy',
      expandedSections: new Set(['main_efficacy']),
    };
  }

  componentDidMount() {
    if (this.props.herbName) {
      this.loadHerbData(this.props.herbName);
    }
  }

  componentDidUpdate(prevProps: EfficacyExplainerProps) {
    if (prevProps.herbName !== this.props.herbName && this.props.herbName) {
      this.loadHerbData(this.props.herbName);
    }
  }

  private async loadHerbData(herbName: string) {
    this.setLoading(true);
    try {
      const herb = await tcmService.getHerbByName(herbName);
      if (herb) {
        this.setState({ herb });
      }
    } catch (error) {
      this.handleError(error);
    } finally {
      this.setLoading(false);
      if (this.props.onAnalysisComplete) {
        this.props.onAnalysisComplete();
      }
    }
  }

  private toggleSection = (sectionId: string) => {
    this.setState((prev) => {
      const expanded = new Set(prev.expandedSections);
      if (expanded.has(sectionId)) {
        expanded.delete(sectionId);
      } else {
        expanded.add(sectionId);
      }
      return { expandedSections: expanded };
    });
  };

  private getEfficacyCategories(): EfficacyCategory[] {
    const { herb } = this.state;
    if (!herb) return [];

    return [
      {
        id: 'main_efficacy',
        name: '主要功效',
        icon: <Heart className="w-5 h-5" />,
        description: '中药的核心治疗作用',
        items: herb.indications.map((indication, index) => ({
          id: `efficacy_${index}`,
          name: indication,
          description: this.getEfficacyDescription(indication),
          evidenceLevel: 'strong',
        })),
      },
      {
        id: 'pharmacology',
        name: '药理作用',
        icon: <Activity className="w-5 h-5" />,
        description: '现代药理研究发现的作用机制',
        items: herb.chemistry.targets.map((target) => ({
          id: target.uniprotId,
          name: target.geneSymbol,
          description: target.geneName,
          targets: [target],
          evidenceLevel: target.affinity && target.affinity >= 7 ? 'strong' : 'moderate',
        })),
      },
      {
        id: 'clinical',
        name: '临床应用',
        icon: <Pill className="w-5 h-5" />,
        description: '临床实践中的应用场景',
        items: herb.chemistry.diseases.map((disease) => ({
          id: disease.diseaseId,
          name: disease.diseaseName,
          description: disease.mechanisms.join('；'),
          diseases: [disease],
          evidenceLevel: disease.evidenceLevel.toLowerCase() === 'strong' ? 'strong' : 'moderate',
        })),
      },
      {
        id: 'pathways',
        name: '作用通路',
        icon: <Brain className="w-5 h-5" />,
        description: '涉及的生物信号通路',
        items: herb.chemistry.pathways.map((pathway, index) => ({
          id: `pathway_${index}`,
          name: pathway,
          description: this.getPathwayDescription(pathway),
          evidenceLevel: 'moderate',
        })),
      },
    ];
  }

  private getEfficacyDescription(efficacy: string): string {
    const descriptions: Record<string, string> = {
      '气虚欲脱': '适用于元气大虚、气息微弱的危重病症，能大补元气、复脉固脱。',
      '脾虚食少': '用于脾胃虚弱引起的食欲不振、消化不良等症状。',
      '肺虚喘咳': '治疗肺气虚导致的咳嗽、气喘等呼吸系统疾病。',
      '津伤口渴': '适用于热病后期或大汗后津液耗伤引起的口渴。',
      '内热消渴': '用于治疗糖尿病等阴虚燥热引起的病症。',
      '气血亏虚': '适用于气血两虚引起的面色苍白、乏力等症状。',
      '惊悸失眠': '治疗心脾两虚引起的心悸、失眠等神经系统疾病。',
      '气虚乏力': '适用于气虚引起的全身乏力、精神不振。',
      '食少便溏': '用于脾胃虚弱导致的消化不良、大便稀溏。',
      '血虚萎黄': '治疗血虚引起的面色萎黄、头晕乏力。',
      '眩晕心悸': '适用于血虚或阴虚引起的头晕、心悸。',
      '月经不调': '用于治疗妇科月经不调、痛经等病症。',
      '胸痹心痛': '治疗冠心病、心绞痛等心血管疾病。',
      '心烦不眠': '用于心火亢盛或阴虚火旺引起的失眠。',
    };
    return descriptions[efficacy] || '该功效的详细描述。';
  }

  private getPathwayDescription(pathway: string): string {
    const descriptions: Record<string, string> = {
      'PI3K/AKT signaling': 'PI3K/AKT信号通路是细胞存活和增殖的关键调节通路。',
      'MAPK signaling': 'MAPK信号通路参与细胞增殖、分化和应激反应。',
      'PPAR signaling pathway': 'PPAR信号通路调节脂质代谢和胰岛素敏感性。',
      'NF-kB signaling': 'NF-kB信号通路是炎症反应的核心调节通路。',
      'TGF-beta signaling': 'TGF-beta信号通路参与细胞生长和分化调控。',
      'JAK-STAT signaling': 'JAK-STAT信号通路调节免疫反应和细胞因子信号传导。',
      'VEGF signaling': 'VEGF信号通路调控血管生成过程。',
      'Apoptosis pathway': '细胞凋亡通路参与细胞程序性死亡过程。',
      'Cell cycle regulation': '细胞周期调控通路控制细胞分裂和增殖。',
      'Mineralocorticoid signaling': '盐皮质激素信号通路调节水盐平衡。',
      'Glucocorticoid signaling': '糖皮质激素信号通路参与抗炎和免疫抑制。',
    };
    return descriptions[pathway] || '该通路的详细描述。';
  }

  private renderEvidenceBadge(level: string) {
    const styles: Record<string, string> = {
      strong: 'bg-green-100 text-green-800',
      moderate: 'bg-yellow-100 text-yellow-800',
      weak: 'bg-gray-100 text-gray-600',
    };

    const labels: Record<string, string> = {
      strong: '证据充分',
      moderate: '证据中等',
      weak: '证据有限',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[level]}`}>
        {labels[level]}
      </span>
    );
  }

  private renderCategory(category: EfficacyCategory) {
    const { expandedSections } = this.state;
    const isExpanded = expandedSections.has(category.id);

    return (
      <div key={category.id} className="mb-4">
        <button
          onClick={() => this.toggleSection(category.id)}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white">
              {category.icon}
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 dark:text-white">{category.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{category.description}</p>
            </div>
          </div>
          <div className="text-gray-400">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="mt-2 space-y-3 pl-2">
            {category.items.map((item) => (
              <div
                key={item.id}
                className="bg-gray-50 dark:bg-gray-850 rounded-lg p-4 border border-gray-100 dark:border-gray-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      {item.name}
                      {this.renderEvidenceBadge(item.evidenceLevel)}
                    </h4>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      {item.description}
                    </p>
                    {item.targets && item.targets.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-1">相关靶点：</p>
                        <div className="flex flex-wrap gap-2">
                          {item.targets.map((target) => (
                            <span
                              key={target.uniprotId}
                              className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs"
                            >
                              {target.geneSymbol}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {item.diseases && item.diseases.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-1">相关疾病：</p>
                        <div className="flex flex-wrap gap-2">
                          {item.diseases.map((disease) => (
                            <span
                              key={disease.diseaseId}
                              className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs"
                            >
                              {disease.diseaseName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  render() {
    const { herb } = this.state;

    if (this.isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">正在分析功效...</span>
        </div>
      );
    }

    if (!herb) {
      return (
        <div className="text-center py-12">
          <Leaf className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">请选择或搜索中药成分</p>
        </div>
      );
    }

    const efficacyCategories = this.getEfficacyCategories();

    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{herb.name}</h2>
              <p className="text-teal-100 text-sm">{herb.latinName}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-sm">
              药性：{herb.properties.nature}
            </span>
            {herb.properties.flavor.map((flavor, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-sm"
              >
                味{flavor}
              </span>
            ))}
            {herb.properties.meridian.map((meridian, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm"
              >
                归{meridian}经
              </span>
            ))}
          </div>

          <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
            {herb.description}
          </p>

          {efficacyCategories.map((category) => this.renderCategory(category))}

          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-850 rounded-lg border border-gray-100 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">使用注意</h4>
            <div className="space-y-2">
              {herb.contraindications.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">禁忌：</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {herb.contraindications.join('；')}
                  </p>
                </div>
              )}
              {herb.sideEffects.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                    不良反应：
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {herb.sideEffects.join('；')}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-200 dark:border-teal-800">
            <h4 className="font-medium text-teal-800 dark:text-teal-200 mb-2">推荐用量</h4>
            <p className="text-sm text-teal-700 dark:text-teal-300">
              {herb.dosage.amount} {herb.dosage.unit}，{herb.dosage.preparations.join('、')}
            </p>
          </div>
        </div>
      </div>
    );
  }
}

export default EfficacyExplainer;
