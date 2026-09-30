"""
文档智能提取服务

对标 FormLab 的 CoA/PDS/SDS AI 提取能力：
- CoA (Certificate of Analysis): 成分分析报告
- PDS (Product Data Sheet): 产品数据表
- SDS (Safety Data Sheet): 安全数据表

处理流程：
  上传 → OCR → 字段提取 → 置信度评分 → 人工审核 → 应用

由于当前环境无 Tesseract/OCR 引擎，采用：
- PDF 文本层提取（pdfminer.six，如已安装）
- 结构化文档解析（python-docx）
- 基于规则的字段匹配（作为 OCR 的降级方案）
"""
from __future__ import annotations

import io
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# 文档类型对应的字段定义
DOCUMENT_FIELD_SCHEMAS: Dict[str, List[Dict[str, Any]]] = {
    "coa": [
        {"field": "batch_number", "label": "批号", "type": "string", "required": True},
        {"field": "product_name", "label": "产品名称", "type": "string", "required": True},
        {"field": "test_date", "label": "检测日期", "type": "date", "required": True},
        {"field": "expiry_date", "label": "有效期至", "type": "date", "required": False},
        {"field": "manufacturer", "label": "生产厂家", "type": "string", "required": False},
        {"field": "assay", "label": "含量测定", "type": "float", "required": True},
        {"field": "moisture", "label": "水分", "type": "float", "required": True},
        {"field": "heavy_metal", "label": "重金属", "type": "string", "required": False},
        {"field": "arsenic", "label": "砷盐", "type": "float", "required": False},
        {"field": "lead", "label": "铅", "type": "float", "required": False},
        {"field": "cadmium", "label": "镉", "type": "float", "required": False},
        {"field": "mercury", "label": "汞", "type": "float", "required": False},
        {"field": "microbial_count", "label": "微生物总数", "type": "string", "required": False},
        {"field": "e_coli", "label": "大肠埃希氏菌", "type": "string", "required": False},
        {"field": "salmonella", "label": "沙门氏菌", "type": "string", "required": False},
        {"field": "pass_fail", "label": "检验结论", "type": "string", "required": True},
    ],
    "pds": [
        {"field": "product_name", "label": "产品名称", "type": "string", "required": True},
        {"field": "specification", "label": "规格", "type": "string", "required": True},
        {"field": "appearance", "label": "外观", "type": "string", "required": False},
        {"field": "solubility", "label": "溶解性", "type": "string", "required": False},
        {"field": "storage_condition", "label": "储存条件", "type": "string", "required": True},
        {"field": "shelf_life", "label": "保质期", "type": "string", "required": False},
        {"field": "packaging", "label": "包装规格", "type": "string", "required": False},
        {"field": "main_ingredients", "label": "主要成分", "type": "string", "required": False},
        {"field": "application", "label": "应用领域", "type": "string", "required": False},
    ],
    "sd": [
        {"field": "chemical_name", "label": "化学品名称", "type": "string", "required": True},
        {"field": "cas_number", "label": "CAS 号", "type": "string", "required": True},
        {"field": "hazard_classification", "label": "危险性概述", "type": "string", "required": True},
        {"field": "first_aid", "label": "急救措施", "type": "string", "required": False},
        {"field": "fire_fighting", "label": "消防措施", "type": "string", "required": False},
        {"field": "handling_storage", "label": "操作处置与储存", "type": "string", "required": False},
        {"field": "ppe_required", "label": "个人防护装备", "type": "string", "required": False},
        {"field": "ec_number", "label": "EC 号", "type": "string", "required": False},
    ],
}


@dataclass
class ExtractedField:
    """单个提取字段"""
    field: str
    label: str
    value: Any
    confidence: float       # 0.0 - 1.0
    source_section: str = ""  # 原文中出现的位置描述


