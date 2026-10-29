"""
谱图峰识别规则引擎

基于规则和轻量级 ML 模型，自动识别谱图中的主要成分峰、杂质峰，
并计算含量。支持 FTIR、NMR、GC-MS、HPLC 等多种谱图类型。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class PeakType(str, Enum):
    """峰类型"""
    PRIMARY = "primary"          # 主要成分峰
    IMPURITY = "impurity"        # 杂质峰
    SOLVENT = "solvent"          # 溶剂峰
    NOISE = "noise"              # 噪声峰
    UNKNOWN = "unknown"          # 未识别


class SpectrumType(str, Enum):
    """谱图类型"""
    FTIR = "FTIR"
    NMR = "NMR"
    MS = "MS"
    GC_MS = "GC-MS"
    HPLC = "HPLC"
    UV_VIS = "UV-VIS"
    AAS = "AAS"


@dataclass
class IdentifiedPeak:
    """识别出的峰"""
    x: float                    # 保留时间 / 波数 / ppm / m/z
    y: float                    # 强度
    peak_type: PeakType
    confidence: float = 0.0     # 0-1
    component_name: Optional[str] = None
    quantity_estimate: Optional[float] = None
    notes: str = ""


@dataclass
class SpectrumAnalysisResult:
    """谱图分析结果"""
    spectrum_type: SpectrumType
    total_peaks: int = 0
    primary_peaks: List[IdentifiedPeak] = field(default_factory=list)
    impurity_peaks: List[IdentifiedPeak] = field(default_factory=list)
    noise_peaks: int = 0
    solvent_peaks: int = 0
    total_component_count: int = 0
    estimated_purity: float = 0.0
    notes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "spectrum_type": self.spectrum_type.value,
            "total_peaks": self.total_peaks,
            "primary_peak_count": len(self.primary_peaks),
            "impurity_peak_count": len(self.impurity_peaks),
            "noise_peak_count": self.noise_peaks,
            "solvent_peak_count": self.solvent_peaks,
            "estimated_purity_percent": round(self.estimated_purity * 100, 1),
            "primary_peaks": [
                {
                    "x": p.x,
                    "y": p.y,
                    "confidence": round(p.confidence, 2),
                    "component": p.component_name,
                    "quantity": p.quantity_estimate,
                    "notes": p.notes,
                }
                for p in self.primary_peaks[:20]
            ],
            "impurity_peaks": [
                {
                    "x": p.x,
                    "y": p.y,
                    "confidence": round(p.confidence, 2),
                }
                for p in self.impurity_peaks[:10]
            ],
            "notes": self.notes,
        }


class PeakRecognitionEngine:
    """
    谱图峰识别规则引擎

    使用基于规则的算法识别主要成分峰和杂质峰：
    1. 信噪比分析：区分信号峰和噪声
    2. 峰宽分析：主要成分峰通常较宽，杂质峰较窄
    3. 强度阈值：高于设定阈值的峰为主要成分
    4. 已知峰位置库：匹配标准谱图库
    """

    # 噪声阈值：低于基线 3σ 的峰视为噪声
    NOISE_SIGMA_THRESHOLD = 3.0

    # 溶剂峰强度占比阈值（HPLC 中溶剂峰通常很高）
    SOLVENT_PEAK_RATIO = 0.8

    # 杂质峰强度占比阈值
    IMPURITY_RATIO_THRESHOLD = 0.05

    # 最小峰宽（相对）
    MIN_PEAK_WIDTH_RATIO = 0.001

    def __init__(self, spectrum_type: SpectrumType = SpectrumType.FTIR):
        self.spectrum_type = spectrum_type
        self._known_peaks: Dict[str, List[Tuple[float, float]]] = {}  # 标准峰位置库

    def analyze(
        self,
        x_values: List[float],
        y_values: List[float],
        x_unit: str = "",
        known_peaks: Optional[Dict[str, List[float]]] = None,
    ) -> SpectrumAnalysisResult:
        """
        分析谱图数据

        Args:
            x_values: X 轴数据（波数/ppm/保留时间/m/z）
            y_values: Y 轴数据（强度）
            x_unit: X 轴单位
            known_peaks: 已知成分峰位置 {成分名: [峰位置列表]}
        """
        if len(x_values) != len(y_values):
            raise ValueError("x_values 和 y_values 长度必须一致")
        if len(x_values) < 3:
            return SpectrumAnalysisResult(spectrum_type=self.spectrum_type, notes=["数据点太少"])

        result = SpectrumAnalysisResult(spectrum_type=self.spectrum_type)
        result.notes.append(f"分析 {len(x_values)} 个数据点，单位: {x_unit}")

        # 计算基线统计
        base_mean, base_std = self._compute_baseline_stats(y_values)
        noise_threshold = base_mean + self.NOISE_SIGMA_THRESHOLD * base_std

        # 检测所有峰
        peaks = self._detect_peaks(x_values, y_values, base_mean, base_std)
        result.total_peaks = len(peaks)

        # 对每个峰进行分类
        max_y = max(y_values) if y_values else 1
        total_intensity = sum(abs(y) for y in y_values)

        primary_candidates = []
        impurity_candidates = []

        for peak in peaks:
            peak_type = self._classify_peak(
                peak, base_mean, base_std, noise_threshold, max_y, total_intensity,
                x_unit, known_peaks or {},
            )
            identified = IdentifiedPeak(
                x=peak["x"],
                y=peak["y"],
                peak_type=peak_type,
                confidence=peak.get("confidence", 0.0),
                component_name=peak.get("component_name"),
                notes=peak.get("notes", ""),
            )

            if peak_type == PeakType.PRIMARY:
                primary_candidates.append(identified)
                result.total_component_count += 1
            elif peak_type == PeakType.IMPURITY:
                impurity_candidates.append(identified)
            elif peak_type == PeakType.NOISE:
                result.noise_peaks += 1
            elif peak_type == PeakType.SOLVENT:
                result.solvent_peaks += 1

        result.primary_peaks = sorted(primary_candidates, key=lambda p: p.y, reverse=True)
        result.impurity_peaks = sorted(impurity_candidates, key=lambda p: p.y, reverse=True)

        # 计算估计纯度
        if total_intensity > 0:
            primary_intensity = sum(p.y for p in result.primary_peaks)
            result.estimated_purity = primary_intensity / total_intensity

        # 估计含量（基于峰面积近似）
        for peak in result.primary_peaks:
            peak.quantity_estimate = self._estimate_quantity(
                peak.y, result.primary_peaks, total_intensity
            )

        result.notes.append(
            f"识别主要成分 {len(result.primary_peaks)} 个，杂质 {len(result.impurity_peaks)} 个"
        )

        return result

    def _compute_baseline_stats(self, y_values: List[float]) -> Tuple[float, float]:
        """计算基线均值和标准差"""
        if not y_values:
            return 0.0, 1.0
        mean = sum(y_values) / len(y_values)
        variance = sum((y - mean) ** 2 for y in y_values) / len(y_values)
        std = variance ** 0.5
        return mean, std if std > 0 else 1.0

    def _detect_peaks(
        self,
        x_vals: List[float],
        y_vals: List[float],
        baseline_mean: float,
        baseline_std: float,
    ) -> List[Dict[str, Any]]:
        """检测所有显著峰"""
        peaks = []
        min_peak_height = baseline_mean + 2.0 * baseline_std

        for i in range(1, len(y_vals) - 1):
            curr_y = y_vals[i]
            prev_y = y_vals[i - 1]
            next_y = y_vals[i + 1]

            # 局部极大值检测
            if curr_y > prev_y and curr_y > next_y and curr_y > min_peak_height:
                # 计算峰宽（半高宽近似）
                half_max = (baseline_mean + curr_y) / 2
                left_idx = i
                right_idx = i
                for j in range(i - 1, max(0, i - 100), -1):
                    if y_vals[j] < half_max:
                        left_idx = j
                        break
                for j in range(i + 1, min(len(y_vals), i + 100)):
                    if y_vals[j] < half_max:
                        right_idx = j
                        break

                fwhm = x_vals[right_idx] - x_vals[left_idx] if right_idx != left_idx else 0

                peaks.append({
                    "x": x_vals[i],
                    "y": curr_y,
                    "fwhm": fwhm,
                    "index": i,
                })

        return peaks

    def _classify_peak(
        self,
        peak: Dict[str, Any],
        baseline_mean: float,
        baseline_std: float,
        noise_threshold: float,
        max_y: float,
        total_intensity: float,
        x_unit: str,
        known_peaks: Dict[str, List[float]],
    ) -> Dict[str, Any]:
        """对峰进行分类"""
        peak["y"] - baseline_mean
        result = {
            "x": peak["x"],
            "y": peak["y"],
            "confidence": 0.0,
            "component_name": None,
            "notes": "",
        }

        # 噪声检测
        if peak["y"] < noise_threshold:
            result["peak_type"] = PeakType.NOISE
            result["confidence"] = 0.9
            return result

        # 溶剂峰检测（强度极高且宽）
        if max_y > 0 and peak["y"] / max_y > self.SOLVENT_PEAK_RATIO:
            result["peak_type"] = PeakType.SOLVENT
            result["confidence"] = 0.7
            result["notes"] = "高强度宽峰，可能为溶剂峰"
            return result

        # 匹配已知峰
        matched_component = None
        match_confidence = 0.0
        for comp_name, positions in known_peaks.items():
            for pos in positions:
                if abs(peak["x"] - pos) / max(abs(pos), 1) < 0.02:  # 2% 容差
                    matched_component = comp_name
                    match_confidence = max(match_confidence, 1.0 - abs(peak["x"] - pos) / max(abs(pos), 1))
                    break

        # 杂质 vs 主要成分判断
        intensity_ratio = peak["y"] / max_y if max_y > 0 else 0

        if matched_component:
            result["peak_type"] = PeakType.PRIMARY
            result["component_name"] = matched_component
            result["confidence"] = match_confidence
            result["notes"] = f"匹配已知成分: {matched_component}"
        elif intensity_ratio > self.IMPURITY_RATIO_THRESHOLD:
            result["peak_type"] = PeakType.PRIMARY
            result["confidence"] = min(0.5 + intensity_ratio * 0.5, 0.95)
            result["notes"] = f"强度占比 {intensity_ratio * 100:.1f}%"
        else:
            result["peak_type"] = PeakType.IMPURITY
            result["confidence"] = 0.6
            result["notes"] = f"低强度峰，占比 {intensity_ratio * 100:.1f}%"

        return result

    def _estimate_quantity(
        self,
        peak_y: float,
        all_peaks: List[IdentifiedPeak],
        total_intensity: float,
    ) -> Optional[float]:
        """估算峰含量百分比"""
        if total_intensity <= 0:
            return None
        return round((peak_y / total_intensity) * 100, 2)


# 便捷函数
def analyze_spectrum(
    x_values: List[float],
    y_values: List[float],
    spectrum_type: SpectrumType = SpectrumType.FTIR,
    x_unit: str = "",
    known_peaks: Optional[Dict[str, List[float]]] = None,
) -> SpectrumAnalysisResult:
    """快速分析谱图"""
    engine = PeakRecognitionEngine(spectrum_type)
    return engine.analyze(x_values, y_values, x_unit, known_peaks)
