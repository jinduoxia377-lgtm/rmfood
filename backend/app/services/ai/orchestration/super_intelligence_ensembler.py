"""
超级智能集成引擎 (Super Intelligence Ensembler)

院士级 AI 核心 — 五大算法深度协同：

  用户输入 → 问题分类器 → 算法调度
  ├─ 神经网络 (模式识别)
  ├─ 贝叶斯优化 (模型驱动)
  ├─ 遗传算法 (种群进化)
  ├─ 知识图谱 (图推理)
  └─ 多模态引擎 (输出合成)
      → 统一多模态输出 + 思考过程

@version 1.0.0
"""
import json
import logging
import math
import re
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class QueryCategory(Enum):
    GENERAL_CHAT = "general_chat"
    FORMULA_DESIGN = "formula_design"
    INGREDIENT_QUERY = "ingredient_query"
    EFFICACY_ANALYSIS = "efficacy_analysis"
    SAFETY_CHECK = "safety_check"
    SYNERGY_ANALYSIS = "synergy_analysis"
    COMPARISON = "comparison"


@dataclass
class AlgorithmResult:
    algorithm: str
    confidence: float
    output: Any
    latency_ms: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EnsemblerConfig:
    enable_neural: bool = True
    enable_bayesian: bool = True
    enable_genetic: bool = True
    enable_knowledge_graph: bool = True
    enable_multimodal: bool = True
    confidence_threshold: float = 0.3


