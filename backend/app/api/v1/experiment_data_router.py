"""
实验数据解析 API

提供实验数据文件上传和解析功能，支持：
- AnIML 格式（HPLC/GC/ICP-MS 等）
- JCAMP-DX 格式（FTIR/NMR/MS/GC-MS 等）
- 通用 CSV/TSV 格式
"""
import logging
from typing import List

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.services.experiment.parsers import AnIMLParser, JcampDXParser
from app.services.experiment.signal_processor import (
    PeakRecognitionEngine,
    SpectrumType,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/experiment-data", tags=["实验数据解析"])


class ParseResult(BaseModel):
    format: str
    point_count: int
    peak_count: int
    spectrum_type: str
    x_unit: str
    y_unit: str
    x_range: list
    y_range: list
    peaks: list
    notes: list


@router.post("/parse", summary="解析实验数据文件")
async def parse_experiment_data(
    file: UploadFile = File(..., description="实验数据文件"),
    format_type: str = Query("auto", description="文件格式: auto/animl/jcamp/csv"),
    recognize_peaks: bool = Query(True, description="是否进行峰识别"),
):
    """
    上传并解析实验数据文件。

    支持格式:
    - AnIML: 分析仪器通用 XML 格式 (HPLC, GC, ICP-MS)
    - JCAMP-DX: 光谱数据交换标准 (FTIR, NMR, MS, GC-MS)
    - CSV/TSV: 通用表格数据 (两列: x, y)
    """
    content = await file.read()
    filename = file.filename or ""

    # 自动检测格式
    fmt = format_type
    if fmt == "auto":
        content_str = content.decode("utf-8", errors="replace").lower()
        if "<measurement" in content_str or "<spectrum" in content_str:
            fmt = "animl"
        elif "^" in content and "$END" in content:
            fmt = "jcamp"
        else:
            fmt = "csv"

    try:
        if fmt == "animl":
            return await _parse_animl(content, recognize_peaks)
        elif fmt == "jcamp":
            return await _parse_jcamp(content, recognize_peaks)
        else:
            return await _parse_csv(content, recognize_peaks, filename)
    except Exception as e:
        logger.error("Parse failed: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail=f"解析失败: {e}")


async def _parse_animl(content: bytes, recognize: bool) -> dict:
    parser = AnIMLParser()
    result = parser.parse(content)

    resp = {
        "format": "AnIML",
        "point_count": result.total_data_points,
        "sample_count": len(result.samples),
        "measurement_count": len(result.measurements),
        "parse_errors": result.parse_errors,
        "metadata": {
            "title": result.raw_metadata.get("title", ""),
            "instrument": result.raw_metadata.get("instrument", ""),
            "method_name": result.raw_metadata.get("method_name", ""),
        },
    }

    if recognize and result.has_spectrum_data:
        # 对第一个有数据的测量进行峰识别
        for m in result.measurements:
            if m.points:
                x_vals = [p.x for p in m.points]
                y_vals = [p.y for p in m.points]
                engine = PeakRecognitionEngine(SpectrumType.HPLC)
                analysis = engine.analyze(x_vals, y_vals)
                resp["analysis"] = analysis.to_dict()
                break
    elif not result.has_spectrum_data:
        resp["measurements"] = result.to_dict().get("measurements", [])

    return {"success": True, "data": resp}


async def _parse_jcamp(content: bytes, recognize: bool) -> dict:
    parser = JcampDXParser()
    result = parser.parse(content)

    resp = result.to_dict()
    resp["format"] = "JCAMP-DX"

    if recognize and result.points:
        x_vals = [p.x for p in result.points]
        y_vals = [p.y for p in result.points]
        spectrum_type_map = {
            "FTIR": SpectrumType.FTIR,
            "NMR": SpectrumType.NMR,
            "MS": SpectrumType.MS,
            "GC-MS": SpectrumType.GC_MS,
            "HPLC": SpectrumType.HPLC,
            "UV-VIS": SpectrumType.UV_VIS,
        }
        stype = spectrum_type_map.get(result.record_type, SpectrumType.FTIR)
        engine = PeakRecognitionEngine(stype)
        analysis = engine.analyze(x_vals, y_vals, result.x_unit)
        resp["analysis"] = analysis.to_dict()

    return {"success": True, "data": resp}


async def _parse_csv(content: bytes, recognize: bool, filename: str) -> dict:
    """解析 CSV/TSV 格式数据（两列 x, y）"""
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("gbk")

    lines = [line.strip() for line in text.strip().split("\n") if line.strip()]
    if len(lines) < 2:
        raise ValueError("数据太少，至少需要2行")

    # 检测分隔符
    sep = "\t" if "\t" in lines[0] else ","
    if sep == "," and ";" in lines[0]:
        sep = ";"

    # 跳过可能的标题行
    data_lines = lines
    if any(kw in data_lines[0].lower() for kw in ("x", "y", "wavelength", "time", "intensity")):
        data_lines = lines[1:]

    x_vals: List[float] = []
    y_vals: List[float] = []

    for line in data_lines[:10000]:
        parts = line.split(sep)
        if len(parts) >= 2:
            try:
                x_vals.append(float(parts[0]))
                y_vals.append(float(parts[1]))
            except ValueError:
                continue

    if len(x_vals) < 3:
        raise ValueError("有效数据点不足（需要至少3个）")

    result = {
        "format": "CSV/TSV",
        "point_count": len(x_vals),
        "sample_file": filename,
    }

    if recognize:
        engine = PeakRecognitionEngine(SpectrumType.HPLC)
        analysis = engine.analyze(x_vals, y_vals)
        result["analysis"] = analysis.to_dict()

    return {"success": True, "data": result}
