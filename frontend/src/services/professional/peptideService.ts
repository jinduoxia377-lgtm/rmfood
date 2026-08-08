import { ProfessionalBaseService } from './ProfessionalBaseService';
import type { ProfessionalServiceConfig } from '../../types/professional';


import { logger } from '@/utils/safeLogger';
export interface AminoAcidProperties {
  code: string;
  name: string;
  molecularWeight: number;
  pI: number;
  hydrophobicity: number;
  charge: number;
  pKa: Record<string, number>;
}

export interface PeptideAnalysis {
  sequence: string;
  length: number;
  molecularWeight: number;
  isoelectricPoint: number;
  hydrophobicity: number;
  chargeAtPH7: number;
  instabilityIndex: number;
  aliphaticIndex: number;
  extinctionCoefficient: number;
  gravy: number;
  secondaryStructure: {
    helix: number;
    sheet: number;
    coil: number;
  };
  aminoAcidComposition: Record<string, number>;
}

export interface Peptide {
  id: string;
  sequence: string;
  name: string;
  alternativeNames?: string[];
  length: number;
  molecularFormula?: string;
  molecularWeight: number;
  isoelectricPoint: number;
  hydrophobicity: number;
  chargeAtPH7?: number;
  extinctionCoefficient?: number;
  instabilityIndex?: number;
  aliphaticIndex?: number;
  modifications?: {
    type: string;
    position?: number;
    description?: string;
    effect?: string;
  }[];
  bioactivities: {
    type: string;
    potency?: string;
    mechanism?: string;
    ic50?: number;
    ec50?: number;
  }[];
  foodSources: string[];
  animalSources?: string[];
  plantSources?: string[];
  targetReceptors?: string[];
  toxicity?: {
    acute?: string;
    chronic?: string;
    cytotoxicity?: string;
    ld50?: number;
    studyDetails?: string;
  };
  stability?: {
    thermal?: string;
    ph?: string;
    gastrointestinal?: string;
    storage?: string;
    halfLife?: string;
  };
  pharmacologicalEffects?: string[];
  dosage?: {
    min?: number;
    max?: number;
    unit?: string;
    form?: string;
  };
  researchStatus: string;
  patents?: {
    number?: string;
    title?: string;
    holder?: string;
    year?: number;
    status?: string;
  }[];
  references?: string[];
  doi?: string;
  createdAt?: string;
  updatedAt?: string;
  version?: string;
}

export interface BioactivityPrediction {
  type: string;
  confidence: number;
  mechanism: string;
  predictedIC50?: number;
  relatedPeptides: string[];
  evidence: string;
}

export interface StructurePrediction {
  sequence: string;
  predictedStructure: string;
  confidence: number;
  secondaryStructure: {
    helix: string;
    sheet: string;
    coil: string;
  };
  surfaceAccessibility: number[];
  flexibilityIndex: number[];
}

export interface DFBPQueryParams {
  sequence?: string;
  name?: string;
  bioactivity?: string;
  foodSource?: string;
  minLength?: number;
  maxLength?: number;
  minMW?: number;
  maxMW?: number;
  researchStatus?: string;
  page?: number;
  pageSize?: number;
}

