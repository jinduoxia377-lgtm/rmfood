# 食源性多肽原材料COA模板开发方案

> 版本: v1.0  
> 日期: 2026-08-21  
> 作者: RMFOOD Data Expert  
> 关联文档: `docs/食源性多肽原材料COA/鱼胶原蛋白肽-出厂报告模板.docx`

---

## 一、模板文件分析

### 1.1 现有模板结构（鱼胶原蛋白肽）

根据对 `鱼胶原蛋白肽-出厂报告模板.docx` 的XML解析，该出厂报告（COA）包含以下核心模块：

#### 1.1.1 页眉（Header）
| 元素 | 内容 |
|------|------|
| Logo图片 | 莱茵（厦门）分子生物科技有限公司 |
| 公司名称 | 莱茵（厦门）分子生物科技有限公司 |
| 英文名称 | RHEIN (XIAMEN) MOLEKÜL BIOTECH INC |

#### 1.1.2 基础信息区
| 字段 | 中文名 | 英文名 | 示例值 |
|------|--------|--------|--------|
| 产品名称 | 产品名 称 | Product Name | 鱼胶原蛋白肽 / Hydrolyzed-Collagen-Fish |
| 产品类型 | 产品类 型 | Product Type | 其他食品 / Other Food |
| 型号 | 型 号 | Code | AMO-06 |
| 规格 | 规 格 | Spec | 20千克/袋 / 20 KG/Bag |
| 生产日期 | 生产日 期 | Mfg. Date | 2024-5-18 |
| 生产批号 | 生产批 号 | Batch No. | 20240518 |

#### 1.1.3 检验结果表（核心检测项）

| 检测类别 | 项目 | 标准限值 | 检测结果 | 判定 |
|----------|------|----------|----------|------|
| **感官要求** | 色泽 | 具有本品应有的色泽 | 符合标准 | 符合 |
| | 性状 | 均匀性粉末状或颗粒状，无结块现象 | 符合标准 | 符合 |
| | 气味与滋味 | 具有本品固有的滋味和气味，无异味 | 符合标准 | 符合 |
| | 杂质 | 无正常视力可见外来杂质 | 符合标准 | 符合 |
| **理化指标** | 水分含量(%) | ≤ 7.0 | 4.43 | 符合 |
| | 灰分(干基,% ) | ≤ 7.0 | 1.0 | 符合 |
| | 粗蛋白质(干基,% ) | ≥ 80.0 | 98.0 | 符合 |
| | 肽含量(干基,% ) | ≥ 80.0 | 100 | 符合 |
| **微生物指标** | 菌落总数(CFU/g) | n=5,c=2,m=10⁴,M=10⁵ | 10,10,10,10,10 | 符合 |
| | 大肠菌群(CFU/g) | n=5,c=2,m=10,M=10² | <10×5 | 符合 |
| **包装标签** | 净含量 | 20千克/袋 | 20.05千克/袋 | 符合 |
| | 产品包装 | 包装整洁、卫生，密封完好 | 符合标准 | 符合 |
| | 标签 | GB 7718和GB 28050的要求 | 符合标准 | 符合 |

#### 1.1.4 结论区
- **检测判定依据**: GB31645—2018 《鱼胶原蛋白肽》
- **结论**: 该批产品符合 GB31645—2018 出厂检验要求，合格
- **签名区**: 检测人 + 时间、校对人 + 时间

---

## 二、后端数据现状分析

### 2.1 现有数据模型

| 模型 | 表名 | 作用 | COA相关字段 |
|------|------|------|------------|
| `Peptide` (formula.py) | peptides | 多肽主表 | ❌ 无 |
| `BioactivePeptide` (external_data.py) | bioactive_peptides | 外部来源活性肽 | ❌ 无 |
| `FoodMaterial` | food_materials | 食品原料 | ✅ coa_url |
| `PeptideAnalysis` | peptide_analyses | 肽序列分析 | ❌ 无 |
| `PeptideDesign` | peptide_designs | 肽设计项目 | ❌ 无 |
| `RetailProduct` | retail_products | 零售产品 | ❌ 无 |

