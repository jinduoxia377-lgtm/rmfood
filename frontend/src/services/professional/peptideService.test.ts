import { PeptideService } from './peptideService';

describe('PeptideService', () => {
  let peptideService: PeptideService;

  beforeEach(() => {
    peptideService = PeptideService.getInstance({ cacheEnabled: true });
  });

  describe('Molecular Weight Calculation', () => {
    it('should calculate molecular weight correctly', () => {
      const sequence = 'LVGQDPVHPF';
      const mw = peptideService.calculateMolecularWeight(sequence);
      expect(mw).toBeGreaterThan(1000);
      expect(mw).toBeLessThan(1500);
    });

    it('should throw error for invalid sequence', () => {
      // 'INVALID' 恰好是合法氨基酸（I-N-V-A-L-I-D），必须用真正非法的字符
      expect(() => {
        peptideService.calculateMolecularWeight('INVALIDX');
      }).toThrow('Invalid amino acid');
    });
  });

  describe('Isoelectric Point Calculation', () => {
    it('should calculate isoelectric point', () => {
      const sequence = 'LVGQDPVHPF';
      const pI = peptideService.calculateIsoelectricPoint(sequence);
      expect(pI).toBeGreaterThan(0);
      expect(pI).toBeLessThan(14);
    });

    it('should handle charged peptides', () => {
      const basicPeptide = 'RRY'; 
      const pI = peptideService.calculateIsoelectricPoint(basicPeptide);
      expect(pI).toBeGreaterThan(7);
    });
  });

  describe('Hydrophobicity Calculation', () => {
    it('should calculate hydrophobicity', () => {
      const sequence = 'LVGQDPVHPF';
      const hydro = peptideService.calculateHydrophobicity(sequence);
      expect(typeof hydro).toBe('number');
    });

    it('should calculate GRAVY', () => {
      const sequence = 'LVGQDPVHPF';
      const gravy = peptideService.calculateGRAVY(sequence);
      expect(gravy).toBe(peptideService.calculateHydrophobicity(sequence));
    });
  });

  describe('Peptide Analysis', () => {
    it('should analyze peptide comprehensively', () => {
      const sequence = 'LVGQDPVHPF';
      const analysis = peptideService.analyzePeptide(sequence);

      expect(analysis).toHaveProperty('sequence');
      expect(analysis).toHaveProperty('length');
      expect(analysis).toHaveProperty('molecularWeight');
      expect(analysis).toHaveProperty('isoelectricPoint');
      expect(analysis).toHaveProperty('hydrophobicity');
      expect(analysis).toHaveProperty('chargeAtPH7');
      expect(analysis).toHaveProperty('instabilityIndex');
      expect(analysis).toHaveProperty('aliphaticIndex');
      expect(analysis).toHaveProperty('extinctionCoefficient');
      expect(analysis).toHaveProperty('secondaryStructure');
      expect(analysis).toHaveProperty('aminoAcidComposition');
    });

    it('should use cache for repeated analysis', () => {
      const sequence = 'LVGQDPVHPF';
      const analysis1 = peptideService.analyzePeptide(sequence);
      const analysis2 = peptideService.analyzePeptide(sequence);
      
      expect(analysis1).toEqual(analysis2);
    });
  });

  describe('Secondary Structure Prediction', () => {
    it('should predict secondary structure', () => {
      const sequence = 'LVGQDPVHPF';
      const structure = peptideService.predictSecondaryStructure(sequence);

      expect(structure).toHaveProperty('helix');
      expect(structure).toHaveProperty('sheet');
      expect(structure).toHaveProperty('coil');
      
      expect(structure.helix + structure.sheet + structure.coil).toBeCloseTo(100, 0);
    });
  });

  describe('Bioactivity Prediction', () => {
    it('should predict bioactivities', () => {
      const sequence = 'LVGQDPVHPF';
      const predictions = peptideService.predictBioactivity(sequence);

      expect(Array.isArray(predictions)).toBe(true);
      if (predictions.length > 0) {
        expect(predictions[0]).toHaveProperty('type');
        expect(predictions[0]).toHaveProperty('confidence');
        expect(predictions[0]).toHaveProperty('mechanism');
      }
    });

    it('should return confidence scores between 0 and 1', () => {
      const sequence = 'LVGQDPVHPF';
      const predictions = peptideService.predictBioactivity(sequence);

      predictions.forEach(pred => {
        expect(pred.confidence).toBeGreaterThanOrEqual(0);
        expect(pred.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Structure Prediction', () => {
    it('should predict peptide structure', () => {
      const sequence = 'LVGQDPVHPF';
      const structure = peptideService.predictStructure(sequence);

      expect(structure).toHaveProperty('sequence');
      expect(structure).toHaveProperty('predictedStructure');
      expect(structure).toHaveProperty('confidence');
      expect(structure).toHaveProperty('secondaryStructure');
      expect(structure).toHaveProperty('surfaceAccessibility');
      expect(structure).toHaveProperty('flexibilityIndex');

      expect(structure.confidence).toBeGreaterThan(0);
      expect(structure.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Mock Data', () => {
    it('should return mock peptides', () => {
      const peptides = peptideService.getMockPeptides();
      expect(peptides.length).toBeGreaterThan(0);
      expect(peptides[0]).toHaveProperty('sequence');
      expect(peptides[0]).toHaveProperty('bioactivities');
    });

    it('should find peptide by sequence', () => {
      const peptide = peptideService.getMockPeptideBySequence('LVGQDPVHPF');
      expect(peptide).toBeDefined();
      expect(peptide?.sequence).toBe('LVGQDPVHPF');
    });

    it('should search peptides', async () => {
      const result = await peptideService.searchPeptides({
        bioactivity: 'antioxidant',
        page: 1,
        pageSize: 10
      });

      expect(result).toHaveProperty('peptides');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(Array.isArray(result.peptides)).toBe(true);
    });

    it('should filter by length', async () => {
      const result = await peptideService.searchPeptides({
        minLength: 8,
        maxLength: 12
      });

      result.peptides.forEach(peptide => {
        expect(peptide.length).toBeGreaterThanOrEqual(8);
        expect(peptide.length).toBeLessThanOrEqual(12);
      });
    });
  });

  describe('Amino Acid Info', () => {
    it('should get amino acid info', () => {
      const info = peptideService.getAminoAcidInfo('A');
      expect(info).toBeDefined();
      expect(info?.name).toBe('Alanine');
      expect(info?.molecularWeight).toBe(89.09);
    });

    it('should get all amino acid info', () => {
      const allInfo = peptideService.getAllAminoAcidInfo();
      expect(Object.keys(allInfo).length).toBe(20);
    });
  });

  describe('Cache Management', () => {
    it('should clear caches', () => {
      const sequence = 'LVGQDPVHPF';
      peptideService.analyzePeptide(sequence);
      
      const statsBefore = peptideService.getCacheStats();
      expect(statsBefore.analysisCacheSize).toBeGreaterThan(0);

      peptideService.clearAllCache();
      const statsAfter = peptideService.getCacheStats();
      expect(statsAfter.analysisCacheSize).toBe(0);
    });
  });

  describe('Instability Index', () => {
    it('should calculate instability index', () => {
      const sequence = 'LVGQDPVHPF';
      const index = peptideService.calculateInstabilityIndex(sequence);
      expect(typeof index).toBe('number');
    });
  });

  describe('Aliphatic Index', () => {
    it('should calculate aliphatic index', () => {
      const sequence = 'LVGQDPVHPF';
      const index = peptideService.calculateAliphaticIndex(sequence);
      expect(index).toBeGreaterThan(0);
    });
  });

  describe('Extinction Coefficient', () => {
    it('should calculate extinction coefficient', () => {
      const sequence = 'LVGQDPVHPF';
      const coeff = peptideService.calculateExtinctionCoefficient(sequence);
      expect(typeof coeff).toBe('number');
    });
  });

  describe('Charge at pH 7', () => {
    it('should calculate charge at pH 7', () => {
      const sequence = 'LVGQDPVHPF';
      const charge = peptideService.calculateChargeAtPH7(sequence);
      expect(typeof charge).toBe('number');
    });
  });

  describe('Amino Acid Composition', () => {
    it('should calculate amino acid composition', () => {
      const sequence = 'LVGQDPVHPF';
      const composition = peptideService.getAminoAcidComposition(sequence);
      expect(typeof composition).toBe('object');
      expect(composition['L']).toBe(1);
      expect(composition['V']).toBe(2); // 序列 LVGQDPVHPF 中 V 出现两次
    });
  });
});