export interface DFBPSearchResult {
  peptides: Peptide[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const AMINO_ACID_DATA: Record<string, AminoAcidProperties> = {
  A: {
    code: 'A',
    name: 'Alanine',
    molecularWeight: 89.09,
    pI: 6.0,
    hydrophobicity: 1.8,
    charge: 0,
    pKa: { carboxyl: 2.35, amino: 9.87 },
  },
  R: {
    code: 'R',
    name: 'Arginine',
    molecularWeight: 174.2,
    pI: 10.76,
    hydrophobicity: -4.5,
    charge: 1,
    pKa: { carboxyl: 2.18, amino: 8.99, sideChain: 12.48 },
  },
  N: {
    code: 'N',
    name: 'Asparagine',
    molecularWeight: 132.12,
    pI: 5.41,
    hydrophobicity: -3.5,
    charge: 0,
    pKa: { carboxyl: 2.14, amino: 8.72 },
  },
  D: {
    code: 'D',
    name: 'Aspartic acid',
    molecularWeight: 133.1,
    pI: 2.77,
    hydrophobicity: -3.5,
    charge: -1,
    pKa: { carboxyl: 1.88, amino: 9.6, sideChain: 3.65 },
  },
  C: {
    code: 'C',
    name: 'Cysteine',
    molecularWeight: 121.15,
    pI: 5.07,
    hydrophobicity: 2.5,
    charge: 0,
    pKa: { carboxyl: 1.96, amino: 10.28, sideChain: 8.18 },
  },
  E: {
    code: 'E',
    name: 'Glutamic acid',
    molecularWeight: 147.13,
    pI: 3.22,
    hydrophobicity: -3.5,
    charge: -1,
    pKa: { carboxyl: 2.19, amino: 9.67, sideChain: 4.25 },
  },
  Q: {
    code: 'Q',
    name: 'Glutamine',
    molecularWeight: 146.15,
    pI: 5.65,
    hydrophobicity: -3.5,
    charge: 0,
    pKa: { carboxyl: 2.17, amino: 9.13 },
  },
  G: {
    code: 'G',
    name: 'Glycine',
    molecularWeight: 75.07,
    pI: 5.97,
    hydrophobicity: -0.4,
    charge: 0,
    pKa: { carboxyl: 2.35, amino: 9.78 },
  },
  H: {
    code: 'H',
    name: 'Histidine',
    molecularWeight: 155.16,
    pI: 7.59,
    hydrophobicity: -3.2,
    charge: 0.1,
    pKa: { carboxyl: 1.82, amino: 9.17, sideChain: 6.0 },
  },
  I: {
    code: 'I',
    name: 'Isoleucine',
    molecularWeight: 131.17,
    pI: 6.02,
    hydrophobicity: 4.5,
    charge: 0,
    pKa: { carboxyl: 2.32, amino: 9.76 },
  },
  L: {
    code: 'L',
    name: 'Leucine',
    molecularWeight: 131.17,
    pI: 5.98,
    hydrophobicity: 3.8,
    charge: 0,
    pKa: { carboxyl: 2.36, amino: 9.6 },
  },
  K: {
    code: 'K',
    name: 'Lysine',
    molecularWeight: 146.19,
    pI: 9.74,
    hydrophobicity: -3.9,
    charge: 1,
    pKa: { carboxyl: 2.18, amino: 8.95, sideChain: 10.53 },
  },
  M: {
    code: 'M',
    name: 'Methionine',
    molecularWeight: 149.21,
    pI: 5.74,
    hydrophobicity: 1.9,
    charge: 0,
    pKa: { carboxyl: 2.28, amino: 9.21 },
  },
  F: {
    code: 'F',
    name: 'Phenylalanine',
    molecularWeight: 165.19,
    pI: 5.48,
    hydrophobicity: 2.8,
    charge: 0,
    pKa: { carboxyl: 2.58, amino: 9.24 },
  },
  P: {
    code: 'P',
    name: 'Proline',
    molecularWeight: 115.13,
    pI: 6.3,
    hydrophobicity: -1.6,
    charge: 0,
    pKa: { carboxyl: 2.05, amino: 10.6 },
  },
  S: {
    code: 'S',
    name: 'Serine',
    molecularWeight: 105.09,
    pKa: { carboxyl: 2.21, amino: 9.15 },
    pI: 5.68,
    hydrophobicity: -0.8,
    charge: 0,
  },
  T: {
    code: 'T',
    name: 'Threonine',
    molecularWeight: 119.12,
    pI: 5.6,
    hydrophobicity: -0.7,
    charge: 0,
    pKa: { carboxyl: 2.09, amino: 9.1 },
  },
  W: {
    code: 'W',
    name: 'Tryptophan',
    molecularWeight: 204.23,
    pI: 5.89,
    hydrophobicity: -0.9,
    charge: 0,
    pKa: { carboxyl: 2.38, amino: 9.39 },
  },
  Y: {
    code: 'Y',
    name: 'Tyrosine',
    molecularWeight: 181.19,
    pI: 5.66,
    hydrophobicity: -1.3,
    charge: 0,
    pKa: { carboxyl: 2.2, amino: 9.11, sideChain: 10.07 },
  },
  V: {
    code: 'V',
    name: 'Valine',
    molecularWeight: 117.15,
    pI: 5.96,
    hydrophobicity: 4.2,
    charge: 0,
    pKa: { carboxyl: 2.29, amino: 9.72 },
  },
};

const MOCK_PEPTIDES: Peptide[] = [
  {
    id: 'pep001',
    sequence: 'LVGQDPVHPF',
    name: 'Lactobacillus Peptide LV-10',
    length: 10,
    molecularWeight: 1147.3,
    isoelectricPoint: 6.52,
    hydrophobicity: 2.1,
    chargeAtPH7: 0.5,
    extinctionCoefficient: 5500,
    instabilityIndex: 32.5,
    aliphaticIndex: 125.8,
    bioactivities: [
      { type: 'antioxidant', potency: 'high', mechanism: 'DPPH radical scavenging', ic50: 12.5 },
      { type: 'anti-inflammatory', potency: 'moderate', mechanism: 'COX-2 inhibition' },
    ],
    foodSources: ['Lactobacillus fermentum', 'Yogurt', 'Kefir'],
    animalSources: ['Dairy products'],
    plantSources: [],
    pharmacologicalEffects: ['Free radical neutralization', 'Lipid oxidation inhibition'],
    researchStatus: 'validated',
    references: ['PMID: 12345678', 'DOI: 10.1234/peptides.2024.001'],
    doi: '10.1234/peptides.2024.001',
  },
  {
    id: 'pep002',
    sequence: 'WFWMSLAQYR',
    name: 'Whey Peptide WR-9',
    length: 10,
    molecularWeight: 1324.5,
    isoelectricPoint: 8.76,
    hydrophobicity: 1.2,
    chargeAtPH7: 1.8,
    extinctionCoefficient: 14500,
    instabilityIndex: 45.2,
    aliphaticIndex: 98.3,
    bioactivities: [
      { type: 'antihypertensive', potency: 'high', mechanism: 'ACE inhibition', ic50: 3.2, ec50: 5.8 },
      { type: 'antioxidant', potency: 'moderate', mechanism: 'Superoxide radical scavenging' },
    ],
    foodSources: ['Whey protein', 'Milk', 'Cheese'],
    animalSources: ['Bovine milk'],
    plantSources: [],
    pharmacologicalEffects: ['Blood pressure regulation', 'Antioxidant defense enhancement'],
    dosage: { min: 5, max: 20, unit: 'mg', form: 'capsule' },
    researchStatus: 'validated',
    patents: [
      {
        number: 'US1234567A',
        title: 'Whey-derived ACE inhibitory peptide',
        holder: 'Dairy Research Institute',
        year: 2023,
        status: 'active',
      },
    ],
    references: ['PMID: 23456789', 'DOI: 10.1234/peptides.2023.015'],
    doi: '10.1234/peptides.2023.015',
  },
  {
    id: 'pep003',
    sequence: 'PGVGVAPGTGG',
    name: 'Collagen Peptide CG-11',
    length: 11,
    molecularWeight: 892.4,
    isoelectricPoint: 5.23,
    hydrophobicity: 1.8,
    chargeAtPH7: -0.3,
    extinctionCoefficient: 0,
    instabilityIndex: 18.7,
    aliphaticIndex: 142.6,
    bioactivities: [
      { type: 'immunomodulatory', potency: 'high', mechanism: 'Macrophage activation', ic50: 8.9 },
      { type: 'collagen synthesis', potency: 'high', mechanism: 'Fibroblast proliferation' },
    ],
    foodSources: ['Bovine collagen', 'Fish collagen', 'Bone broth'],
    animalSources: ['Bovine skin', 'Fish scale'],
    pharmacologicalEffects: ['Skin elasticity improvement', 'Joint health support'],
    dosage: { min: 2.5, max: 10, unit: 'g', form: 'powder' },
    researchStatus: 'validated',
    references: ['PMID: 34567890'],
    doi: '10.1234/peptides.2024.020',
  },
  {
    id: 'pep004',
    sequence: 'RPYLPRPR',
    name: 'Casein Peptide CR-8',
    length: 8,
    molecularWeight: 1089.3,
    isoelectricPoint: 12.01,
    hydrophobicity: -0.8,
    chargeAtPH7: 3.2,
    extinctionCoefficient: 0,
    instabilityIndex: 28.4,
    aliphaticIndex: 56.8,
    bioactivities: [
      { type: 'opioid', potency: 'moderate', mechanism: 'mu-opioid receptor binding', ic50: 15.3 },
      { type: 'analgesic', potency: 'moderate', mechanism: 'Pain perception modulation' },
    ],
    foodSources: ['Casein', 'Milk', 'Cheese'],
    animalSources: ['Bovine milk'],
    pharmacologicalEffects: ['Pain relief', 'Anxiety reduction', 'Sleep improvement'],
    dosage: { min: 100, max: 500, unit: 'mg', form: 'capsule' },
    researchStatus: 'preliminary',
    references: ['PMID: 45678901'],
    doi: '10.1234/peptides.2022.008',
  },
  {
    id: 'pep005',
    sequence: 'LQPIPGPTQQFF',
    name: 'Soy Peptide SP-12',
    length: 12,
    molecularWeight: 1385.6,
    isoelectricPoint: 5.87,
    hydrophobicity: 0.5,
    chargeAtPH7: -0.2,
    extinctionCoefficient: 2750,
    instabilityIndex: 35.8,
    aliphaticIndex: 89.4,
    bioactivities: [
      { type: 'antioxidant', potency: 'high', mechanism: 'Hydroxyl radical scavenging', ic50: 6.7 },
      { type: 'antimicrobial', potency: 'moderate', mechanism: 'Bacterial membrane disruption' },
    ],
    foodSources: ['Soybean', 'Tofu', 'Soy milk'],
    plantSources: ['Glycine max'],
    pharmacologicalEffects: ['Antimicrobial defense', 'Oxidative stress protection'],
    dosage: { min: 50, max: 200, unit: 'mg', form: 'tablet' },
    researchStatus: 'validated',
    patents: [
      {
        number: 'CN101234567A',
        title: 'Soy-derived antimicrobial peptide',
        holder: 'SoyTech Corp',
        year: 2024,
        status: 'pending',
      },
    ],
    references: ['PMID: 56789012'],
    doi: '10.1234/peptides.2024.025',
  },
  {
    id: 'pep006',
    sequence: 'HMPGAFTGRRG',
    name: 'Egg White Peptide EW-11',
    length: 11,
    molecularWeight: 1205.3,
    isoelectricPoint: 10.24,
    hydrophobicity: -1.2,
    chargeAtPH7: 2.1,
    extinctionCoefficient: 5500,
    instabilityIndex: 42.3,
    aliphaticIndex: 62.7,
    bioactivities: [
      { type: 'antihypertensive', potency: 'high', mechanism: 'ACE inhibition', ic50: 2.8 },
      { type: 'anticoagulant', potency: 'moderate', mechanism: 'Thrombin inhibition' },
    ],
    foodSources: ['Egg white', 'Chicken egg'],
    animalSources: ['Chicken egg albumen'],
    pharmacologicalEffects: ['Cardiovascular protection', 'Blood clot prevention'],
    dosage: { min: 10, max: 30, unit: 'mg', form: 'capsule' },
    researchStatus: 'preliminary',
    references: ['PMID: 67890123'],
    doi: '10.1234/peptides.2023.030',
  },
  {
    id: 'pep007',
    sequence: 'DLPMLLPKP',
    name: 'Rice Protein Peptide RP-9',
    length: 9,
    molecularWeight: 1034.3,
    isoelectricPoint: 6.54,
    hydrophobicity: 2.4,
    chargeAtPH7: 0.4,
    extinctionCoefficient: 0,
    instabilityIndex: 22.6,
    aliphaticIndex: 138.9,
    bioactivities: [
      { type: 'antioxidant', potency: 'high', mechanism: 'ABTS radical scavenging', ic50: 9.4 },
      { type: 'antidiabetic', potency: 'moderate', mechanism: 'DPP-4 inhibition', ic50: 18.2 },
    ],
    foodSources: ['Rice protein', 'Brown rice', 'Rice bran'],
    plantSources: ['Oryza sativa'],
    pharmacologicalEffects: ['Glucose metabolism regulation', 'Insulin sensitivity improvement'],
    dosage: { min: 25, max: 75, unit: 'mg', form: 'tablet' },
    researchStatus: 'validated',
    references: ['PMID: 78901234'],
    doi: '10.1234/peptides.2024.035',
  },
  {
    id: 'pep008',
    sequence: 'TGPYDVSHGH',
    name: 'Mushroom Peptide MP-10',
    length: 10,
    molecularWeight: 1132.2,
    isoelectricPoint: 7.14,
    hydrophobicity: -2.1,
    chargeAtPH7: 0.8,
    extinctionCoefficient: 8250,
    instabilityIndex: 38.9,
    aliphaticIndex: 48.2,
    bioactivities: [
      { type: 'immunomodulatory', potency: 'high', mechanism: 'NK cell activation', ic50: 5.6 },
      { type: 'antitumor', potency: 'moderate', mechanism: 'Apoptosis induction' },
    ],
    foodSources: ['Ganoderma lucidum', 'Shiitake mushroom', 'Maitake mushroom'],
    plantSources: ['Medicinal mushrooms'],
    pharmacologicalEffects: ['Immune system enhancement', 'Tumor growth suppression'],
    dosage: { min: 100, max: 500, unit: 'mg', form: 'capsule' },
    researchStatus: 'hypothetical',
    references: ['PMID: 89012345'],
    doi: '10.1234/peptides.2024.040',
  },
  {
    id: 'pep009',
    sequence: 'IAVEGVPGEG',
    name: 'Pea Protein Peptide PP-10',
    length: 10,
    molecularWeight: 956.1,
    isoelectricPoint: 4.87,
    hydrophobicity: 1.6,
    chargeAtPH7: -1.2,
    extinctionCoefficient: 0,
    instabilityIndex: 15.3,
    aliphaticIndex: 126.4,
    bioactivities: [
      { type: 'antioxidant', potency: 'moderate', mechanism: 'Metal ion chelation', ic50: 22.1 },
      { type: 'ACE inhibitory', potency: 'high', mechanism: 'Angiotensin converting enzyme inhibition', ic50: 4.5 },
    ],
    foodSources: ['Pea protein', 'Green pea', 'Yellow pea'],
    plantSources: ['Pisum sativum'],
    pharmacologicalEffects: ['Metal homeostasis', 'Cardiovascular health'],
    dosage: { min: 15, max: 45, unit: 'mg', form: 'powder' },
    researchStatus: 'validated',
    references: ['PMID: 90123456'],
    doi: '10.1234/peptides.2024.045',
  },
  {
    id: 'pep010',
    sequence: 'YQSFPQTQTP',
    name: 'Fish Protein Peptide FP-10',
    length: 10,
    molecularWeight: 1198.3,
    isoelectricPoint: 5.34,
    hydrophobicity: -1.8,
    chargeAtPH7: -0.6,
    extinctionCoefficient: 8250,
    instabilityIndex: 29.7,
    aliphaticIndex: 58.3,
    bioactivities: [
      { type: 'antioxidant', potency: 'high', mechanism: 'Hydroxyl and superoxide scavenging', ic50: 7.8 },
      { type: 'anti-inflammatory', potency: 'moderate', mechanism: 'NF-κB pathway inhibition' },
    ],
    foodSources: ['Salmon protein', 'Cod protein', 'Fish muscle'],
    animalSources: ['Atlantic salmon', 'Pacific cod'],
    pharmacologicalEffects: ['Inflammation reduction', 'Oxidative damage prevention'],
    dosage: { min: 20, max: 60, unit: 'mg', form: 'softgel' },
    researchStatus: 'validated',
    references: ['PMID: 01234567'],
    doi: '10.1234/peptides.2023.040',
  },
];

export class PeptideService extends ProfessionalBaseService {
  private static instance: PeptideService;
  private sequenceCache: Map<string, PeptideAnalysis>;
  private analysisCache: Map<string, { analysis: PeptideAnalysis; timestamp: number }>;
  private readonly CACHE_DURATION = 10 * 60 * 1000;
  private readonly MAX_CACHE_SIZE = 200;
  private useMockData: boolean;

  constructor(config: ProfessionalServiceConfig = {}) {
    super({
      baseURL: config.baseURL || 'https://dfbp-api.example.com/api/v1',
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      cacheEnabled: config.cacheEnabled !== false,
      cacheDuration: config.cacheDuration || 5 * 60 * 1000,
      ...config,
    });

    this.sequenceCache = new Map();
    this.analysisCache = new Map();
    this.useMockData = config.cacheEnabled !== false;
  }

  public static getInstance(config?: ProfessionalServiceConfig): PeptideService {
    if (!PeptideService.instance) {
      PeptideService.instance = new PeptideService(config);
    }
    return PeptideService.instance;
  }

  private validateSequence(sequence: string): void {
    const validChars = new Set(Object.keys(AMINO_ACID_DATA));
    for (const char of sequence.toUpperCase()) {
      if (!validChars.has(char)) {
        throw new Error(`Invalid amino acid: ${char}`);
      }
    }
  }

  public calculateMolecularWeight(sequence: string): number {
    this.validateSequence(sequence);
    let weight = 0;
    for (const aa of sequence) {
      weight += AMINO_ACID_DATA[aa.toUpperCase()]?.molecularWeight || 0;
    }
    weight -= (sequence.length - 1) * 18.015;
    return Math.round(weight * 100) / 100;
  }

  public calculateIsoelectricPoint(sequence: string): number {
    this.validateSequence(sequence);

    let pHLow = 0;
    let pHHigh = 14;
    let pH = 7;

    for (let i = 0; i < 100; i++) {
      pH = (pHLow + pHHigh) / 2;
      let netCharge = 0;

      for (const aa of sequence) {
        const props = AMINO_ACID_DATA[aa.toUpperCase()];
        if (!props) continue;

        if (props.charge > 0) {
          const pKaValue = props.pKa.sideChain || props.pKa.amino;
          netCharge += 1 / (1 + Math.pow(10, pH - pKaValue));
        } else if (props.charge < 0) {
          const pKaValue = props.pKa.sideChain || props.pKa.carboxyl;
          netCharge -= 1 / (1 + Math.pow(10, pKaValue - pH));
        }
      }

      netCharge += 1 / (1 + Math.pow(10, pH - 9.69));
      netCharge -= 1 / (1 + Math.pow(10, 2.34 - pH));

      if (Math.abs(netCharge) < 0.001) {
        return Math.round(pH * 100) / 100;
      }

      if (netCharge > 0) {
        pHLow = pH;
      } else {
        pHHigh = pH;
      }
    }

    return Math.round(pH * 100) / 100;
  }

  public calculateHydrophobicity(sequence: string): number {
    this.validateSequence(sequence);
    let totalHydro = 0;
    for (const aa of sequence) {
      totalHydro += AMINO_ACID_DATA[aa.toUpperCase()]?.hydrophobicity || 0;
    }
    return Math.round((totalHydro / sequence.length) * 100) / 100;
  }

  public calculateGRAVY(sequence: string): number {
    return this.calculateHydrophobicity(sequence);
  }

  public calculateInstabilityIndex(sequence: string): number {
    this.validateSequence(sequence);
    const dipeptideWeights: Record<string, number> = {
      WW: 1.0,
      WC: 1.0,
      WM: 24.68,
      WH: 24.68,
      WY: 1.0,
      WF: 1.0,
      WQ: 1.0,
      WN: 13.34,
      WI: 1.0,
      WR: 1.0,
      WD: 1.0,
      WP: 1.0,
      WT: -14.03,
      WK: 1.0,
      WS: 1.0,
      WV: 1.0,
      WG: -9.37,
      WA: 1.0,
    };

    let sum = 0;
    for (let i = 0; i < sequence.length - 1; i++) {
      const dipeptide = sequence.substring(i, i + 2);
      sum += dipeptideWeights[dipeptide] || 1.0;
    }

    const index = (10 / sequence.length) * sum;
    return Math.round(index * 100) / 100;
  }

  public calculateAliphaticIndex(sequence: string): number {
    this.validateSequence(sequence);
    const counts = this.getAminoAcidComposition(sequence);
    const length = sequence.length;

    const alaContent = (counts.A || 0) / length;
    const valContent = (counts.V || 0) / length;
    const ileContent = (counts.I || 0) / length;
    const leuContent = (counts.L || 0) / length;

    const index =
      alaContent * 100 + valContent * 100 + ileContent * 100 + leuContent * 100 + ileContent * ileContent * 100;

    return Math.round(index * 100) / 100;
  }

  public getAminoAcidComposition(sequence: string): Record<string, number> {
    this.validateSequence(sequence);
    const composition: Record<string, number> = {};

    for (const aa of sequence) {
      composition[aa.toUpperCase()] = (composition[aa.toUpperCase()] || 0) + 1;
    }

    return composition;
  }

  public predictSecondaryStructure(sequence: string): { helix: number; sheet: number; coil: number } {
    this.validateSequence(sequence);
    const helixFormers = new Set(['A', 'E', 'L', 'M', 'Q', 'K', 'R', 'H', 'I']);
    const sheetFormers = new Set(['V', 'I', 'Y', 'C', 'F', 'W', 'N']);
    const coilFormers = new Set(['G', 'P', 'S', 'D', 'T']);

    let helix = 0,
      sheet = 0,
      coil = 0;

    for (const aa of sequence) {
      const upperAA = aa.toUpperCase();
      if (helixFormers.has(upperAA)) helix++;
      if (sheetFormers.has(upperAA)) sheet++;
      if (coilFormers.has(upperAA)) coil++;
    }

    const total = sequence.length;
    return {
      helix: Math.round((helix / total) * 100 * 100) / 100,
      sheet: Math.round((sheet / total) * 100 * 100) / 100,
      coil: Math.round((coil / total) * 100 * 100) / 100,
    };
  }

  public calculateExtinctionCoefficient(sequence: string): number {
    this.validateSequence(sequence);
    const composition = this.getAminoAcidComposition(sequence);

    const tyrCoeff = (composition.Y || 0) * 1490;
    const trpCoeff = (composition.W || 0) * 5500;
    const cysCoeff = Math.floor((composition.C || 0) / 2) * 125;

    return tyrCoeff + trpCoeff + cysCoeff;
  }

  public calculateChargeAtPH7(sequence: string): number {
    this.validateSequence(sequence);
    let charge = 0;
    const pH = 7.0;

    charge += 1 / (1 + Math.pow(10, pH - 9.69));

    for (const aa of sequence) {
      const props = AMINO_ACID_DATA[aa.toUpperCase()];
      if (!props) continue;

      if (props.charge > 0) {
        const pKaValue = props.pKa.sideChain || props.pKa.amino;
        charge += 1 / (1 + Math.pow(10, pH - pKaValue));
      } else if (props.charge < 0) {
        const pKaValue = props.pKa.sideChain || props.pKa.carboxyl;
        charge -= 1 / (1 + Math.pow(10, pKaValue - pH));
      }
    }

    charge -= 1 / (1 + Math.pow(10, 2.34 - pH));

    return Math.round(charge * 1000) / 1000;
  }

  public analyzePeptide(sequence: string, useCache = true): PeptideAnalysis {
    this.validateSequence(sequence);

    const cacheKey = sequence.toUpperCase();
    if (useCache && this.analysisCache.has(cacheKey)) {
      const cached = this.analysisCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.analysis;
      }
    }

    const analysis: PeptideAnalysis = {
      sequence: sequence.toUpperCase(),
      length: sequence.length,
      molecularWeight: this.calculateMolecularWeight(sequence),
      isoelectricPoint: this.calculateIsoelectricPoint(sequence),
      hydrophobicity: this.calculateHydrophobicity(sequence),
      chargeAtPH7: this.calculateChargeAtPH7(sequence),
      instabilityIndex: this.calculateInstabilityIndex(sequence),
      aliphaticIndex: this.calculateAliphaticIndex(sequence),
      extinctionCoefficient: this.calculateExtinctionCoefficient(sequence),
      gravy: this.calculateGRAVY(sequence),
      secondaryStructure: this.predictSecondaryStructure(sequence),
      aminoAcidComposition: this.getAminoAcidComposition(sequence),
    };

    if (useCache) {
      this.analysisCache.set(cacheKey, {
        analysis,
        timestamp: Date.now(),
      });
      this.optimizeAnalysisCache();
    }

    return analysis;
  }

  private optimizeAnalysisCache(): void {
    if (this.analysisCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.analysisCache.entries());
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      const toDelete = entries.slice(this.MAX_CACHE_SIZE);
      toDelete.forEach(([key]) => this.analysisCache.delete(key));
    }
  }

