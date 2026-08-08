export interface Ingredient {
  id: string;
  name: string;
  dosage: number;
  parameters: Record<string, number>;
}

export interface Individual {
  id: string;
  ingredients: Ingredient[];
  objective_scores: Record<string, number>;
  rank: number;
  crowding_distance: number;
}

export interface NSGAIIParams {
  populationSize: number;
  generations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteRatio: number;
  count: number;
}

export interface NSGAIIProgress {
  generation: number;
  best_fitness: number;
  avg_fitness: number;
  diversity: number;
}

export interface NSGAIIResult {
  candidates: Individual[];
  total_generations: number;
  execution_time_ms: number;
  pareto_front: Individual[];
  convergence_history: NSGAIIProgress[];
}

const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

export class NSGAIIOptimizer {
  private params: NSGAIIParams;
  private targetEffects: string[];
  private baseIngredients: Ingredient[];
  private totalWeight: number;
  private population: Individual[] = [];
  private convergenceHistory: NSGAIIProgress[] = [];

  constructor(
    params: NSGAIIParams,
    baseIngredients: Ingredient[],
    totalWeight: number,
    targetEffects: string[] = ['免疫调节']
  ) {
    this.params = params;
    this.baseIngredients = baseIngredients;
    this.totalWeight = totalWeight;
    this.targetEffects = targetEffects;
  }

  private initializePopulation(): void {
    this.population = [];
    const ingredientNames = this.baseIngredients.map((ing) => ing.name);
    
    for (let i = 0; i < this.params.populationSize; i++) {
      const numIngredients = Math.max(3, Math.floor(Math.random() * (this.baseIngredients.length - 2)) + 3);
      const selectedIndices = new Set<number>();
      
      while (selectedIndices.size < numIngredients) {
        selectedIndices.add(Math.floor(Math.random() * this.baseIngredients.length));
      }

      const dosages: number[] = Array.from({ length: numIngredients }, () => Math.random());
      const sumDosages = dosages.reduce((a, b) => a + b, 0);
      const normalizedDosages = dosages.map((d) => (d / sumDosages) * this.totalWeight);

      const ingredients: Ingredient[] = Array.from(selectedIndices).map((idx, i) => ({
        id: generateId(),
        name: ingredientNames[idx],
        dosage: normalizedDosages[i],
        parameters: this.baseIngredients[idx].parameters || {},
      }));

      const objectiveScores = this.evaluateObjectives(ingredients);

      this.population.push({
        id: generateId(),
        ingredients,
        objective_scores: objectiveScores,
        rank: 0,
        crowding_distance: 0,
      });
    }
  }

  private evaluateObjectives(ingredients: Ingredient[]): Record<string, number> {
    const scores: Record<string, number> = {};
    
    const efficacy = this.calculateEfficacy(ingredients);
    const safety = this.calculateSafety(ingredients);
    const cost = this.calculateCost(ingredients);
    const synergy = this.calculateSynergy(ingredients);
    const stability = this.calculateStability(ingredients);

    scores.efficacy = Math.max(0, Math.min(1, efficacy));
    scores.safety = Math.max(0, Math.min(1, safety));
    scores.cost = Math.max(0, Math.min(1, 1 - cost / 100));
    scores.synergy = Math.max(0, Math.min(1, synergy));
    scores.stability = Math.max(0, Math.min(1, stability));
    scores.overall_fitness = (scores.efficacy + scores.safety + scores.synergy + scores.stability) / 4;

    return scores;
  }

  private calculateEfficacy(ingredients: Ingredient[]): number {
    let score = 0.3;
    const effectWeights: Record<string, number> = {
      '免疫调节': 0.3,
      '抗炎': 0.25,
      '抗氧化': 0.2,
      '抗肿瘤': 0.15,
      '保肝': 0.1,
    };

    ingredients.forEach((ing) => {
      const paramEfficacy = ing.parameters.efficacy || 0.5;
      const paramTargetEffect = ing.parameters.target_component || 0.3;
      const dosageFactor = Math.min(ing.dosage / this.totalWeight, 1);
      
      this.targetEffects.forEach((effect) => {
        score += paramEfficacy * paramTargetEffect * dosageFactor * (effectWeights[effect] || 0.2);
      });
    });

    return score / ingredients.length;
  }

