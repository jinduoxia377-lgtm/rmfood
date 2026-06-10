"""
合成配方数据生成模块
实现专利权利要求 G4：合成配方数据生成
"""
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import random
import math
import json


@dataclass
class Formula:
    """配方数据结构"""
    id: str
    name: str
    ingredients: Dict[str, float]
    effects: List[str]
    dosage: float
    properties: Dict[str, float] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "ingredients": self.ingredients,
            "effects": self.effects,
            "dosage": self.dosage,
            "properties": self.properties or {}
        }

    @staticmethod
    def from_dict(data: dict) -> "Formula":
        return Formula(
            id=data.get("id", ""),
            name=data.get("name", ""),
            ingredients=data.get("ingredients", {}),
            effects=data.get("effects", []),
            dosage=data.get("dosage", 0.0),
            properties=data.get("properties", {})
        )


class SyntheticFormulaGenerator:
    """合成配方生成器"""

    def __init__(
        self,
        interpolation_weight: float = 0.5,
        perturbation_scale: float = 0.1,
        quality_threshold: float = 0.7
    ):
        self.interpolation_weight = interpolation_weight
        self.perturbation_scale = perturbation_scale
        self.quality_threshold = quality_threshold

    def generate_synthetic_formulas(
        self,
        base_formulas: List[dict],
        n_samples: int = 100
    ) -> List[dict]:
        """生成合成配方数据"""
        if len(base_formulas) < 2:
            raise ValueError("需要至少2个基础配方进行插值")

        synthetic_formulas = []
        formulas = [Formula.from_dict(f) for f in base_formulas]

        for i in range(n_samples):
            idx1, idx2 = random.sample(range(len(formulas)), 2)
            alpha = random.random()

            if random.random() < 0.7:
                synthetic = self.interpolate_formulas(
                    formulas[idx1].to_dict(),
                    formulas[idx2].to_dict(),
                    alpha
                )
            else:
                synthetic = self.perturb_formula(
                    formulas[idx1].to_dict(),
                    self.perturbation_scale
                )

            quality = self.assess_quality(synthetic)
            if quality >= self.quality_threshold:
                synthetic["quality_score"] = quality
                synthetic["generation_method"] = "interpolation" if alpha else "perturbation"
                synthetic_formulas.append(synthetic)

        return synthetic_formulas

    def interpolate_formulas(
        self,
        formula1: dict,
        formula2: dict,
        alpha: float = 0.5
    ) -> dict:
        """在两个配方之间进行插值"""
        interpolated = {
            "id": f"synthetic_{random.randint(10000, 99999)}",
            "name": f"Synthetic_{alpha:.2f}",
            "ingredients": {},
            "effects": [],
            "dosage": 0.0,
            "properties": {}
        }

        all_ingredients = set(formula1.get("ingredients", {}).keys())
        all_ingredients.update(formula2.get("ingredients", {}).keys())

        for ing in all_ingredients:
            dose1 = formula1.get("ingredients", {}).get(ing, 0.0)
            dose2 = formula2.get("ingredients", {}).get(ing, 0.0)
            interpolated["ingredients"][ing] = dose1 + alpha * (dose2 - dose1)

        interpolated["effects"] = list(set(formula1.get("effects", [])) | set(formula2.get("effects", [])))

        dose1 = formula1.get("dosage", 0)
        dose2 = formula2.get("dosage", 0)
        interpolated["dosage"] = dose1 + alpha * (dose2 - dose1)

        props1 = formula1.get("properties", {})
        props2 = formula2.get("properties", {})
        all_props = set(props1.keys()) | set(props2.keys())
        for prop in all_props:
            val1 = props1.get(prop, 0.0)
            val2 = props2.get(prop, 0.0)
            interpolated["properties"][prop] = val1 + alpha * (val2 - val1)

        return interpolated

    def slerp_interpolate(
        self,
        vec1: List[float],
        vec2: List[float],
        alpha: float
    ) -> List[float]:
        """球面线性插值（SLERP）"""
        theta = math.acos(sum(a * b for a, b in zip(vec1, vec2)) /
                         (math.sqrt(sum(a * a for a in vec1)) * math.sqrt(sum(b * b for b in vec2)) + 1e-8))

        if theta < 1e-6:
            return [a + alpha * (b - a) for a, b in zip(vec1, vec2)]

        sin_theta = math.sin(theta)
        w1 = math.sin((1 - alpha) * theta) / sin_theta
        w2 = math.sin(alpha * theta) / sin_theta

        return [w1 * a + w2 * b for a, b in zip(vec1, vec2)]

    def perturb_formula(
        self,
        formula: dict,
        scale: float = None
    ) -> dict:
        """对配方进行扰动生成"""
        if scale is None:
            scale = self.perturbation_scale

        perturbed = formula.copy()
        perturbed["id"] = f"perturbed_{random.randint(10000, 99999)}"
        perturbed["name"] = f"Perturbed_{random.randint(100, 999)}"
        perturbed["ingredients"] = {}

        for ing, dose in formula.get("ingredients", {}).items():
            noise = random.gauss(0, scale * dose)
            perturbed["ingredients"][ing] = max(0, dose + noise)

        total_dose = sum(perturbed["ingredients"].values())
        if total_dose > 0:
            for ing in perturbed["ingredients"]:
                perturbed["ingredients"][ing] = (perturbed["ingredients"][ing] / total_dose) * formula.get("dosage", 100)

        return perturbed

    def assess_quality(self, synthetic_formula: dict) -> float:
        """评估合成配方质量"""
        quality = 1.0

        ingredients = synthetic_formula.get("ingredients", {})
        if not ingredients:
            return 0.0

        doses = list(ingredients.values())
        if any(d < 0 for d in doses):
            return 0.0

        dose_variance = sum((d - sum(doses) / len(doses)) ** 2 for d in doses) / len(doses) if doses else 0
        if dose_variance > 1000:
            quality *= 0.7

        if not synthetic_formula.get("effects"):
            quality *= 0.5

        return max(0.0, min(1.0, quality))


