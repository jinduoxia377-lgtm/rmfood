"""
AnIML 格式解析器

AnIML (Analytical Information Markup Language) 是分析化学领域的通用XML格式，
支持 HPLC、GC、ICP-MS 等多种仪器数据。

支持版本: AnIML 1.0 / 1.1 / 2.0

主要标签解析:
- <measurement>: 测量信息
- <result>: 数值结果
- <spectrum>: 谱图数据 (x/y 对)
- <chromatogram>: 色谱图数据
- <sample>: 样品信息
- <method>: 分析条件
"""
from __future__ import annotations

import logging
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class AnIMLPoint:
    """谱图/色谱数据点"""
    x: float
    y: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AnIMLMeasurement:
    """单次测量结果"""
    name: str
    value: Optional[float] = None
    unit: Optional[str] = None
    uncertainty: Optional[float] = None
    points: List[AnIMLPoint] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AnIMLSample:
    """样品信息"""
    name: str = ""
    id: str = ""
    description: str = ""
    concentration: Optional[float] = None
    concentration_unit: Optional[str] = None
    injection_volume: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AnIMLMethod:
    """分析条件"""
    instrument: str = ""
    method_name: str = ""
    description: str = ""
    parameters: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AnIMLResult:
    """完整解析结果"""
    samples: List[AnIMLSample] = field(default_factory=list)
    measurements: List[AnIMLMeasurement] = field(default_factory=list)
    method: Optional[AnIMLMethod] = None
    raw_metadata: Dict[str, Any] = field(default_factory=dict)
    parse_errors: List[str] = field(default_factory=list)

    @property
    def has_spectrum_data(self) -> bool:
        return any(m.points for m in self.measurements)

    @property
    def total_data_points(self) -> int:
        return sum(len(m.points) for m in self.measurements)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_count": len(self.samples),
            "measurement_count": len(self.measurements),
            "total_data_points": self.total_data_points,
            "has_spectrum": self.has_spectrum_data,
            "samples": [
                {
                    "name": s.name,
                    "id": s.id,
                    "concentration": s.concentration,
                    "concentration_unit": s.concentration_unit,
                }
                for s in self.samples
            ],
            "measurements": [
                {
                    "name": m.name,
                    "value": m.value,
                    "unit": m.unit,
                    "point_count": len(m.points),
                    "sample_points": m.points[:50],  # 限制返回前50个点
                }
                for m in self.measurements[:10]  # 最多10个测量
            ],
            "parse_errors": self.parse_errors[:5],
        }