  private calculateSafety(ingredients: Ingredient[]): number {
    let toxicity = 0;
    let contraindications = 0;

    ingredients.forEach((ing) => {
      toxicity += ing.parameters.toxicity || 0.1;
      contraindications += ing.parameters.contraindications || 0;
    });

    const baseSafety = 0.8;
    const toxicityPenalty = toxicity / ingredients.length * 0.3;
    const contraPenalty = contraindications * 0.1;

    return Math.max(0.1, baseSafety - toxicityPenalty - contraPenalty);
  }

  private calculateCost(ingredients: Ingredient[]): number {
    let totalCost = 0;
    
    ingredients.forEach((ing) => {
      const baseCost = ing.parameters.cost || 50;
      totalCost += baseCost * ing.dosage / 100;
    });

    return totalCost;
  }

  private calculateSynergy(ingredients: Ingredient[]): number {
    if (ingredients.length < 2) return 0.5;

    let synergyScore = 0.5;
    const herbPairs: Record<string, number> = {
      '黄芪-当归': 0.2,
      '党参-白术': 0.15,
      '茯苓-甘草': 0.1,
      '川芎-丹参': 0.15,
      '熟地-山药': 0.12,
    };

    for (let i = 0; i < ingredients.length; i++) {
      for (let j = i + 1; j < ingredients.length; j++) {
        const pair1 = `${ingredients[i].name}-${ingredients[j].name}`;
        const pair2 = `${ingredients[j].name}-${ingredients[i].name}`;
        synergyScore += herbPairs[pair1] || herbPairs[pair2] || 0.02;
      }
    }

    const maxPossible = ingredients.length * (ingredients.length - 1) * 0.1;
    return Math.min(1, 0.5 + synergyScore / maxPossible * 0.5);
  }

  private calculateStability(ingredients: Ingredient[]): number {
    let stability = 0.7;
    const moisture = ingredients.reduce((sum, ing) => sum + (ing.parameters.moisture || 0.1), 0) / ingredients.length;
    const ash = ingredients.reduce((sum, ing) => sum + (ing.parameters.ash || 0.05), 0) / ingredients.length;

    if (moisture > 0.15) stability -= (moisture - 0.15) * 2;
    if (ash > 0.1) stability -= (ash - 0.1) * 3;

    return Math.max(0.3, stability);
  }

  private fastNonDominatedSort(population: Individual[]): Individual[][] {
    const fronts: Individual[][] = [];
    const dominatedSet: Record<string, Individual[]> = {};
    const dominationCount: Record<string, number> = {};

    population.forEach((p) => {
      dominatedSet[p.id] = [];
      dominationCount[p.id] = 0;

      population.forEach((q) => {
        if (this.dominates(p, q)) {
          dominatedSet[p.id].push(q);
        } else if (this.dominates(q, p)) {
          dominationCount[p.id]++;
        }
      });

      if (dominationCount[p.id] === 0) {
        p.rank = 1;
        if (!fronts[0]) fronts[0] = [];
        fronts[0].push(p);
      }
    });

    let i = 0;
    while (fronts[i] && fronts[i].length > 0) {
      const nextFront: Individual[] = [];

      fronts[i].forEach((p) => {
        dominatedSet[p.id].forEach((q) => {
          dominationCount[q.id]--;
          if (dominationCount[q.id] === 0) {
            q.rank = i + 2;
            nextFront.push(q);
          }
        });
      });

      i++;
      fronts[i] = nextFront;
    }

    return fronts;
  }