class SyntheticDataQualityAssessor:
    """合成数据质量评估器"""

    def __init__(self):
        self.statistical_checks = ["variance", "range", "distribution"]
        self.domain_validation = True

    def compute_diversity_score(self, formulas: List[dict]) -> float:
        """计算配方多样性分数"""
        if not formulas:
            return 0.0

        ingredient_sets = [set(f.get("ingredients", {}).keys()) for f in formulas]
        effect_sets = [set(f.get("effects", [])) for f in formulas]

        unique_ingredients = len(set().union(*ingredient_sets)) if ingredient_sets else 0
        unique_effects = len(set().union(*effect_sets)) if effect_sets else 0

        ingredient_diversity = unique_ingredients / (len(formulas) * 5) if formulas else 0
        effect_diversity = unique_effects / (len(formulas) * 3) if formulas else 0

        return min(1.0, (ingredient_diversity + effect_diversity) / 2)

    def compute_validity_score(self, formula: dict) -> float:
        """计算配方有效性分数"""
        validity = 1.0

        ingredients = formula.get("ingredients", {})
        if not ingredients:
            return 0.0

        doses = list(ingredients.values())
        if any(d < 0 for d in doses):
            return 0.0

        total_dose = sum(doses)
        if total_dose == 0:
            return 0.0

        if total_dose > 1000:
            validity *= 0.8

        if not formula.get("effects"):
            validity *= 0.6

        return validity

    def compute_quality_score(self, formula: dict) -> dict:
        """综合质量评分"""
        return {
            "overall": self.compute_validity_score(formula),
            "diversity": 0.5,
            "statistical": self._compute_statistical_quality(formula),
            "domain": self._compute_domain_quality(formula)
        }

    def _compute_statistical_quality(self, formula: dict) -> float:
        """计算统计质量"""
        doses = list(formula.get("ingredients", {}).values())
        if not doses:
            return 0.0

        mean_dose = sum(doses) / len(doses)
        variance = sum((d - mean_dose) ** 2 for d in doses) / len(doses)
        cv = math.sqrt(variance) / mean_dose if mean_dose > 0 else 0

        if cv < 0.5:
            return 1.0
        elif cv < 1.0:
            return 0.8
        else:
            return 0.5

    def _compute_domain_quality(self, formula: dict) -> float:
        """计算领域质量"""
        quality = 1.0

        effects = formula.get("effects", [])
        if not effects:
            quality *= 0.5

        ingredients = formula.get("ingredients", {})
        if len(ingredients) > 20:
            quality *= 0.8
        elif len(ingredients) < 3:
            quality *= 0.7

        return quality


class SyntheticDataStorage:
    """合成数据存储管理"""

    def __init__(self):
        self.storage_path = "data/synthetic"
        self.batches = {}
        self._ensure_storage_dir()

    def _ensure_storage_dir(self):
        """确保存储目录存在"""
        import os
        os.makedirs(self.storage_path, exist_ok=True)

    def save_synthetic_batch(
        self,
        formulas: List[dict],
        metadata: dict
    ) -> str:
        """保存合成数据批次"""
        batch_id = f"batch_{metadata.get('timestamp', random.randint(10000, 99999))}"

        batch_data = {
            "batch_id": batch_id,
            "metadata": metadata,
            "formulas": formulas,
            "count": len(formulas)
        }

        self.batches[batch_id] = batch_data

        import os
        filepath = os.path.join(self.storage_path, f"{batch_id}.json")
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(batch_data, f, ensure_ascii=False, indent=2)

        return batch_id

    def load_synthetic_batch(self, batch_id: str) -> List[dict]:
        """加载合成数据批次"""
        if batch_id in self.batches:
            return self.batches[batch_id]["formulas"]

        import os
        filepath = os.path.join(self.storage_path, f"{batch_id}.json")
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                batch_data = json.load(f)
                self.batches[batch_id] = batch_data
                return batch_data["formulas"]

        return []

    def get_synthetic_data_stats(self) -> dict:
        """获取合成数据统计"""
        total_formulas = sum(b["count"] for b in self.batches.values())
        return {
            "total_batches": len(self.batches),
            "total_formulas": total_formulas,
            "batches": list(self.batches.keys())
        }


def generate_ingredient_perturbations(
    formula: dict,
    n_variations: int = 5,
    perturbation_type: str = "gaussian"
) -> List[dict]:
    """
    生成成分扰动变体

    Args:
        formula: 原始配方
        n_variations: 变体数量
        perturbation_type: 扰动类型 ("gaussian", "uniform", "random_walk")
    """
    variations = []

    for i in range(n_variations):
        perturbed = formula.copy()
        perturbed["id"] = f"{formula.get('id', 'formula')}_var{i}"
        perturbed["ingredients"] = {}

        scale = 0.1 * formula.get("dosage", 100)

        for ing, dose in formula.get("ingredients", {}).items():
            if perturbation_type == "gaussian":
                noise = random.gauss(0, scale)
            elif perturbation_type == "uniform":
                noise = random.uniform(-scale, scale)
            else:
                noise = random.gauss(0, scale * 0.5)

            perturbed["ingredients"][ing] = max(0, dose + noise)

        variations.append(perturbed)

    return variations


__all__ = [
    "SyntheticFormulaGenerator",
    "SyntheticDataQualityAssessor",
    "SyntheticDataStorage",
    "Formula",
    "generate_ingredient_perturbations"
]
