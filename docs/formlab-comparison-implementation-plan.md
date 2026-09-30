# RMFOODFP × FormLab 补全实施方案

> 基于《RMFOODFP × FormLab 功能对比分析与补全方案》（docs/formlab-comparison-analysis.md）
> 制定日期：2026年
> 总工期：21周（约5个月）
> 状态：待审批

---

## 一、实施总览

```
Phase 1 (W1-W6)    ████████████████████    数据底座加固        ← 最高优先级
Phase 2 (W7-W9)    █████████████████       报告与AI分离
Phase 3 (W10-W14)  █████████████████████   DOE与逆向搜索
Phase 4 (W15-W18)  █████████████████████   稳定性与追溯增强
Phase 5 (W19-W21)  █████████████████       外围能力补齐
```

**关键路径**：Phase 1 → Phase 2 → Phase 3（并行 Phase 4）→ Phase 5

---

## 二、Phase 1：数据底座加固（W1-W6）⭐⭐⭐⭐⭐

### 1.1 W1-W2：核心数据实体建模

#### 后端交付物

**新建文件：`backend/app/models/batch_record.py`**
```python
"""
Batch（批记录）模型
建立从配方到实物的第一次落地
"""
from datetime import datetime, timezone
from sqlalchemy import BigInteger, String, Text, DateTime, JSON, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from .enums import BatchStatus

class Batch(Base):
    __tablename__ = "batches"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    organization_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    
    # 批号（人类可读）
    batch_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    
    # 关联
    formula_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("formulas.id", ondelete="CASCADE"), index=True)
    formula_version_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("formula_versions.id"), index=True)
    
    # 批记录信息
    target_weight_kg: Mapped[float] = mapped_column(Float, nullable=False)  # 目标产量
    actual_weight_kg: Mapped[float | None] = mapped_column(Float)  # 实际产量
    yield_rate: Mapped[float | None] = mapped_column(Float)  # 产率
    
    # 状态
    status: Mapped[BatchStatus] = mapped_column(
        Enum(BatchStatus), default=BatchStatus.PLANNED, nullable=False
    )
    
    # 生产信息
    prepared_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id"))
    preparation_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    
    # 时间戳
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=timezone.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=timezone.now, onupdate=timezone.now)
    
    # 关系
    formula: Mapped["Formula"] = relationship("Formula", back_populates="batches")
    ingredient_lots: Mapped[list["IngredientLot"]] = relationship(
        "IngredientLot", secondary="batch_ingredient_lots", back_populates="batches"
    )
    samples: Mapped[list["Sample"]] = relationship("Sample", back_populates="batch", cascade="all, delete-orphan")
```

**新建文件：`backend/app/models/sample.py`**
```python
"""
Sample（样品）模型
连接批次与测试结果
"""
from sqlalchemy import BigInteger, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base

class Sample(Base):
    __tablename__ = "samples"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    organization_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    
    sample_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    batch_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("batches.id", ondelete="CASCADE"), index=True)
    
    # 样品信息
    sample_type: Mapped[str] = mapped_column(String(50), default="qc")  # qc/stability/pilot
    quantity_g: Mapped[float | None] = mapped_column(Float)
    storage_condition: Mapped[str | None] = mapped_column(String(100))  # 25°C/60%RH, 4°C, RT
    aliquot_count: Mapped[int] = mapped_column(Integer, default=1)
    
    # 关联测试报告
    test_reports: Mapped[list["TestReport"]] = relationship(
        "TestReport", back_populates="sample", cascade="all, delete-orphan"
    )
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=timezone.now)
    
    @property
    def batch(self) -> "Batch | None":
        from .batch_record import Batch
        return None  # 延迟导入
    
    @property
    def formula_code(self) -> str | None:
        if self.batch and self.batch.formula:
            return self.batch.formula.code
        return None
```

**新建文件：`backend/app/models/test_report.py`**
```python
"""
TestReport（测试报告）模型
每个测试参数一条记录，携带 spec 判定
"""
from sqlalchemy import BigInteger, String, Text, DateTime, JSON, ForeignKey, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base

class TestReport(Base):
    __tablename__ = "test_reports"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    organization_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    
    sample_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("samples.id", ondelete="CASCADE"), index=True)
    
    # 测试信息
    parameter: Mapped[str] = mapped_column(String(200), nullable=False, index=True)  # 测试参数名
    value: Mapped[float | None] = mapped_column(Float)  # 实测值
    unit: Mapped[str | None] = mapped_column(String(50))
    
    # Spec 判定
    spec_min: Mapped[float | None] = mapped_column(Float)
    spec_max: Mapped[float | None] = mapped_column(Float)
    result: Mapped[str | None] = mapped_column(String(20))  # pass/fail/warn
    
    # 元数据
    tester_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id"))
    tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=timezone.now)
    
    # 关系
    sample: Mapped["Sample"] = relationship("Sample", back_populates="test_reports")
```

**新建文件：`backend/app/models/ingredient_lot.py`**
```python
"""
IngredientLot（原料批号）模型
原料入库追踪，链接批次原料消耗
"""
from sqlalchemy import BigInteger, String, Text, DateTime, JSON, ForeignKey, Float
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base

class IngredientLot(Base):
    __tablename__ = "ingredient_lots"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    organization_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    
    ingredient_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("ingredients.id", ondelete="CASCADE"), index=True)
    
    # 批号信息
    supplier_lot_number: Mapped[str] = mapped_column(String(100), nullable=False)  # 供应商批号
    internal_lot_code: Mapped[str] = mapped_column(String(50), unique=True, index=True)  # 内部批号
    
    # 数量
    received_qty_kg: Mapped[float] = mapped_column(Float, nullable=False)
    used_qty_kg: Mapped[float] = mapped_column(Float, default=0.0)
    remaining_qty_kg: Mapped[float] = mapped_column(Float)
    
    # 日期
    received_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expiry_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    
    # 状态
    status: Mapped[str] = mapped_column(String(20), default="available")  # available/held/used/expired
    
    # 文档
    coa_url: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=timezone.now)
```

