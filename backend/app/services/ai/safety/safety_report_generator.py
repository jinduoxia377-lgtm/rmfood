"""
合规报告 PDF 导出服务 (v1.0)

生成专业的安全检查报告：
- 包含检查概要、详细结果、合规率趋势
- 法规引用条款
- 支持水印和数字签名占位
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


@dataclass
class SafetyReportData:
    """报告数据"""
    title: str = "安全合规检查报告"
    generated_at: str = ""
    formula_name: str = ""
    overall_compliance: float = 0.0
    total_checks: int = 0
    passed_checks: int = 0
    failed_checks: int = 0
    warnings: list[str] = field(default_factory=list)
    violations: list[str] = field(default_factory=list)
    regulations: list[dict] = field(default_factory=list)
    ingredient_list: list[str] = field(default_factory=list)
    trend_data: list[dict] = field(default_factory=list)


class SafetyReportGenerator:
    """安全合规报告生成器"""

    def generate_html(self, data: SafetyReportData) -> str:
        """生成 HTML 报告（可用于 PDF 转换）"""
        now = data.generated_at or datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        # 合规率颜色
        if data.overall_compliance >= 90:
            color = "#10B981"
            _ = "合格"
        elif data.overall_compliance >= 70:
            color = "#F59E0B"
            _ = "有条件合格"
        else:
            color = "#EF4444"
            _ = "不合格"

        # 法规引用
        reg_rows = ""
        for reg in data.regulations:
            reg_rows += f"""
            <tr>
                <td>{reg.get('name', '')}</td>
                <td>{reg.get('clause', '')}</td>
                <td>{reg.get('status', '')}</td>
            </tr>"""

        # 趋势数据
        trend_rows = ""
        for td in data.trend_data:
            trend_rows += f"""
            <tr>
                <td>{td.get('date', '')}</td>
                <td>{td.get('compliance', '')}%</td>
                <td>{td.get('status', '')}</td>
            </tr>"""

        # 成分列表
        ingredient_items = "".join(
            f"<li>{ing}</li>" for ing in data.ingredient_list
        )

        # 违规列表
        violation_items = ""
        for v in data.violations:
            violation_items += f'<li style="color:#EF4444">⚠️ {v}</li>'
        if not violation_items:
            violation_items = '<li style="color:#10B981">✅ 无违规项</li>'

        # 警告列表
        warning_items = ""
        for w in data.warnings:
            warning_items += f'<li style="color:#F59E0B">⚡ {w}</li>'

        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  body {{ font-family: -apple-system, "Microsoft YaHei", sans-serif; margin: 40px; color: #1a1a1a; }}
  .header {{ text-align: center; border-bottom: 3px solid #3B82F6; padding-bottom: 20px; margin-bottom: 30px; }}
  .header h1 {{ font-size: 24px; color: #1e40af; margin: 0; }}
  .header .meta {{ color: #6b7280; font-size: 13px; margin-top: 8px; }}
  .metric {{ display: inline-block; width: 22%; text-align: center; padding: 16px; margin: 4px;
             background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }}
  .metric .value {{ font-size: 28px; font-weight: bold; color: {color}; }}
  .metric .label {{ font-size: 12px; color: #6b7280; margin-top: 4px; }}
  table {{ width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }}
  th {{ background: #f1f5f9; padding: 10px 12px; text-align: left; font-weight: 600; }}
  td {{ padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }}
  .watermark {{ position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg);
                font-size: 80px; color: rgba(203,213,225,0.15); pointer-events: none; z-index: 0; }}
  .section {{ margin: 24px 0; }}
  .section h2 {{ font-size: 18px; color: #1e40af; border-left: 4px solid #3B82F6; padding-left: 12px; }}
  ul {{ padding-left: 20px; }}
  li {{ margin: 4px 0; font-size: 14px; }}
  .footer {{ margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0;
             text-align: center; color: #94a3b8; font-size: 12px; }}
</style>
</head>
<body>
<div class="watermark">RMFOOD</div>

<div class="header">
  <h1>{data.title}</h1>
  <div class="meta">生成时间：{now} | 配方：{data.formula_name}</div>
</div>

<div style="text-align:center">
  <div class="metric"><div class="value">{data.overall_compliance}%</div><div class="label">综合合规率</div></div>
  <div class="metric"><div class="value">{data.passed_checks}</div><div class="label">通过项</div></div>
  <div class="metric"><div class="value" style="color:#EF4444">{data.failed_checks}</div><div class="label">违规项</div></div>
  <div class="metric"><div class="value" style="color:#F59E0B">{len(data.warnings)}</div><div class="label">警告项</div></div>
</div>

<div class="section">
  <h2>检查成分</h2>
  <ul>{ingredient_items}</ul>
</div>

<div class="section">
  <h2>违规项</h2>
  <ul>{violation_items}</ul>
</div>

<div class="section">
  <h2>警告项</h2>
  <ul>{warning_items}</ul>
</div>

<div class="section">
  <h2>法规引用</h2>
  <table><tr><th>法规名称</th><th>条款</th><th>状态</th></tr>
  {reg_rows}
  </table>
</div>

<div class="section">
  <h2>合规趋势</h2>
  <table><tr><th>日期</th><th>合规率</th><th>状态</th></tr>
  {trend_rows}
  </table>
</div>

<div class="footer">
  本报告由 RMFOOD AI 智能助手生成 | 仅供参考，不构成法律意见<br>
  © {datetime.now().year} RMFOOD 配方平台
</div>
</body>
</html>"""
        return html

    def generate_pdf(self, data: SafetyReportData) -> bytes | None:
        """生成 PDF（需要 WeasyPrint 或 pdfkit）"""
        html = self.generate_html(data)

        try:
            from weasyprint import HTML
            return HTML(string=html).write_pdf()
        except ImportError:
            logger.warning("WeasyPrint 未安装，返回 HTML 格式")
            return html.encode("utf-8")

        # 备选：pdfkit
        # try:
        #     import pdfkit
        #     return pdfkit.from_string(html, False)
        # except ImportError:
        #     pass


# 全局单例
report_generator = SafetyReportGenerator()