### 2.2 数据缺口分析

```
┌─────────────────────────────────────────────────────────────────────┐
│                        COA 数据缺口矩阵                              │
├──────────────────┬────────────┬────────────┬─────────────────────────┤
│      字段         │  现有模型   │  状态       │       说明              │
├──────────────────┼────────────┼────────────┼─────────────────────────┤
│ batch_no         │    ❌       │  缺失       │ 生产批号，COA核心字段     │
│ mfg_date         │    ❌       │  缺失       │ 生产日期                │
│ spec             │    ❌       │  缺失       │ 规格(如 20KG/Bag)       │
│ product_code     │    ❌       │  缺失       │ 型号/编号               │
│ gb_standard      │    ❌       │  缺失       │ 执行标准(如 GB31645)    │
│ organoleptic     │    ❌       │  缺失       │ 感官检测数据            │
│ chemical_items   │    ❌       │  缺失       │ 理化指标(JSON)          │
│ microbial_items  │    ❌       │  缺失       │ 微生物指标(JSON)        │
│ test_conclusion  │    ❌       │  缺失       │ 检验结论                │
│ tested_by        │    ❌       │  缺失       │ 检测人                  │
│ checked_by       │    ❌       │  缺失       │ 校对人                  │
│ coa_pdf_url      │    ❌       │  缺失       │ COA PDF附件             │
└──────────────────┴────────────┴────────────┴─────────────────────────┘
```

### 2.3 前端数据检索现状

| 前端页面 | 路由 | 功能 | COA展示 |
|----------|------|------|---------|
| PeptidesTab | `/database/peptides` | 活性肽列表 | ❌ 无 |
| PeptideDetailContent | - | 肽详情(序列可视化) | ❌ 无 |
| AdvancedPeptideAnalyzer | `/ai/peptide` | AI深度分析 | ❌ 无 |

---

## 三、开发方案

### 3.1 整体架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                        系统架构图                                │
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Frontend   │────▶│  FastAPI     │────▶│   PostgreSQL │    │
│  │  React+TS    │     │  REST API    │     │   + pgvector │    │
│  └──────────────┘     └──────┬───────┘     └──────────────┘    │
│           │                 │                                    │
│           │                 ▼                                    │
│           │         ┌──────────────┐                            │
│           │         │  Word/PDF    │                            │
│           │         │  COA 生成器   │                            │
│           │         └──────────────┘                            │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────┐     ┌──────────────┐                          │
│  │ COA 模板管理  │────▶│  素材库      │                           │
│  │ (后端模板库)  │     │  (Logo/样式)  │                           │
│  └──────────────┘     └──────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 数据库模型设计

#### 3.2.1 新增模型: `PeptideBatchCOA`

