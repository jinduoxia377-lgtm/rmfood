export interface Ingredient {
  id: string;
  name: string;
  chineseName?: string;
  latinName?: string;
  category: IngredientCategory;
  source: string;
  activeComponents: ActiveComponent[];
  properties: IngredientProperties;
  functions: string[];
  dosage?: DosageRange;
  contraindications?: string[];
  warnings?: string[];
  interactions?: IngredientInteraction[];
  evidence?: EvidenceReference[];
  metadata: IngredientMetadata;
}

export type IngredientCategory =
  | 'medicinal_food'
  | 'food_material'
  | 'medicine'
  | 'peptide'
  | 'extract';

export interface ActiveComponent {
  name: string;
  englishName?: string;
  casNumber?: string;
  concentration?: string;
  percentage?: number;
  bioactivity?: string[];
  source?: string;
}

export interface IngredientProperties {
  nature: 'cold' | 'cool' | 'neutral' | 'warm' | 'hot';
  flavor: ('sour' | 'bitter' | 'sweet' | 'pungent' | 'salty')[];
  meridianTropism?: string[];
  toxicity?: 'none' | 'low' | 'moderate' | 'high';
}

export interface DosageRange {
  min: number;
  max: number;
  unit: string;
  form?: string;
  dailyMax?: number;
}

export interface IngredientInteraction {
  ingredient: string;
  type: 'synergy' | 'antagonism' | 'neutral';
  mechanism?: string;
  evidence?: string;
}

export interface EvidenceReference {
  type: 'clinical' | 'preclinical' | 'traditional' | 'literature';
  title?: string;
  source?: string;
  year?: number;
  doi?: string;
}

export interface IngredientMetadata {
  createdAt?: string;
  updatedAt?: string;
  version?: string;
  source?: string;
  reliability?: 'high' | 'medium' | 'low';
}

export interface Peptide {
  id: string;
  sequence: string;
  name: string;
  molecularFormula?: string;
  molecularWeight?: number;
  isoelectricPoint?: number;
  hydrophobicity?: number;
  length: number;
  modifications?: PeptideModification[];
  bioactivities: Bioactivity[];
  sources: string[];
  foodSources?: string[];
  targetReceptors?: string[];
  toxicity?: ToxicityInfo;
  stability?: StabilityInfo;
  pharmacologicalEffects: string[];
  dosage?: DosageRange;
  researchStatus: ResearchStatus;
  patents?: PatentInfo[];
  references?: string[];
  metadata: PeptideMetadata;
}

export interface PeptideModification {
  type: string;
  position?: number;
  description?: string;
  effect?: string;
}

export interface Bioactivity {
  type: BioactivityType;
  potency?: string;
  mechanism?: string;
  evidence?: EvidenceReference[];
  ic50?: number;
  ec50?: number;
}

export type BioactivityType =
  | 'antioxidant'
  | 'anti-inflammatory'
  | 'antimicrobial'
  | 'antihypertensive'
  | 'antidiabetic'
  | 'anticancer'
  | 'immunomodulatory'
  | 'neuroprotective'
  | 'analgesic'
  | 'anticoagulant'
  | 'antiobesity'
  | 'other';

export interface ToxicityInfo {
  acute?: ToxicityLevel;
  chronic?: ToxicityLevel;
  cytotoxicity?: ToxicityLevel;
  mutagenicity?: ToxicityLevel;
  ld50?: number;
  studyDetails?: string;
}

export type ToxicityLevel = 'none' | 'low' | 'moderate' | 'high' | 'unknown';

export interface StabilityInfo {
  thermal?: StabilityLevel;
  ph?: StabilityLevel;
  gastrointestinal?: StabilityLevel;
  storage?: string;
  halfLife?: string;
}

export type StabilityLevel = 'stable' | 'moderate' | 'unstable' | 'unknown';

export type ResearchStatus =
  | 'validated'
  | 'preliminary'
  | 'hypothetical'
  | 'discovered';

export interface PatentInfo {
  number: string;
  title: string;
  holder?: string;
  year?: number;
  status?: 'active' | 'expired' | 'pending';
}

