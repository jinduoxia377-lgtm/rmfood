import {
  tcmService,
  ChemistryUtils,
} from '../professional';
import type {
  TCMSearchParams,
  TCMPredictionParams,
} from '../professional';

export class TCMDataIntegration {
  async demonstrateUsage() {
    tcmService.getServiceInfo();

    const searchParams: TCMSearchParams = {
      keyword: '人参',
      page: 1,
      pageSize: 10,
    };

    const searchResults = await tcmService.searchHerbs(searchParams);

    if (searchResults.herbs.length > 0) {
      const firstHerb = searchResults.herbs[0];

      if (firstHerb.chemistry.smiles) {
        await tcmService.visualizeChemistry(firstHerb.chemistry.smiles);

        const chemistryUtils = ChemistryUtils.calculateDescriptors(firstHerb.chemistry.smiles);

        ChemistryUtils.isDrugLike(chemistryUtils);

        ChemistryUtils.generateSVG(firstHerb.chemistry.smiles, 500, 400);
      }

      await tcmService.getHerbNetwork(firstHerb.id);

      await tcmService.getRelatedHerbs(firstHerb.id);
    }

    tcmService.getServiceInfo();
  }

  async testCompoundPrediction() {
    const smiles = 'CC(=O)Oc1ccccc1C(=O)O';

    const params: TCMPredictionParams = {
      compoundSmiles: smiles,
      predictTargets: true,
      predictDiseases: true,
      predictPathways: true,
    };

    await tcmService.getFullPrediction(params);
  }

  async testChemistryUtils() {
    const smiles1 = 'CCO';
    const smiles2 = 'CCCO';

    ChemistryUtils.calculateDescriptors(smiles1);
    ChemistryUtils.calculateDescriptors(smiles2);

    ChemistryUtils.calculateSimilarity(smiles1, smiles2);

    ChemistryUtils.generateSVG(smiles1);
  }

  clearCache() {
    tcmService.clearHerbCache();
  }
}

const integration = new TCMDataIntegration();

export default integration;