```python
# backend/app/models/peptide_batch_coa.py
"""
食源性多肽批次COA数据模型
管理每个生产批次的出厂检验报告
"""
from datetime import datetime, timezone
from sqlalchemy import String, Text, Float, BigInteger, JSON, DateTime, Enum as SQLEnum, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.utils import now_utc_mapped


class COATestItem(Base):
    """COA检验单项记录 - 用于结构化存储每个检测项目"""
    __tablename__ = "coa_test_items"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    coa_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("peptide_batch_coas.id", ondelete="CASCADE"), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, comment="检测类别: sensory/chemical/microbial/packaging")
    item_name: Mapped[str] = mapped_column(String(100), nullable=False, comment="检测项目名")
    item_name_en: Mapped[str | None] = mapped_column(String(100), comment="英文项目名")
    standard: Mapped[str] = mapped_column(String(500), nullable=False, comment="标准/限值")
    result: Mapped[str | None] = mapped_column(String(500), comment="检测结果")
    unit: Mapped[str | None] = mapped_column(String(20), comment="单位")
    judgment: Mapped[str | None] = mapped_column(String(20), comment="判定: 符合/不符合")
    remark: Mapped[str | None] = mapped_column(Text, comment="备注")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, comment="排序")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)


class PeptideBatchCOA(Base):
    """
    食源性多肽批次COA（出厂检验报告）
    
    一对一关联: 一个产品标准 + 多批次COA记录
    一对多关联: 每个COA包含多个检验单项
    """
    __tablename__ = "peptide_batch_coas"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # ── 产品标识 ──
    peptide_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("peptides.id", ondelete="SET NULL"),
        nullable=True, index=True, comment="关联多肽主表ID"
    )
    product_name_cn: Mapped[str] = mapped_column(String(200), nullable=False, comment="产品名称(中文)")
    product_name_en: Mapped[str | None] = mapped_column(String(200), comment="产品名称(英文)")
    product_type: Mapped[str] = mapped_column(String(100), default="其他食品", comment="产品类型")
    product_code: Mapped[str | None] = mapped_column(String(50), comment="型号/编号")
    spec: Mapped[str | None] = mapped_column(String(100), comment="规格(如 20千克/袋)")

    # ── 批次信息 ──
    batch_no: Mapped[str] = mapped_column(String(50), nullable=False, index=True, comment="生产批号")
    mfg_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), comment="生产日期")
    expiry_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), comment="有效期/保质期")
    production_line: Mapped[str | None] = mapped_column(String(100), comment="生产线上线")

    # ── 检验依据 ──
    gb_standard: Mapped[str | None] = mapped_column(String(100), comment="执行标准(如 GB31645—2018)")
    enterprise_standard: Mapped[str | None] = mapped_column(String(200), comment="企业标准")
    inspection_basis: Mapped[str | None] = mapped_column(Text, comment="检验判定依据说明")

    # ── 结论 ──
    test_conclusion: Mapped[str] = mapped_column(String(200), default="合格", comment="检验结论: 合格/不合格/待检")
    qualified: Mapped[bool] = mapped_column(Boolean, default=True, comment="是否合格")

    # ── 文件附件 ──
    coa_pdf_url: Mapped[str | None] = mapped_column(String(500), comment="COA PDF文件URL")
    coa_word_url: Mapped[str | None] = mapped_column(String(500), comment="COA Word原文URL")
    test_report_image_url: Mapped[str | None] = mapped_column(String(500), comment="检测报告扫描件")

    # ── 人员 ──
    tested_by: Mapped[str | None] = mapped_column(String(50), comment="检测人")
    checked_by: Mapped[str | None] = mapped_column(String(50), comment="校对人")
    approved_by: Mapped[str | None] = mapped_column(String(50), comment="批准人")

    # ── 供应商 ──
    supplier_name: Mapped[str | None] = mapped_column(String(200), comment="供应商名称")
    supplier_batch_ref: Mapped[str | None] = mapped_column(String(100), comment="供应商批次编号")

    # ── 审计 ──
    created_by: Mapped[int | None] = mapped_column(BigInteger, comment="创建人ID")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped)
    deleted_at: Mapped[datetime | None] = nullable=True, comment="软删除时间")

    # ── 关系 ──
    peptide: Mapped["Peptide | None"] = relationship("Peptide", back_populates="batch_coas")
    test_items: Mapped[list["COATestItem"]] = relationship(
        "COATestItem",
        back_populates="coa",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "peptide_id": self.peptide_id,
            "product_name_cn": self.product_name_cn,
            "product_name_en": self.product_name_en,
            "product_type": self.product_type,
            "product_code": self.product_code,
            "spec": self.spec,
            "batch_no": self.batch_no,
            "mfg_date": self.mfg_date.isoformat() if self.mfg_date else None,
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "production_line": self.production_line,
            "gb_standard": self.gb_standard,
            "enterprise_standard": self.enterprise_standard,
            "inspection_basis": self.inspection_basis,
            "test_conclusion": self.test_conclusion,
            "qualified": self.qualified,
            "coa_pdf_url": self.coa_pdf_url,
            "coa_word_url": self.coa_word_url,
            "test_report_image_url": self.test_report_image_url,
            "tested_by": self.tested_by,
            "checked_by": self.checked_by,
            "approved_by": self.approved_by,
            "supplier_name": self.supplier_name,
            "supplier_batch_ref": self.supplier_batch_ref,
            "test_items": [item.to_dict() for item in (self.test_items or [])],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
```