  private dominates(p: Individual, q: Individual): boolean {
    const pScores = p.objective_scores;
    const qScores = q.objective_scores;
    const objectives = ['efficacy', 'safety', 'synergy', 'stability'];
    const costObjective = 'cost';

    let hasBetter = false;
    let hasWorse = false;

    objectives.forEach((obj) => {
      if ((pScores[obj] || 0) > (qScores[obj] || 0)) hasBetter = true;
      if ((pScores[obj] || 0) < (qScores[obj] || 0)) hasWorse = true;
    });

    const pCost = pScores[costObjective] || 0;
    const qCost = qScores[costObjective] || 0;
    if (pCost < qCost) hasBetter = true;
    if (pCost > qCost) hasWorse = true;

    return hasBetter && !hasWorse;
  }

  private calculateCrowdingDistance(front: Individual[]): void {
    if (front.length <= 2) {
      front.forEach((ind) => {
        ind.crowding_distance = Infinity;
      });
      return;
    }

    const objectives = ['efficacy', 'safety', 'cost', 'synergy', 'stability'];

    front.forEach((ind) => {
      ind.crowding_distance = 0;
    });

    objectives.forEach((obj) => {
      front.sort((a, b) => (a.objective_scores[obj] || 0) - (b.objective_scores[obj] || 0));
      
      front[0].crowding_distance = Infinity;
      front[front.length - 1].crowding_distance = Infinity;

      const maxVal = front[front.length - 1].objective_scores[obj] || 1;
      const minVal = front[0].objective_scores[obj] || 0;
      const range = maxVal - minVal || 1;

      for (let i = 1; i < front.length - 1; i++) {
        const nextVal = front[i + 1].objective_scores[obj] || 0;
        const prevVal = front[i - 1].objective_scores[obj] || 0;
        front[i].crowding_distance += (nextVal - prevVal) / range;
      }
    });
  }

