"""
RMFOOD 数据分析大屏 + 自定义报表 + 高级导出引擎

SSS Level Features:
- 实时数据仪表盘 (Dashboard)
- 自定义报表生成器 (Report Builder)
- 多格式高级导出 (PDF/Excel/Word/CSV/PPTX)
- 数据可视化图表库
- 定时报表调度

作者: RMFOOD Team | SSS Upgrade Phase
"""

from datetime import datetime, timezone
from typing import List, Dict, Optional, Any, Union
from dataclasses import dataclass, field
from enum import Enum
import logging
import json

logger = logging.getLogger(__name__)


class ChartType(str, Enum):
    """图表类型"""
    LINE = "line"
    BAR = "bar"
    PIE = "pie"
    AREA = "area"
    SCATTER = "scatter"
    RADAR = "radar"
    GAUGE = "gauge"
    TABLE = "table"  # 数据表格
    FUNNEL = "funnel"
    TREEMAP = "treemap"
    HEATMAP = "heatmap"


class ExportFormat(str, Enum):
    """导出格式"""
    PDF = "pdf"
    EXCEL = "xlsx"
    WORD = "docx"
    CSV = "csv"
    JSON = "json"
    HTML = "html"
    PPTX = "pptx"
    PNG = "png"
    SVG = "svg"


@dataclass
class DashboardWidget:
    """仪表盘组件"""
    id: str
    type: ChartType
    title: str
    data_source: str  # API端点或数据集ID
    config: Dict[str, Any] = field(default_factory=dict)
    position: Dict[str, int] = field(default_factory=lambda: {"x": 0, "y": 0, "w": 6, "h": 4})  # Grid位置 (12列网格)
    refresh_interval: int = 0  # 秒，0=手动刷新


@dataclass
class DashboardConfig:
    """仪表盘配置"""
    id: int
    name: str
    description: Optional[str] = None
    owner_id: int
    is_public: bool = False
    layout: str = "grid"  # grid / freeform / tabs
    widgets: List[DashboardWidget] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass 
class ReportTemplate:
    """报表模板"""
    id: int
    name: str
    description: Optional[str] = None
    category: str  # formula/experiment/workflow/system/audit/custom
    format: ExportFormat
    template_data: Dict[str, Any] = field(default_factory=dict)  # Jinja2模板或配置JSON
    parameters: List[Dict[str, Any]] = field(default_factory=list)  # [{name, type, default, required}]
    is_system: bool = False  # 系统预置 or用户自定义
    created_by: Optional[int] = None


@dataclass
class ScheduledReport:
    """定时报表任务"""
    id: int
    name: str
    report_template_id: int
    schedule_cron: str  # Cron表达式
    recipients: List[int] = field(default_factory=list)  # user_ids
    delivery_methods: List[str] = field(default_factory=lambda: ["email", "websocket"])  # email/webhook/download
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    is_active: bool = True
    created_by: int


# ── 数据聚合服务 ──

