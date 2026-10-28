"""
RMFOODFP 肽链结构分析模块
基于 PepLink 的肽序列↔SMILES 双向转换服务
"""

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# 尝试导入 PepLink
# 注意：pip包名是peplink，但实际导入模块名是PepLink（大写P）
try:
    from PepLink import (
        IntrachainBond,
        aa_seqs_to_smiles,
        list_supported_noncanonical_aas,
        load_noncanonical_aas_from_csv,
        register_noncanonical_aa,
        smiles_to_aa_seqs,
    )
    PEPLINK_AVAILABLE = True
except ImportError as e:
    PEPLINK_AVAILABLE = False
    logger.warning(f"PepLink 未安装，部分功能不可用: {e}")


# ═══════════════════════════════════════════════════════════
# 数据模型定义
# ═══════════════════════════════════════════════════════════

@dataclass
class SMILESResult:
    """SMILES 转换结果"""
    success: bool
    sequence: str
    smiles: Optional[str] = None
    selfies: Optional[str] = None
    error_message: Optional[str] = None
    unsupported_reason: Optional[str] = None


@dataclass
class SequenceResult:
    """序列解析结果"""
    success: bool
    sequence: Optional[str] = None
    is_cyclic: bool = False
    cyclization: Optional[str] = None
    unsupported_reason: Optional[str] = None
    n_terminal_mod: Optional[str] = None
    c_terminal_mod: Optional[str] = None


@dataclass
class PeptideStructureInfo:
    """肽结构信息"""
    sequence: str
    smiles: Optional[str] = None
    selfies: Optional[str] = None
    is_cyclic: bool = False
    cyclization_type: Optional[str] = None
    n_terminal_modification: Optional[str] = None
    c_terminal_modification: Optional[str] = None
    unusual_amino_acids: List[Dict] = field(default_factory=list)
    intrachain_bonds: List[Dict] = field(default_factory=list)


# ═══════════════════════════════════════════════════════════
# PeptideConverter 核心类
# ═══════════════════════════════════════════════════════════