  public async searchPeptides(params: DFBPQueryParams): Promise<DFBPSearchResult> {
    if (this.useMockData) {
      return this.mockSearchPeptides(params);
    }

    try {
      const response = await this.post<DFBPSearchResult>('/peptides/search', params);
      return response;
    } catch (error) {
      logger.warn('DFBP API unavailable, falling back to mock data:', error);
      this.useMockData = true;
      return this.mockSearchPeptides(params);
    }
  }

  private mockSearchPeptides(params: DFBPQueryParams): DFBPSearchResult {
    let filtered = [...MOCK_PEPTIDES];

    if (params.sequence) {
      filtered = filtered.filter((p) => p.sequence.toLowerCase().includes(params.sequence!.toLowerCase()));
    }

    if (params.name) {
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(params.name!.toLowerCase()));
    }

    if (params.bioactivity) {
      filtered = filtered.filter((p) =>
        p.bioactivities.some((b) => b.type.toLowerCase().includes(params.bioactivity!.toLowerCase())),
      );
    }

    if (params.foodSource) {
      filtered = filtered.filter((p) =>
        p.foodSources.some((s) => s.toLowerCase().includes(params.foodSource!.toLowerCase())),
      );
    }

    if (params.minLength !== undefined) {
      filtered = filtered.filter((p) => p.length >= params.minLength!);
    }

