"""
JCAMP-DX 格式解析器

JCAMP-DX (JCAMP Information Exchange - Digital eXchange) 是光谱数据的标准交换格式。
支持: FTIR, NMR, MS, GC-MS, UV-Vis, AAS, ESR

文件格式特点:
- 基于文本，使用 ^ 关键字标记
- 关键字以 ^ 开头，行内或单独一行
- 数据以 "X-Y" 或 "X Y" 格式存储
- 支持 INDX 和 DY 双索引格式
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class JCAMPPoint:
    """光谱数据点"""
    x: float
    y: float
    error_low: Optional[float] = None
    error_high: Optional[float] = None


@dataclass
class JCAMPRecord:
    """JCAMP 关键字记录"""
    key: str
    value: str
    line_number: int = 0


@dataclass
class JCAMPResult:
    """JCAMP-DX 解析结果"""
    record_type: str = ""           # FTIR, NMR, MS, GC-MS, etc.
    compound_name: str = ""
    source_file: str = ""
    instrument: str = ""
    operator: str = ""
    date: str = ""
    x_unit: str = ""                # cm-1, ppm, m/z, etc.
    y_unit: str = ""
    x_min: float = 0.0
    x_max: float = 0.0
    y_min: float = 0.0
    y_max: float = 0.0
    points: List[JCAMPPoint] = field(default_factory=list)
    peaks: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, str] = field(default_factory=dict)
    parse_errors: List[str] = field(default_factory=list)

    @property
    def point_count(self) -> int:
        return len(self.points)

    def to_dict(self) -> Dict[str, Any]:
        # 采样返回前1000个点避免响应过大
        sample_points = self.points[:1000] if len(self.points) > 1000 else self.points
        return {
            "record_type": self.record_type,
            "compound_name": self.compound_name,
            "x_unit": self.x_unit,
            "y_unit": self.y_unit,
            "x_range": [self.x_min, self.x_max],
            "y_range": [self.y_min, self.y_max],
            "point_count": self.point_count,
            "peak_count": len(self.peaks),
            "sample_points": [
                {"x": p.x, "y": p.y} for p in sample_points
            ],
            "peaks": self.peaks[:50],  # 最多返回50个峰
            "metadata": self.metadata,
            "parse_errors": self.parse_errors[:5],
        }


class JcampDXParser:
    """JCAMP-DX 格式解析器"""

    # 关键字模式: ^KEYWORD=value 或 ^KEYWORD (单独行)
    KEYWORD_PATTERN = re.compile(r'^\^([A-Z][A-Z0-9_-]*)\s*(?:=(.*))?$', re.MULTILINE)

    # 数据行模式: x y 或 x-y 或 [x,y]
    DATA_LINE_PATTERN = re.compile(
        r'[\[\(]?\s*([-+]?\d+\.?\d*(?:[eE][-+]?\d+)?)\s*[-,/\s]\s*([-+]?\d+\.?\d*(?:[eE][-+]?\d+)?)\s*[\]\)]?'
    )

    def __init__(self):
        self._records: List[JCAMPRecord] = []

    def parse(self, content: bytes) -> JCAMPResult:
        """解析 JCAMP-DX 内容"""
        result = JCAMPResult()

        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text = content.decode("gbk")
            except UnicodeDecodeError:
                text = content.decode("latin-1")

        # 标准 JCAMP-DX 结束标记
        if "$END" not in text:
            result.parse_errors.append("缺少 $END 标记，可能不是标准 JCAMP-DX 格式")

        # 解析关键字
        self._parse_keywords(text, result)

        # 解析数据
        self._parse_data(text, result)

        # 识别记录类型
        self._identify_record_type(result)

        # 提取峰信息
        if result.points:
            result.peaks = self._extract_peaks(result)

        logger.info(
            "JCAMP-DX parsed: type=%s points=%d peaks=%d",
            result.record_type, result.point_count, len(result.peaks),
        )
        return result

    def _parse_keywords(self, text: str, result: JCAMPResult) -> None:
        """解析 JCAMP-DX 关键字"""
        lines = text.split("\n")

        for i, line in enumerate(lines):
            line = line.strip()
            if not line or line.startswith("$"):
                continue

            # 匹配关键字
            kw_match = re.match(r'^\^([A-Z][A-Z0-9_-]*)\s*(?:=(.*))?$', line)
            if kw_match:
                key = kw_match.group(1)
                value = (kw_match.group(2) or "").strip()

                record = JCAMPRecord(key=key, value=value, line_number=i + 1)
                self._records.append(record)

                # 映射到结果字段
                self._map_keyword(key, value, result)

    def _map_keyword(self, key: str, value: str, result: JCAMPResult) -> None:
        """将关键字映射到结果字段"""
        key_upper = key.upper()

        # 基本信息
        if key_upper in ("TITL", "TITLE"):
            result.compound_name = value
        elif key_upper in ("FILE", "NAME"):
            result.source_file = value
        elif key_upper == "INAM":
            result.instrument = value
        elif key_upper == "OPNA":
            result.operator = value
        elif key_upper == "DATE":
            result.date = value
        elif key_upper == "BXUN":
            result.x_unit = value
        elif key_upper == "BYUN":
            result.y_unit = value
        elif key_upper == "BX":
            try:
                parts = value.split(",")
                if len(parts) >= 2:
                    result.x_min = float(parts[0])
                    result.x_max = float(parts[1])
            except ValueError:
                pass
        elif key_upper == "BY":
            try:
                parts = value.split(",")
                if len(parts) >= 2:
                    result.y_min = float(parts[0])
                    result.y_max = float(parts[1])
            except ValueError:
                pass
        elif key_upper in ("NX", "NY"):
            try:
                n = int(value)
                # NX/NY 表示数据点数量
            except ValueError:
                pass
        else:
            # 保存为元数据
            result.metadata[key_upper] = value

    def _parse_data(self, text: str, result: JCAMPResult) -> None:
        """解析光谱数据点"""
        lines = text.split("\n")
        in_data_section = False
        data_buffer: List[str] = []

        for line in lines:
            line = line.strip()

            # 检测数据开始标记
            if line.startswith("$$") or "DY=" in line.upper() or "DX=" in line.upper():
                in_data_section = True
                data_buffer = []
                continue

            if line == "$END" or line.startswith("$"):
                # 处理缓冲的数据
                if data_buffer and result.x_unit:
                    self._parse_data_buffer(data_buffer, result)
                in_data_section = False
                data_buffer = []
                continue

            if in_data_section and line:
                data_buffer.append(line)

        # 处理最后的缓冲
        if data_buffer and result.x_unit:
            self._parse_data_buffer(data_buffer, result)

        # 如果没有找到 $$ 格式的数据，尝试直接解析
        if not result.points:
            self._parse_inline_data(text, result)

    def _parse_data_buffer(self, lines: List[str], result: JCAMPResult) -> None:
        """解析数据缓冲区"""
        # 合并多行数据
        combined = " ".join(lines)

        # 尝试 DX/DY 格式: DX=[x1,x2,...] DY=[y1,y2,...]
        dx_match = re.search(r'DX=\[([^\]]+)\]', combined, re.IGNORECASE)
        dy_match = re.search(r'DY=\[([^\]]+)\]', combined, re.IGNORECASE)

        if dx_match and dy_match:
            x_vals = [float(v.strip()) for v in dx_match.group(1).split(",") if v.strip()]
            y_vals = [float(v.strip()) for v in dy_match.group(1).split(",") if v.strip()]
            count = min(len(x_vals), len(y_vals), 10000)
            for i in range(count):
                result.points.append(JCAMPPoint(x=x_vals[i], y=y_vals[i]))
            return

        # 尝试单行 x-y 格式
        for match in self.DATA_LINE_PATTERN.finditer(combined):
            try:
                x = float(match.group(1))
                y = float(match.group(2))
                if result.x_min <= x <= result.x_max or not result.x_unit:
                    result.points.append(JCAMPPoint(x=x, y=y))
                    if len(result.points) >= 10000:
                        break
            except (ValueError, IndexError):
                continue

    def _parse_inline_data(self, text: str, result: JCAMPResult) -> None:
        """尝试直接解析文本中的坐标数据"""
        # 查找类似 "x y" 或 "x-y" 的数据对
        patterns = [
            re.compile(r'(\-?\d+\.?\d*)\s+([\-+]?\d+\.?\d*)'),  # x y
            re.compile(r'(\-?\d+\.?\d*)\s*\-\s*([\-+]?\d+\.?\d*)'),  # x-y
        ]

        for pattern in patterns:
            matches = pattern.findall(text)
            if len(matches) >= 10:  # 至少10个点才认为是数据
                for x_str, y_str in matches[:10000]:
                    try:
                        result.points.append(JCAMPPoint(
                            x=float(x_str),
                            y=float(y_str),
                        ))
                    except ValueError:
                        continue
                if result.points:
                    break

    def _identify_record_type(self, result: JCAMPResult) -> None:
        """识别记录类型"""
        # 从元数据中推断
        rec_type = result.metadata.get("REC.TYP", "").upper()

        if "FTIR" in rec_type or "INFRARED" in rec_type:
            result.record_type = "FTIR"
        elif "NMR" in rec_type:
            result.record_type = "NMR"
        elif "MS" in rec_type or "MASS" in rec_type:
            result.record_type = "MS"
        elif "GCMS" in rec_type or "GC-MS" in rec_type:
            result.record_type = "GC-MS"
        elif "UV" in rec_type or "VIS" in rec_type:
            result.record_type = "UV-VIS"
        elif "AAS" in rec_type:
            result.record_type = "AAS"
        elif result.x_unit == "CM-1" or result.x_unit == "WAVENUM":
            result.record_type = "FTIR"
        elif result.x_unit == "PPM":
            result.record_type = "NMR"
        elif result.x_unit == "M/Z" or result.x_unit == "MASS":
            result.record_type = "MS"
        else:
            result.record_type = rec_type if rec_type else "UNKNOWN"

    def _extract_peaks(self, result: JCAMPResult) -> List[Dict[str, Any]]:
        """从光谱数据中提取峰"""
        if len(result.points) < 3:
            return []

        peaks: List[Dict[str, Any]] = []
        points = result.points

        # 简单的峰检测算法：找到局部极大值
        min_peak_height = (result.y_max - result.y_min) * 0.05  # 至少5%的峰值范围

        for i in range(1, len(points) - 1):
            curr = points[i]
            prev = points[i - 1]
            nxt = points[i + 1]

            # 局部极大值检测
            if curr.y > prev.y and curr.y > nxt.y and curr.y > min_peak_height:
                # 查找更精确的峰值位置（二次插值）
                if curr.y > prev.y and curr.y > nxt.y:
                    peak_x = curr.x
                    peak_y = curr.y

                    # 计算峰宽（半高宽）
                    half_max = (result.y_max + curr.y) / 2
                    left_width = 0
                    right_width = 0

                    for j in range(i - 1, max(0, i - 50), -1):
                        if points[j].y < half_max:
                            left_width = peak_x - points[j].x
                            break

                    for j in range(i + 1, min(len(points), i + 50)):
                        if points[j].y < half_max:
                            right_width = points[j].x - peak_x
                            break

                    fwhm = left_width + right_width if (left_width > 0 or right_width > 0) else None

                    peaks.append({
                        "x": round(peak_x, 4),
                        "y": round(peak_y, 4),
                        "intensity_percent": round(
                            (peak_y - result.y_min) / (result.y_max - result.y_min) * 100, 1
                        ) if result.y_max != result.y_min else 0,
                        "fwhm": round(fwhm, 4) if fwhm else None,
                    })

        # 按强度排序，返回 Top 50
        peaks.sort(key=lambda p: p["intensity_percent"], reverse=True)
        return peaks[:50]


# 便捷函数
def parse_jcamp_dx(content: bytes) -> JCAMPResult:
    """解析 JCAMP-DX 文件内容"""
    parser = JcampDXParser()
    return parser.parse(content)