class PeptideConverter:
    """
    肽序列转换器

    基于 PepLink 实现：
    - 序列 → SMILES/SELFIES 转换
    - SMILES/SELFIES → 序列解析
    - 非天然氨基酸支持（420种内置）
    - 末端修饰支持（296种内置）
    - 环肽结构支持（3类拓扑+11种键）
    """

    def __init__(self):
        if not PEPLINK_AVAILABLE:
            raise ImportError(
                "请先安装 PepLink: pip install peplink>=0.1.3"
            )
        self._supported_aas_cache = None
        self._initialized_aas = False

    def _ensure_initialized(self) -> None:
        """确保必要的数据已初始化"""
        if not self._initialized_aas:
            # 触发初始化（获取支持的非天然氨基酸列表）
            try:
                list_supported_noncanonical_aas()
                self._initialized_aas = True
            except Exception as e:
                logger.warning(f"初始化非天然氨基酸列表失败: {e}")

    def sequence_to_smiles(
        self,
        sequence: str,
        n_terminal: Optional[str] = None,
        c_terminal: Optional[str] = None,
        unusual_aaminos: Optional[List[Dict]] = None,
        intrachain_bonds: Optional[List[Dict]] = None,
        output_format: str = "smiles"
    ) -> SMILESResult:
        """
        肽序列 → SMILES/SELFIES 转换

        Args:
            sequence: 氨基酸序列（如 "ACDEFG" 或 "RRXXRF"）
            n_terminal: N端修饰（如 "ACT" 乙酰化）
            c_terminal: C端修饰（如 "AMD" 酰胺化）
            unusual_aaminos: 非天然氨基酸列表
                格式: [{"position": 3, "name": "1-NAL"}, ...]
                position 是 1-based 索引
            intrachain_bonds: 链内键列表
                格式: [{"type": "DSB", "residues": ["C1", "C6"]}, ...]
            output_format: 输出格式 "smiles" 或 "selfies"

        Returns:
            SMILESResult 对象
        """
        # 参数验证
        if not sequence or not isinstance(sequence, str):
            return SMILESResult(
                success=False,
                sequence=sequence or "",
                error_message="序列不能为空"
            )

        seq_upper = sequence.upper()

        # 验证序列长度
        if len(seq_upper) < 2:
            return SMILESResult(
                success=False,
                sequence=seq_upper,
                error_message="序列长度不能少于2个氨基酸"
            )

        if len(seq_upper) > 100:
            return SMILESResult(
                success=False,
                sequence=seq_upper,
                error_message="序列长度不能超过100个氨基酸"
            )

        try:
            # 构建调用参数
            kwargs = {"output_format": output_format}

            if n_terminal:
                kwargs["n_terminal"] = n_terminal
            if c_terminal:
                kwargs["c_terminal"] = c_terminal
            if unusual_aaminos:
                kwargs["unusual_amino_acids"] = unusual_aaminos
            if intrachain_bonds:
                # 将 dict 列表转换为 IntrachainBond 对象
                bonds = []
                for b in intrachain_bonds:
                    if isinstance(b, dict):
                        bonds.append(IntrachainBond(
                            position1=b.get("position1", b.get("position", 1)),
                            position2=b.get("position2", b.get("position", 2)),
                            bond_type=b.get("bond_type", "DSB"),
                        ))
                    else:
                        bonds.append(b)
                kwargs["intrachain_bonds"] = bonds

            # 调用 PepLink
            result_smiles = aa_seqs_to_smiles(seq_upper, **kwargs)

            return SMILESResult(
                success=True,
                sequence=seq_upper,
                smiles=result_smiles if output_format == "smiles" else None,
                selfies=result_smiles if output_format == "selfies" else None,
            )

        except Exception as e:
            logger.error(f"序列转 SMILES 失败: {e}", exc_info=True)
            return SMILESResult(
                success=False,
                sequence=seq_upper,
                error_message=str(e),
            )

    def smiles_to_sequence(
        self,
        smiles: str,
        format_type: str = "smiles"
    ) -> SequenceResult:
        """
        SMILES/SELFIES → 肽序列解析

        Args:
            smiles: SMILES 或 SELFIES 字符串
            format_type: 输入格式 "smiles" 或 "selfies"

        Returns:
            SequenceResult 对象
        """
        if not smiles or not isinstance(smiles, str):
            return SequenceResult(
                success=False,
                unsupported_reason="输入不能为空"
            )

        try:
            # 调用 PepLink
            result = smiles_to_aa_seqs(smiles)

            return SequenceResult(
                success=True,
                sequence=result.sequence,
                is_cyclic=result.is_cyclic,
                cyclization=result.cyclization,
                unsupported_reason=result.unsupported_reason,
            )

        except Exception as e:
            logger.error(f"SMILES 解析失败: {e}", exc_info=True)
            return SequenceResult(
                success=False,
                unsupported_reason=str(e),
            )

    def register_custom_aa(
        self,
        name: str,
        smiles: str
    ) -> bool:
        """
        注册自定义非天然氨基酸

        Args:
            name: 氨基酸名称（如 "MyAA"）
            smiles: SMILES 字符串定义

        Returns:
            是否注册成功
        """
        try:
            register_noncanonical_aa(name, smiles)
            # 清除缓存
            self._supported_aas_cache = None
            logger.info(f"已注册自定义氨基酸: {name}")
            return True
        except Exception as e:
            logger.error(f"注册自定义氨基酸失败: {e}", exc_info=True)
            return False

    def load_custom_aas_from_csv(
        self,
        csv_path: str
    ) -> int:
        """
        从 CSV 文件批量注册非天然氨基酸

        Args:
            csv_path: CSV 文件路径

        Returns:
            成功注册的数量
        """
        try:
            count = load_noncanonical_aas_from_csv(csv_path)
            self._supported_aas_cache = None
            logger.info(f"已从 CSV 加载 {count} 个自定义氨基酸")
            return count
        except Exception as e:
            logger.error(f"批量注册失败: {e}", exc_info=True)
            return 0

    def list_supported_aas(self) -> Dict[str, str]:
        """
        获取支持的非天然氨基酸列表

        Returns:
            {名称: SMILES定义} 字典
        """
        try:
            return list_supported_noncanonical_aas()
        except Exception as e:
            logger.error(f"获取支持列表失败: {e}", exc_info=True)
            return {}

    def get_structure_info(
        self,
        sequence: str,
        n_terminal: Optional[str] = None,
        c_terminal: Optional[str] = None,
        unusual_aaminos: Optional[List[Dict]] = None,
        intrachain_bonds: Optional[List[Dict]] = None
    ) -> PeptideStructureInfo:
        """
        获取肽的完整结构信息

        Args:
            sequence: 氨基酸序列
            n_terminal: N端修饰
            c_terminal: C端修饰
            unusual_aaminos: 非天然氨基酸
            intrachain_bonds: 链内键

        Returns:
            PeptideStructureInfo 对象
        """
        info = PeptideStructureInfo(sequence=sequence.upper())

        # 转换到 SMILES
        smiles_result = self.sequence_to_smiles(
            sequence,
            n_terminal=n_terminal,
            c_terminal=c_terminal,
            unusual_aaminos=unusual_aaminos,
            intrachain_bonds=intrachain_bonds,
        )

        if smiles_result.success:
            info.smiles = smiles_result.smiles
            info.selfies = smiles_result.selfies
            info.n_terminal_modification = n_terminal
            info.c_terminal_modification = c_terminal
            info.unusual_amino_acids = unusual_aaminos or []
            info.intrachain_bonds = intrachain_bonds or []

        return info


# ═══════════════════════════════════════════════════════════
# 便捷函数
# ═══════════════════════════════════════════════════════════

def convert_sequence_to_smiles(
    sequence: str,
    **kwargs
) -> SMILESResult:
    """便捷函数：序列转 SMILES"""
    converter = PeptideConverter()
    return converter.sequence_to_smiles(sequence, **kwargs)


def convert_smiles_to_sequence(
    smiles: str,
    **kwargs
) -> SequenceResult:
    """便捷函数：SMILES 转序列"""
    converter = PeptideConverter()
    return converter.smiles_to_sequence(smiles, **kwargs)


# ═══════════════════════════════════════════════════════════
# 导出
# ═══════════════════════════════════════════════════════════

__all__ = [
    "PeptideConverter",
    "SMILESResult",
    "SequenceResult",
    "PeptideStructureInfo",
    "convert_sequence_to_smiles",
    "convert_smiles_to_sequence",
]