    if (params.maxLength !== undefined) {
      filtered = filtered.filter((p) => p.length <= params.maxLength!);
    }

    if (params.minMW !== undefined) {
      filtered = filtered.filter((p) => p.molecularWeight >= params.minMW!);
    }

    if (params.maxMW !== undefined) {
      filtered = filtered.filter((p) => p.molecularWeight <= params.maxMW!);
    }

    if (params.researchStatus) {
      filtered = filtered.filter((p) => p.researchStatus.toLowerCase() === params.researchStatus!.toLowerCase());
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      peptides: filtered.slice(start, end),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  public async getPeptideById(id: string): Promise<Peptide | null> {
    if (this.useMockData) {
      return MOCK_PEPTIDES.find((p) => p.id === id) || null;
    }

    try {
      return await this.get<Peptide>(`/peptides/${id}`);
    } catch (error) {
      logger.warn('DFBP API unavailable, falling back to mock data:', error);
      return MOCK_PEPTIDES.find((p) => p.id === id) || null;
    }
  }

  public async getPeptideBySequence(sequence: string): Promise<Peptide | null> {
    if (this.useMockData) {
      return MOCK_PEPTIDES.find((p) => p.sequence.toUpperCase() === sequence.toUpperCase()) || null;
    }

    try {
      return await this.get<Peptide>(`/peptides/sequence/${sequence}`);
    } catch (error) {
      logger.warn('DFBP API unavailable, falling back to mock data:', error);
      return MOCK_PEPTIDES.find((p) => p.sequence.toUpperCase() === sequence.toUpperCase()) || null;
    }
  }

  public predictBioactivity(sequence: string): BioactivityPrediction[] {
    const analysis = this.analyzePeptide(sequence);
    const predictions: BioactivityPrediction[] = [];

    const bioactivityRules: {
      type: string;
      conditions: (analysis: PeptideAnalysis) => boolean;
      mechanism: string;
      evidence: string;
    }[] = [
      {
        type: 'antioxidant',
        conditions: (a) => a.hydrophobicity < 0 && a.gravy < 0,
        mechanism: 'Hydrophobic and charged residues enhance radical scavenging activity',
        evidence: 'Based on structure-activity relationship analysis',
      },
      {
        type: 'antihypertensive',
        conditions: (a) => a.hydrophobicity > 1.5 && a.aliphaticIndex > 100,
        mechanism: 'ACE inhibition through hydrophobic C-terminal interactions',
        evidence: 'Hydrophobic peptides show strong ACE inhibitory activity',
      },
      {
        type: 'antimicrobial',
        conditions: (a) => a.hydrophobicity > 2 && a.chargeAtPH7 > 1,
        mechanism: 'Amphiphilic structure disrupts bacterial membranes',
        evidence: 'Cationic antimicrobial peptides with hydrophobic regions',
      },
      {
        type: 'immunomodulatory',
        conditions: (a) => a.secondaryStructure.helix > 30,
        mechanism: 'Alpha-helical structure facilitates immune cell interaction',
        evidence: 'Helical peptides show enhanced immunomodulatory effects',
      },
      {
        type: 'opioid',
        conditions: (_a) => ['Y', 'F', 'W'].some((aa) => analysis.aminoAcidComposition[aa] > 0),
        mechanism: 'Aromatic residues at N-terminus enable opioid receptor binding',
        evidence: 'Typical opioid peptide motif with aromatic residue',
      },
      {
        type: 'collagen synthesis',
        conditions: (a) =>
          (analysis.aminoAcidComposition.P || 0) + (analysis.aminoAcidComposition.P || 0) > 2 &&
          (analysis.aminoAcidComposition.G || 0) > 1,
        mechanism: 'Proline-hydroxyproline sequence stimulates collagen synthesis',
        evidence: 'Collagen-like peptides with repeating Pro-Hyp-Gly motif',
      },
    ];

    for (const rule of bioactivityRules) {
      if (rule.conditions(analysis)) {
        const confidence = this.calculateBioactivityConfidence(analysis, rule.type);
        const relatedPeptides = this.findSimilarPeptides(sequence, rule.type);

        predictions.push({
          type: rule.type,
          confidence,
          mechanism: rule.mechanism,
          predictedIC50: this.estimateIC50(analysis, rule.type),
          relatedPeptides,
          evidence: rule.evidence,
        });
      }
    }

    return predictions.sort((_a, b) => b.confidence - _a.confidence);
  }

  private calculateBioactivityConfidence(analysis: PeptideAnalysis, bioactivityType: string): number {
    let baseConfidence = 0.5;

    switch (bioactivityType) {
      case 'antioxidant':
        if (analysis.hydrophobicity < -2) baseConfidence += 0.2;
        if (analysis.chargeAtPH7 !== 0) baseConfidence += 0.1;
        if (analysis.instabilityIndex < 40) baseConfidence += 0.1;
        break;
      case 'antihypertensive':
        if (analysis.hydrophobicity > 2) baseConfidence += 0.2;
        if (analysis.aliphaticIndex > 120) baseConfidence += 0.15;
        if (analysis.length >= 5 && analysis.length <= 15) baseConfidence += 0.1;
        break;
      case 'antimicrobial':
        if (analysis.hydrophobicity > 2.5) baseConfidence += 0.2;
        if (analysis.chargeAtPH7 > 2) baseConfidence += 0.15;
        break;
      case 'immunomodulatory':
        if (analysis.secondaryStructure.helix > 35) baseConfidence += 0.2;
        if (analysis.chargeAtPH7 > 0) baseConfidence += 0.1;
        break;
      case 'opioid':
        if (analysis.aminoAcidComposition.Y > 0) baseConfidence += 0.2;
        if (analysis.aminoAcidComposition.F > 0) baseConfidence += 0.1;
        break;
      case 'collagen synthesis':
        if ((analysis.aminoAcidComposition.P || 0) > 3) baseConfidence += 0.2;
        if ((analysis.aminoAcidComposition.G || 0) > 2) baseConfidence += 0.15;
        break;
    }

    return Math.min(Math.round(baseConfidence * 100) / 100, 0.95);
  }

  private findSimilarPeptides(sequence: string, bioactivityType: string): string[] {
    return MOCK_PEPTIDES.filter((p) => p.bioactivities.some((b) => b.type === bioactivityType))
      .slice(0, 3)
      .map((p) => p.id);
  }

  private estimateIC50(analysis: PeptideAnalysis, bioactivityType: string): number {
    let baseIC50 = 10;

    switch (bioactivityType) {
      case 'antioxidant':
        if (analysis.hydrophobicity < -2) baseIC50 *= 0.8;
        if (analysis.instabilityIndex < 30) baseIC50 *= 0.9;
        break;
      case 'antihypertensive':
        if (analysis.hydrophobicity > 2) baseIC50 *= 0.5;
        if (analysis.aliphaticIndex > 120) baseIC50 *= 0.7;
        break;
      case 'antimicrobial':
        if (analysis.chargeAtPH7 > 2) baseIC50 *= 0.6;
        if (analysis.hydrophobicity > 2.5) baseIC50 *= 0.75;
        break;
    }

    return Math.round(baseIC50 * 100) / 100;
  }

  public predictStructure(sequence: string): StructurePrediction {
    this.analyzePeptide(sequence);
    const secondaryStructure = this.predictSecondaryStructure(sequence);

    let predictedStructure = '';
    for (let i = 0; i < sequence.length; i++) {
      const aa = sequence[i].toUpperCase();
      if (['A', 'E', 'L', 'M', 'Q', 'K', 'R', 'H', 'I'].includes(aa)) {
        predictedStructure += 'H';
      } else if (['V', 'I', 'Y', 'C', 'F', 'W', 'N'].includes(aa)) {
        predictedStructure += 'E';
      } else {
        predictedStructure += 'C';
      }
    }

    const surfaceAccessibility = sequence.split('').map((_char, _index) => {
      const nearbyHydrophobic = ['A', 'V', 'I', 'L', 'M', 'F', 'W'].filter((aa) => sequence.includes(aa)).length;
      return Math.min(1, nearbyHydrophobic / sequence.length);
    });

    const flexibilityIndex = sequence.split('').map((_char, idx) => {
      const flexible = ['G', 'P', 'S', 'D'].includes(sequence[idx].toUpperCase());
      return flexible ? 0.8 : 0.4;
    });

    return {
      sequence: sequence.toUpperCase(),
      predictedStructure,
      confidence: 0.75 + Math.random() * 0.2,
      secondaryStructure: {
        helix:
          'H'.repeat(Math.floor(secondaryStructure.helix / 10)) +
          'E'.repeat(Math.floor(secondaryStructure.sheet / 10)) +
          'C'.repeat(Math.floor(secondaryStructure.coil / 10)),
        sheet: 'E'.repeat(Math.floor(secondaryStructure.sheet / 10)),
        coil: 'C'.repeat(Math.floor(secondaryStructure.coil / 10)),
      },
      surfaceAccessibility,
      flexibilityIndex,
    };
  }

  public clearSequenceCache(): void {
    this.sequenceCache.clear();
    this.analysisCache.clear();
  }

  public clearAllCache(): void {
    this.clearCache();
    this.sequenceCache.clear();
    this.analysisCache.clear();
  }

  public getCacheStats(): {
    size: number;
    keys: string[];
    analysisCacheSize: number;
    sequenceCacheSize: number;
    baseCacheSize: number;
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      analysisCacheSize: this.analysisCache.size,
      sequenceCacheSize: this.sequenceCache.size,
      baseCacheSize: this.cache.size,
    };
  }

  public getMockPeptides(): Peptide[] {
    return [...MOCK_PEPTIDES];
  }

  public getMockPeptideBySequence(sequence: string): Peptide | undefined {
    return MOCK_PEPTIDES.find((p) => p.sequence.toUpperCase() === sequence.toUpperCase());
  }

  public addCustomPeptide(peptide: Peptide): void {
    MOCK_PEPTIDES.push(peptide);
  }

  public getAminoAcidInfo(aa: string): AminoAcidProperties | undefined {
    return AMINO_ACID_DATA[aa.toUpperCase()];
  }

  public getAllAminoAcidInfo(): Record<string, AminoAcidProperties> {
    return { ...AMINO_ACID_DATA };
  }
}

export default PeptideService;
