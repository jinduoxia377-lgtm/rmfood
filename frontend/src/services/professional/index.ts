export { default as ProfessionalBaseService } from './ProfessionalBaseService';
export { default as tcmService, TCMService } from './tcmService';
export { default as literatureService, LiteratureService } from './literatureService';
export { default as peptideService, PeptideService } from './peptideService';
export { default as keggService, KEGGService } from './keggService';
export { default as compatibilityService, CompatibilityService } from './compatibilityService';
export { default as tcmIntegration } from './tcmServiceExample';
export { default as ChemistryUtils } from './chemistryUtils';
export { default as TCMViewer, TCMSearchComponent } from './tcmServiceComponents';

export type {
  TCMHerb,
  TCMChemistry,
  TCMTarget,
  TCMDisease,
  TCMSearchParams,
  TCMCompoundSearchParams,
  TCMPredictionParams,
  TCMPredictionResult,
  TCMChemistryVisualization,
} from './tcmService';

export type {
  LiteratureArticle,
  LiteratureSearchParams,
  LiteratureSearchResult,
  CitationMetrics,
  JournalInfo,
} from './literatureService';

export type { PeptideAnalysis, Peptide, BioactivityPrediction, StructurePrediction } from './peptideService';

export type {
  KEGGPathway,
  KEGGEntry,
  KEGGGene,
  KEGGCompound,
  KEGGReaction,
  KEGGOrganism,
  KEGGSearchResult,
  PathwayEnrichmentResult,
  KEGGModule,
} from './keggService';

export type { ChemistryDescriptor, AtomInfo, BondInfo } from './chemistryUtils';
