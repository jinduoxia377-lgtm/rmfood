import React, { useState, useEffect } from 'react';
import { PeptideService, Peptide, PeptideAnalysis, BioactivityPrediction } from './peptideService';

interface PeptideAnalyzerProps {
  initialSequence?: string;
}

export const PeptideAnalyzer: React.FC<PeptideAnalyzerProps> = ({ initialSequence = 'LVGQDPVHPF' }) => {
  const [sequence, setSequence] = useState(initialSequence);
  const [analysis, setAnalysis] = useState<PeptideAnalysis | null>(null);
  const [bioactivity, setBioactivity] = useState<BioactivityPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peptideService = PeptideService.getInstance();

  const analyzePeptide = () => {
    setLoading(true);
    setError(null);

    try {
      const result = peptideService.analyzePeptide(sequence);
      setAnalysis(result);

      const predictions = peptideService.predictBioactivity(sequence);
      setBioactivity(predictions);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    analyzePeptide();
  }, []);

  return (
    <div className="peptide-analyzer">
      <input
        type="text"
        value={sequence}
        onChange={(e) => setSequence(e.target.value.toUpperCase())}
        placeholder="请输入肽序列"
      />
      <button onClick={analyzePeptide} disabled={loading}>
        {loading ? '分析中…' : '分析'}
      </button>

      {error && <div className="error">{error}</div>}

      {analysis && (
        <div className="analysis-results">
          <h3>分析结果</h3>
          <div>序列长度：{analysis.length}</div>
          <div>分子量：{analysis.molecularWeight.toFixed(2)} Da</div>
          <div>等电点：{analysis.isoelectricPoint.toFixed(2)}</div>
          <div>疏水性：{analysis.hydrophobicity.toFixed(2)}</div>
          <div>GRAVY（脂残基指数）：{analysis.gravy.toFixed(2)}</div>
          <div>不稳定性指数：{analysis.instabilityIndex.toFixed(2)}</div>
          <div>脂肪族指数：{analysis.aliphaticIndex.toFixed(2)}</div>
          <div>pH 7 净电荷：{analysis.chargeAtPH7.toFixed(3)}</div>

          <h4>二级结构预测</h4>
          <div>α-螺旋：{analysis.secondaryStructure.helix.toFixed(2)}%</div>
          <div>β-折叠：{analysis.secondaryStructure.sheet.toFixed(2)}%</div>
          <div>卷曲/无规：{analysis.secondaryStructure.coil.toFixed(2)}%</div>

          <h4>氨基酸组成</h4>
          <div>{JSON.stringify(analysis.aminoAcidComposition, null, 2)}</div>
        </div>
      )}

      {bioactivity.length > 0 && (
        <div className="bioactivity-predictions">
          <h3>生物活性预测</h3>
          {bioactivity.map((pred, index) => (
            <div key={index} className="prediction">
              <h4>{pred.type}</h4>
              <div>置信度：{(pred.confidence * 100).toFixed(1)}%</div>
              <div>{pred.mechanism}</div>
              {pred.predictedIC50 && (
                <div>预测 IC50：{pred.predictedIC50.toFixed(2)} μM</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PeptideAnalyzer;
