import tcmService from './tcmService';
import type {
  TCMHerb,
  TCMSearchParams,
  TCMPredictionParams,
  TCMChemistryVisualization,
} from './tcmService';

export class TCMServiceIntegration {
  private service = tcmService;

  async searchHerbsExample(): Promise<void> {
    const searchParams: TCMSearchParams = {
      keyword: '人参',
      family: '五加科',
      nature: '温',
      page: 1,
      pageSize: 10,
    };

    const results = await this.service.searchHerbs(searchParams);

    results.herbs.forEach(() => {
    });
  }

  async getHerbDetailsExample(herbId: string): Promise<void> {
    const herb = await this.service.getHerbById(herbId);
    if (herb) {
      // 示例：此处处理药材详情
    }
  }

  async analyzeCompoundExample(herbId: string): Promise<void> {
    const { compounds } = await this.service.getHerbCompounds(herbId);

    compounds.forEach(() => {
    });
  }

  async predictTargetsExample(smiles: string): Promise<void> {
    const params: TCMPredictionParams = {
      compoundSmiles: smiles,
      predictTargets: true,
      predictDiseases: true,
      predictPathways: true,
    };

    await this.service.getFullPrediction(params);
  }

  async visualizeChemistryExample(smiles: string): Promise<TCMChemistryVisualization> {
    const visualization = await this.service.visualizeChemistry(smiles);

    return visualization;
  }

  async getHerbNetworkExample(herbId: string): Promise<void> {
    const network = await this.service.getHerbNetwork(herbId);

    network.nodes.forEach(() => {
    });
  }

  async compareHerbsExample(herbIds: string[]): Promise<void> {
    const herbs: TCMHerb[] = [];

    for (const herbId of herbIds) {
      const herb = await this.service.getHerbById(herbId);
      if (herb) {
        herbs.push(herb);
      }
    }

    herbs.forEach(() => {
    });
  }

  async findRelatedHerbsExample(herbId: string): Promise<void> {
    const related = await this.service.getRelatedHerbs(herbId);

    related.forEach(() => {
    });
  }

  getServiceInfo(): void {
    this.service.getServiceInfo();
  }

  clearCache(herbId?: string): void {
    this.service.clearHerbCache(herbId);
  }
}

const tcmIntegration = new TCMServiceIntegration();

export default tcmIntegration;