**新建迁移文件：`backend/migrations/versions/001_add_batch_traceability.py`**
```python
"""
Alembic 迁移：添加批记录追溯体系
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    # 1. 创建 ingredient_lots 表
    op.create_table('ingredient_lots', ...)
    
    # 2. 创建 batches 表
    op.create_table('batches', ...)
    
    # 3. 创建 batch_ingredient_lots 关联表
    op.create_table('batch_ingredient_lots', ...)
    
    # 4. 创建 samples 表
    op.create_table('samples', ...)
    
    # 5. 创建 test_reports 表
    op.create_table('test_reports', ...)
    
    # 6. 添加外键索引
    op.create_index('idx_batches_formula_id', 'batches', ['formula_id'])
    op.create_index('idx_samples_batch_id', 'samples', ['batch_id'])
    op.create_index('idx_test_reports_sample_id', 'test_reports', ['sample_id'])
```

**新建服务：`backend/app/services/batch/batch_service.py`**
```python
"""
批记录生成服务
从配方自动生成可称重批记录
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

class BatchRecordService:
    """
    配方 → 批记录 转换服务
    
    功能：
    1. 根据目标产量放大配方各成分用量
    2. 生成可打印的批记录（含称重量）
    3. 自动关联原料批号（如果可用）
    """
    
    async def create_batch(
        self,
        formula_id: int,
        formula_version_id: int | None,
        target_weight_kg: float,
        preparer_id: int,
        notes: str | None = None,
    ) -> Dict[str, Any]:
        """创建批记录"""
        # 1. 获取配方版本
        formula = await self._get_formula_with_version(formula_id, formula_version_id)
        
        # 2. 计算放大比例
        formula_total_g = sum(ing.dosage_mg for ing in formula.ingredients) / 1000  # 转换为kg
        scale_factor = target_weight_kg / formula_total_g if formula_total_g > 0 else 1.0
        
        # 3. 生成批记录
        batch_code = await self._generate_batch_code(formula.code)
        
        # 4. 创建批记录
        batch = Batch(
            organization_id=formula.organization_id,
            batch_code=batch_code,
            formula_id=formula_id,
            formula_version_id=formula_version_id,
            target_weight_kg=target_weight_kg,
            prepared_by=preparer_id,
            preparation_date=datetime.now(timezone.utc),
            notes=notes,
        )
        
        # 5. 创建批记录行（成分+称重量）
        for ing in formula.ingredients:
            scaled_dosage_mg = ing.dosage_mg * scale_factor
            batch_row = BatchIngredientRow(
                batch_id=batch.id,
                ingredient_id=ing.id,
                specified_dosage_mg=ing.dosage_mg,
                scaled_dosage_mg=scaled_dosage_mg,
                unit=ing.unit or "mg",
            )
            # TODO: 如果有可用原料批号，自动关联
            
        return batch.to_dict()
    
    async def _generate_batch_code(self, formula_code: str) -> str:
        """生成批号：FMT-{formula_code}-{YYYYMMDD}-{seq}"""
        date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        seq = await self._get_batch_seq_count(date_str) + 1
        return f"B-{formula_code}-{date_str}-{seq:03d}"
```

**新建服务：`backend/app/services/batch/sample_tracking_service.py`**
```python
"""
样品追踪服务
"""
class SampleTrackingService:
    async def create_sample(
        self,
        batch_id: int,
        sample_type: str = "qc",
        quantity_g: float | None = None,
        storage_condition: str | None = None,
    ) -> Dict[str, Any]:
        """创建样品"""
        sample_code = await self._generate_sample_code(batch_id)
        sample = Sample(
            organization_id=...,
            sample_code=sample_code,
            batch_id=batch_id,
            sample_type=sample_type,
            quantity_g=quantity_g,
            storage_condition=storage_condition,
        )
        return sample.to_dict()
```

#### 前端交付物

**新建页面：`frontend/src/pages/batch/BatchListPage.tsx`**
- 批记录列表（搜索/筛选/分页）
- 从配方创建批记录入口
- 批量操作

**新建页面：`frontend/src/pages/batch/BatchDetailPage.tsx`**
- 批记录详情
- 成分称量清单
- 关联样品列表
- 关联原料批号

**新建组件：`frontend/src/components/batch/BatchWeightList.tsx`**
- 可称重批记录清单（带勾选项）
- 扫码录入原料批号

### 1.2 W3：TraceabilityEngine

**新建服务：`backend/app/services/batch/traceability_engine.py`**
```python
"""
双向追溯引擎
- 正向：原料批号 → 使用该批号的所有批次 → 所有成品
- 反向：成品批次 → 使用的所有原料批号
"""
class TraceabilityEngine:
    async def forward_trace(self, ingredient_lot_id: int) -> Dict[str, Any]:
        """正向追溯：这个原料批号用到了哪些产品"""
        # 1. 找到所有使用该批号的批次
        batches = await self._find_batches_using_lot(ingredient_lot_id)
        # 2. 找到这些批次对应的成品
        finished_goods = await self._find_finished_goods_from_batches(batches)
        return {
            "ingredient_lot_id": ingredient_lot_id,
            "batches": batches,
            "finished_goods": finished_goods,
        }
    
    async def backward_trace(self, batch_id: int) -> Dict[str, Any]:
        """反向追溯：这个批次用了哪些原料"""
        ingredient_lots = await self._find_ingredient_lots_for_batch(batch_id)
        return {
            "batch_id": batch_id,
            "ingredient_lots": ingredient_lots,
        }
```

### 1.3 W4-W5：价格系统与影响分析

**修改模型：`backend/app/models/external_data.py`**
```python
class FoodMaterial(Base):
    # ... 现有字段 ...
    
    # 新增价格字段
    price_per_kg: Mapped[float | None] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="CNY")
    supplier_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("organizations.id"))
    last_price_update: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    
    # 新增价格历史
    price_history: Mapped[list] = mapped_column(JSON, default=list)
```