  private tournamentSelection(population: Individual[], tournamentSize: number = 3): Individual {
    const selected: Individual[] = [];
    for (let i = 0; i < tournamentSize; i++) {
      selected.push(population[Math.floor(Math.random() * population.length)]);
    }

    selected.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return b.crowding_distance - a.crowding_distance;
    });

    return selected[0];
  }

  private crossover(parent1: Individual, parent2: Individual): Individual {
    if (Math.random() > this.params.crossoverRate / 100) {
      return { ...parent1, id: generateId() };
    }

    const childIngredients: Ingredient[] = [];
    const parent1Ingredients = parent1.ingredients;
    const parent2Ingredients = parent2.ingredients;

    const combined = [...parent1Ingredients, ...parent2Ingredients];
    const uniqueNames = new Set(combined.map((ing) => ing.name));
    const numIngredients = Math.min(
      Math.max(3, Math.floor(Math.random() * (uniqueNames.size - 2)) + 3),
      uniqueNames.size
    );

    const shuffled = [...uniqueNames].sort(() => Math.random() - 0.5).slice(0, numIngredients);

    shuffled.forEach((name) => {
      const p1Ing = parent1Ingredients.find((ing) => ing.name === name);
      const p2Ing = parent2Ingredients.find((ing) => ing.name === name);

      if (p1Ing && p2Ing) {
        const weight = Math.random();
        childIngredients.push({
          id: generateId(),
          name,
          dosage: p1Ing.dosage * weight + p2Ing.dosage * (1 - weight),
          parameters: p1Ing.parameters,
        });
      } else if (p1Ing) {
        childIngredients.push({ ...p1Ing, id: generateId() });
      } else if (p2Ing) {
        childIngredients.push({ ...p2Ing, id: generateId() });
      }
    });

    const sumDosage = childIngredients.reduce((sum, ing) => sum + ing.dosage, 0);
    childIngredients.forEach((ing) => {
      ing.dosage = (ing.dosage / sumDosage) * this.totalWeight;
    });

    return {
      id: generateId(),
      ingredients: childIngredients,
      objective_scores: this.evaluateObjectives(childIngredients),
      rank: 0,
      crowding_distance: 0,
    };
  }

  private mutate(individual: Individual): Individual {
    const mutatedIngredients = individual.ingredients.map((ing) => {
      if (Math.random() < this.params.mutationRate / 100) {
        const mutationFactor = 0.8 + Math.random() * 0.4;
        return {
          ...ing,
          dosage: Math.max(0.1, Math.min(this.totalWeight * 0.8, ing.dosage * mutationFactor)),
        };
      }
      return ing;
    });

    const sumDosage = mutatedIngredients.reduce((sum, ing) => sum + ing.dosage, 0);
    mutatedIngredients.forEach((ing) => {
      ing.dosage = (ing.dosage / sumDosage) * this.totalWeight;
    });

    return {
      ...individual,
      id: generateId(),
      ingredients: mutatedIngredients,
      objective_scores: this.evaluateObjectives(mutatedIngredients),
      rank: 0,
      crowding_distance: 0,
    };
  }

  private environmentalSelection(population: Individual[]): Individual[] {
    const fronts = this.fastNonDominatedSort(population);
    const newPopulation: Individual[] = [];

    for (const front of fronts) {
      this.calculateCrowdingDistance(front);
      
      if (newPopulation.length + front.length <= this.params.populationSize) {
        newPopulation.push(...front);
      } else {
        front.sort((a, b) => b.crowding_distance - a.crowding_distance);
        const remaining = this.params.populationSize - newPopulation.length;
        newPopulation.push(...front.slice(0, remaining));
        break;
      }
    }

    return newPopulation;
  }

  private calculateDiversity(population: Individual[]): number {
    if (population.length < 2) return 0;

    const objectives = ['efficacy', 'safety', 'cost', 'synergy', 'stability'];
    let diversity = 0;

    objectives.forEach((obj) => {
      const values = population.map((ind) => ind.objective_scores[obj] || 0);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      diversity += Math.sqrt(variance);
    });

    return diversity / objectives.length;
  }

  async optimize(onProgress?: (progress: NSGAIIProgress) => void): Promise<NSGAIIResult> {
    const startTime = performance.now();

    this.initializePopulation();

    for (let gen = 1; gen <= this.params.generations; gen++) {
      const offspring: Individual[] = [];
      const eliteCount = Math.floor(this.params.populationSize * this.params.eliteRatio / 100);
      
      const elites = [...this.population].sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return b.crowding_distance - a.crowding_distance;
      }).slice(0, eliteCount);

      while (offspring.length < this.params.populationSize - eliteCount) {
        const parent1 = this.tournamentSelection(this.population);
        const parent2 = this.tournamentSelection(this.population);
        let child = this.crossover(parent1, parent2);
        child = this.mutate(child);
        offspring.push(child);
      }

      offspring.push(...elites);
      this.population = this.environmentalSelection(offspring);

      const bestIndividual = this.population.reduce((best, ind) => {
        if (best.rank < ind.rank) return best;
        if (best.rank > ind.rank) return ind;
        return best.crowding_distance > ind.crowding_distance ? best : ind;
      });

      const avgFitness = this.population.reduce((sum, ind) => sum + (ind.objective_scores.overall_fitness || 0), 0) / this.population.length;
      const diversity = this.calculateDiversity(this.population);

      const progress: NSGAIIProgress = {
        generation: gen,
        best_fitness: bestIndividual.objective_scores.overall_fitness || 0,
        avg_fitness: avgFitness,
        diversity,
      };

      this.convergenceHistory.push(progress);

      if (onProgress) {
        onProgress(progress);
      }

      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const paretoFront = this.population.filter((ind) => ind.rank === 1);
    const sortedCandidates = [...this.population]
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return b.crowding_distance - a.crowding_distance;
      })
      .slice(0, this.params.count);

    const endTime = performance.now();

    return {
      candidates: sortedCandidates,
      total_generations: this.params.generations,
      execution_time_ms: Math.round(endTime - startTime),
      pareto_front: paretoFront,
      convergence_history: this.convergenceHistory,
    };
  }
}
