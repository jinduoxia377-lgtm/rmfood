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
                r"(?:NAME|产品)\s*[-:：]\s*([^\n]{2,50})",
                r"^产品名称\s*[:：]\s*([^\n]{2,50})",
            ],
            "confidence": 0.80,
        },
        "test_date": {
            "patterns": [
                r"(?:检测日期|Test\s*Date|Testing\s*Date|Date\s*of\s*Test)\s*[:：]?\s*(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日|\d{4}[-/]\d{1,2}[-/]\d{1,2})",
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
                r"(?:生产厂家|生产厂商|制造厂商|Manufacturer|Produced\s*by)\s*[:：]?\s*([^\n]{2,80})",
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
        "cadmium": {
            "patterns": [
                r"镉\s*[:：]?\s*(?:≤|<=)?\s*([\d.]+)\s*(?:mg/kg|ppm)?",
                r"(?:Cd|镉)\s*[:：]?\s*([\d.]+)\s*(?:ppm|mg/kg)?",
            ],
            "confidence": 0.75,
        },
        "microbial_count": {
            "patterns": [
                r"(?:细菌总数|总菌落|Aerobic\s*Plate\s*Count|TPC)\s*[:：]?\s*(?:≤|<=|＜|<)?\s*([\d,]+\s*cfu/g)",
                r"细菌总数\s*[:：]?\s*(?:≤|<=|＜|<)?\s*([\d,]+)\s*cfu/g",
            ],
            "confidence": 0.70,
        },
        "e_coli": {
            "patterns": [
                r"(?:大肠埃希氏菌|大肠杆菌|E\s*\.\s*coli)\s*[:：]?\s*(阴性|阳性|未检出|[^\n]{1,30})",
            ],
            "confidence": 0.70,
        },
        "salmonella": {
            "patterns": [
                r"(?:沙门氏菌|Salmonella)\s*[:：]?\s*(阴性|阳性|未检出|[^\n]{1,30})",
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

        # 1. 提取原始文本 + OCR 结构化块
        raw_text, ocr_blocks = await self._extract_text(document_bytes, document_type)

        # 2. 基于规则的字段提取
        schema = DOCUMENT_FIELD_SCHEMAS.get(document_type, [])
        extracted: Dict[str, Dict[str, Any]] = {}
        confidence_scores: Dict[str, float] = {}

        for field_def in schema:
            field_name = field_def["field"]
            field_label = field_def["label"]

            value = None
            confidence = 0.0

            # OCR 场景优先使用坐标匹配（标签块右侧/下方值块）
            if ocr_blocks:
                value, confidence = self._extract_field_from_blocks(ocr_blocks, field_name)

            if value is None:
                # 查找匹配的模式
                pattern_info = self.FIELD_PATTERNS.get(field_name)
                if pattern_info:
                    value, confidence = self._match_pattern(raw_text, pattern_info["patterns"], pattern_info["confidence"])
                    # 正则未命中时，尝试行级上下文提取（适配表格型 OCR 文本）
                    if value is None:
                        value, confidence = self._extract_by_line_context(raw_text, field_name)
                else:
                    # 通用 fallback：扫描所有行
                    value, confidence = self._generic_extract(raw_text, field_label)
                    if value is None:
                        value, confidence = self._extract_by_line_context(raw_text, field_name)

            if value is not None and self._is_plausible_value(value, field_name):
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

        result_dict = proposal.to_dict()
        # OCR 场景：解析检验明细表格（项目/标准/检测结果/判定）
        if ocr_blocks:
            result_dict["inspection_items"] = self._parse_inspection_table(ocr_blocks)
        return result_dict

    @staticmethod
    def _clean_noise_lines(text: str) -> str:
        """清理 PDF/DOCX 文本层中的噪声行。

        pdfminer 提取的文本常混入 PDF 内部资源（字体名 /CIDFont+F1）、
        元数据（Producer: Microsoft Print To PDF）、页码等，这些会严重干扰
        正则字段匹配，必须先按行过滤。
        """
        if not text:
            return text
        noise_keywords = (
            "/CIDFont", "/Type0", "/Subtype", "/BaseFont", "/FontFile",
            "/Length", "/ToUnicode", "/Widths", "/FontDescriptor",
            "Microsoft Print To PDF", "Producer:", "Creator:", "pdfFactory",
            "Adobe PDF Library", "PDFlib", "Generated by",
        )
        cleaned: List[str] = []
        for raw_line in text.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            # 1. PDF 内部对象/字体资源行（通常以 / 开头）
            if line.startswith("/"):
                continue
            # 2. PDF 元数据 / 打印驱动 / 生成器信息
            if any(kw.lower() in line.lower() for kw in noise_keywords):
                continue
            # 3. 纯数字/页码/页眉页脚行（如 "1"、"Page 1 of 2"、"第 1 页"）
            if re.fullmatch(r"[\d\s\-.,:：/()页第共ofPpAaGgEeNn]{1,14}", line):
                continue
            cleaned.append(raw_line)
        return "\n".join(cleaned)

    @staticmethod
    def _has_meaningful_text(text: str) -> bool:
        """判断文本是否包含足够的可读内容（用于识别扫描件/无文本层）。"""
        if not text:
            return False
        printable = "".join(ch for ch in text if ch.isprintable() or ch in "\n\r\t")
        return len(printable.strip()) >= 30

    _ocr_engine = None

    @classmethod
    def _get_ocr_engine(cls):
        """惰性加载 RapidOCR 引擎（进程内单例，避免重复加载模型）。"""
        if cls._ocr_engine is None:
            from rapidocr_onnxruntime import RapidOCR
            cls._ocr_engine = RapidOCR()
        return cls._ocr_engine

    def _ocr_pdf_blocks(self, document_bytes: bytes) -> List[Dict[str, Any]]:
        """将扫描型 PDF 逐页渲染为图像，用 RapidOCR 识别，返回结构化文本块。

        每个文本块：{"text": str, "x": int, "y": int, "w": int, "h": int}
        坐标基于渲染图像像素（scale=1.8，兼顾速度与识别率），用于表格结构（标签列/值列）的空间匹配。

        说明：RapidOCR 模型为进程内单例，首次调用需加载模型（约 15-25 秒），
        后续请求复用模型，通常 3-8 秒即可完成。
        """
        import numpy as np
        import pypdfium2 as pdfium

        engine = self._get_ocr_engine()
        blocks: List[Dict[str, Any]] = []
        pdf = pdfium.PdfDocument(document_bytes)
        try:
            for page in pdf:
                bitmap = page.render(scale=1.8)
                pil_img = bitmap.to_pil()
                img = np.array(pil_img.convert("RGB"))
                out = engine(img)
                result = out[0] if isinstance(out, tuple) else out
                if result:
                    for item in result:
                        try:
                            box, text, _score = item[0], item[1], item[2]
                            xs = [p[0] for p in box]
                            ys = [p[1] for p in box]
                            x, y = int(min(xs)), int(min(ys))
                            w = int(max(xs) - min(xs))
                            h = int(max(ys) - min(ys))
                            blocks.append({"text": str(text), "x": x, "y": y, "w": w, "h": h})
                        except Exception:
                            continue
        finally:
            pdf.close()
        return blocks

    async def _extract_text(self, document_bytes: bytes, doc_type: str) -> tuple:
        """
        从文档字节中提取文本，并返回 OCR 结构化文本块（无 OCR 时为空列表）。

        Returns:
            (text: str, ocr_blocks: List[Dict]) — ocr_blocks 用于基于坐标的表格字段匹配
        """
        # 1. 先判断是否为纯文本文件（避免对 .txt 跑 pdfminer/docx 的异常噪声）
        is_pdf = document_bytes[:4] == b"%PDF"
        is_docx = document_bytes[:4] == b"PK\x03\x04"

        # 2. 按文件类型提取文本
        text = ""
        ocr_blocks: List[Dict[str, Any]] = []
        if is_pdf:
            try:
                from pdfminer.high_level import extract_text
                text = extract_text(io.BytesIO(document_bytes)) or ""
                # 清理 PDF 内部资源/元数据噪声，避免干扰字段匹配
                text = self._clean_noise_lines(text)
            except Exception as e:
                logger.debug(f"pdfminer failed: {e}")
                text = ""
            # 文本层不可用（扫描件/图片型 PDF）→ 渲染页面并 OCR 识别
            if not self._has_meaningful_text(text):
                try:
                    logger.info("PDF 无文本层，尝试 RapidOCR 识别...")
                    ocr_blocks = self._ocr_pdf_blocks(document_bytes)
                    text = "\n".join(b["text"] for b in ocr_blocks)
                    text = self._clean_noise_lines(text)
                except Exception as e:
                    logger.warning(f"OCR failed: {e}")
                    text = ""
                    ocr_blocks = []
        elif is_docx:
            try:
                from docx import Document
                doc = Document(io.BytesIO(document_bytes))
                text = "\n".join(p.text for p in doc.paragraphs)
            except Exception as e:
                logger.debug(f"python-docx failed: {e}")
                text = ""
        else:
            # 纯文本：UTF-8 优先，回退 GBK；仅纯文本文件允许二进制兜底解码
            for enc in ("utf-8", "utf-8-sig", "gbk"):
                try:
                    text = document_bytes.decode(enc)
                    break
                except (UnicodeDecodeError, LookupError):
                    continue
            if not text:
                try:
                    text = document_bytes.decode("utf-8", errors="replace")
                except Exception:
                    pass

        # 有效性检查：过滤控制字符/二进制噪声后，仍应存在足够的可读文本。
        # PDF/DOCX 解析失败时不得用二进制兜底（会把压缩流误解码成乱码）。
        if text:
            printable = "".join(ch for ch in text if ch.isprintable() or ch in "\n\r\t")
            if len(printable.strip()) >= 30:
                return text, ocr_blocks

        # 降级：图片/扫描件需 OCR（暂未接入）
        logger.warning("No text layer found in document. OCR would be needed.")
        return "", ocr_blocks

    # 行级上下文提取用的标签别名表（适配表格型 OCR 文本：字段名与值常在不同行）
    FIELD_LINE_LABELS: Dict[str, List[str]] = {
        "batch_number": ["批号", "生产批号", "Batch No", "Batch No.", "LOT", "Lot"],
        "product_name": ["产品名称", "Product Name", "品名", "商品名"],
        "test_date": ["生产日期", "检测日期", "Mfg. Date", "Test Date", "Testing Date"],
        "expiry_date": ["有效期至", "有效期", "Expiry", "Exp", "Exp Date"],
        "manufacturer": ["生产厂家", "生产厂商", "制造厂商", "制造商", "Manufacturer"],
        "assay": ["含量测定", "含量", "Assay", "效价", "纯度"],
        "moisture": ["水分", "Moisture", "含水量", "Loss on Drying"],
        "heavy_metal": ["重金属", "Heavy Metal"],
        "arsenic": ["砷", "砷盐"],
        "lead": ["铅", "Pb"],
        "cadmium": ["镉", "Cd"],
        "mercury": ["汞", "Hg"],
        "microbial_count": ["细菌总数", "总菌落", "微生物", "TPC", "Aerobic Plate Count"],
        "e_coli": ["大肠杆菌", "大肠埃希氏菌", "大肠埃希", "E.coli", "E. coli"],
        "salmonella": ["沙门氏菌", "Salmonella"],
        "pass_fail": ["检验结论", "检验结果", "结论", "Result", "Test Result", "判定", "Pass", "Fail"],
        "specification": ["规格", "Spec.", "Spec"],
        "appearance": ["外观", "性状", "Appearance"],
        "storage_condition": ["储存条件", "Storage", "保存条件"],
        "shelf_life": ["保质期", "有效期", "Shelf Life"],
        "packaging": ["包装", "Packaging"],
        "main_ingredients": ["主要成分", "Main Ingredients"],
        "chemical_name": ["化学品名称", "Chemical Name"],
        "cas_number": ["CAS号", "CAS No", "CAS"],
        "ec_number": ["EC号", "EC No", "EINECS"],
    }

    def _extract_by_line_context(self, text: str, field_name: str) -> tuple:
        """行级上下文提取：在按行拆分的文本中定位标签行，并从该行/下一行取值。

        适配表格型 OCR 文本（如“产品名称\\n牛骨胶原蛋白肽”），字段名和值不在同一行时，
        全文正则无法正确取值，此方法按“标签行 + 下一行”提取。
        """
        labels = self.FIELD_LINE_LABELS.get(field_name, [field_name])
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        for i, line in enumerate(lines):
            for label in labels:
                if label.lower() in line.lower():
                    # 1) 冒号后取值（如 "产品名称：牛骨胶原蛋白肽"）
                    m = re.search(r"[:：]\s*(.+)", line)
                    if m and len(m.group(1).strip()) >= 2:
                        return m.group(1).strip(), 0.6
                    # 2) 行内标签后取值（如 "产品名称 牛骨胶原蛋白肽"）
                    lower_line = line.lower()
                    lower_label = label.lower()
                    idx = lower_line.find(lower_label)
                    if idx >= 0:
                        rest = line[idx + len(label):].strip()
                        # 过滤明显不合理的值：超长、含过多英文空格串（表格噪音）
                        if len(rest) >= 2 and len(rest) <= 60 and rest.count(" ") <= 12:
                            return rest, 0.6
                    # 3) 下一行作为值（表格布局：标签行与值行分离）
                    if i + 1 < len(lines):
                        nxt = lines[i + 1]
                        # 下一行是另一个字段标签（如“生产日期”后接“生产批号”）则跳过
                        if self._looks_like_label(nxt, field_name):
                            continue
                        if len(nxt) >= 2 and len(nxt) <= 60 and nxt.count(" ") <= 12:
                            return nxt, 0.6
        return None, 0.0

    def _extract_field_from_blocks(
        self, blocks: List[Dict[str, Any]], field_name: str
    ) -> tuple:
        """基于 OCR 坐标匹配字段值：定位标签块后，取同行右侧或正下方的值块。"""
        labels = self.FIELD_LINE_LABELS.get(field_name, [field_name])
        for block in blocks:
            lower_text = block["text"].lower()
            for label in labels:
                if len(label) >= 2 and label.lower() in lower_text:
                    value = self._find_value_block(blocks, block, field_name)
                    if value:
                        return value, 0.65
        return None, 0.0

    def _find_value_block(
        self, blocks: List[Dict[str, Any]], label_block: Dict[str, Any], field_name: str
    ) -> Optional[str]:
        """在标签块周围查找值块。

        优先：同一水平行、位于标签右侧的最近块（表格“标签列 → 值列”）。
        次优：位于标签正下方的块（上下排布）。
        排除其他字段标签块，避免“生产日期”右侧取到“生产批号”。
        """
        lb_x, lb_y, lb_w, lb_h = label_block["x"], label_block["y"], label_block["w"], label_block["h"]
        lb_cx = lb_x + lb_w / 2
        lb_cy = lb_y + lb_h / 2

        best: Optional[str] = None
        best_score = float("inf")
        for b in blocks:
            if b is label_block:
                continue
            b_x, b_y, b_w, b_h = b["x"], b["y"], b["w"], b["h"]
            b_cx = b_x + b_w / 2
            b_cy = b_y + b_h / 2
            b_text = b["text"].strip()
            if len(b_text) < 1:
                continue
            # 排除其他字段标签块（避免取到相邻标签）
            if self._looks_like_label(b_text, field_name):
                continue
            # 优先：同行右侧
            y_dist = abs(b_cy - lb_cy)
            if y_dist <= max(lb_h, b_h) * 0.9 and b_x >= lb_x:
                score = (b_x - lb_x) + y_dist * 0.1
                if score < best_score:
                    best_score = score
                    best = b_text
            # 次优：正下方（x 中心接近）
            elif b_y >= lb_y + lb_h * 0.5 and abs(b_cx - lb_cx) <= max(lb_h, b_h) * 2:
                score = (b_y - lb_y) + abs(b_cx - lb_cx) * 0.1 + 1000
                if score < best_score:
                    best_score = score
                    best = b_text
        return best

    def _parse_inspection_table(
        self, blocks: List[Dict[str, Any]]
    ) -> List[Dict[str, str]]:
        """解析 COA 检验结果表格（表头：项目/标准/检测结果/单项判定）。

        基于 OCR 坐标：
        1. 识别表头各列的中心 x（中英文表头词）；
        2. 将表头下方的文本块按 y 中心分组为“表格行”；
        3. 每行中的每个块按最近列中心分配到对应列。

        返回：[{item, standard, result, judgment}, ...]
        """
        if not blocks:
            return []

        header_map = {
            "item": ["项目", "Items", "ITEM", "检验项目"],
            "standard": ["标准", "Test Standard", "Standard"],
            "result": ["检测结果", "Test Result", "Result"],
            "judgment": ["单项判定", "Single Judgment", "Judgment", "判定"],
        }
        col_centers: Dict[str, float] = {}
        for b in blocks:
            t = b["text"].strip()
            for col, keywords in header_map.items():
                if col in col_centers:
                    continue
                if any(k.lower() in t.lower() for k in keywords):
                    col_centers[col] = b["x"] + b["w"] / 2
                    break

        # 必须至少识别出“项目”列
        if "item" not in col_centers:
            return []

        # 表头行的 y 下界
        header_bottom = 0
        for b in blocks:
            t = b["text"].lower()
            if any(k in t for k in ("项目", "检测结果", "单项判定", "items", "test result")):
                header_bottom = max(header_bottom, b["y"] + b["h"])

        # 将表头下方的文本块按行分组（y 中心接近）
        rows: Dict[str, Dict[str, Any]] = {}
        for b in blocks:
            if b["y"] < header_bottom - 5:
                continue
            cy = b["y"] + b["h"] / 2
            cx = b["x"] + b["w"] / 2
            matched_key = None
            for key, row in rows.items():
                if abs(row["cy"] - cy) <= max(b["h"], 12):
                    matched_key = key
                    break
            if matched_key is None:
                matched_key = f"r{len(rows)}"
                rows[matched_key] = {"cy": cy, "blocks": []}
            rows[matched_key]["blocks"].append({"text": b["text"].strip(), "cx": cx})

        # 每行按最近列中心分配，并分离中英文
        items: List[Dict[str, str]] = []
        for row in sorted(rows.values(), key=lambda r: r["cy"]):
            cell: Dict[str, str] = {
                "item": "", "item_en": "",
                "standard": "", "standard_en": "",
                "result": "", "result_en": "",
                "judgment": "", "judgment_en": "",
            }
            for blk in row["blocks"]:
                best_col = None
                best_dist = float("inf")
                for col, center in col_centers.items():
                    d = abs(blk["cx"] - center)
                    if d < best_dist:
                        best_dist = d
                        best_col = col
                if best_col:
                    self._append_cell_text(cell, best_col, blk["text"])
            if cell["item"] or cell["result"] or cell["judgment"] or cell["item_en"]:
                items.append(cell)

        return items

    @staticmethod
    def _append_cell_text(cell: Dict[str, str], col: str, text: str) -> None:
        """将 OCR 文本块追加到对应列；含中文的进主字段，纯英文/数字进 *_en 字段。"""
        t = (text or "").strip()
        if not t:
            return
        if re.search(r"[\u4e00-\u9fa5]", t):
            cell[col] = (cell[col] + " " + t).strip()
        else:
            cell[col + "_en"] = (cell[col + "_en"] + " " + t).strip()

    def _looks_like_label(self, line: str, field_name: str) -> bool:
        """判断一行文本是否看起来是另一个字段的标签（表格中标签常相邻排列）。"""
        lower = line.lower()
        for fn, labs in self.FIELD_LINE_LABELS.items():
            if fn == field_name:
                continue
            for lab in labs:
                if len(lab) >= 2 and lab.lower() in lower:
                    return True
        return False

    def _is_plausible_value(self, value: str, field_name: str) -> bool:
        """值合理性校验：过滤明显是表头/其他字段标签的误报值。"""
        if not value:
            return False
        v = value.strip()
        if len(v) < 2 or len(v) > 60:
            return False
        if v.count(" ") > 12:
            return False
        # 值中不应包含其他字段的标签（避免“生产批号”“项目”“标准”等表头词）
        lower = v.lower()
        for fn, labs in self.FIELD_LINE_LABELS.items():
            if fn == field_name:
                continue
            for lab in labs:
                if len(lab) >= 2 and lab.lower() in lower:
                    return False
        # ── 字段特定校验 ──
        # 数值型字段：值必须包含数字
        if field_name in ("assay", "moisture", "lead", "arsenic", "cadmium", "mercury", "microbial_count"):
            if not re.search(r"\d", v):
                return False
        # 结论字段：值应包含结论词
        if field_name == "pass_fail":
            if not any(k in lower for k in ("合格", "不合格", "符合", "不符合", "pass", "fail", "conform", "判定", "通过", "ok")):
                return False
        # 批号：通常包含数字
        if field_name == "batch_number":
            if not re.search(r"\d", v):
                return False
        return True

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