#### 3.2.2 扩展模型: `Peptide` 添加 COA 关联

在现有 `peptides` 表中添加 COA 关系字段：

```python
# 在 backend/app/models/formula.py 的 Peptide 类中添加:
batch_coas: Mapped[list["PeptideBatchCOA"]] = relationship(
    "PeptideBatchCOA",
    back_populates="peptide",
    cascade="all, delete-orphan"
)
latest_coa_id: Mapped[int | None] = mapped_column(
    BigInteger, nullable=True, comment="最新COA记录ID(冗余索引)"
)
```

### 3.3 API 接口设计

#### 3.3.1 COA CRUD 接口

```
# 路由前缀: /api/v1/peptide-coas

POST   /                          # 创建COA（含检验单项）
GET    /                          # 列表查询（分页+筛选）
GET    /{id}                      # 获取COA详情（含检验单项）
PUT    /{id}                      # 更新COA元数据
PUT    /{id}/test-items           # 更新检验单项列表
DELETE /{id}                      # 软删除COA
POST   /{id}/generate-pdf         # 生成/重新生成COA PDF
GET    /{id}/download-pdf         # 下载COA PDF文件

# 产品级接口
GET    /by-peptide/{peptide_id}   # 按多肽ID获取所有批次COA
GET    /by-batch/{batch_no}       # 按批号查询COA
POST   /batch/import              # 批量导入COA（从Excel/JSON）
GET    /export                    # 导出COA数据为Excel
```

#### 3.3.2 COA 模板管理接口

```
# 路由前缀: /api/v1/coa-templates

GET    /                           # 获取所有模板
POST   /                           # 创建新模板
GET    /{template_id}              # 获取模板详情
PUT    /{template_id}              # 更新模板
DELETE /{template_id}              # 删除模板
POST   /{template_id}/preview      # 预览COA（生成HTML预览）
```

#### 3.3.3 前端检索接口增强

```
# 在现有 /api/v1/bioactive-peptides 中增强:

GET    /                            # 列表增加 COA 状态字段
       ?has_coa=true/false          # 筛选有/无COA的肽
       ?batch_no=xxx                # 按批号搜索
GET    /{id}                        # 详情增加 COA 历史
       ?include_coa=true            # 是否包含COA数据
```

### 3.4 前端组件设计

#### 3.4.1 新增组件

```
frontend/src/components/coa/
├── COAView.tsx              # COA报告查看器（类Word格式展示）
├── COATable.tsx             # COA数据表格（列表页）
├── COACreateForm.tsx        # COA创建表单
├── COATestItemEditor.tsx    # 检验单项编辑器
├── COAPDFViewer.tsx         # PDF预览组件
└── COAExportButton.tsx      # 导出按钮

frontend/src/pages/database/tabs/
└── COAsTab.tsx              # COA管理Tab（集成到数据库页）
```

#### 3.4.2 PeptidesTab 增强

在现有 `PeptidesTab.tsx` 详情页中增加 COA 标签页：

```
PeptideDetailContent (现有)
├── 氨基酸序列可视化 (现有)
├── 理化性质 (现有)
├── 生物活性 (现有)
├── 安全性 (现有)
└── 🆕 COA 出厂报告 (新增)
    ├── COA 列表（按批次）
    ├── COA 详情查看
    └── COA PDF 下载
```

#### 3.4.3 COAView 组件设计