**新建服务：`backend/app/services/batch/price_change_impact_service.py`**
```python
"""
供应商调价影响分析服务
"""
class PriceChangeImpactService:
    async def analyze_impact(
        self,
        ingredient_id: int,
        old_price: float,
        new_price: float,
    ) -> Dict[str, Any]:
        """
        分析某原料调价对所有配方和批次的成本影响
        """
        # 1. 找到所有使用该原料的配方
        affected_formulas = await self._find_formulas_using_ingredient(ingredient_id)
        
        # 2. 计算每个配方的成本变化
        impact_per_formula = []
        for formula in affected_formulas:
            cost_change = self._calc_cost_change(formula, ingredient_id, old_price, new_price)
            impact_per_formula.append({
                "formula_id": formula.id,
                "formula_code": formula.code,
                "old_cost_per_kg": formula.cost_per_kg,
                "new_cost_per_kg": formula.cost_per_kg + cost_change,
                "cost_change_percent": (cost_change / formula.cost_per_kg * 100) if formula.cost_per_kg > 0 else 0,
            })
        
        # 3. 排序（影响最大的在前）
        impact_per_formula.sort(key=lambda x: abs(x["cost_change_percent"]), reverse=True)
        
        return {
            "ingredient_id": ingredient_id,
            "old_price": old_price,
            "new_price": new_price,
            "price_change_percent": ((new_price - old_price) / old_price * 100) if old_price > 0 else 0,
            "affected_formulas_count": len(affected_formulas),
            "impact_per_formula": impact_per_formula,
        }
```

### 1.4 W6：自定义字段与理论参数

**新建服务：`backend/app/services/custom_fields/custom_field_service.py`**
```python
"""
动态自定义字段服务
允许用户在原料上添加任意属性
"""
class CustomFieldService:
    async def create_field(
        self,
        entity_type: str,  # "ingredient" | "formula" | "sample"
        field_name: str,
        field_type: str,   # "text" | "number" | "date" | "select" | "boolean"
        options: list | None = None,
        required: bool = False,
    ) -> Dict[str, Any]:
        """创建自定义字段定义"""
        ...
    
    async def set_value(
        self,
        entity_type: str,
        entity_id: int,
        field_name: str,
        value: Any,
    ) -> None:
        """设置实体字段值"""
        ...
    
    async def get_value(
        self,
        entity_type: str,
        entity_id: int,
        field_name: str,
    ) -> Any:
        """获取实体字段值"""
        ...
```

**新建服务：`backend/app/services/custom_fields/theoretical_parameter_service.py`**
```python
"""
理论参数计算服务
类似 FormLab 的 "Theoretical Parameters" 功能
"""
class TheoreticalParameterService:
    async def calculate_formula_parameter(
        self,
        formula_id: int,
        parameter_expression: str,  # 如 "SUM(row.dosage_mg * ing.density)"
    ) -> float:
        """
        计算配方级理论参数
        
        支持的表达式语法：
        - SUM(row.dosage_mg * ing.density WHERE ing.density)  # 加权求和
        - AVG(row.dosage_mg)  # 平均值
        - MAX(row.dosage_mg)  # 最大值
        - row.dosage_mg / 1000 * ing.nitrogen_factor  # 氮折算
        """
        ...
```

---

## 三、Phase 2：报告与 AI 分离（W7-W9）

### 2.1 W7：FactEngine

**新建服务：`backend/app/services/report/fact_engine.py`**
```python
"""
确定性事实引擎
计算所有"有正确答案"的数据，不经过 AI
"""
class FactEngine:
    async def analyze_formula(self, formula_id: int) -> Dict[str, Any]:
        """
        计算配方的所有确定性事实
        
        Returns:
            {
                "cost_per_kg": 12.5,           # 确定计算
                "pass_rate": 0.97,              # 确定计算
                "out_of_spec_count": 1,         # 确定计算
                "drifting_parameters": [...],   # 确定计算
                "compliance_issues": [...],     # 确定计算
                "coverage_gaps": [...],         # 确定计算
                "ingredient_count": 10,         # 确定计算
            }
        """
        facts = {}
        
        # 1. 成本计算（从数据库实时价格）
        facts["cost_per_kg"] = await self._calc_cost(formula_id)
        
        # 2. 合规评分（硬约束检查）
        facts["compliance_issues"] = await self._check_compliance(formula_id)
        
        # 3. 测试通过率
        facts["pass_rate"], facts["out_of_spec_count"] = await self._calc_pass_rate(formula_id)
        
        # 4. 漂移参数检测（结合异常检测引擎）
        facts["drifting_parameters"] = await self._detect_drift(formula_id)
        
        # 5. 覆盖率缺口
        facts["coverage_gaps"] = await self._find_coverage_gaps(formula_id)
        
        return facts
    
    async def analyze_batch(self, batch_id: int) -> Dict[str, Any]:
        """分析批次事实"""
        ...
    
    async def analyze_project(self, project_id: int) -> Dict[str, Any]:
        """分析项目级事实汇总"""
        ...
```

### 2.2 W8：AIReportWriter

**新建服务：`backend/app/services/report/ai_report_writer.py`**
```python
"""
AI 报告撰写服务
只接收 FactEngine 的输出，不自行计算任何数字
"""
class AIReportWriter:
    TONES = {
        "internal": " candid and technical; names the risks plainly",
        "management": "Leads with status, cost, timeline and risk; concise and decision-oriented",
        "client": "Polished and professional; confident but honest",
        "regulatory": "Formal, precise and conservative; states only what the facts support",
    }
    
    async def write_summary(
        self,
        facts: Dict[str, Any],
        entity_type: str,  # "formula" | "batch" | "project"
        tone: str = "internal",
        detail_level: str = "standard",  # "executive" | "standard" | "full"
    ) -> str:
        """
        基于确定性事实生成 AI 叙述摘要
        
        Prompt 策略：
        - 传入 facts（所有数字来源）
        - 明确指示"不要编造或估算任何未在 facts 中提供的数据"
        - 按 tone 调整语言风格
        """
        system_prompt = f"""你是专业的配方研发报告撰写人。
你收到的所有数字都是系统从真实数据计算得出的，请勿编造任何数字。
报告受众：{self.TONES[tone]}
"""
        
        user_prompt = f"""基于以下确定性事实，撰写一份{detail_level}级别的报告摘要：

{json.dumps(facts, ensure_ascii=False, indent=2)}

要求：
1. 所有数字必须来自上述 facts，不得自行计算或估算
2. 用{self.TONES[tone]}的风格撰写
3. 指出关键风险和下一步建议
"""
        
        return await self._call_llm(system_prompt, user_prompt)
```