class AnIMLParser:
    """AnIML 格式解析器"""

    # AnIML XML 命名空间
    NAMESPACES = {
        "animl": "http://www.animl.org/schema/animl-2.0",
        "animl1": "http://www.animl.org/schema/animl-1.1",
        "animl10": "http://www.animl.org/schema/animl-1.0",
        "xlink": "http://www.w3.org/1999/xlink",
    }

    def __init__(self):
        self._ns_map: Dict[str, str] = {}

    def parse(self, content: bytes) -> AnIMLResult:
        """解析 AnIML XML 内容"""
        result = AnIMLResult()

        try:
            # 尝试多种编码
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text = content.decode("gbk")
            except UnicodeDecodeError:
                text = content.decode("latin-1")

        # 检测命名空间
        root = ET.fromstring(text)
        self._detect_namespace(root)

        # 解析各部分
        result.raw_metadata = self._parse_metadata(root)
        result.samples = self._parse_samples(root)
        result.measurements = self._parse_measurements(root)
        result.method = self._parse_method(root)

        logger.info(
            "AnIML parsed: %d samples, %d measurements, %d data points",
            len(result.samples), len(result.measurements), result.total_data_points,
        )
        return result

    def _detect_namespace(self, root: ET.Element) -> None:
        """检测 XML 命名空间"""
        tag = root.tag
        if "animl-2.0" in tag:
            self._ns_map = {"": "http://www.animl.org/schema/animl-2.0"}
        elif "animl-1.1" in tag:
            self._ns_map = {"": "http://www.animl.org/schema/animl-1.1"}
        elif "animl-1.0" in tag:
            self._ns_map = {"": "http://www.animl.org/schema/animl-1.0"}
        else:
            # 尝试从根元素提取命名空间
            if tag.startswith("{"):
                ns = tag.split("}")[0].strip("{")
                self._ns_map = {"": ns}

    def _find(self, element: ET.Element, path: str) -> List[ET.Element]:
        """带命名空间的元素查找"""
        if self._ns_map:
            ns = self._ns_map.get("", "")
            if ns:
                path = path.replace("/", "{%s}/" % ns, 1) if "/" in path else "{%s}%s" % (ns, path)
        return element.findall(path)

    def _get_text(self, element: ET.Element, path: str, default: str = "") -> str:
        """获取文本内容"""
        found = self._find(element, path)
        if found:
            text = found[0].text
            return text.strip() if text else default
        return default

    def _parse_metadata(self, root: ET.Element) -> Dict[str, Any]:
        """解析元数据"""
        meta: Dict[str, Any] = {}

        # 获取文件名/标题
        title = self._get_text(root, ".//title")
        if title:
            meta["title"] = title

        # 获取创建时间
        created = self._get_text(root, ".//created")
        if created:
            try:
                meta["created_at"] = datetime.fromisoformat(created.replace("Z", "+00:00"))
            except ValueError:
                pass

        # 获取仪器信息
        instrument = self._get_text(root, ".//instrumentName")
        if instrument:
            meta["instrument"] = instrument

        # 获取方法信息
        method_name = self._get_text(root, ".//methodName")
        if method_name:
            meta["method_name"] = method_name

        return meta

    def _parse_samples(self, root: ET.Element) -> List[AnIMLSample]:
        """解析样品信息"""
        samples = []

        # 尝试多种路径查找样品
        sample_paths = [
            ".//sample",
            ".//sampleSet/sample",
            ".//result/sampleRef",
        ]

        seen_ids = set()
        for path in sample_paths:
            for elem in self._find(root, path):
                sample_id = self._get_text(elem, "id|@id", "")
                if sample_id in seen_ids:
                    continue
                seen_ids.add(sample_id)

                sample = AnIMLSample(
                    name=self._get_text(elem, "name|sampleName", sample_id),
                    id=sample_id,
                    description=self._get_text(elem, "description", ""),
                )

                # 解析浓度信息
                conc = self._get_text(elem, ".//concentration")
                conc_unit = self._get_text(elem, ".//concentrationUnit")
                if conc:
                    try:
                        sample.concentration = float(conc)
                    except ValueError:
                        pass
                    sample.concentration_unit = conc_unit or "ppm"

                samples.append(sample)

        # 如果没找到显式样品，创建默认样品
        if not samples:
            samples.append(AnIMLSample(name="default", id="default"))

        return samples

    def _parse_measurements(self, root: ET.Element) -> List[AnIMLMeasurement]:
        """解析测量结果"""
        measurements = []

        # 查找所有 result 元素
        for result_elem in self._find(root, ".//result"):
            measurement = self._parse_single_measurement(result_elem)
            if measurement:
                measurements.append(measurement)

        # 也查找 measurement 元素
        for m_elem in self._find(root, ".//measurement"):
            measurement = self._parse_single_measurement(m_elem)
            if measurement:
                measurements.append(measurement)

        return measurements

    def _parse_single_measurement(self, elem: ET.Element) -> Optional[AnIMLMeasurement]:
        """解析单个测量结果"""
        name = self._get_text(elem, "name|@name", "measurement")
        measurement = AnIMLMeasurement(name=name)

        # 解析数值结果
        value_text = self._get_text(elem, ".//value")
        if value_text:
            try:
                measurement.value = float(value_text)
            except ValueError:
                pass

        # 解析单位
        unit = self._get_text(elem, ".//unit")
        if unit:
            measurement.unit = unit

        # 解析不确定性
        unc_text = self._get_text(elem, ".//uncertainty")
        if unc_text:
            try:
                measurement.uncertainty = float(unc_text)
            except ValueError:
                pass

        # 解析谱图数据 (spectrum/chromatogram)
        points = self._parse_spectral_data(elem)
        if points:
            measurement.points = points

        # 解析附加元数据
        for child in elem:
            key = child.tag.split("}")[-1] if "}" in child.tag else child.tag
            if child.text:
                measurement.metadata[key] = child.text.strip()

        return measurement if (measurement.value is not None or measurement.points) else None

    def _parse_spectral_data(self, elem: ET.Element) -> List[AnIMLPoint]:
        """解析谱图数据点 (x/y 对)"""
        points: List[AnIMLPoint] = []

        # 方式1: 查找 explicitPoints
        for points_elem in self._find(elem, ".//explicitPoints"):
            x_text = self._get_text(points_elem, ".//x")
            y_text = self._get_text(points_elem, ".//y")
            if x_text and y_text:
                try:
                    points.append(AnIMLPoint(
                        x=float(x_text),
                        y=float(y_text),
                    ))
                except ValueError:
                    pass

        # 方式2: 查找 dataFile (引用外部文件)
        datafile_href = self._get_text(elem, ".//dataFile/@href")
        if datafile_href:
            # 外部数据文件引用，记录但不解析（需要文件路径）
            pass

        # 方式3: 查找 inlineData (内联数据)
        for data_elem in self._find(elem, ".//inlineData"):
            # 支持多种格式: "x y" 分隔、逗号分隔等
            text = data_elem.text or ""
            lines = text.strip().split("\n")
            for line in lines[:1000]:  # 限制解析行数
                parts = re.split(r"[\s,;]+", line.strip())
                if len(parts) >= 2:
                    try:
                        x = float(parts[0])
                        y = float(parts[1])
                        points.append(AnIMLPoint(x=x, y=y))
                    except ValueError:
                        pass

        return points[:10000]  # 限制最多10000个点

    def _parse_method(self, root: ET.Element) -> Optional[AnIMLMethod]:
        """解析分析方法"""
        method_elem = self._find(root, ".//method")[0] if self._find(root, ".//method") else None
        if not method_elem:
            method_elem = self._find(root, ".//measurementMethod")[0] if self._find(root, ".//measurementMethod") else None

        if not method_elem:
            return None

        method = AnIMLMethod(
            instrument=self._get_text(method_elem, ".//instrumentName", ""),
            method_name=self._get_text(method_elem, ".//methodName", ""),
            description=self._get_text(method_elem, ".//description", ""),
        )

        # 解析方法参数
        for param_elem in self._find(method_elem, ".//parameter"):
            name = self._get_text(param_elem, "name", "")
            value = self._get_text(param_elem, "value", "")
            if name and value:
                method.parameters[name] = value

        return method


# 便捷函数
def parse_animl(content: bytes) -> AnIMLResult:
    """解析 AnIML 文件内容"""
    parser = AnIMLParser()
    return parser.parse(content)
