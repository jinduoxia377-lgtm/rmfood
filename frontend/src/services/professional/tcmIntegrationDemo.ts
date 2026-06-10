import {
  tcmService,
  TCMService,
  ChemistryUtils,
} from '../professional';
import type {
  TCMHerb,
  TCMChemistry,
  TCMTarget,
  TCMDisease,
  TCMSearchParams,
  TCMPredictionParams,
  TCMChemistryVisualization,
  ChemistryDescriptor,
} from '../professional';

export class TCMDataIntegration {
  async demonstrateUsage() {
    const serviceInfo = tcmService.getServiceInfo();

    const searchParams: TCMSearchParams = {
      keyword: '人参',
      page: 1,
      pageSize: 10,
    };

    const searchResults = await tcmService.searchHerbs(searchParams);

    if (searchResults.herbs.length > 0) {
      const firstHerb = searchResults.herbs[0];

      if (firstHerb.chemistry.smiles) {
        const visualization = await tcmService.visualizeChemistry(firstHerb.chemistry.smiles);

        const chemistryUtils = ChemistryUtils.calculateDescriptors(firstHerb.chemistry.smiles);

        const isDrugLike = ChemistryUtils.isDrugLike(chemistryUtils);

        const svg = ChemistryUtils.generateSVG(firstHerb.chemistry.smiles, 500, 400);
      }

      const network = await tcmService.getHerbNetwork(firstHerb.id);

      const related = await tcmService.getRelatedHerbs(firstHerb.id);
    }

    const stats = tcmService.getServiceInfo();
  }

  async testCompoundPrediction() {
    const smiles = 'CC(=O)Oc1ccccc1C(=O)O';

    const params: TCMPredictionParams = {
      compoundSmiles: smiles,
      predictTargets: true,
      predictDiseases: true,
      predictPathways: true,
    };

    const result = await tcmService.getFullPrediction(params);
  }

  async testChemistryUtils() {
    const smiles1 = 'CCO';
    const smiles2 = 'CCCO';

    const desc1 = ChemistryUtils.calculateDescriptors(smiles1);
    const desc2 = ChemistryUtils.calculateDescriptors(smiles2);

    const similarity = ChemistryUtils.calculateSimilarity(smiles1, smiles2);

    const svg = ChemistryUtils.generateSVG(smiles1);
  }

  clearCache() {
    tcmService.clearHerbCache();
  }
}

const integration = new TCMDataIntegration();

export default integration;
