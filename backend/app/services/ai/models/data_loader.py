"""TCMSP/DFBP 数据加载器

从 TCMSP (Traditional Chinese Medicine Systems Pharmacology) 和 DFBP
( Database for Figures of Basic Pharmacology) 加载药材数据。

支持的数据格式:
1. JSON 文件 (mmid_data.json, herb_data.json)
2. 数据库表 (herb_profiles, herb_efficacy, herb_formulas)
3. CSV 文件

输出格式:
- HerbDataset: 包含药材功效数据、配方序列、信号向量的数据集
"""

from __future__ import annotations

import json
import logging
import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class HerbSample:
    """单个药材样本"""
    herb_id: str
    name_cn: str
    efficacy_scores: Dict[str, float]
    safety_index: float
    cost_per_gram: float
    dosage_min: float
    dosage_max: float
    dosage_step: float
    synergy_partners: List[str] = field(default_factory=list)
    antagonistic_pairs: List[str] = field(default_factory=list)


@dataclass
class FormulaSample:
    """配方序列样本"""
    herb_ids: List[str]           # 药材 ID 序列
    dosages: List[float]          # 对应用量
    target_effects: List[str]     # 目标功效
    signal_vector: List[float]    # 36维信号向量
    stop_sequence: List[int]      # 停止标记序列 (0/1)
    efficacy_labels: List[int]    # 功效标签


@dataclass
class FormulaDataset:
    """配方训练数据集"""

    def __init__(
        self,
        signals: List[List[float]],
        target_herbs: List[List[int]],
        target_dosages: List[List[float]],
        target_stops: List[List[int]],
        herb_vocab: List[str],
    ):
        self.signals = signals
        self.target_herbs = target_herbs
        self.target_dosages = target_dosages
        self.target_stops = target_stops
        self.herb_vocab = herb_vocab

    def __len__(self) -> int:
        return len(self.signals)

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        import torch
        return {
            "signal": torch.tensor(self.signals[idx], dtype=torch.float32),
            "target_herb": torch.tensor(self.target_herbs[idx], dtype=torch.long),
            "target_dosage": torch.tensor(self.target_dosages[idx], dtype=torch.float32),
            "target_stop": torch.tensor(self.target_stops[idx], dtype=torch.float32),
        }


