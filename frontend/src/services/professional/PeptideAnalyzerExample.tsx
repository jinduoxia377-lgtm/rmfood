import React, { useState, useEffect } from 'react';
import { PeptideService, Peptide, PeptideAnalysis, BioactivityPrediction } from '../services/professional/peptideService';

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
      setError(err instanceof Error ? err.message : 'Analysis failed');
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
        placeholder="Enter peptide sequence"
      />
      <button onClick={analyzePeptide} disabled={loading}>
        {loading ? 'Analyzing...' : 'Analyze'}
      </button>

      {error && <div className="error">{error}</div>}

      {analysis && (
        <div className="analysis-results">
          <h3>Analysis Results</h3>
          <div>Length: {analysis.length}</div>
          <div>Molecular Weight: {analysis.molecularWeight.toFixed(2)} Da</div>
          <div>Isoelectric Point: {analysis.isoelectricPoint.toFixed(2)}</div>
          <div>Hydrophobicity: {analysis.hydrophobicity.toFixed(2)}</div>
          <div>GRAVY: {analysis.gravy.toFixed(2)}</div>
          <div>Instability Index: {analysis.instabilityIndex.toFixed(2)}</div>
          <div>Aliphatic Index: {analysis.aliphaticIndex.toFixed(2)}</div>
          <div>Charge at pH 7: {analysis.chargeAtPH7.toFixed(3)}</div>

          <h4>Secondary Structure</h4>
          <div>Helix: {analysis.secondaryStructure.helix.toFixed(2)}%</div>
          <div>Sheet: {analysis.secondaryStructure.sheet.toFixed(2)}%</div>
          <div>Coil: {analysis.secondaryStructure.coil.toFixed(2)}%</div>

          <h4>Amino Acid Composition</h4>
          <div>{JSON.stringify(analysis.aminoAcidComposition, null, 2)}</div>
        </div>
      )}

      {bioactivity.length > 0 && (
        <div className="bioactivity-predictions">
          <h3>Bioactivity Predictions</h3>
          {bioactivity.map((pred, index) => (
            <div key={index} className="prediction">
              <h4>{pred.type}</h4>
              <div>Confidence: {(pred.confidence * 100).toFixed(1)}%</div>
              <div>{pred.mechanism}</div>
              {pred.predictedIC50 && (
                <div>Predicted IC50: {pred.predictedIC50.toFixed(2)} μM</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PeptideAnalyzer;