```tsx
// 类Word文档布局的COA展示组件
<COAView coa={PeptideBatchCOA}>
  {/* 页眉: Logo + 公司名称 */}
  <COAHeader 
    companyLogo={company.logo_url}
    companyName={company.name_cn}
    companyNameEn={company.name_en}
  />
  
  {/* 标题: 成品检测报告 */}
  <COATitle title="成品检测报告" subtitle="CERTIFICATE OF ANALYSIS" />
  
  {/* 基础信息表 */}
  <COABasicInfoTable 
    productName={coa.product_name_cn}
    productType={coa.product_type}
    code={coa.product_code}
    spec={coa.spec}
    mfgDate={coa.mfg_date}
    batchNo={coa.batch_no}
  />
  
  {/* 检验结果表 */}
  <COATestResultTable 
    items={coa.test_items}
    standard={coa.gb_standard}
  />
  
  {/* 结论区 */}
  <COAConclusion 
    conclusion={coa.test_conclusion}
    basis={coa.inspection_basis}
    testedBy={coa.tested_by}
    checkedBy={coa.checked_by}
    testDate={coa.mfg_date}
  />
</COAView>
```

### 3.5 COA 模板定制方案

#### 3.5.1 模板配置结构

```json
{
  "template_id": "fish_collagen_peptide_001",
  "template_name": "鱼胶原蛋白肽出厂报告模板",
  "company": {
    "name_cn": "莱茵（厦门）分子生物科技有限公司",
    "name_en": "RHEIN (XIAMEN) MOLEKÜL BIOTECH INC",
    "logo_url": "/assets/company/logo.png"
  },
  "document_title": {
    "cn": "成品检测报告",
    "en": "CERTIFICATE OF ANALYSIS"
  },
  "standard_refs": [
    { "name": "GB31645—2018", "name_cn": "鱼胶原蛋白肽" },
    { "name": "GB 7718", "name_cn": "食品安全国家标准 预包装食品标签通则" },
    { "name": "GB 28050", "name_cn": "食品安全国家标准 预包装食品营养标签通则" }
  ],
  "default_test_items": [
    {
      "category": "sensory",
      "item_name": "色泽",
      "item_name_en": "Color",
      "standard_pattern": "具有本品应有的色泽",
      "unit": null
    },
    {
      "category": "sensory",
      "item_name": "性状",
      "item_name_en": "State",
      "standard_pattern": "均匀性粉末状或颗粒状，无结块现象",
      "unit": null
    },
    {
      "category": "chemical",
      "item_name": "水分含量",
      "item_name_en": "Moisture Content",
      "standard_pattern": "≤ {value}%",
      "unit": "%",
      "limit_type": "max"
    }
    // ... 更多默认检测项
  ],
  "layout": {
    "page_size": "A4",
    "margins": { "top": 72, "bottom": 72, "left": 72, "right": 72 },
    "font": { "cn": "华文中宋", "en": "Calibri", "size": 10.5 }
  }
}
```

### 3.6 COA 生成策略

#### 方案A: Word 模板引擎（推荐用于打印）

```python
# backend/app/services/coa_generator.py
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

class COAGenerator:
    """基于 python-docx 的 COA Word 文档生成器"""
    
    def __init__(self, template_path: str):
        self.template = Document(template_path)
        self.company_logo = self._load_logo()
    
    def generate(self, coa: PeptideBatchCOA) -> bytes:
        """生成COA Word文档"""
        doc = Document(self.template_path)
        # 填充字段...
        self._fill_basic_info(doc, coa)
        self._fill_test_results(doc, coa.test_items)
        self._fill_conclusion(doc, coa)
        return doc.save()
    
    def _fill_basic_info(self, doc, coa):
        """填充基础信息"""
        # 替换文档中的占位符 {product_name} 等
        pass
    
    def _fill_test_results(self, doc, items):
        """填充检验结果表格"""
        # 遍历test_items填充表格行
        pass
```

#### 方案B: HTML/CSS 渲染（推荐用于Web展示）