### 2.3 W9：报告重构

**重构：`backend/app/services/report/explainability_report.py`**
```python
"""
重写可解释性报告，采用 FactEngine → AIReportWriter 架构
"""
class ExplainabilityReportService:
    async def generate(
        self,
        formula_id: int,
        tone: str = "internal",
        detail_level: str = "standard",
    ) -> ReportOutput:
        """
        生成报告：先计算事实，再由 AI 撰写叙述
        """
        # Phase 1: 确定性计算
        facts = await self.fact_engine.analyze_formula(formula_id)
        
        # Phase 2: AI 叙述
        ai_summary = await self.ai_report_writer.write_summary(
            facts=facts,
            entity_type="formula",
            tone=tone,
            detail_level=detail_level,
        )
        
        return ReportOutput(
            facts=facts,           # 确定性事实（可溯源）
            ai_summary=ai_summary, # AI 叙述（标注来源）
            footer="本报告所有数值来自系统记录，AI 生成叙述部分。外部使用前请核实。",
        )
```

---

## 四、Phase 3：DOE 与逆向搜索（W10-W14）

### 3.1 W10-W11：DOE 实验设计

**新建服务：`backend/app/services/experiment/doe_generator.py`**
```python
"""
实验设计矩阵生成器
对标 FormLab DOE workbench
"""
import numpy as np
from scipy.stats import maximin_lhs

class DOEGenrator:
    """
    支持的设计类型：
    - FullFactorial: 全因子设计
    - FractionalFactorial: 部分因子设计
    - CCD: 中心复合设计
    - BBD: Box-Behnken 设计
    - LatinHypercube: 拉丁超立方设计
    - SimplexLattice: 混料简单形格子设计
    - SimplexCentroid: 混料简单形重心设计
    """
    
    async def generate(
        self,
        design_type: str,
        factors: List[Dict[str, Any]],  # [{"name": "黄芪", "low": 0.1, "high": 0.5}, ...]
        runs: int | None = None,
    ) -> Dict[str, Any]:
        """
        生成实验设计矩阵
        
        Returns:
            {
                "design_type": "CCD",
                "factors": [...],
                "design_matrix": [[...], ...],  # 各 run 的各因子水平
                "center_points": [...],
                "star_points": [...],
                "properties": {"rotatability": True, "orthogonality": 0.95},
            }
        """
        if design_type == "full_factorial":
            return await self._full_factorial(factors, runs)
        elif design_type == "ccd":
            return await self._ccd(factors)
        elif design_type == "bbd":
            return await self._bbd(factors)
        elif design_type == "latin_hypercube":
            return await self._latin_hypercube(factors, runs)
        elif design_type == "simplex_lattice":
            return await self._simplex_lattice(factors, runs)
        else:
            raise ValueError(f"Unknown design type: {design_type}")
    
    async def _ccd(self, factors: List[Dict]) -> Dict:
        """中心复合设计"""
        k = len(factors)
        # 2^k 因子点 + 2k 星点 + center points
        factorial_runs = 2 ** k
        star_runs = 2 * k
        center_runs = min(6, max(4, factorial_runs // 2))
        total_runs = factorial_runs + star_runs + center_runs
        
        # 使用 scipy 生成因子部分
        from itertools import product
        factor_levels = list(product([-1, 1], repeat=k))
        
        # 星点 alpha 值
        alpha = (factorial_runs ** 0.25) if factorial_runs > 0 else 1.414
        
        design_matrix = []
        for levels in factor_levels:
            design_matrix.append(list(levels))
        
        # 星点
        for i in range(k):
            row = [0] * k
            row[i] = alpha
            design_matrix.append(row)
            row[i] = -alpha
            design_matrix.append(row)
        
        # 中心点
        for _ in range(center_runs):
            design_matrix.append([0] * k)
        
        return {
            "design_type": "CCD",
            "total_runs": len(design_matrix),
            "design_matrix": design_matrix,
            "alpha": alpha,
            "properties": {"rotatability": True},
        }
```

**新建服务：`backend/app/services/experiment/response_surface.py`**
```python
"""
响应面拟合服务
"""
class ResponseSurfaceService:
    async def fit(
        self,
        design_matrix: List[List[float]],
        responses: List[float],
        factor_names: List[str],
        model_type: str = "quadratic",
    ) -> Dict[str, Any]:
        """
        拟合响应面模型
        
        Returns:
            {
                "model_type": "quadratic",
                "r_squared": 0.95,
                "adj_r_squared": 0.92,
                "coefficients": {...},
                "anova": {...},
                "equation": "Y = 2.5 + 1.2X1 - 0.8X2 + 0.3X1² + ...",
            }
        """
        from sklearn.linear_model import LinearRegression
        from sklearn.preprocessing import PolynomialFeatures
        
        # 构建多项式特征
        poly = PolynomialFeatures(degree=2, include_bias=False)
        X_poly = poly.fit_transform(np.array(design_matrix))
        
        # 拟合
        model = LinearRegression()
        model.fit(X_poly, np.array(responses))
        
        # 计算 R²
        r_squared = model.score(X_poly, np.array(responses))
        
        return {
            "model_type": model_type,
            "r_squared": round(r_squared, 4),
            "coefficients": model.coef_.tolist(),
            "intercept": round(model.intercept_, 4),
            "equation": self._format_equation(factor_names, model.coef_, model.intercept_),
        }
```