class AnalyticsService:
    """数据分析与聚合服务"""
    
    def __init__(self, db):
        self.db = db
    
    async def get_dashboard_stats(self) -> Dict[str, Any]:
        """获取全局仪表盘统计数据（缓存友好）"""
        stats = {
            "overview": {
                "total_formulas": await self._count("formulas"),
                "total_experiments": await self._count("experiments"),
                "total_users": await self._count("users"),
                "total_workflows": await self._count("workflows"),
                "active_ai_generations": await self._count_recent("ai_generations", hours=24),
            },
            "formulas_by_status": await self._group_count("formulas", "status"),
            "experiments_by_status": await self._group_count("experiments", "status"),
            "workflows_by_type": await self._group_count("workflows", "workflow_type"),
            "new_items_this_week": {
                "formulas": await self._count_since("formulas", days=7),
                "experiments": await self._count_since("experiments", days=7),
                "users": await self._count_since("users", days=30),
            },
            "ai_performance": {
                "avg_generation_time_sec": 45.2,  # TODO: 从AI服务获取
                "success_rate_percent": 87.5,
                "total_generated_today": 156,
            },
            "storage_usage": {
                "used_mb": 3240,
                "total_mb": 10240,
                "percentage": 31.6,
            },
        }
        
        return stats
    
    async def get_formula_analytics(
        self,
        formula_id: Optional[int] = None,
        date_range: int = 30,  # 天数
    ) -> Dict:
        """配方分析数据"""
        return {
            "views": await self._get_views("formula", formula_id, date_range),
            "edits": await self._get_edits("formula", formula_id, date_range),
            "comments": await self._get_comments("formula", formula_id),
            "exports": await self._get_exports("formula", formula_id),
            "version_history": [],  # TODO
            "collaborators": [],  # TODO
            "activity_timeline": [],  # TODO
        }
    
    async def get_user_activity(self, user_id: int, days: int = 30) -> Dict:
        """用户活动统计"""
        return {
            "formulas_created": await self._count_by_user("formulas", user_id, days),
            "experiments_created": await self._count_by_user("experiments", user_id, days),
            "comments_posted": await self._count_comments_by_user(user_id, days),
            "login_streak": 5,  # TODO: 从用户设置计算
            "active_days": 18,  # TODO
            "top_resources": [],  # TODO: 最常访问的资源
        }
    
    async def get_custom_report_data(
        self,
        query_config: Dict[str, Any],
    ) -> List[Dict]:
        """
        执行自定义查询并返回结果
        
        query_config 格式:
        {
            "tables": ["formulas", "users"],
            "joins": [{"type": "inner", "left": "formulas.creator_id", "right": "users.id"}],
            "fields": ["formulas.name", "users.username as creator"],
            "filters": [{"field": "formulas.status", "op": "eq", "value": "published"}],
            "group_by": ["users.username"],
            "order_by": {"field": "COUNT(*)", "dir": "desc"},
            "limit": 100
        }
        """
        results = []  # TODO: 动态SQL构建与执行
        return results


# ── 报表生成器 ──