```python
# 使用 WeasyPrint 或 Playwright 将 HTML 渲染为 PDF
from weasyprint import HTML, CSS

class COAPDFGenerator:
    """基于 HTML/CSS 的 COA PDF 生成器"""
    
    def generate(self, coa: PeptideBatchCOA) -> bytes:
        html_template = self._render_template(coa)
        pdf_bytes = HTML(string=html_template).write_pdf()
        return pdf_bytes
    
    def _render_template(self, coa):
        """渲染HTML模板"""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            .coa-header {{ text-align: center; border-bottom: 2px solid #333; }}
            .coa-table {{ width: 100%; border-collapse: collapse; }}
            .coa-table th, .coa-table td {{ border: 1px solid #000; padding: 4px; }}
          </style>
        </head>
        <body>
          <!-- COA内容 -->
        </body>
        </html>
        """
```

---

## 四、开发实施计划

### Phase 1: 数据库模型 & 基础API (预计 2天)

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建 `peptide_batch_coa.py` 模型 | `backend/app/models/peptide_batch_coa.py` | 新增COA模型 |
| 扩展 `formula.py` Peptide 模型 | `backend/app/models/formula.py` | 添加 batch_coas 关系 |
| 创建 `schemas/coa.py` | `backend/app/schemas/coa.py` | Pydantic 请求/响应模型 |
| 注册新模型到 `__init__.py` | `backend/app/models/__init__.py` | 导出新模型 |
| 创建 Alembic 迁移脚本 | `backend/alembic/versions/` | 数据库迁移 |

### Phase 2: COA API 服务层 (预计 2天)

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建 COA 服务 | `backend/app/services/coa_service.py` | CRUD业务逻辑 |
| 创建 COA 路由 | `backend/app/api/coa_routes.py` | RESTful API端点 |
| 集成到主路由 | `backend/app/main.py` | 注册路由器 |

### Phase 3: COA 生成器 (预计 2天)

| 任务 | 文件 | 说明 |
|------|------|------|
| Word COA 生成器 | `backend/app/services/coa_word_generator.py` | python-docx实现 |
| HTML/PDF COA 生成器 | `backend/app/services/coa_pdf_generator.py` | WeasyPrint实现 |
| COA模板管理 API | `backend/app/api/coa_template_routes.py` | 模板CRUD |
| 添加依赖 | `backend/pyproject.toml` | python-docx, weasyprint |

### Phase 4: 前端组件开发 (预计 3天)

| 任务 | 文件 | 说明 |
|------|------|------|
| COA API Service | `frontend/src/services/coaService.ts` | API调用封装 |
| COAView 组件 | `frontend/src/components/coa/COAView.tsx` | 类Word报告展示 |
| COATable 组件 | `frontend/src/components/coa/COATable.tsx` | COA列表表格 |
| COACreateForm 组件 | `frontend/src/components/coa/COACreateForm.tsx` | 创建/编辑表单 |
| COAsTab 页面 | `frontend/src/pages/database/tabs/COAsTab.tsx` | COA管理页 |
| 增强 PeptideDetail | `frontend/src/pages/database/PeptideDetailContent.tsx` | 添加COA标签页 |

### Phase 5: 集成测试 & 数据初始化 (预计 1天)

| 任务 | 说明 |
|------|------|
| API端到端测试 | 验证COA CRUD + 生成PDF |
| 前端联调测试 | 验证COA查看/创建流程 |
| 初始化样板数据 | 为鱼胶原蛋白肽添加示例COA |
| 文档更新 | 更新API文档 |

---

## 五、数据迁移策略

### 5.1 现有数据导入

由于当前后端数据库中没有完整的食源性多肽数据，建议：

1. **第一阶段**: 先建立COA数据模型和API，不迁移历史数据
2. **第二阶段**: 手动录入第一批COA数据（从现有Word模板提取）
3. **第三阶段**: 批量导入历史COA数据（从Excel/Word批量解析）

### 5.2 样板数据初始化脚本