### 3.2 W12：响应面可视化

**新建前端：`frontend/src/components/experiment/ResponseSurfaceChart.tsx`**
- 3D 响应面图（React Three Fiber 或 Plotly）
- 等高线图
- 交互：拖动因子滑块观察响应变化

**新建前端：`frontend/src/pages/experiment/DOEWorkbenchPage.tsx`**
- 设计选择器（CCD/BBD/全因子/混料）
- 设计矩阵预览
- 因子范围设置
- 结果导入（上传测试数据）
- 模型拟合与诊断

### 3.3 W13：逆向搜索

**新建服务：`backend/app/services/search/reverse_search_service.py`**
```python
"""
按测试结果反向搜索配方
对标 FormLab "Find by Results"
"""
class ReverseSearchService:
    async def search_by_results(
        self,
        criteria: List[Dict[str, Any]],  # [{"parameter": "pH", "min": 6.5, "max": 7.5}, ...]
        grain: str = "formula",  # "formula" | "sample" | "batch"
        scope: Dict[str, Any] | None = None,  # 限定范围
    ) -> Dict[str, Any]:
        """
        按测试结果反向搜索
        
        Returns:
            {
                "matches": [
                    {
                        "formula_id": 1,
                        "formula_code": "FORM-001",
                        "formula_name": "安神代茶饮",
                        "match_scores": {"pH": 7.0, "色泽": "合格"},
                        "ranking_score": 0.95,
                    }
                ],
                "histograms": {"pH": [...], "色泽": [...]},
                "total_matches": 12,
            }
        """
        # 1. 构建查询
        query = self._build_query(criteria, grain, scope)
        
        # 2. 执行搜索
        results = await self._execute_search(query)
        
        # 3. 计算直方图
        histograms = await self._compute_histograms(criteria, grain)
        
        # 4. 排序和评分
        ranked = self._rank_results(results, criteria)
        
        return {
            "matches": ranked,
            "histograms": histograms,
            "total_matches": len(ranked),
        }
```

### 3.4 W14：主动学习

**新建服务：`backend/app/services/experiment/active_learning.py`**
```python
"""
主动学习：推荐下一个最优实验点
对标 FormLab "Suggest next experiments"
"""
class ActiveLearningService:
    async def suggest_next_experiments(
        self,
        fitted_model: Dict[str, Any],
        design_space: Dict[str, Any],
        targets: List[Dict[str, Any]] | None = None,
        n_suggestions: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        推荐下一个实验点
        
        策略：
        - 无 targets → 纯探索（模型不确定性最大处）
        - 有 targets → 探索+利用（上置信界 UCB）
        """
        if not targets:
            # 纯探索：推荐模型最不确定处的实验点
            return await self._explore_uncertainty(fitted_model, design_space, n_suggestions)
        else:
            # 探索+利用：UCB 策略
            return await self._ucb_search(fitted_model, design_space, targets, n_suggestions)
    
    async def _explore_uncertainty(
        self, model: Dict, space: Dict, n: int
    ) -> List[Dict]:
        """不确定性探索：推荐模型方差最大的区域"""
        # 使用 Gaussian Process 或 ensemble 方法估计不确定性
        ...
    
    async def _ucb_search(
        self, model: Dict, space: Dict, targets: List[Dict], n: int
    ) -> List[Dict]:
        """UCB 探索+利用"""
        # UCB = μ(x) + κ·σ(x)
        # μ(x) = 模型预测值，σ(x) = 预测不确定性
        ...
```

---

## 五、Phase 4：稳定性与追溯增强（W15-W18）

### 4.1 W15-W16：真实稳定性模型

**替换：`backend/app/services/ai_models/stability_model.py`**
```python
"""
真实稳定性预测服务
替代 MockStabilityModel
"""
import math
from typing import List, Dict, Any

class StabilityModelService:
    """
    Arrhenius 加速模型 + 实测数据趋势分析
    
    原理：
    - 加速条件（40°C/75%RH）下观测退化速率
    - 通过 Arrhenius 方程外推常温（25°C）下的有效期
    - k = A · e^(-Ea/RT)
    """
    
    GAS_CONSTANT = 8.314  # J/(mol·K)
    
    async def predict(
        self,
        ingredients: List[Dict[str, Any]],
        storage_conditions: List[Dict[str, Any]],  # [{"temp_c": 25, "rh": 60}, ...]
        test_history: List[Dict[str, Any]],  # 历史测试数据
        activation_energy: float = 80000,  # J/mol（默认值，可通过实验校准）
    ) -> Dict[str, Any]:
        """
        预测配方稳定性
        
        Returns:
            {
                "stability_score": 0.85,
                "estimated_shelf_life_months": 24,
                "shelf_life_confidence": "high",
                "risk_factors": [...],
                "monthly_curve": [...],  # 每月预测值
                "failure_mode": "微生物超标",  # 最可能的失效模式
                "recommendations": [...],
            }
        """
        # 1. 基于历史数据拟合退化曲线
        degradation_curve = await self._fit_degradation_curve(test_history)
        
        # 2. 计算加速因子（Arrhenius）
        accel_factor = self._arrhenius_acceleration(
            T_ref=298.15,  # 25°C = 298.15K
            T_accel=313.15,  # 40°C = 313.15K
            Ea=activation_energy,
        )
        
        # 3. 基于退化曲线和加速因子估算有效期
        shelf_life = await self._estimate_shelf_life(degradation_curve, accel_factor)
        
        # 4. 识别风险因素
        risk_factors = await self._identify_risk_factors(ingredients, storage_conditions)
        
        # 5. 生成月度预测曲线
        monthly_curve = await self._generate_monthly_curve(degradation_curve, shelf_life)
        
        return {
            "stability_score": round(shelf_life["score"], 2),
            "estimated_shelf_life_months": shelf_life["months"],
            "shelf_life_confidence": shelf_life["confidence"],
            "risk_factors": risk_factors,
            "monthly_curve": monthly_curve,
            "failure_mode": self._identify_failure_mode(risk_factors),
            "recommendations": self._generate_recommendations(risk_factors, shelf_life),
        }
    
    def _arrhenius_acceleration(self, T_ref: float, T_accel: float, Ea: float) -> float:
        """计算加速因子"""
        return math.exp((Ea / self.GAS_CONSTANT) * (1/T_ref - 1/T_accel))
```