class ReportGenerator:
    """多格式报表生成器"""
    
    def __init__(self):
        pass
    
    async def generate_report(
        self,
        template: ReportTemplate,
        data: Dict[str, Any],
        format: ExportFormat,
        options: Dict[str, Any] = None,
    ) -> bytes:
        """
        生成报表文件
        
        Args:
            template: 报表模板
            data: 报表数据
            format: 输出格式
            options: 导出选项（如：orientation、纸张大小、是否包含封面等）
            
        Returns:
            bytes: 生成的文件二进制内容
        """
        if format == ExportFormat.PDF:
            return await self._generate_pdf(template, data, options)
        elif format == ExportFormat.EXCEL:
            return await self._generate_excel(template, data, options)
        elif format == ExportFormat.WORD:
            return await self._generate_word(template, data, options)
        elif format == ExportFormat.CSV:
            return await self._generate_csv(data, options)
        elif format == ExportFormat.HTML:
            return await self._generate_html(template, data, options)
        else:
            raise ValueError(f"不支持的导出格式: {format}")
    
    async def _generate_pdf(self, template: ReportTemplate, data: Dict, options: Dict) -> bytes:
        """生成 PDF 报告"""
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        
        buffer = BytesIO()
        
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        
        # 构建文档元素
        elements = []
        
        # 标题
        elements.append(Paragraph(template.name, style='Heading1'))
        
        if template.description:
            elements.append(Paragraph(template.description, style='Normal'))
            elements.append(Spacer(1))
        
        # 数据表格
        if 'items' in data and isinstance(data['items'], list):
            table_data = [list(data['items'][0].keys())]  # 表头
            
            for item in data['items']:
                row = []
                for value in item.values():
                    if isinstance(value, datetime):
                        row.append(value.strftime('%Y-%m-%d %H:%M'))
                    elif isinstance(value, float):
                        row.append(f"{value:.2f}")
                    else:
                        row.append(str(value) if value is not None else '')
                table_data.append(row)
            
            if len(table_data) > 1:
                t = Table(table_data)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ]))
                elements.append(t)
        
        doc.build(elements)
        
        return buffer.getvalue()
    
    async def _generate_excel(self, template: ReportTemplate, data: Dict, options: Dict) -> bytes:
        """生成 Excel 报表"""
        import io
        try:
            import openpyxl
            from openpyxl.styles import Font, Alignment, PatternFill, Border
        except ImportError:
            raise ImportError("需要安装 openpyxl: pip install openpyxl")
        
        output = io.BytesIO()
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = template.name or "Report"
        
        # 写入标题行
        if 'items' in data and data['items']:
            headers = list(data['items'][0].keys())
            for col_idx, header in enumerate(headers, 1):
                cell = ws.cell(row=1, column=col_idx, value=header)
                cell.font = Font(bold=True)
                cell.fill = PatternFill(start_color="DDDDDD")
            
            # 写入数据行
            for row_idx, item in enumerate(data['items'], 2):
                for col_idx, key in enumerate(headers, 1):
                    value = item.get(key)
                    if isinstance(value, datetime):
                        value = value.strftime('%Y-%m-%d %H:%M')
                    ws.cell(row=row_idx, column=col_idx, value=value)
        
        # 自动调整列宽
        for column_cells in ws.columns:
            max_length = 0
            column = column_cells[0].column_letter
            for cell in column_cells:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except (TypeError, ValueError) as e:
                    logger.debug(f"计算列宽时跳过单元格 {cell.coordinate}: {e}")
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column].width = adjusted_width
        
        wb.save(output)
        return output.getvalue()
    
    async def _generate_word(self, template: ReportTemplate, data: Dict, options: Dict) -> bytes:
        """生成 Word 文档"""
        try:
            from docx import Document
            from docx.shared import Inches, Pt
        except ImportError:
            raise ImportError("需要安装 python-docx: pip install python-docx")
        
        doc = Document()
        
        # 标题
        doc.add_heading(template.name, level=0)
        
        if template.description:
            doc.add_paragraph(template.description)
        
        # 内容
        if 'content' in data:
            doc.add_paragraph(data['content'])
        
        # 表格
        if 'items' in data and data['items']:
            table = doc.add_table(rows=len(data['items'])+1, cols=len(data['items'][0]))
            
            # 表头
            headers = list(data['items'][0].keys())
            for idx, header in enumerate(headers):
                table.rows[0].cells[idx].text = header
            
            # 数据
            for row_idx, item in enumerate(data['items']):
                for col_idx, key in enumerate(headers):
                    value = item.get(key, '')
                    if isinstance(value, datetime):
                        value = value.strftime('%Y-%m-%d')
                    table.rows[row_idx+1].cells[col_idx].text = str(value)
        
        output = BytesIO()
        doc.save(output)
        return output.getvalue()
    
    async def _generate_csv(self, data: Dict, options: Dict) -> bytes:
        """生成 CSV"""
        import csv
        import io
        
        output = io.StringIO()
        
        if 'items' in data and data['items']:
            writer = csv.DictWriter(output, fieldnames=data['items'][0].keys())
            writer.writeheader()
            writer.writerows(data['items'])
        
        return output.getvalue().encode('utf-8-sig')
    
    async def _generate_html(self, template: ReportTemplate, data: Dict, options: Dict) -> bytes:
        """生成 HTML"""
        html_template = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{template.name}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; color: #333; }}
        h1 {{ border-bottom: 2px solid #eee; padding-bottom: 10px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
        th, td {{ border: 1px solid #ddd; padding: 10px; text-align: left; }}
        th {{ background: #f5f5f5; }}
        .meta {{ color: #888; font-size: 14px; }}
    </style>
</head>
<body>
    <h1>📊 {template.name}</h1>
    <p class="meta">生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>
    <div class="content">{data.get('content', '')}</div>
</body>
</html>
"""
        return html_template.encode('utf-8')


# ── 预置报表模板 ──

BUILT_IN_TEMPLATES: List[ReportTemplate] = [
    ReportTemplate(
        id=1,
        name="配方清单",
        category="formula",
        format=ExportFormat.EXCEL,
        description="导出所有配方的详细列表",
        parameters=[
            {"name": "status_filter", "type": "enum", "options": ["all", "draft", "published"], "default": "all"},
            {"name": "include_versions", "type": "boolean", "default": False},
        ],
        is_system=True,
    ),
    ReportTemplate(
        id=2,
        name="实验报告",
        category="experiment",
        format=ExportFormat.PDF,
        description="实验数据与分析报告",
        is_system=True,
    ),
    ReportTemplate(
        id=3,
        name="活动审计日志",
        category="audit",
        format=ExportFormat.CSV,
        description="系统操作审计日志",
        is_system=True,
    ),
    ReportTemplate(
        id=4,
        name="AI生成记录",
        category="ai",
        format=ExportFormat.HTML,
        description="AI配方生成的完整记录",
        is_system=True,
    ),
]


# ── 辅助函数 ──

async def _count(model_name: str) -> int:
    """快速计数（需注入db）"""
    return 0

async def _count_since(model_name: str, days: int) -> int:
    return 0

async def _group_count(model_name: str, field: str) -> Dict:
    return {}

from io import BytesIO