import {
  generateId,
  validateNumberRange,
  validateRequiredParameters,
  validateRatioSum,
  validateIngredientCount,
  validateForm,
  calculateDosages,
  percentageToMass,
  massToPercentage,
  createNewIngredient,
  duplicateIngredient,
  formatForNSGAII,
} from './utils';

describe('FormulaIngredientInput Utils', () => {
  describe('generateId', () => {
    it('should generate a unique ID', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^\d+-\w{9}$/);
    });
  });

  describe('validateNumberRange', () => {
    it('should return null for valid value', () => {
      expect(validateNumberRange(5, 0, 10, 'test')).toBeNull();
    });

    it('should return error when value is below min', () => {
      const result = validateNumberRange(-1, 0, 10, 'test');
      expect(result).not.toBeNull();
      expect(result?.message).toContain('小于最小值');
    });

    it('should return error when value is above max', () => {
      const result = validateNumberRange(15, 0, 10, 'test');
      expect(result).not.toBeNull();
      expect(result?.message).toContain('大于最大值');
    });

    it('should return null for null value', () => {
      expect(validateNumberRange(null, 0, 10, 'test')).toBeNull();
    });
  });

  describe('validateRequiredParameters', () => {
    it('should return empty array when all required params are filled', () => {
      const ingredient = {
        id: 'test',
        name: 'test',
        nameCn: 'test',
        ratio: 10,
        unit: 'percentage',
        dosage: 10,
        parameters: [
          { id: 'p1', name: 'param1', nameEn: 'param1', value: 5, unit: '%', min: 0, max: 10, step: 0.1, required: true, description: '' },
        ],
      };
      expect(validateRequiredParameters(ingredient)).toEqual([]);
    });

    it('should return errors when required param is missing', () => {
      const ingredient = {
        id: 'test',
        name: 'test',
        nameCn: 'test',
        ratio: 10,
        unit: 'percentage',
        dosage: 10,
        parameters: [
          { id: 'p1', name: 'param1', nameEn: 'param1', value: null, unit: '%', min: 0, max: 10, step: 0.1, required: true, description: '' },
        ],
      };
      const errors = validateRequiredParameters(ingredient);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('必填项');
    });
  });

  describe('validateRatioSum', () => {
    it('should return null when sum is 100', () => {
      const ingredients = [
        { id: '1', name: 'a', nameCn: 'a', ratio: 50, unit: 'percentage', dosage: 50, parameters: [] },
        { id: '2', name: 'b', nameCn: 'b', ratio: 50, unit: 'percentage', dosage: 50, parameters: [] },
      ];
      expect(validateRatioSum(ingredients)).toBeNull();
    });

    it('should return error when sum is not 100', () => {
      const ingredients = [
        { id: '1', name: 'a', nameCn: 'a', ratio: 40, unit: 'percentage', dosage: 40, parameters: [] },
        { id: '2', name: 'b', nameCn: 'b', ratio: 50, unit: 'percentage', dosage: 50, parameters: [] },
      ];
      const result = validateRatioSum(ingredients);
      expect(result).not.toBeNull();
      expect(result?.message).toContain('不为100%');
    });
  });

  describe('validateIngredientCount', () => {
    it('should return error when no ingredients', () => {
      const result = validateIngredientCount([]);
      expect(result).not.toBeNull();
      expect(result?.message).toContain('未添加任何成分');
    });

    it('should return error when too many ingredients', () => {
      const ingredients = Array(51).fill({ id: '1', name: 'a', nameCn: 'a', ratio: 1, unit: 'percentage', dosage: 1, parameters: [] });
      const result = validateIngredientCount(ingredients);
      expect(result).not.toBeNull();
      expect(result?.message).toContain('超过限制');
    });

    it('should return null for valid count', () => {
      const ingredients = [
        { id: '1', name: 'a', nameCn: 'a', ratio: 50, unit: 'percentage', dosage: 50, parameters: [] },
        { id: '2', name: 'b', nameCn: 'b', ratio: 50, unit: 'percentage', dosage: 50, parameters: [] },
      ];
      expect(validateIngredientCount(ingredients)).toBeNull();
    });
  });

  describe('validateForm', () => {
    it('should validate all aspects of the form', () => {
      const ingredients = [
        {
          id: '1',
          name: 'a',
          nameCn: 'a',
          ratio: 50,
          unit: 'percentage',
          dosage: 50,
          parameters: [
            { id: 'p1', name: 'param1', nameEn: 'param1', value: null, unit: '%', min: 0, max: 10, step: 0.1, required: true, description: '' },
          ],
        },
        { id: '2', name: 'b', nameCn: 'b', ratio: 40, unit: 'percentage', dosage: 40, parameters: [] },
      ];
      const errors = validateForm(ingredients);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('calculateDosages', () => {
    it('should calculate dosages correctly', () => {
      const ingredients = [
        { id: '1', name: 'a', nameCn: 'a', ratio: 30, unit: 'percentage', dosage: 0, parameters: [] },
        { id: '2', name: 'b', nameCn: 'b', ratio: 70, unit: 'percentage', dosage: 0, parameters: [] },
      ];
      const result = calculateDosages(ingredients, 100);
      expect(result[0].dosage).toBe(30);
      expect(result[1].dosage).toBe(70);
    });

    it('should round to one decimal place', () => {
      const ingredients = [
        { id: '1', name: 'a', nameCn: 'a', ratio: 33.333, unit: 'percentage', dosage: 0, parameters: [] },
      ];
      const result = calculateDosages(ingredients, 100);
      expect(result[0].dosage).toBe(33.3);
    });
  });

  describe('percentageToMass', () => {
    it('should convert percentage to mass correctly', () => {
      expect(percentageToMass(50, 100)).toBe(50);
      expect(percentageToMass(25, 200)).toBe(50);
    });
  });

  describe('massToPercentage', () => {
    it('should convert mass to percentage correctly', () => {
      expect(massToPercentage(50, 100)).toBe(50);
      expect(massToPercentage(50, 200)).toBe(25);
    });

    it('should return 0 when totalWeight is 0', () => {
      expect(massToPercentage(50, 0)).toBe(0);
    });
  });

  describe('createNewIngredient', () => {
    it('should create a new ingredient with default parameters', () => {
      const ingredient = createNewIngredient();
      expect(ingredient.id).toBeDefined();
      expect(ingredient.name).toBe('');
      expect(ingredient.ratio).toBe(0);
      expect(ingredient.parameters.length).toBeGreaterThan(0);
    });
  });

  describe('duplicateIngredient', () => {
    it('should duplicate an ingredient with new IDs', () => {
      const original = {
        id: 'original',
        name: 'test',
        nameCn: 'test',
        ratio: 10,
        unit: 'percentage' as const,
        dosage: 10,
        parameters: [{ id: 'p1', name: 'param1', nameEn: 'param1', value: 5, unit: '%', min: 0, max: 10, step: 0.1, required: true, description: '' }],
      };
      const duplicated = duplicateIngredient(original);
      expect(duplicated.id).not.toBe(original.id);
      expect(duplicated.name).toBe('test (副本)');
      expect(duplicated.parameters[0].id).not.toBe(original.parameters[0].id);
      expect(duplicated.parameters[0].value).toBe(original.parameters[0].value);
    });
  });

  describe('formatForNSGAII', () => {
    it('should format ingredients for NSGA-II algorithm', () => {
      const ingredients = [
        {
          id: '1',
          name: 'a',
          nameCn: 'A',
          ratio: 50,
          unit: 'percentage',
          dosage: 50,
          parameters: [
            { id: 'p1', name: '水分', nameEn: 'moisture', value: 10, unit: '%', min: 0, max: 20, step: 0.1, required: false, description: '' },
            { id: 'p2', name: '靶向成分', nameEn: 'target_component', value: 5, unit: '%', min: 0, max: 100, step: 0.01, required: true, description: '' },
          ],
        },
      ];
      const result = formatForNSGAII(ingredients, 100);
      expect(result.total_weight).toBe(100);
      expect(result.ingredients.length).toBe(1);
      expect(result.ingredients[0].name).toBe('A');
      expect(result.ingredients[0].dosage).toBe(50);
      expect(result.ingredients[0].parameters.moisture).toBe(10);
      expect(result.ingredients[0].parameters.target_component).toBe(5);
    });
  });
});