### 4.2 W17：稳定性方案设计

**新建服务：`backend/app/services/stability/stability_protocol.py`**
```python
"""
稳定性试验方案设计服务
"""
class StabilityProtocolBuilder:
    async def build_protocol(
        self,
        product_type: str,  # "solid" | "liquid" | "semi-solid" | "cream"
        target_shelf_life_months: int,
        markets: List[str],  # ["CN", "EU", "US"]
    ) -> Dict[str, Any]:
        """
        根据产品类型和上市地区自动生成稳定性方案
        
        ICH 指南参考：
        - ICH Q1A(R2): 新原料药和制剂的稳定性试验
        - ICH Q1C: 新制剂的稳定性试验
        - GB/T 16886: 中国保健食品稳定性试验指导原则
        """
        protocol = {
            "conditions": [],
            "timepoints": [],
            "test_parameters": [],
        }
        
        # 长期条件（真实存储）
        if "CN" in markets:
            protocol["conditions"].append({
                "name": "长期（中国）",
                "temp_c": 25,
                "rh_percent": 60,
                "duration_months": target_shelf_life_months * 2,  # 至少覆盖有效期1.5倍
            })
        
        # 加速条件
        protocol["conditions"].append({
            "name": "加速",
            "temp_c": 40,
            "rh_percent": 75,
            "duration_months": 6,
        })
        
        # 中间条件（如加速条件显著变化）
        protocol["conditions"].append({
            "name": "中间",
            "temp_c": 30,
            "rh_percent": 65,
            "duration_months": 6,
        })
        
        # 时间点
        protocol["timepoints"] = [0, 1, 2, 3, 6, 9, 12, 18, 24, 36]
        
        # 测试参数（根据产品类型）
        protocol["test_parameters"] = self._get_parameters_for_type(product_type)
        
        return protocol
```

### 4.3 W18：趋势分析与失效模式

**新建服务：`backend/app/services/stability/trend_analyzer.py`**
```python
"""
稳定性趋势分析服务
"""
class TrendAnalyzer:
    async def analyze_trend(
        self,
        test_history: List[Dict[str, Any]],  # [{timepoint, value, spec_min, spec_max}]
    ) -> Dict[str, Any]:
        """
        分析参数趋势
        
        Returns:
            {
                "trend_direction": "decreasing",  # increasing/decreasing/stable
                "trend_slope": -0.02,  # 每月变化率
                "time_to_spec_limit_months": 18.5,  # 预计多久触及规格限
                "is_drifting": True,
                "confidence": "high",
                "failure_mode_prediction": "微生物超标风险上升",
            }
        """
        # 1. 线性回归拟合趋势
        slope, intercept, r_squared = self._linear_regression(test_history)
        
        # 2. 判断是否漂移
        is_drifting = abs(slope) > self._get_drift_threshold(test_history)
        
        # 3. 外推至规格限
        time_to_limit = None
        if slope < 0 and test_history[-1]["value"] > test_history[-1].get("spec_min", 0):
            time_to_limit = (test_history[-1]["value"] - test_history[-1]["spec_min"]) / abs(slope)
        
        return {
            "trend_direction": "decreasing" if slope < 0 else "increasing",
            "trend_slope": round(slope, 4),
            "r_squared": round(r_squared, 4),
            "time_to_spec_limit_months": round(time_to_limit, 1) if time_to_limit else None,
            "is_drifting": is_drifting,
        }
```

---

## 六、Phase 5：外围能力补齐（W19-W21）

### 5.1 W19：MCP 服务器

**新建服务：`backend/app/services/mcp_server/main.py`**
```python
"""
MCP（Model Context Protocol）服务器
对标 FormLab 的 40 个只读 MCP 工具
"""
from mcp.server import Server
from mcp.types import Tool, TextContent

app = Server("rmfood-mcp")

@app.tool()
async def list_formulas(organization_id: int | None = None, status: str | None = None) -> list:
    """列出配方"""
    ...

@app.tool()
async def get_formula(formula_id: int) -> dict:
    """获取配方详情"""
    ...

@app.tool()
async def search_herbs(query: str, limit: int = 20) -> list:
    """搜索药材"""
    ...

@app.tool()
async def check_compliance(formula_id: int) -> dict:
    """检查配方合规性"""
    ...

# ... 共 20+ 个工具
```

### 5.2 W20：标签打印

**新建服务：`backend/app/services/label_generator.py`**
```python
"""
条码/QR 标签生成服务
对标 FormLab 的 Code128 + QR 标签
"""
from barcode import Code128
from qrcode import make as make_qr

class LabelGenerator:
    async def generate_label(
        self,
        entity_type: str,  # "sample" | "batch" | "ingredient" | "equipment"
        entity_id: int,
        format: str = "both",  # "code128" | "qr" | "both"
        label_size: str = "medium",
    ) -> bytes:
        """
        生成标签
        
        标签内容：
        - 上层：Code128 条码（内部ID编码）
        - 中层：QR 码（deep link 到应用）
        - 下层：人类可读信息（UID + 名称 + 上下文）
        """
        # 1. 获取实体信息
        entity = await self._get_entity(entity_type, entity_id)
        
        # 2. 生成 Code128
        code128 = Code128(str(entity.internal_id), writer=QuietZoneWriter())
        code128_bytes = code128.get_image_bytes()
        
        # 3. 生成 QR（deep link）
        deep_link = f"https://rmfood.app/entity/{entity_type}/{entity.internal_id}"
        qr = make_qr(deep_link)
        qr_bytes = qr.to_string()
        
        # 4. 组合标签
        label = self._compose_label(code128_bytes, qr_bytes, entity)
        
        return label
```