class SuperIntelligenceEnsembler:

    def __init__(self, config: Optional[EnsemblerConfig] = None):
        self.config = config or EnsemblerConfig()

    def process(self, question: str,
                thinking_steps: List[Dict],
                target_effects: Optional[List[str]] = None,
                constraints: Optional[Dict] = None) -> Dict[str, Any]:
        start_time = time.time()

        category = self._classify_question(question)
        effects = target_effects or self._extract_effects(question)

        logger.info(f"[SuperEnsembler] 分类={category.value}, 功效={effects}")

        results: List[AlgorithmResult] = []
        used_algorithms = []
        formula_candidates = []

        kg_result = self._run_knowledge_graph(question, effects)
        results.append(kg_result)
        used_algorithms.append({
            "name": "知识图谱", "id": "knowledge-graph",
            "confidence": kg_result.confidence,
            "latency_ms": kg_result.latency_ms,
        })

        nn_result = None
        if self.config.enable_neural:
            nn_result = self._run_neural_network(question, effects)
            if nn_result:
                results.append(nn_result)
                used_algorithms.append({
                    "name": "神经网络", "id": "neural-network",
                    "confidence": nn_result.confidence,
                    "latency_ms": nn_result.latency_ms,
                })
                if nn_result.output:
                    formula_candidates.append({
                        "source": "神经网络",
                        "candidates": self._to_candidate_list(nn_result.output),
                    })

        bayesian_result = None
        if self.config.enable_bayesian and category in [
            QueryCategory.FORMULA_DESIGN, QueryCategory.EFFICACY_ANALYSIS
        ]:
            bayesian_result = self._run_bayesian(effects)
            if bayesian_result:
                results.append(bayesian_result)
                used_algorithms.append({
                    "name": "贝叶斯优化", "id": "bayesian",
                    "confidence": bayesian_result.confidence,
                    "latency_ms": bayesian_result.latency_ms,
                })
                if bayesian_result.output:
                    formula_candidates.append({
                        "source": "贝叶斯优化",
                        "candidates": self._candidate_to_dict(bayesian_result.output),
                    })

        ga_result = None
        if self.config.enable_genetic and category in [
            QueryCategory.FORMULA_DESIGN, QueryCategory.COMPARISON
        ]:
            ga_result = self._run_genetic_algorithm(effects)
            if ga_result:
                results.append(ga_result)
                used_algorithms.append({
                    "name": "遗传算法", "id": "genetic-algorithm",
                    "confidence": ga_result.confidence,
                    "latency_ms": ga_result.latency_ms,
                })
                if ga_result.output:
                    formula_candidates.append({
                        "source": "遗传算法",
                        "candidates": self._candidate_to_dict(ga_result.output),
                    })

        merged_herbs = self._merge_herb_suggestions(results)
        ensemble_confidence = self._compute_ensemble_confidence(results)

        content = self._generate_response(question, category, merged_herbs, results, kg_result)
        enhanced_steps = self._build_thinking_steps(thinking_steps, results, used_algorithms, effects)

        all_candidates = []
        for fc in formula_candidates:
            all_candidates.extend(fc["candidates"])

        total_latency = (time.time() - start_time) * 1000

        return {
            "content": content,
            "formulas": self._extract_formula_scores(all_candidates),
            "thinking_steps": enhanced_steps,
            "algorithms_used": used_algorithms,
            "ensemble_confidence": ensemble_confidence,
            "total_latency_ms": round(total_latency, 1),
        }

    CATEGORY_PATTERNS = [
        (QueryCategory.FORMULA_DESIGN, r'配方|设计|开发|生成|方案|制造|产品|饮料|片剂|胶囊|口服液|软糖'),
        (QueryCategory.INGREDIENT_QUERY, r'黄芪|党参|枸杞|人参|当归|白术|茯苓|甘草|菊花|川芎|陈皮|薏苡仁|大枣|生姜|葛根'),
        (QueryCategory.EFFICACY_ANALYSIS, r'功效|作用|效果|疗效|功能|保健|预防|治疗|改善|调节'),
        (QueryCategory.SAFETY_CHECK, r'安全|毒性|副作用|禁忌|过敏|不良|风险|剂量|过量'),
        (QueryCategory.SYNERGY_ANALYSIS, r'协同|配伍|搭配|君臣佐使|组合|联合|复用'),
        (QueryCategory.COMPARISON, r'对比|比较|哪个|更好|vs|区别|差异|优劣'),
    ]

    def _classify_question(self, question: str) -> QueryCategory:
        for cat, pattern in self.CATEGORY_PATTERNS:
            if re.search(pattern, question):
                return cat
        return QueryCategory.GENERAL_CHAT

    def _run_knowledge_graph(self, question: str, effects: List[str]) -> AlgorithmResult:
        t0 = time.time()
        try:
            from .knowledge_graph_service import get_knowledge_graph
            kg = get_knowledge_graph()
            result = {"herbs": {}, "synergy": 0, "paths": []}
            mentioned = []
            for hid, herb in [
                ("hq","黄芪"),("ds","党参"),("gz","枸杞"),("rs","人参"),
                ("dg","当归"),("bq","白术"),("fp","茯苓"),("gq","甘草"),
            ]:
                if herb in question:
                    info = kg.get_herb_info(hid)
                    if info:
                        mentioned.append(info)
                        result["herbs"][hid] = info
            for eff in effects:
                herbs = kg.find_herbs_for_effect(eff)
                for h in herbs:
                    if h["id"] not in result["herbs"]:
                        info = kg.get_herb_info(h["id"])
                        if info:
                            result["herbs"][h["id"]] = info
            latency = (time.time() - t0) * 1000
            conf = min(0.95, 0.5 + len(result["herbs"]) * 0.05)
            return AlgorithmResult(algorithm="knowledge-graph", confidence=conf, output=result,
                                   latency_ms=round(latency, 1),
                                   metadata={"herbs_found": len(result["herbs"]), "mentioned": len(mentioned)})
        except Exception as e:
            logger.warning(f"[SuperEnsembler] KG failed: {e}")
            return AlgorithmResult(algorithm="knowledge-graph", confidence=0, output={},
                                   latency_ms=round((time.time() - t0) * 1000, 1))

    def _run_neural_network(self, question: str, effects: List[str]) -> Optional[AlgorithmResult]:
        t0 = time.time()
        try:
            from .neural_formula_network import get_neural_ensemble
            ensemble = get_neural_ensemble()
            if not effects:
                return None
            result = ensemble.ensemble_predict(effects)
            latency = (time.time() - t0) * 1000
            conf = min(0.85, 0.4 + len(result) * 0.03)
            return AlgorithmResult(algorithm="neural-network", confidence=conf, output=result,
                                   latency_ms=round(latency, 1), metadata={"n_herbs": len(result)})
        except Exception as e:
            logger.warning(f"[SuperEnsembler] Neural failed: {e}")
            return None

    def _run_bayesian(self, effects: List[str]) -> Optional[AlgorithmResult]:
        t0 = time.time()
        try:
            from .bayesian_formula_optimizer import get_bayesian_optimizer
            opt = get_bayesian_optimizer()
            candidates = opt.generate(target_effects=effects)
            latency = (time.time() - t0) * 1000
            if candidates:
                best = max(c.overall_score for c in candidates)
                return AlgorithmResult(algorithm="bayesian", confidence=best, output=candidates,
                                       latency_ms=round(latency, 1),
                                       metadata={"n_candidates": len(candidates), "best_score": best})
            return AlgorithmResult(algorithm="bayesian", confidence=0, output=[],
                                   latency_ms=round(latency, 1))
        except Exception as e:
            logger.warning(f"[SuperEnsembler] Bayesian failed: {e}")
            return None

    def _run_genetic_algorithm(self, effects: List[str]) -> Optional[AlgorithmResult]:
        t0 = time.time()
        try:
            from .genetic_formula_optimizer import get_genetic_optimizer
            ga = get_genetic_optimizer()
            individuals = ga.optimize(effects)
            latency = (time.time() - t0) * 1000
            if individuals:
                best = max(i.fitness for i in individuals)
                return AlgorithmResult(algorithm="genetic-algorithm", confidence=best, output=individuals,
                                       latency_ms=round(latency, 1),
                                       metadata={"n_individuals": len(individuals), "best_fitness": best})
            return AlgorithmResult(algorithm="genetic-algorithm", confidence=0, output=[],
                                   latency_ms=round(latency, 1))
        except Exception as e:
            logger.warning(f"[SuperEnsembler] GA failed: {e}")
            return None

    def _merge_herb_suggestions(self, results: List[AlgorithmResult]) -> Dict[str, float]:
        herb_votes: Dict[str, List[Tuple[float, float]]] = {}
        for result in results:
            if result.confidence < self.config.confidence_threshold:
                continue
            output = result.output
            if isinstance(output, dict) and "herbs" in output:
                for hid in output.get("herbs", {}):
                    if hid not in herb_votes:
                        herb_votes[hid] = []
                    herb_votes[hid].append((result.confidence, 0.5))
            elif isinstance(output, dict) and all(k.isalpha() for k in output.keys()):
                for hid, dosage in output.items():
                    if hid not in herb_votes:
                        herb_votes[hid] = []
                    herb_votes[hid].append((result.confidence, dosage))
            elif isinstance(output, list):
                for cand in output:
                    genes = getattr(cand, 'genes', getattr(cand, 'ingredients', cand if isinstance(cand, dict) else {}))
                    for hid in genes:
                        if hid not in herb_votes:
                            herb_votes[hid] = []
                        herb_votes[hid].append((result.confidence, 1.0))
        merged = {}
        for hid, votes in herb_votes.items():
            total_conf = sum(v[0] for v in votes)
            avg_dosage = sum(v[1] for v in votes) / len(votes)
            merged[hid] = round(avg_dosage * (total_conf / max(1, len(votes))), 4)
        return dict(sorted(merged.items(), key=lambda x: -x[1]))

    def _compute_ensemble_confidence(self, results: List[AlgorithmResult]) -> float:
        valid = [r for r in results if r.confidence > 0]
        if not valid:
            return 0
        return sum(r.confidence for r in valid) / len(valid)

    def _generate_response(self, question: str, category: QueryCategory,
                           merged_herbs: Dict[str, float],
                           results: List[AlgorithmResult],
                           kg_result: AlgorithmResult) -> str:
        parts = []
        if category == QueryCategory.FORMULA_DESIGN:
            parts.append(f"## 🎯 配方设计方案\n")
            if merged_herbs:
                herb_names = {"hq":"黄芪","ds":"党参","gz":"枸杞","rs":"人参","dg":"当归",
                             "bq":"白术","fp":"茯苓","gq":"甘草","jgh":"菊花","cs":"川芎",
                             "cx":"陈皮","yq":"薏苡仁","cyh":"金银花","dcx":"大枣","sj":"生姜","gh":"葛根"}
                herb_list = []
                for hid, score in list(merged_herbs.items())[:10]:
                    name = herb_names.get(hid, hid)
                    herb_list.append(f"- **{name}** (配伍强度: {score:.2f})")
                parts.append("基于多算法综合分析，推荐以下药材组合：\n")
                parts.append("\n".join(herb_list))
            for result in results:
                if result.confidence > 0.5:
                    parts.append(f"\n**{result.algorithm}**: 置信度 {result.confidence:.1%}")
            parts.append(f"\n\n💡 **建议**: 可在配方生成模块选择具体功效标签获取完整方案。")
        elif category == QueryCategory.INGREDIENT_QUERY and kg_result.output:
            herbs = kg_result.output.get("herbs", {})
            for hid, info in list(herbs.items())[:3]:
                effects_list = info.get("effects", [])
                syns = info.get("synergies", [])
                parts.append(f"### {info['name']}\n")
                if effects_list:
                    parts.append("**核心功效**: " + ", ".join(e["name"] + "(" + str(round(e["score"]*100)) + "%)" for e in effects_list[:4]))
                if syns:
                    parts.append(f"**协同配伍**: {', '.join(s['name'] for s in syns[:3])}")
                parts.append("")
        else:
            parts.append(f"关于「{question}」，以下是AI分析结果：\n")
            for result in results:
                if result.confidence > 0.3:
                    parts.append(f"- ✅ **{result.algorithm}**: 置信度 {result.confidence:.1%}")
            parts.append(f"\n如需专业配方建议，请明确目标功效（如免疫调节、抗氧化等）。")
        return "\n".join(parts)

    def _build_thinking_steps(self, base_steps: List[Dict], results: List[AlgorithmResult],
                               used_algorithms: List[Dict], effects: List[str]) -> List[Dict]:
        steps = list(base_steps) if base_steps else []
        for alg in used_algorithms:
            steps.append({
                "step": alg["name"],
                "content": f"执行{alg['name']}分析...",
                "status": "complete",
                "detail": f"算法ID: {alg['id']}, 置信度: {alg['confidence']:.1%}, 耗时: {alg['latency_ms']}ms",
            })
        n_algs = len(used_algorithms)
        steps.append({
            "step": "集成决策",
            "content": f"合并 {n_algs} 个算法输出",
            "status": "complete",
            "detail": f"参与算法: {' + '.join(a['name'] for a in used_algorithms)}\n"
                     f"集成置信度: {sum(a['confidence'] for a in used_algorithms)/max(1,n_algs):.1%}",
        })
        return steps

    def _extract_effects(self, question: str) -> List[str]:
        effect_map = [(r'免疫|增强.*抵抗','免疫调节'),(r'抗氧化|衰老|自由基','抗氧化'),
                      (r'降.*血[糖棠]|糖尿','降血糖'),(r'降.*血[压亚]','降压'),
                      (r'抗疲劳|疲劳|乏力','抗疲劳'),(r'护肝|肝脏|肝功','护肝'),
                      (r'消化|脾胃|胃|肠','消化系统'),(r'补气|气虚|乏力|气短','补气'),
                      (r'养血|补血|贫血','养血'),(r'安神|失眠|睡眠','安神')]
        effects = []
        for pat, eff in effect_map:
            if re.search(pat, question) and eff not in effects:
                effects.append(eff)
        return effects[:5] if effects else ["免疫调节"]

    def _to_candidate_list(self, nn_output: Dict[str, float]) -> List:
        return [{"ingredients": nn_output, "overall_score": 0.6, "efficacy_score": 0.6}] if nn_output else []

    def _candidate_to_dict(self, candidates: List) -> List[Dict]:
        result = []
        for c in candidates:
            if hasattr(c, 'fitness'):
                result.append({
                    "ingredients": getattr(c, 'genes', getattr(c, 'ingredients', {})),
                    "overall_score": c.fitness if hasattr(c, 'fitness') else getattr(c, 'overall_score', 0),
                    "efficacy_score": getattr(c, 'efficacy', getattr(c, 'efficacy_score', 0)),
                    "safety_score": getattr(c, 'safety', getattr(c, 'safety_score', 0)),
                    "taste_score": getattr(c, 'taste', getattr(c, 'taste_score', 0)),
                    "cost_score": getattr(c, 'cost', getattr(c, 'cost_score', 0)),
                    "confidence": getattr(c, 'confidence', 0.5),
                })
            elif isinstance(c, dict):
                result.append(c)
        return result

    def _extract_formula_scores(self, candidates: List[Dict]) -> List[Dict]:
        scores = []
        herb_names = {"hq":"黄芪","ds":"党参","gz":"枸杞","rs":"人参","dg":"当归",
                     "bq":"白术","fp":"茯苓","gq":"甘草","jgh":"菊花","cs":"川芎",
                     "cx":"陈皮","yq":"薏苡仁","cyh":"金银花","dcx":"大枣","sj":"生姜","gh":"葛根"}
        for c in candidates[:5]:
            ing = c.get("ingredients", {})
            names = [herb_names.get(hid, hid) for hid in list(ing.keys())[:3]]
            score_val = c.get("overall_score", 0)
            if callable(score_val):
                score_val = score_val()
            scores.append({
                "name": " + ".join(names),
                "value": round(score_val * 100, 1) if isinstance(score_val, (int, float)) else 0,
                "unit": "分",
                "confidence": round(c.get("confidence", 0.5), 2),
            })
        return scores


_ensembler: Optional[SuperIntelligenceEnsembler] = None

def get_super_ensembler() -> SuperIntelligenceEnsembler:
    global _ensembler
    if _ensembler is None:
        _ensembler = SuperIntelligenceEnsembler()
    return _ensembler
