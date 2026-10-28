"""统一配方生成引擎 — 融合自回归生成 + 预测-判别 + RL调优 + 中医后处理

生成流程：
1. 信号编码：用户需求 → 信号向量
2. 模板选择：选择经典方剂模板
3. 自回归生成：LSTM 逐个成分生成
4. 预测评分：预测器实时评分
5. 新颖性检查：判别器检查新颖性
6. 选择优选：选择器优选 Top-K
7. 安全合规：安全检查
8. 结构构建：君臣佐使结构
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class GenerationResult:
    """生成结果"""
    summary: str
    details: str
    data: List[Dict]
    scores: Dict[str, float]
    template_used: Optional[str]
    strategy: str
    execution_time_ms: float


class UnifiedFormulaEngine:
    """
    统一配方生成引擎

    集成所有 AI 模型组件，提供端到端配方生成能力：
    - 信号编码器
    - 自回归生成器
    - 预测器
    - 判别器
    - 模板子系统
    - RL 调优器
    - 配方选择器

    与现有 FormulaDesigner 兼容：可替换内部实现，保持外部接口不变。
    """

    def __init__(
        self,
        herb_db: Optional[Dict[str, dict]] = None,
        herb_vocab: Optional[List[str]] = None,
        use_gpu: bool = False,
    ):
        self.herb_db = herb_db or {}
        self.herb_vocab = herb_vocab or []

        # 组件初始化（惰性加载）
        self._signal_encoder = None
        self._generator = None
        self._predictor = None
        self._discriminator = None
        self._template_subsystem = None
        self._rl_tuner = None
        self._selector = None

        self._initialized = False
        self._use_gpu = use_gpu

    def _ensure_initialized(self) -> None:
        """延迟初始化所有组件"""
        if self._initialized:
            return

        try:
            from .formula_discriminator import get_formula_discriminator
            from .formula_predictor import get_formula_predictor
            from .formula_selector import get_formula_selector

            # ★ 关键修复：优先使用真正的 PyTorch LSTM 生成器
            from .pytorch_generator import PyTorchFormulaGenerator
            from .rl_tuner import get_rl_tuner
            from .signal_encoder import get_signal_encoder
            from .template_subsystem import get_template_subsystem

            self._signal_encoder = get_signal_encoder()
            # 使用真正的 PyTorch LSTM 生成器（而非启发式版本）。
            # 注意：这里创建引擎专属的生成器实例，而不是使用全局单例
            # get_pytorch_generator() —— 全局单例可能已被其他调用方以不同的
            # input_dim/n_herbs 创建（例如测试 test_get_pytorch_generator 以
            # input_dim=40 创建），导致信号向量维度与 input_proj 不匹配。
            self._generator = PyTorchFormulaGenerator(
                n_herbs=max(len(self.herb_vocab), 1),
                input_dim=self._signal_encoder.output_dim,
                device="cpu",
            )
            self._predictor = get_formula_predictor(herb_db=self.herb_db)
            self._discriminator = get_formula_discriminator()
            self._template_subsystem = get_template_subsystem()
            # 将生成器引用传入 RL 调优器，使其能执行梯度回传
            self._rl_tuner = get_rl_tuner(generator=self._generator)
            self._selector = get_formula_selector()

            self._initialized = True
            logger.info("[UnifiedEngine] 组件初始化完成 (PyTorch LSTM Generator)")
        except ImportError as e:
            logger.warning(f"[UnifiedEngine] PyTorch 组件导入失败，降级到启发式: {e}")
            self._fallback_to_heuristic()
            self._initialized = True

    def _fallback_to_heuristic(self):
        """降级到启发式生成器（当 PyTorch 不可用时）"""
        from .autoregressive_generator import get_autoregressive_generator
        from .formula_discriminator import get_formula_discriminator
        from .formula_predictor import get_formula_predictor
        from .formula_selector import get_formula_selector
        from .rl_tuner import get_rl_tuner
        from .signal_encoder import get_signal_encoder
        from .template_subsystem import get_template_subsystem

        self._signal_encoder = get_signal_encoder()
        self._generator = get_autoregressive_generator(herb_vocab=self.herb_vocab)
        self._predictor = get_formula_predictor(herb_db=self.herb_db)
        self._discriminator = get_formula_discriminator()
        self._template_subsystem = get_template_subsystem()
        self._rl_tuner = get_rl_tuner()
        self._selector = get_formula_selector()
        logger.info("[UnifiedEngine] 已降级到启发式生成器")

    def _generate_candidate(
        self,
        signal: "EncodedSignal",
        template: Any,
        constraints: Optional[Dict],
    ) -> Optional[Dict[str, float]]:
        """调用底层生成器生成一个候选配方。

        PyTorchFormulaGenerator.generate() 的真实签名为
        ``generate(signal, herb_vocab, config=None)``，不支持 min_herbs/max_herbs/
        exclude_herbs/template_prefix 关键字参数；启发式生成器（AutoregressiveGenerator）
        则支持这些参数。这里按生成器类型分别适配，保证两种生成器都能正常工作。
        """
        exclude_herbs = constraints.get("exclude_herbs", []) if constraints else []
        exclude_set = set(exclude_herbs)

        if type(self._generator).__name__ == "PyTorchFormulaGenerator":
            import torch

            from .pytorch_generator import GenerationConfig

            config = GenerationConfig(
                max_seq_len=12,
                min_seq_len=3,
                device=self._generator.device,
            )
            signal_tensor = torch.tensor(
                signal.raw_vector,
                dtype=torch.float32,
                device=self._generator.device,
            ).unsqueeze(0)
            formulas = self._generator.generate(
                signal=signal_tensor,
                herb_vocab=self.herb_vocab,
                config=config,
            )
            formula = formulas[0] if formulas else {}
        else:
            formula = self._generator.generate(
                signal=signal.raw_vector,
                herb_vocab=self.herb_vocab,
                min_herbs=3,
                max_herbs=12,
                exclude_herbs=exclude_herbs,
                template_prefix=template.base_sequence if template else None,
            )

        if not formula:
            return None

        # PyTorch 生成器不支持 exclude_herbs，统一在引擎层过滤，保证约束语义一致
        if exclude_set:
            formula = {k: v for k, v in formula.items() if k not in exclude_set}
        return formula or None

    async def generate(
        self,
        target_effects: List[str],
        constraints: Optional[Dict] = None,
        template_preference: Optional[str] = None,
        n_candidates: int = 10,
        select_top_k: int = 3,
        use_rl_tuning: bool = False,
    ) -> GenerationResult:
        """
        统一生成入口

        Args:
            target_effects: 目标功效列表
            constraints: 约束条件（成本上限、人群等）
            template_preference: 偏好模板名称
            n_candidates: 生成候选数
            select_top_k: 最终选择数
            use_rl_tuning: 是否启用 RL 调优

        Returns:
            GenerationResult
        """
        start_time = time.perf_counter()
        self._ensure_initialized()

        try:
            # Step 1: 信号编码
            signal = self._signal_encoder.encode(
                target_effects=target_effects,
                product_category=constraints.get("product_category") if constraints else None,
                target_group=constraints.get("target_group", "adult") if constraints else "adult",
                continuous_constraints={
                    "max_cost": constraints.get("max_cost", 50.0) if constraints else 50.0,
                    "min_efficacy": constraints.get("min_efficacy", 0.5) if constraints else 0.5,
                } if constraints else None,
            )

            # Step 2: 模板选择
            template = self._template_subsystem.select_template(
                target_effects=target_effects,
                preference=template_preference,
            )
            template_name = template.name if template else None
            logger.info(f"[UnifiedEngine] 选择模板: {template_name or '无'}")

            # Step 3: 自回归生成（多轮采样）
            # P0-2 修复：PyTorch LSTM 推理是纯同步 CPU 操作，直接循环会阻塞事件循环
            # 约 52 秒（实测）。整体放入 asyncio.to_thread，避免阻塞其它请求。
            def _generate_all() -> List[Dict]:
                results: List[Dict] = []
                for _ in range(n_candidates):
                    formula = self._generate_candidate(signal, template, constraints)
                    if formula:
                        results.append(formula)
                return results

            generated_formulas = await asyncio.to_thread(_generate_all)

            if not generated_formulas:
                return GenerationResult(
                    summary="未生成有效配方",
                    details="生成器未返回任何配方",
                    data=[],
                    scores={},
                    template_used=template_name,
                    strategy="unified_engine",
                    execution_time_ms=(time.perf_counter() - start_time) * 1000,
                )

            # Step 4: 预测器评分（同步 CPU 推理，同样放入线程池）
            def _score_all() -> List[Dict]:
                scored: List[Dict] = []
                for formula in generated_formulas:
                    pred = self._predictor.predict(formula, target_effects)
                    scored.append({
                        **formula,
                        "efficacy_score": pred.efficacy,
                        "safety_score": pred.safety,
                        "taste_score": pred.taste,
                        "cost_score": pred.cost_score,
                        "synergy_score": pred.synergy,
                        "stability_score": pred.stability,
                        "overall_score": pred.overall,
                    })
                return scored

            scored_formulas = await asyncio.to_thread(_score_all)

            # Step 5: 判别器新颖性检查
            for f in scored_formulas:
                disc = self._discriminator.discriminate(f)
                f["novelty_score"] = disc.novelty_score
                f["is_generated_prob"] = disc.is_generated

            # Step 7: RL 调优（可选）— 修复：传入生成器引用
            if use_rl_tuning and self._rl_tuner:
                for f in scored_formulas[:5]:
                    pred_result = next(
                        (sf for sf in scored_formulas if sf.get("efficacy_score") is not None),
                        None
                    )
                    if pred_result:
                        from dataclasses import dataclass
                        @dataclass
                        class PredCls:
                            efficacy: float
                            safety: float
                            taste: float
                        pred_cls = PredCls(
                            efficacy=pred_result.get('efficacy_score', 0),
                            safety=pred_result.get('safety_score', 0),
                            taste=pred_result.get('taste_score', 0),
                        )
                        # 更新生成器的 log_probs 供 RL 使用
                        if hasattr(self._generator, '_current_log_probs'):
                            self._generator._current_log_probs = None
                        self._rl_tuner.train_step(
                            formula=f, predictor_result=pred_cls
                        )

            # Step 7: 选择器优选
            selected = self._selector.select(
                scored_formulas,
                target_effects=target_effects,
                constraints=constraints,
                top_k=select_top_k,
            )

            # Step 8: 安全合规检查
            safe_candidates = await self._safety_check(selected, constraints)

            # Step 9: 君臣佐使结构构建
            final_data = self._build_tcm_structure(safe_candidates, target_effects)

            elapsed = (time.perf_counter() - start_time) * 1000
            logger.info(
                f"[UnifiedEngine] 生成完成: {len(final_data)} 味药材, "
                f"评分={safe_candidates[0].get('overall_score', 0):.3f}, "
                f"耗时={elapsed:.1f}ms"
            )

            return GenerationResult(
                summary=f"已通过自回归生成 {len(final_data)} 味药材配方方案",
                details=f"综合评分: {safe_candidates[0].get('overall_score', 0):.3f}",
                data=final_data,
                scores={
                    "overall_score": safe_candidates[0].get("overall_score", 0),
                    "efficacy_score": safe_candidates[0].get("efficacy_score", 0),
                    "safety_score": safe_candidates[0].get("safety_score", 0),
                    "taste_score": safe_candidates[0].get("taste_score", 0),
                    "novelty_score": safe_candidates[0].get("novelty_score", 0),
                },
                template_used=template_name,
                strategy="unified_engine",
                execution_time_ms=elapsed,
            )

        except Exception as e:
            logger.error(f"[UnifiedEngine] 生成失败: {e}", exc_info=True)
            return GenerationResult(
                summary=f"生成失败: {str(e)[:50]}",
                details="",
                data=[],
                scores={},
                template_used=None,
                strategy="unified_engine_error",
                execution_time_ms=(time.perf_counter() - start_time) * 1000,
            )

    async def _safety_check(
        self,
        candidates: List[Dict],
        constraints: Optional[Dict],
    ) -> List[Dict]:
        """安全合规检查：十八反/十九畏配伍禁忌 + 剂量上限。

        修复 P1-2：原实现为 TODO 空操作，v2 生成的配方不经过任何安全校验。
        现在：
        - 对每个候选，先按 herb_db 的 dosage_max 做剂量上限裁剪（超限则裁剪到上限并告警）；
        - 再检查十八反/十九畏配伍禁忌（基于中文名配对），命中禁忌的候选直接丢弃；
        - 返回通过安全校验的候选列表。
        """
        if not candidates:
            return candidates

        try:
            from ...ai_models.safety_checker import (
                _EIGHTEEN_CONTRAINDICATIONS,
                _NINETEEN_ANTAGONISMS,
            )
            forbidden_pairs = _EIGHTEEN_CONTRAINDICATIONS | _NINETEEN_ANTAGONISMS
        except Exception as e:
            logger.warning(f"[UnifiedEngine] 加载配伍禁忌规则失败，跳过安全校验: {e}")
            return candidates

        # herb_id -> 中文名映射（herb_db 的键是 herb_id，值含 name_cn）
        id_to_name_cn: Dict[str, str] = {}
        for hid, info in self.herb_db.items():
            if isinstance(info, dict):
                id_to_name_cn[hid] = info.get("name_cn", hid) or hid
            else:
                id_to_name_cn[hid] = getattr(info, "name_cn", hid) or hid

        safe_candidates: List[Dict] = []
        for cand in candidates:
            # 只取 herb_db 中存在的药材键（过滤评分等附加键）
            herb_items = {k: v for k, v in cand.items() if k in self.herb_db}
            if not herb_items:
                continue

            # 1) 剂量上限校验（超限裁剪到 dosage_max）
            clipped: Dict[str, float] = {}
            dosage_issues: List[str] = []
            for hid, dosage_raw in herb_items.items():
                try:
                    dosage = float(dosage_raw)
                except (TypeError, ValueError):
                    continue
                info = self.herb_db.get(hid, {})
                dosage_max = 30.0
                if isinstance(info, dict):
                    dosage_max = float(info.get("dosage_max", 30.0) or 30.0)
                else:
                    dosage_max = float(getattr(info, "dosage_max", 30.0) or 30.0)
                if dosage > dosage_max:
                    dosage_issues.append(
                        f"{id_to_name_cn.get(hid, hid)} 剂量 {dosage}g 超过上限 {dosage_max}g，已裁剪"
                    )
                    dosage = dosage_max
                clipped[hid] = dosage

            # 2) 十八反/十九畏配伍禁忌检查
            names_cn = [id_to_name_cn.get(hid, hid) for hid in clipped]
            forbidden_hit = None
            for i in range(len(names_cn)):
                for j in range(i + 1, len(names_cn)):
                    pair = (names_cn[i], names_cn[j])
                    if pair in forbidden_pairs or (pair[1], pair[0]) in forbidden_pairs:
                        forbidden_hit = f"{pair[0]} + {pair[1]}"
                        break
                if forbidden_hit:
                    break

            if forbidden_hit:
                logger.warning(
                    f"[UnifiedEngine] 候选命中配伍禁忌被丢弃: {forbidden_hit}"
                )
                continue

            if dosage_issues:
                logger.warning(f"[UnifiedEngine] 候选剂量超限已裁剪: {dosage_issues}")

            safe_candidates.append({**cand, **clipped})

        return safe_candidates

    def _build_tcm_structure(
        self, candidates: List[Dict], target_effects: List[str]
    ) -> List[Dict]:
        """君臣佐使结构构建（药材名映射为中文名 name_cn）"""
        if not candidates:
            return []

        # herb_id -> 中文名映射
        id_to_name_cn: Dict[str, str] = {}
        for hid, info in self.herb_db.items():
            if isinstance(info, dict):
                id_to_name_cn[hid] = info.get("name_cn", hid) or hid
            else:
                id_to_name_cn[hid] = getattr(info, "name_cn", hid) or hid

        # 按综合评分排序
        sorted_candidates = sorted(
            candidates,
            key=lambda c: c.get("overall_score", 0),
            reverse=True,
        )

        best = sorted_candidates[0]
        herbs = {k: v for k, v in best.items() if k not in (
            "efficacy_score", "safety_score", "taste_score",
            "cost_score", "synergy_score", "stability_score",
            "overall_score", "novelty_score", "is_generated_prob",
        )}

        # 按用量降序分配角色
        sorted_herbs = sorted(herbs.items(), key=lambda x: -x[1])
        roles = ["君", "臣", "臣", "佐", "佐", "使"]

        formula_data = []
        for i, (name, dosage) in enumerate(sorted_herbs[:6]):
            role = roles[i] if i < len(roles) else "佐"
            formula_data.append({
                "role": role,
                "name": id_to_name_cn.get(name, name),  # 中文名
                "dosage": f"{dosage}g",
                "purpose": target_effects[0] if target_effects else "综合调理",
                "score": best.get("overall_score", 0),
            })

        return formula_data


# 全局单例
_engine: Optional[UnifiedFormulaEngine] = None


def get_unified_formula_engine(
    herb_db: Optional[Dict[str, dict]] = None,
    herb_vocab: Optional[List[str]] = None,
) -> UnifiedFormulaEngine:
    global _engine
    if _engine is None:
        _engine = UnifiedFormulaEngine(herb_db=herb_db, herb_vocab=herb_vocab)
    return _engine