### 5.3 W21：文档智能提取

**新建服务：`backend/app/services/document_extractor/extractor.py`**
```python
"""
供应商文档智能提取服务
对标 FormLab 的 CoA/PDS/SDS AI 提取
"""
class DocumentExtractor:
    async def extract(
        self,
        document_bytes: bytes,
        document_type: str,  # "coa" | "pds" | "sd"
        ingredient_id: int | None = None,
    ) -> Dict[str, Any]:
        """
        从供应商文档中提取结构化数据
        
        流程：提取 → 提案 → 人工审核 → 应用
        """
        # 1. 调用 OCR + AI 提取
        extracted_fields = await self._ocr_and_extract(document_bytes, document_type)
        
        # 2. 不自动应用，返回提案供审核
        proposal = {
            "document_type": document_type,
            "extracted_fields": extracted_fields,
            "confidence_scores": {k: v["confidence"] for k, v in extracted_fields.items()},
            "requires_review": any(f["confidence"] < 0.9 for f in extracted_fields.values()),
        }
        
        return proposal
```

---

## 七、数据库迁移汇总

```sql
-- 1. 原料批号
CREATE TABLE ingredient_lots (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT,
    ingredient_id BIGINT REFERENCES ingredients(id),
    supplier_lot_number VARCHAR(100) NOT NULL,
    internal_lot_code VARCHAR(50) UNIQUE,
    received_qty_kg FLOAT NOT NULL,
    used_qty_kg FLOAT DEFAULT 0,
    remaining_qty_kg FLOAT,
    received_date TIMESTAMPTZ,
    expiry_date TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'available',
    coa_url VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 批记录
CREATE TABLE batches (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT,
    batch_code VARCHAR(50) UNIQUE NOT NULL,
    formula_id BIGINT REFERENCES formulas(id),
    formula_version_id BIGINT REFERENCES formula_versions(id),
    target_weight_kg FLOAT NOT NULL,
    actual_weight_kg FLOAT,
    yield_rate FLOAT,
    status VARCHAR(20) DEFAULT 'planned',
    prepared_by BIGINT REFERENCES users(id),
    preparation_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 批-原料关联
CREATE TABLE batch_ingredient_lots (
    batch_id BIGINT REFERENCES batches(id) ON DELETE CASCADE,
    ingredient_lot_id BIGINT REFERENCES ingredient_lots(id) ON DELETE CASCADE,
    used_qty_kg FLOAT NOT NULL,
    PRIMARY KEY (batch_id, ingredient_lot_id)
);

-- 4. 样品
CREATE TABLE samples (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT,
    sample_code VARCHAR(50) UNIQUE NOT NULL,
    batch_id BIGINT REFERENCES batches(id) ON DELETE CASCADE,
    sample_type VARCHAR(50) DEFAULT 'qc',
    quantity_g FLOAT,
    storage_condition VARCHAR(100),
    aliquot_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 测试报告
CREATE TABLE test_reports (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT,
    sample_id BIGINT REFERENCES samples(id) ON DELETE CASCADE,
    parameter VARCHAR(200) NOT NULL,
    value FLOAT,
    unit VARCHAR(50),
    spec_min FLOAT,
    spec_max FLOAT,
    result VARCHAR(20),  -- pass/fail/warn
    tester_id BIGINT REFERENCES users(id),
    tested_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 自定义字段定义
CREATE TABLE custom_field_definitions (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT,
    entity_type VARCHAR(50) NOT NULL,  -- ingredient/formula/sample
    field_name VARCHAR(100) NOT NULL,
    field_type VARCHAR(20) NOT NULL,   -- text/number/date/select/boolean
    options JSON,
    required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 自定义字段值
CREATE TABLE custom_field_values (
    id BIGSERIAL PRIMARY KEY,
    definition_id BIGINT REFERENCES custom_field_definitions(id),
    entity_id BIGINT NOT NULL,
    field_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 八、API 路由新增汇总

```
POST   /api/v1/batches                  创建批记录
GET    /api/v1/batches                  批记录列表
GET    /api/v1/batches/{id}             批记录详情
POST   /api/v1/batches/{id}/samples     创建样品
GET    /api/v1/batches/{id}/trace       反向追溯（该批用了哪些原料）
GET    /api/v1/ingredients/{id}/lots    原料批号列表
POST   /api/v1/ingredients/{id}/lots    入库登记
GET    /api/v1/trace/forward/{lot-id}   正向追溯（该批号用到了哪些产品）
POST   /api/v1/samples/{id}/tests       录入测试结果
GET    /api/v1/samples/{id}/tests       样品测试报告
GET    /api/v1/test-results/comparison  测试结果对比
POST   /api/v1/doe/generate             生成实验设计矩阵
GET    /api/v1/doe/{id}/results         获取实验设计结果
POST   /api/v1/doe/{id}/fit             拟合响应面模型
GET    /api/v1/reverse-search           按结果反向搜索配方
POST   /api/v1/reverse-search/suggest   主动学习推荐实验点
POST   /api/v1/stability/protocol       生成稳定性方案
GET    /api/v1/stability/{id}/trend     稳定性趋势分析
GET    /api/v1/reports/facts/{id}       获取确定性事实（FactEngine）
POST   /api/v1/reports/generate         生成完整报告（Fact + AI）
GET    /api/v1/prices/impact            价格变动影响分析
POST   /api/v1/labels/generate          生成标签
POST   /api/v1/documents/extract        提取文档结构化数据
GET    /api/v1/mcp/tools                MCP 工具列表
```

---

## 九、风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 数据模型变更导致现有功能破坏 | 中 | 高 | 每阶段独立迁移+回滚脚本 |
| AI 报告准确性 | 中 | 中 | FactEngine 输出可验证，AI 只负责叙述 |
| DOE 算法复杂度 | 低 | 中 | 复用 scipy/sklearn，不重复造轮子 |
| MCP 协议兼容性问题 | 低 | 低 | 遵循标准 MCP spec，有成熟 SDK |
| 前端开发进度 | 中 | 中 | 复用现有 shadcn/ui 组件 |

---

## 十、成功标准

| 维度 | 目标 | 衡量方式 |
|------|------|----------|
| 数据完整性 | Batch→Sample→Test 链路完整可用 | 端到端流程测试通过 |
| 追溯能力 | 双向追溯查询 < 1秒 | API 响应时间 |
| 报告质量 | 4 tone 报告生成 < 5秒 | 用户满意度评分 |
| DOE 能力 | 支持 5+ 种实验设计 | 测试用例覆盖 |
| 稳定性预测 | 与 Mock 版本相比准确度提升 > 50% | 交叉验证 R² |
| 产品化程度 | 通过 FormLab 同等功能对标 | 功能对比矩阵达标 |

---

> **本实施方案基于** `docs/formlab-comparison-analysis.md`
> **下一步**：逐项拆解为 Jira/禅道任务，开始 Phase 1 实施

---

## 实施进度更新（2026-09-26）

### ✅ Phase 1 已完成（核心部分）

| 交付物 | 状态 | 文件路径 |
|--------|------|----------|
| **枚举扩展** (BatchStatus, SampleType, TestResult, IngredientLotStatus, CustomFieldType, CustomFieldEntity, ProjectPhase) | ✅ 完成 | `backend/app/models/enums.py` |
| **Batch 模型** | ✅ 完成 | `backend/app/models/batch_record.py` |
| **Sample 模型** | ✅ 完成 | `backend/app/models/sample.py` |
| **TestReport 模型** | ✅ 完成 | `backend/app/models/test_report.py` |
| **IngredientLot 模型** | ✅ 完成 | `backend/app/models/ingredient_lot.py` |
| **Formula 关联更新** (batches, ingredient_lots) | ✅ 完成 | `backend/app/models/formula.py` |
| **模型导出更新** | ✅ 完成 | `backend/app/models/__init__.py` |
| **Alembic 迁移** (7张新表 + food_materials价格字段) | ✅ 完成 | `backend/alembic/versions/20260925_000000_add_batch_traceability.py` |
| **BatchRecordService** (创建/列表/状态更新/批号生成) | ✅ 完成 | `backend/app/services/batch/batch_service.py` |
| **SampleTrackingService** (样品创建/测试录入/对比) | ✅ 完成 | `backend/app/services/batch/sample_tracking_service.py` |
| **TraceabilityEngine** (正向/反向追溯 + 配方影响分析) | ✅ 完成 | `backend/app/services/batch/traceability_engine.py` |
| **PriceChangeImpactService** (调价影响分析 + 批量更新) | ✅ 完成 | `backend/app/services/batch/price_change_impact_service.py` |
| **CustomFieldService + TheoreticalParameterService** | ✅ 完成 | `backend/app/services/batch/custom_field_service.py` |
| **批次 API 路由** (8个端点) | ✅ 完成 | `backend/app/api/v1/batches_router.py` |
| **样品 API 路由** (5个端点) | ✅ 完成 | `backend/app/api/v1/samples_router.py` |
| **API 路由注册** | ✅ 完成 | `backend/app/api/v1/__init__.py` |
| **批次列表页** | ✅ 完成 | `frontend/src/pages/batch/BatchListPage.tsx` |
| **批次详情页** | ✅ 完成 | `frontend/src/pages/batch/BatchDetailPage.tsx` |
| **追溯页面** (正向/反向) | ✅ 完成 | `frontend/src/pages/batch/TracePage.tsx` |
| **称重清单组件** (含打印) | ✅ 完成 | `frontend/src/components/batch/BatchWeightList.tsx` |
| **API 客户端** | ✅ 完成 | `frontend/src/api/batch.ts` |

### ✅ Phase 1 已完成（含路由注册）

| 交付物 | 状态 |
|--------|------|
| 前端路由注册 | ✅ 完成（App.tsx + navConfig.ts） |
| 数据库迁移执行 | ✅ 完成（ Alembic stamp 已应用） |
| API 端点验证 | ✅ 完成（8 batch + 5 sample 端点可访问） |
| 前端路由注册 | ✅ 完成 |
| 配方详情页嵌入批记录入口 | ⏳ 待完成 |
| PriceHistory UI | ⏳ 待完成 |
| 自定义字段管理 UI | ⏳ 待完成 |
| 标签打印集成 | ⏳ 待完成 |

### ✅ Phase 2 已完成（核心交付）

| 交付物 | 状态 | 文件路径 |
|--------|------|----------|
| **FactEngine 确定性计算引擎** | ✅ 完成 | `backend/app/services/fact_engine/engine.py` |
| **AIReportWriter 4tone 报告生成器** | ✅ 完成 | `backend/app/services/fact_engine/report_writer.py` |
| **FactEngine API 路由** (7 端点) | ✅ 完成 | `backend/app/api/v1/fact_engine_router.py` |
| **API 路由注册** | ✅ 完成 | `backend/app/api/v1/__init__.py` |
| 报告重构与分离架构集成 | ⏳ 待完成 | — |
| LLM client 集成测试 | ⏳ 待完成 | — |
| 前端报告展示组件 | ⏳ 待完成 | — |

### 📋 Phase 3-5 待开始

| Phase | 工期 | 核心交付 |
|-------|------|----------|
| **Phase 2** (W7-W9) | 3周 | FactEngine + AIReportWriter (4tone报告) |
| **Phase 3** (W10-W14) | 4周 | DOE生成器 + 响应面 + 逆向搜索 + 主动学习 |
| **Phase 4** (W15-W18) | 4周 | 真实稳定性模型(Arrhenius) + 趋势分析 |
| **Phase 5** (W19-W21) | 3周 | MCP服务器 + 条码标签 + 文档智能提取 |