```python
# backend/scripts/seed_coa_data.py
"""
初始化COA样板数据
基于鱼胶原蛋白肽出厂报告模板
"""

SAMPLE_COA = {
    "product_name_cn": "鱼胶原蛋白肽",
    "product_name_en": "Hydrolyzed-Collagen-Fish",
    "product_type": "其他食品",
    "product_code": "AMO-06",
    "spec": "20千克/袋",
    "batch_no": "20240518",
    "mfg_date": "2024-05-18",
    "gb_standard": "GB31645—2018",
    "test_conclusion": "合格",
    "tested_by": "张三",
    "checked_by": "李四",
    "test_items": [
        {"category": "sensory", "item_name": "色泽", "standard": "具有本品应有的色泽", "result": "符合标准", "judgment": "符合"},
        {"category": "sensory", "item_name": "性状", "standard": "均匀性粉末状或颗粒状", "result": "符合标准", "judgment": "符合"},
        {"category": "sensory", "item_name": "气味与滋味", "standard": "具有本品固有的滋味和气味", "result": "符合标准", "judgment": "符合"},
        {"category": "sensory", "item_name": "杂质", "standard": "无正常视力可见外来杂质", "result": "符合标准", "judgment": "符合"},
        {"category": "chemical", "item_name": "水分含量(%)", "standard": "≤ 7.0", "result": "4.43", "unit": "%", "judgment": "符合"},
        {"category": "chemical", "item_name": "灰分(干基,% )", "standard": "≤ 7.0", "result": "1.0", "unit": "%", "judgment": "符合"},
        {"category": "chemical", "item_name": "粗蛋白质(干基,% )", "standard": "≥ 80.0", "result": "98.0", "unit": "%", "judgment": "符合"},
        {"category": "chemical", "item_name": "肽含量(干基,% )", "standard": "≥ 80.0", "result": "100", "unit": "%", "judgment": "符合"},
        {"category": "microbial", "item_name": "菌落总数(CFU/g)", "standard": "n=5,c=2,m=10⁴,M=10⁵", "result": "10,10,10,10,10", "judgment": "符合"},
        {"category": "microbial", "item_name": "大肠菌群(CFU/g)", "standard": "n=5,c=2,m=10,M=10²", "result": "<10×5", "judgment": "符合"},
        {"category": "packaging", "item_name": "净含量", "standard": "20千克/袋", "result": "20.05千克/袋", "judgment": "符合"},
        {"category": "packaging", "item_name": "产品包装", "standard": "包装整洁、卫生，密封完好", "result": "符合标准", "judgment": "符合"},
        {"category": "packaging", "item_name": "标签", "standard": "GB 7718和GB 28050的要求", "result": "符合标准", "judgment": "符合"},
    ]
}
```

---

## 六、关键决策点

| 决策 | 选项A | 选项B | 推荐 |
|------|-------|-------|------|
| COA存储格式 | Word(docx) | PDF | **两者都支持** - 原始Word存档，PDF对外展示 |
| 模板管理 | 前端硬编码 | 后端可配置 | **后端可配置** - 支持多产品多模板 |
| 检验单项结构 | JSON字段 | 独立表 | **独立表** - 支持查询和统计 |
| 数据导入方式 | 手动录入 | Excel批量导入 | **两者都支持** - 先手动录入样板，后支持批量 |
| 前端展示 | 内嵌Word预览 | 下载PDF查看 | **内嵌HTML渲染** + 下载PDF |

---

## 七、风险与注意事项

1. **数据完整性**: COA是与批次强绑定的法律文件，不允许随意修改已确认的COA，需增加版本控制和审计日志
2. **PDF生成稳定性**: WeasyPrint 在 Windows 环境下需要额外配置，建议使用 Linux 容器部署
3. **模板维护**: 不同产品有不同的检测项目和标准，需要灵活的模板配置系统
4. **权限控制**: COA数据涉及商业机密，需要RBAC权限控制（仅质检部门可查看/编辑）
5. **数据库迁移**: 现有数据库无COA表，需要执行 Alembic 迁移，确保不影响现有数据

---

## 九、本次实施总结（2026-08-21）

### 9.1 已完成的工作

#### 后端实现