@dataclass
class ExtractionProposal:
    """提取提案（等待人工审核）"""
    document_type: str
    extracted_fields: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    confidence_scores: Dict[str, float] = field(default_factory=dict)
    requires_review: bool = False
    raw_text_preview: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def overall_confidence(self) -> float:
        if not self.confidence_scores:
            return 0.0
        scores = list(self.confidence_scores.values())
        return sum(scores) / len(scores)

    @property
    def is_approved(self) -> bool:
        return not self.requires_review and self.overall_confidence >= 0.85

    def to_dict(self) -> Dict[str, Any]:
        return {
            "document_type": self.document_type,
            "extracted_fields": self.extracted_fields,
            "confidence_scores": self.confidence_scores,
            "requires_review": self.requires_review,
            "overall_confidence": round(self.overall_confidence, 3),
            "raw_text_preview": self.raw_text_preview[:500] if self.raw_text_preview else "",
            "metadata": self.metadata,
        }


class DocumentExtractor:
    """
    供应商文档智能提取引擎

    支持的文档类型：
    - coa: Certificate of Analysis（成分分析报告）
    - pds: Product Data Sheet（产品数据表）
    - sd: Safety Data Sheet（安全数据表）

    提取策略（优先级从高到低）：
    1. PDF 文本层直接提取（pdfminer.six）
    2. Word 文档解析（python-docx）
    3. 基于规则的文本匹配（正则表达式）
    4. 降级的通用字段发现
    """

    # 常见字段的正则模式
    FIELD_PATTERNS: Dict[str, Dict[str, Any]] = {
        "batch_number": {
            "patterns": [
                r"(?:批号|Batch\s*No\.?|Batch\s*Number|LOT|Lot\s*No\.?|生产批号)\s*[:：]?\s*(\S+)",
                r"(?:BATCH|LOT|批号)\s*[-:：]?\s*([A-Z0-9\-]{4,})",
            ],
            "confidence": 0.85,
        },
        "product_name": {
            "patterns": [
                r"(?:产品名称|Product\s*Name|商品名|品名)\s*[:：]?\s*([^\n]{2,50})",
                r"(?:NAME|产品)\s*[-:：]?\s*([^\n]{2,50})",
                r"^([^\n：:]{2,30})$|^产品名称\s*[:：]\s*([^\n]{2,50})",
            ],
            "confidence": 0.80,
        },
        "test_date": {
            "patterns": [
                r"(?:检测日期|Test\s*Date|Testing\s*Date|Date\s*of\s*Test)\s*[:：]?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})",
                r"(?:日期|Date)\s*[:：]?\s*(\d{1,2}[-/]\w{3,9}[-/]\d{2,4})",
            ],
            "confidence": 0.80,
        },
        "expiry_date": {
            "patterns": [
                r"(?:有效期至|Expiry|EXP|有效期|Exp\s*Date)\s*[:：]?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})",
                r"(?:EXP|有效期)\s*[:：]?\s*(\d{1,2}[-/]\w{3,9})",
            ],
            "confidence": 0.75,
        },
        "manufacturer": {
            "patterns": [
                r"(?:生产厂家|Manufacturer|Producer|公司)\s*[:：]?\s*([^\n]{2,80})",
            ],
            "confidence": 0.70,
        },
        "assay": {
            "patterns": [
                r"(?:含量测定|含量|Assay|效价|纯度)\s*[:：]?\s*(?:≥|<=)?\s*([\d.]+)\s*%",
                r"([\u4e00-\u9fa5]{2,10}(?:含量|多糖|苷|酸))\s*(?:≥|<=)\s*([\d.]+)\s*%",
                r"(?:Assay)\s*[\-:：]\s*([\d.]+)\s*[%–]",
            ],
            "confidence": 0.85,
        },
        "moisture": {
            "patterns": [
                r"(?:水分|Moisture|含水量|Loss\s*on\s*Drying)\s*[:：]?\s*([\d.]+)\s*%",
                r"水分\s*[:：]?\s*(?:≤|<=)\s*([\d.]+)\s*%",
                r"(?:MOISTURE)\s*[\-:：]\s*([\d.]+)\s*[%–]",
            ],
            "confidence": 0.80,
        },
        "heavy_metal": {
            "patterns": [
                r"(?:重金属|Heavy\s*Metal)\s*[:：]?\s*([^\n]{1,80})",
            ],
            "confidence": 0.70,
        },
        "lead": {
            "patterns": [
                r"铅\s*[:：]?\s*(?:≤|<=)?\s*([\d.]+)\s*(?:mg/kg|ppm)?",
                r"(?:Pb|铅)\s*[:：]?\s*([\d.]+)\s*(?:ppm|mg/kg)?",
            ],
            "confidence": 0.75,
        },
        "arsenic": {
            "patterns": [
                r"砷\s*[:：]?\s*(?:≤|<=)?\s*([\d.]+)\s*(?:mg/kg|ppm)?",
                r"(?:As|砷)\s*[:：]?\s*([\d.]+)\s*(?:ppm|mg/kg)?",
            ],
            "confidence": 0.75,
        },
        "mercury": {
            "patterns": [
                r"汞\s*[:：]?\s*(?:≤|<=)?\s*([\d.]+)\s*(?:mg/kg|ppm)?",
                r"(?:Hg|汞)\s*[:：]?\s*([\d.]+)\s*(?:ppm|mg/kg)?",
            ],
            "confidence": 0.75,
        },
        "microbial_count": {
            "patterns": [
                r"(?:细菌总数|总菌落|Aerobic\s*Plate\s*Count|TPC)\s*[:：]?\s*(?:≤|<=)?\s*([\d,]+\s*cfu[/g])",
                r"细菌总数\s*[:：]?\s*(?:≤|<=)?\s*([\d,]+)\s*cfu[/g]",
            ],
            "confidence": 0.70,
        },
        "e_coli": {
            "patterns": [
                r"(?:大肠埃希氏菌|大肠杆菌|E\s*\.\s*coli)\s*[:：]?\s*(阴性|阳性|[^\n]{1,30})",
            ],
            "confidence": 0.70,
        },
        "salmonella": {
            "patterns": [
                r"(?:沙门氏菌|Salmonella)\s*[:：]?\s*(阴性|阳性|[^\n]{1,30})",
            ],
            "confidence": 0.70,
        },
        "pass_fail": {
            "patterns": [
                r"(?:检验结论|Result|结论|Pass|Fail|合格|不合格)\s*[:：]?\s*(\S+)",
                r"(?:RESULT|CONCLUSION)\s*[-:：]\s*(\S+)",
            ],
            "confidence": 0.85,
        },
        "cas_number": {
            "patterns": [
                r"(?:CAS\s*No\.?|CAS\s*号)\s*[:：]?\s*(\d{2,7}[-]\d{2}[-]\d)",
                r"\b(\d{2,7}-\d{2}-\d)\b",
            ],
            "confidence": 0.90,
        },
        "storage_condition": {
            "patterns": [
                r"(?:储存条件|Storage|保存条件)\s*[:：]?\s*([^\n]{2,60})",
            ],
            "confidence": 0.70,
        },
    }

    def __init__(self):
        logger.info("DocumentExtractor 初始化完成")

    async def extract(
        self,
        document_bytes: bytes,
        document_type: str,
        ingredient_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        从供应商文档中提取结构化数据

        Args:
            document_bytes: 文档原始字节（PDF/DOCX/TXT/图片）
            document_type: "coa" | "pds" | "sd"
            ingredient_id: 关联的食材 ID（可选）

        Returns:
            ExtractionProposal 字典
        """
        if document_type not in ("coa", "pds", "sd"):
            return {"error": f"Unknown document type: {document_type}. Expected coa/pds/sd"}

        # 1. 提取原始文本
        raw_text = await self._extract_text(document_bytes, document_type)

        # 2. 基于规则的字段提取
        schema = DOCUMENT_FIELD_SCHEMAS.get(document_type, [])
        extracted: Dict[str, Dict[str, Any]] = {}
        confidence_scores: Dict[str, float] = {}

        for field_def in schema:
            field_name = field_def["field"]
            field_label = field_def["label"]

            # 查找匹配的模式
            pattern_info = self.FIELD_PATTERNS.get(field_name)
            value = None
            confidence = 0.0

            if pattern_info:
                value, confidence = self._match_pattern(raw_text, pattern_info["patterns"], pattern_info["confidence"])
            else:
                # 通用 fallback：扫描所有行
                value, confidence = self._generic_extract(raw_text, field_label)

            if value is not None:
                extracted[field_name] = {
                    "value": value,
                    "label": field_label,
                    "confidence": round(confidence, 3),
                }
                confidence_scores[field_name] = confidence

        # 3. 确定是否需要人工审核
        requires_review = any(
            conf < 0.7 for conf in confidence_scores.values()
        ) or (
            len(confidence_scores) < len(schema) * 0.5  # 提取率低于 50%
        )

        # 4. 构建提案
        proposal = ExtractionProposal(
            document_type=document_type,
            extracted_fields=extracted,
            confidence_scores=confidence_scores,
            requires_review=requires_review,
            raw_text_preview=raw_text[:1000],
            metadata={
                "ingredient_id": ingredient_id,
                "extracted_at": datetime.utcnow().isoformat(),
                "total_fields_expected": len(schema),
                "total_fields_found": len(extracted),
            },
        )

        return proposal.to_dict()

    async def _extract_text(self, document_bytes: bytes, doc_type: str) -> str:
        """
        从文档字节中提取文本
        尝试多种解析方式，返回最优结果
        """
        # 1. 先判断是否为纯文本文件（避免对 .txt 跑 pdfminer/docx 的异常噪声）
        is_pdf = document_bytes[:4] == b"%PDF"
        is_docx = document_bytes[:4] == b"PK\x03\x04"
        is_txt = not is_pdf and not is_docx

        # 2. 按文件类型提取文本
        text = ""
        if is_pdf:
            try:
                from pdfminer.high_level import extract_text
                text = extract_text(io.BytesIO(document_bytes)) or ""
            except Exception as e:
                logger.debug(f"pdfminer failed: {e}")
        elif is_docx:
            try:
                from docx import Document
                doc = Document(io.BytesIO(document_bytes))
                text = "\n".join(p.text for p in doc.paragraphs)
            except Exception as e:
                logger.debug(f"python-docx failed: {e}")
        else:
            # 纯文本：UTF-8 优先，回退 GBK
            for enc in ("utf-8", "utf-8-sig", "gbk"):
                try:
                    text = document_bytes.decode(enc)
                    break
                except (UnicodeDecodeError, LookupError):
                    continue

        # 兜底：以上都没拿到就用 utf-8 替换解码
        if not text:
            try:
                text = document_bytes.decode("utf-8", errors="replace")
            except Exception:
                pass

        if text and len(text.strip()) > 0:
            return text

        # 降级：图片需 OCR（暂未接入）
        logger.warning("No text layer found in document. OCR would be needed.")
        return ""

    def _match_pattern(
        self, text: str, patterns: List[str], base_confidence: float
    ) -> tuple:
        """使用正则匹配提取字段值（多捕获组时优先取末个非空组）"""
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                groups = [g for g in match.groups() if g and g.strip()]
                if not groups:
                    continue
                # 多捕获组时，优先数值捕获组（含量测定类字段的标签组在前）；单组直接取
                if len(groups) > 1:
                    numeric = [g for g in groups if re.match(r"^[\d.,\s%]+$", g.strip())]
                    value = numeric[-1] if numeric else groups[-1]
                else:
                    value = groups[0]
                value = value.strip()
                value = re.sub(r"[^\w\s\-\.\/\%\+\u4e00-\u9fa5]", "", value)[:100]
                if value:
                    return value, base_confidence
        return None, 0.0

    def _generic_extract(self, text: str, label: str) -> tuple:
        """通用字段发现（基于标签关键词）"""
        # 查找包含标签关键词的行
        keywords = label.split()
        for line in text.split("\n"):
            if any(kw.lower() in line.lower() for kw in keywords):
                # 提取冒号后的值
                match = re.search(r"[:：]\s*(.+)", line)
                if match:
                    value = match.group(1).strip()
                    if value and len(value) > 1:
                        return value, 0.5  # 低置信度
        return None, 0.0

    async def batch_extract(
        self,
        documents: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        批量提取多个文档

        Args:
            documents: [{"bytes": bytes, "type": "coa", "ingredient_id": int}, ...]

        Returns:
            提取结果列表
        """
        results = []
        for doc in documents:
            result = await self.extract(
                document_bytes=doc["bytes"],
                document_type=doc["type"],
                ingredient_id=doc.get("ingredient_id"),
            )
            results.append(result)
        return results


# ═══════════════════════════════════════════
# 单例工厂
# ═══════════════════════════════════════════

_instance: Optional[DocumentExtractor] = None


def get_document_extractor() -> DocumentExtractor:
    global _instance
    if _instance is None:
        _instance = DocumentExtractor()
    return _instance
