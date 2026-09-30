import React, { useState, useEffect } from 'react';
import tcmService from './tcmService';
import type { TCMHerb, TCMChemistry, TCMChemistryVisualization } from './tcmService';
import { sanitizeHTML } from '@/utils/sanitize';


import { logger } from '@/utils/safeLogger';
interface TCMViewerProps {
  herbId: string;
  showChemistry?: boolean;
  showNetwork?: boolean;
  showVisualization?: boolean;
}

const TCMViewer: React.FC<TCMViewerProps> = ({
  herbId,
  showChemistry = true,
  showNetwork = false,
  showVisualization = false,
}) => {
  const [herb, setHerb] = useState<TCMHerb | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [visualization, setVisualization] = useState<TCMChemistryVisualization | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'targets' | 'diseases' | 'visualization'>('info');

  useEffect(() => {
    loadHerbData();
  }, [herbId]);

  const loadHerbData = async () => {
    setLoading(true);
    setError(null);

    try {
      const herbData = await tcmService.getHerbById(herbId);
      setHerb(herbData);

      if (herbData && showVisualization && herbData.chemistry.smiles) {
        const viz = await tcmService.visualizeChemistry(herbData.chemistry.smiles);
        setVisualization(viz);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '药材数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="tcm-viewer loading">
        <div className="spinner"></div>
        <p>正在加载中药数据…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tcm-viewer error">
        <p>加载失败：{error}</p>
        <button onClick={loadHerbData}>重试</button>
      </div>
    );
  }

  if (!herb) {
    return (
      <div className="tcm-viewer not-found">
        <p>未找到该药材</p>
      </div>
    );
  }

  return (
    <div className="tcm-viewer">
      <div className="tcm-header">
        <h2>{herb.name}</h2>
        <p className="latin-name">{herb.latinName}</p>
        <p className="family">{herb.family}</p>
      </div>

      <div className="tcm-tabs">
        <button
          className={activeTab === 'info' ? 'active' : ''}
          onClick={() => setActiveTab('info')}
        >
          基本信息
        </button>
        <button
          className={activeTab === 'targets' ? 'active' : ''}
          onClick={() => setActiveTab('targets')}
        >
          靶点（{herb.chemistry.targets.length}）
        </button>
        <button
          className={activeTab === 'diseases' ? 'active' : ''}
          onClick={() => setActiveTab('diseases')}
        >
          疾病（{herb.chemistry.diseases.length}）
        </button>
        {showVisualization && (
          <button
            className={activeTab === 'visualization' ? 'active' : ''}
            onClick={() => setActiveTab('visualization')}
          >
            结构可视化
          </button>
        )}
      </div>

      <div className="tcm-content">
        {activeTab === 'info' && (
          <div className="info-section">
            <div className="info-group">
              <h3>性味归经</h3>
              <p><strong>性：</strong> {herb.properties.nature}</p>
              <p><strong>味：</strong> {herb.properties.flavor.join('、')}</p>
              <p><strong>归经：</strong> {herb.properties.meridian.join('、')}</p>
              {herb.properties.toxicity && (
                <p><strong>毒性：</strong> {herb.properties.toxicity}</p>
              )}
            </div>

            <div className="info-group">
              <h3>功效主治</h3>
              <ul>
                {herb.indications.map((indication, index) => (
                  <li key={index}>{indication}</li>
                ))}
              </ul>
            </div>

            <div className="info-group">
              <h3>用法用量</h3>
              <p>{herb.dosage.amount} {herb.dosage.unit}</p>
              <p>剂型：{herb.dosage.preparations.join('、')}</p>
            </div>

            <div className="info-group">
              <h3>禁忌</h3>
              <ul>
                {herb.contraindications.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="info-group">
              <h3>产地分布</h3>
              <p>{herb.distribution.join('、')}</p>
            </div>
          </div>
        )}

        {activeTab === 'targets' && (
          <div className="targets-section">
            <h3>分子靶点</h3>
            {herb.chemistry.targets.map((target, index) => (
              <div key={index} className="target-card">
                <h4>{target.geneSymbol}</h4>
                <p><strong>基因：</strong> {target.geneName}</p>
                <p><strong>蛋白：</strong> {target.proteinName}</p>
                <p><strong>UniProt：</strong> {target.uniprotId}</p>
                <p><strong>物种：</strong> {target.species}</p>
                {target.affinity && (
                  <p><strong>亲和力：</strong> {target.affinity.toFixed(2)}</p>
                )}
                <p><strong>证据：</strong> {target.evidence.join('、')}</p>
                <p><strong>通路：</strong> {target.pathways.join('、')}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'diseases' && (
          <div className="diseases-section">
            <h3>相关疾病</h3>
            {herb.chemistry.diseases.map((disease, index) => (
              <div key={index} className="disease-card">
                <h4>{disease.diseaseName}</h4>
                <p><strong>疾病编号：</strong> {disease.diseaseId}</p>
                {disease.omimId && (
                  <p><strong>OMIM：</strong> {disease.omimId}</p>
                )}
                <p><strong>相关靶点：</strong> {disease.relatedTargets}</p>
                <p><strong>证据等级：</strong> {disease.evidenceLevel}</p>
                <p><strong>作用机制：</strong> {disease.mechanisms.join('、')}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'visualization' && visualization && (
          <div className="visualization-section">
            <h3>分子结构</h3>
            <div className="molecular-info">
              <p><strong>SMILES：</strong> {visualization.smiles}</p>
              <p><strong>原子数：</strong> {visualization.atoms}</p>
              <p><strong>键数：</strong> {visualization.bonds}</p>
              <p><strong>结构复杂度：</strong> {visualization.complexity.toFixed(2)}</p>
              {visualization.logP && <p><strong>LogP（油水分配系数）：</strong> {visualization.logP}</p>}
              {visualization.hbd && <p><strong>氢键供体：</strong> {visualization.hbd}</p>}
              {visualization.hba && <p><strong>氢键受体：</strong> {visualization.hba}</p>}
              {visualization.tpsa && <p><strong>极性表面积：</strong> {visualization.tpsa}</p>}
            </div>
            <div
              className="structure-svg"
              dangerouslySetInnerHTML={{ __html: sanitizeHTML(visualization.svgData) }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TCMViewer;

interface TCMSearchComponentProps {
  onSelectHerb: (herbId: string) => void;
}

export const TCMSearchComponent: React.FC<TCMSearchComponentProps> = ({ onSelectHerb }) => {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<TCMHerb[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!keyword.trim()) return;

    setSearching(true);
    try {
      const { herbs } = await tcmService.searchHerbs({ keyword, pageSize: 20 });
      setResults(herbs);
    } catch (error) {
      logger.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="tcm-search">
      <div className="search-bar">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索药材…"
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch} disabled={searching}>
          {searching ? '搜索中…' : '搜索'}
        </button>
      </div>

      <div className="search-results">
        {results.map((herb) => (
          <div
            key={herb.id}
            className="herb-card"
             role="button" tabIndex={0} onClick={() => onSelectHerb(herb.id)}
          >
            <h3>{herb.name}</h3>
            <p className="latin">{herb.latinName}</p>
            <p className="family">{herb.family}</p>
            <div className="properties">
              <span className="nature">{herb.properties.nature}</span>
              <span className="flavor">{herb.properties.flavor.join(', ')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