export interface PeptideMetadata {
  createdAt?: string;
  updatedAt?: string;
  version?: string;
  databaseSource?: string;
  reliability?: 'high' | 'medium' | 'low';
}

export interface AnalysisResult {
  id: string;
  type: AnalysisType;
  timestamp: string;
  input: AnalysisInput;
  output: AnalysisOutput;
  confidence: number;
  limitations?: string[];
  recommendations?: string[];
  metadata: AnalysisMetadata;
}

export type AnalysisType =
  | 'ingredient_analysis'
  | 'peptide_analysis'
  | 'compatibility_analysis'
  | 'safety_assessment'
  | 'efficacy_prediction';

export interface AnalysisInput {
  ingredients?: Ingredient[];
  peptides?: Peptide[];
  query?: string;
  parameters?: Record<string, any>;
}

export interface AnalysisOutput {
  findings: Finding[];
  summary: string;
  score?: number;
  warnings?: string[];
  suggestions?: string[];
  detailedReport?: any;
}

export interface Finding {
  category: string;
  description: string;
  severity?: 'info' | 'warning' | 'critical';
  evidence?: EvidenceReference[];
  recommendation?: string;
}

export interface AnalysisMetadata {
  model?: string;
  version?: string;
  processingTime?: number;
  confidence?: number;
  dataSources?: string[];
}

export interface CompatibilityResult {
  id: string;
  ingredients: string[];
  peptides?: string[];
  compatibilityScore: number;
  compatibilityLevel: CompatibilityLevel;
  interactions: InteractionDetail[];
  synergies: SynergyDetail[];
  antagonisms: AntagonismDetail[];
  warnings: Warning[];
  recommendations: Recommendation[];
  confidence: number;
  evidence: EvidenceReference[];
  metadata: CompatibilityMetadata;
}

export type CompatibilityLevel =
  | 'excellent'
  | 'good'
  | 'moderate'
  | 'poor'
  | 'contraindicated';

export interface InteractionDetail {
  type: InteractionType;
  participants: string[];
  mechanism: string;
  description: string;
  clinicalSignificance: 'high' | 'medium' | 'low';
  evidence: EvidenceReference[];
}

export type InteractionType =
  | 'synergistic'
  | 'antagonistic'
  | 'additive'
  | 'pharmacokinetic'
  | 'pharmacodynamic'
  | 'chemical'
  | 'unknown';

export interface SynergyDetail {
  participants: string[];
  effect: string;
  mechanism: string;
  evidence: EvidenceReference[];
  clinicalRelevance?: string;
}

export interface AntagonismDetail {
  participants: string[];
  effect: string;
  mechanism: string;
  evidence: EvidenceReference[];
  clinicalRelevance?: string;
}

export interface Warning {
  type: WarningType;
  severity: 'high' | 'medium' | 'low';
  description: string;
  affectedIngredients: string[];
  recommendation?: string;
}

export type WarningType =
  | 'contraindication'
  | 'interaction'
  | 'toxicity'
  | 'overdose'
  | 'allergy'
  | 'pregnancy'
  | 'special_population';

export interface Recommendation {
  type: RecommendationType;
  priority: 'high' | 'medium' | 'low';
  description: string;
  rationale: string;
  alternatives?: string[];
}

export type RecommendationType =
  | 'dosage_adjustment'
  | 'timing_separation'
  | 'avoid_combination'
  | 'monitoring_required'
  | 'alternative_ingredient';

export interface CompatibilityMetadata {
  analyzedAt: string;
  analysisMethod: string;
  version: string;
  dataCompleteness: number;
  dataSources: string[];
}

export interface ProfessionalComponentProps {
  loading?: boolean;
  error?: string | null;
  onError?: (error: Error) => void;
  className?: string;
  style?: React.CSSProperties;
}

export interface ProfessionalServiceConfig {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  cacheEnabled?: boolean;
  cacheDuration?: number;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
  timestamp: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  status: number;
  details?: any;
}