class TCMSPDataLoader:
    """
    TCMSP/DFBP 数据加载器

    从多种数据源加载配方生成训练数据：
    1. 内置药材知识库 (_BUILTIN_HERBS)
    2. TCMSP JSON 数据文件
    3. DFBP 数据库表
    4. 经典方剂库
    """

    # 经典方剂作为训练先验
    _CLASSIC_FORMULAE = {
        "四君子汤": {"herbs": ["ds", "bq", "gq", "dcx"], "effects": ["补气", "健脾"]},
        "六味地黄丸": {"herbs": ["shd", "sfz", "swd", "ms", "zgy", "fu_ling"], "effects": ["补肾", "养血"]},
        "桂枝汤": {"herbs": ["gz", "shd", "gq", "dcx", "sj"], "effects": ["解表", "补气"]},
        "逍遥散": {"herbs": ["chaihu", "dg", "bz", "fp", "gq", "mj", "sj", "mg"], "effects": ["理气", "养血", "安神"]},
        "银翘散": {"herbs": ["jinhua", "niubang", "jgh", "bohe", "dandufan", "lvgan", "yangjin", "tangsu"], "effects": ["清热", "解毒", "解表"]},
        "补中益气汤": {"herbs": ["hq", "ds", "gz", "chenpi", "shengma", "chaihu", "gq"], "effects": ["补气", "免疫调节"]},
        "桃红四物汤": {"herbs": ["dg", "cx", "ts", "th", "gq"], "effects": ["养血", "活血化瘀"]},
        "当归补血汤": {"herbs": ["hqg", "dg"], "effects": ["补气", "养血"]},
    }

    def __init__(
        self,
        data_dir: Optional[str] = None,
        use_builtin: bool = True,
        use_classic_formulae: bool = True,
    ):
        self.data_dir = Path(data_dir) if data_dir else None
        self.use_builtin = use_builtin
        self.use_classic_formulae = use_classic_formulae
        self._herbs: Dict[str, HerbSample] = {}
        self._formulae: List[FormulaSample] = []
        self._loaded = False

    def load_all(self) -> Dict[str, Any]:
        """
        加载所有可用数据源

        Returns:
            {
                "herbs": Dict[str, HerbSample],
                "formulae": List[FormulaSample],
                "stats": {...}
            }
        """
        # 1. 加载内置药材库
        if self.use_builtin:
            self._load_builtin_herbs()

        # 2. 加载经典方剂
        if self.use_classic_formulae:
            self._load_classic_formulae()

        # 3. 尝试加载 TCMSP 数据文件
        if self.data_dir:
            self._load_tcmsp_json()

        # 4. 尝试加载 DFBP 数据
        self._load_dfbp_data()

        self._loaded = True

        stats = {
            "total_herbs": len(self._herbs),
            "total_formulae": len(self._formulae),
            "efficacy_categories": self._get_efficacy_categories(),
        }

        logger.info(
            f"[DataLoader] 加载完成: {stats['total_herbs']} 味药材, "
            f"{stats['total_formulae']} 个配方, "
            f"{len(stats['efficacy_categories'])} 类功效"
        )

        return {
            "herbs": self._herbs,
            "formulae": self._formulae,
            "stats": stats,
        }

    def _load_builtin_herbs(self) -> None:
        """从内置知识库加载药材"""
        try:
            from app.services.ai.algorithms.bayesian_formula_optimizer import _BUILTIN_HERBS

            for hid, herb_param in _BUILTIN_HERBS.items():
                self._herbs[hid] = HerbSample(
                    herb_id=herb_param.herb_id,
                    name_cn=herb_param.name_cn,
                    efficacy_scores=dict(herb_param.efficacy_scores),
                    safety_index=herb_param.safety_index,
                    cost_per_gram=herb_param.cost_per_gram,
                    dosage_min=herb_param.dosage_min,
                    dosage_max=herb_param.dosage_max,
                    dosage_step=herb_param.dosage_step,
                    synergy_partners=list(herb_param.synergy_partners),
                    antagonistic_pairs=list(herb_param.antagonistic_pairs),
                )

            logger.info(f"[DataLoader] 内置药材库: {len(self._herbs)} 味")
        except ImportError as e:
            logger.warning(f"[DataLoader] 内置药材库加载失败: {e}")

    def _load_classic_formulae(self) -> None:
        """从经典方剂库加载配方样本"""
        from app.services.ai.models import SignalEncoder

        encoder = SignalEncoder()

        for formula_name, formula_data in self._CLASSIC_FORMULAE.items():
            herb_ids = formula_data["herbs"]
            effects = formula_data["effects"]

            # 生成信号向量
            signal = encoder.encode(effects)

            # 生成配方样本
            if len(herb_ids) >= 2:
                sample = FormulaSample(
                    herb_ids=herb_ids,
                    dosages=[8.0] * len(herb_ids),  # 默认用量
                    target_effects=effects,
                    signal_vector=signal.raw_vector,
                    stop_sequence=[0] * (len(herb_ids) - 1) + [1],  # 最后一步停止
                    efficacy_labels=[1 if e in effects else 0 for e in encoder.EFFECTS],
                )
                self._formulae.append(sample)

        logger.info(f"[DataLoader] 经典方剂: {len(self._formulae)} 个")

    def _load_tcmsp_json(self) -> None:
        """从 TCMSP JSON 文件加载数据"""
        if not self.data_dir:
            return

        # 查找 mmid_data.json
        json_paths = [
            self.data_dir / "mmid_data.json",
            self.data_dir / "herb_data.json",
            self.data_dir / "tcmsp_herbs.json",
        ]

        for json_path in json_paths:
            if json_path.exists():
                try:
                    with open(json_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    self._parse_tcmsp_data(data)
                    logger.info(f"[DataLoader] 从 {json_path.name} 加载 {len(self._herbs)} 味药材")
                    return
                except Exception as e:
                    logger.warning(f"[DataLoader] 解析 {json_path.name} 失败: {e}")

    def _parse_tcmsp_data(self, data: Dict) -> None:
        """解析 TCMSP 数据格式"""
        if isinstance(data, list):
            for item in data:
                herb_id = item.get("herb_id") or item.get("id") or item.get("name")
                if herb_id and herb_id not in self._herbs:
                    self._herbs[herb_id] = HerbSample(
                        herb_id=herb_id,
                        name_cn=item.get("name_cn", herb_id),
                        efficacy_scores=item.get("efficacy_scores", {}),
                        safety_index=item.get("safety_index", 0.8),
                        cost_per_gram=item.get("cost_per_gram", 0.1),
                        dosage_min=item.get("dosage_min", 3.0),
                        dosage_max=item.get("dosage_max", 15.0),
                        dosage_step=item.get("dosage_step", 1.0),
                    )
        elif isinstance(data, dict):
            for herb_id, info in data.items():
                if herb_id not in self._herbs:
                    self._herbs[herb_id] = HerbSample(
                        herb_id=herb_id,
                        name_cn=info.get("name_cn", herb_id) if isinstance(info, dict) else herb_id,
                        efficacy_scores=info.get("efficacy_scores", {}) if isinstance(info, dict) else {},
                        safety_index=info.get("safety_index", 0.8) if isinstance(info, dict) else 0.8,
                        cost_per_gram=info.get("cost_per_gram", 0.1) if isinstance(info, dict) else 0.1,
                        dosage_min=info.get("dosage_min", 3.0) if isinstance(info, dict) else 3.0,
                        dosage_max=info.get("dosage_max", 15.0) if isinstance(info, dict) else 15.0,
                        dosage_step=info.get("dosage_step", 1.0) if isinstance(info, dict) else 1.0,
                    )

    def _load_dfbp_data(self) -> None:
        """从 DFBP 数据库加载数据（如果可用）"""
        try:
            from sqlalchemy import text
            from app.core.database.database import get_async_session

            async def _load():
                async with get_async_session() as session:
                    # 加载药材功效数据
                    result = await session.execute(text("""
                        SELECT herb_id, efficacy_name, efficacy_score
                        FROM herb_efficacy
                        WHERE deleted_at IS NULL
                    """))
                    for row in result:
                        herb_id, eff_name, eff_score = row
                        if herb_id not in self._herbs:
                            self._herbs[herb_id] = HerbSample(
                                herb_id=herb_id,
                                name_cn=herb_id,
                                efficacy_scores={},
                                safety_index=0.8,
                                cost_per_gram=0.1,
                                dosage_min=3.0,
                                dosage_max=15.0,
                                dosage_step=1.0,
                            )
                        self._herbs[herb_id].efficacy_scores[eff_name] = eff_score

            import asyncio
            asyncio.run(_load())
            logger.info(f"[DataLoader] DFBP 数据库: {len(self._herbs)} 味药材")
        except Exception as e:
            logger.debug(f"[DataLoader] DFBP 加载失败（可能数据库未配置）: {e}")

    def _get_efficacy_categories(self) -> List[str]:
        """获取所有功效类别"""
        categories = set()
        for herb in self._herbs.values():
            categories.update(herb.efficacy_scores.keys())
        return sorted(categories)

    def get_herb_vocab(self) -> List[str]:
        """获取药材词汇表"""
        return sorted(self._herbs.keys())

    def get_herb_by_id(self, herb_id: str) -> Optional[HerbSample]:
        """按 ID 获取药材"""
        return self._herbs.get(herb_id)

    def get_samples_by_effect(self, effect: str) -> List[HerbSample]:
        """按功效获取药材列表"""
        return [
            h for h in self._herbs.values()
            if effect in h.efficacy_scores and h.efficacy_scores[effect] > 0
        ]

    def generate_training_batch(
        self,
        batch_size: int = 32,
        max_seq_len: int = 12,
    ) -> Tuple[Dict[str, Any], List[FormulaSample]]:
        """
        生成训练批次

        Returns:
            (signals, targets), formula_samples
        """
        if not self._herbs:
            self.load_all()

        # 随机采样配方
        samples = random.sample(
            self._formulae,
            min(batch_size, len(self._formulae))
        ) if len(self._formulae) >= batch_size else self._formulae

        # 增强数据
        augmented_samples = self._augment_samples(samples, batch_size)

        # 构建训练数据
        signals = []
        target_herbs = []
        target_dosages = []
        target_stops = []

        for sample in augmented_samples:
            # 信号向量
            signal = sample.signal_vector
            signals.append(signal)

            # 药材目标（one-hot 编码）
            herb_indices = [
                self.get_herb_vocab().index(h) if h in self.get_herb_vocab() else 0
                for h in sample.herb_ids[:max_seq_len]
            ]
            target_herbs.append(herb_indices)

            # 剂量目标
            dosages = sample.dosages[:max_seq_len]
            target_dosages.append(dosages)

            # 停止标记
            stops = sample.stop_sequence[:max_seq_len]
            target_stops.append(stops)

        return {
            "signals": signals,
            "target_herbs": target_herbs,
            "target_dosages": target_dosages,
            "target_stops": target_stops,
        }, augmented_samples

    def _augment_samples(
        self,
        samples: List[FormulaSample],
        target_count: int,
    ) -> List[FormulaSample]:
        """数据增强：剂量扰动、功效采样"""
        augmented = list(samples)

        while len(augmented) < target_count:
            # 复制并扰动
            sample = random.choice(samples)
            new_sample = FormulaSample(
                herb_ids=list(sample.herb_ids),
                dosages=[d + random.uniform(-2, 2) for d in sample.dosages],
                target_effects=list(sample.target_effects),
                signal_vector=list(sample.signal_vector),
                stop_sequence=list(sample.stop_sequence),
                efficacy_labels=list(sample.efficacy_labels),
            )
            # 剂量裁剪
            new_sample.dosages = [
                max(h.dosage_min, min(h.dosage_max, d))
                for d, h in zip(new_sample.dosages,
                               [self._herbs.get(hid, HerbSample(hid, "", {}, 0.8, 0.1, 3, 15, 1))
                                for hid in new_sample.herb_ids])
            ]
            augmented.append(new_sample)

        return augmented[:target_count]

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def herb_count(self) -> int:
        return len(self._herbs)

    @property
    def formula_count(self) -> int:
        return len(self._formulae)


# 全局单例
_data_loader: Optional[TCMSPDataLoader] = None


def get_data_loader(
    data_dir: Optional[str] = None,
    use_builtin: bool = True,
) -> TCMSPDataLoader:
    """获取全局数据加载器单例"""
    global _data_loader
    if _data_loader is None:
        _data_loader = TCMSPDataLoader(
            data_dir=data_dir,
            use_builtin=use_builtin,
        )
        _data_loader.load_all()
    return _data_loader