| 文件 | 状态 | 说明 |
|------|------|------|
| `backend/app/models/peptide_batch_coa.py` | ✅ 已创建 | COA主记录表 + 检验单项表模型 |
| `backend/app/models/formula.py` | ✅ 已更新 | Peptide 模型添加 batch_coas 关系 |
| `backend/app/models/__init__.py` | ✅ 已更新 | 导出 PeptideBatchCOA, COATestItem |
| `backend/app/schemas/coa.py` | ✅ 已创建 | Pydantic 请求/响应 Schema |
| `backend/app/services/coa_service.py` | ✅ 已创建 | CRUD 业务逻辑服务 |
| `backend/app/api/coa_routes.py` | ✅ 已创建 | RESTful API 路由（自动注册） |
| `backend/alembic/versions/20260821_140000_add_peptide_batch_coa.py` | ✅ 已创建 | 数据库迁移脚本 |
| `backend/scripts/seed_coa_sample_data.py` | ✅ 已创建 | 样板数据初始化脚本 |

#### 前端实现

| 文件 | 状态 | 说明 |
|------|------|------|
| `frontend/src/services/professional/coaService.ts` | ✅ 已创建 | COA API 调用封装 |
| `frontend/src/components/coa/COAView.tsx` | ✅ 已创建 | COA报告查看组件（类Word布局） |
| `frontend/src/components/coa/COATable.tsx` | ✅ 已创建 | COA列表表格组件 |
| `frontend/src/pages/database/tabs/COAsTab.tsx` | ✅ 已创建 | COA管理页面Tab |

#### 文档

| 文件 | 状态 |
|------|------|
| `docs/plans/食源性多肽COA模板开发方案.md` | ✅ 已创建（完整版开发方案） |

### 9.2 API 接口清单

```
POST   /api/v1/coa                      # 创建COA
GET    /api/v1/coa                      # 列表查询（分页+筛选）
GET    /api/v1/coa/{id}                 # 获取COA详情
PUT    /api/v1/coa/{id}                 # 更新COA元数据
PUT    /api/v1/coa/{id}/test-items      # 批量更新检验单项
POST   /api/v1/coa/{coa_id}/test-items  # 添加单个检验单项
DELETE /api/v1/coa/{id}                 # 软删除COA
GET    /api/v1/coa/by-peptide/{id}      # 按多肽ID查询
GET    /api/v1/coa/by-batch/{batch_no}  # 按批号查询
POST   /api/v1/coa/batch/import         # 批量导入COA
GET    /api/v1/coa/stats/summary        # COA统计摘要
```

### 9.3 后续待完成事项

| 优先级 | 任务 | 预估工作量 |
|--------|------|-----------|
| P0 | 执行 Alembic 迁移: `alembic upgrade head` | 10分钟 |
| P0 | 运行样板数据初始化: `python scripts/seed_coa_sample_data.py` | 5分钟 |
| P1 | COA Word/PDF 生成器 (`coa_word_generator.py`) | 2天 |
| P1 | COA创建表单组件 (`COACreateForm.tsx`) | 1天 |
| P2 | PeptideDetailContent 增加 COA 标签页集成 | 0.5天 |
| P2 | API 端到端测试 | 0.5天 |
| P3 | COA模板管理 API 和前端 | 1天 |

### 9.4 快速启动命令

```bash
# 1. 执行数据库迁移
cd D:\RMFOODFP\backend
alembic upgrade head

# 2. 初始化样板数据
python scripts/seed_coa_sample_data.py

# 3. 启动后端（如未运行）
python run_server.py

# 4. 验证API可用
curl http://localhost:8001/api/v1/coa/stats/summary
```

---

## 八、后续扩展方向

1. **COA批量导出**: 支持批量导出某产品所有批次的COA
2. **COA对比分析**: 多批次COA数据对比，趋势分析
3. **COA自动触发**: 新批次生产完成后自动创建COA模板
4. **COA签名认证**: 电子签名支持，符合GLP规范
5. **COA二维码**: 每个COA生成唯一二维码，方便现场扫码查验
