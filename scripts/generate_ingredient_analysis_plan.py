# -*- coding: utf-8 -*-
"""
RMFOOD 小程序配料表分析技术实现方案
生成Word版本
"""

from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import datetime

doc = Document()
style = doc.styles['Normal']
style.font.name = 'Microsoft YaHei'
style.element.rPr.rFonts.set(qn('w:eastAsia'), 'Microsoft YaHei')
style.paragraph_format.line_spacing = 1.5

def set_run_font(run, font_name='Microsoft YaHei', size=Pt(10.5), bold=False, color=None):
    run.font.name = font_name
    run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)
    run.font.size = size
    run.font.bold = bold
    if color:
        run.font.color.rgb = color

def add_table_with_header(doc, headers, data):
    table = doc.add_table(rows=1 + len(data), cols=len(headers))
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, header in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = header
        for run in cell.paragraphs[0].runs:
            set_run_font(run, size=Pt(10), bold=True, color=RGBColor(255, 255, 255))
        shading_elm = OxmlElement('w:shd')
        shading_elm.set(qn('w:fill'), '2D5A3D')
        cell._tc.get_or_add_tcPr().append(shading_elm)
    for i, row_data in enumerate(data):
        for j, text in enumerate(row_data):
            cell = table.rows[i + 1].cells[j]
            cell.text = str(text)
            for run in cell.paragraphs[0].runs:
                set_run_font(run, size=Pt(10))
    return table

# 标题页
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = title.add_run('\n\n\n\n\n')
set_run_font(run, size=Pt(14))

title_text = doc.add_paragraph()
title_text.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = title_text.add_run('RMFOOD 药食同源配方平台')
set_run_font(run, size=Pt(26), bold=True, color=RGBColor(45, 90, 61))

subtitle = doc.add_paragraph()
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = subtitle.add_run('小程序配料表分析技术实现方案')
set_run_font(run, size=Pt(22), bold=True, color=RGBColor(45, 90, 61))

version = doc.add_paragraph()
version.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = version.add_run('v1.0 — 技术实现方案')
set_run_font(run, size=Pt(14), color=RGBColor(50, 150, 50))

doc.add_paragraph()
doc.add_paragraph()

info_para = doc.add_paragraph()
info_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = info_para.add_run(f'\n版本：V1.0\n日期：{datetime.date.today().strftime("%Y年%m月%d日")}\n编制：RMFOOD架构组\n状态：✅ 技术方案设计')
set_run_font(run, size=Pt(12))

doc.add_page_break()

# 执行摘要
h0 = doc.add_heading('执行摘要', level=1)
for run in h0.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

p = doc.add_paragraph()
run = p.add_run('配料表分析是RMFOOD小程序的')
set_run_font(run, size=Pt(10.5))
run = p.add_run('核心差异化功能')
set_run_font(run, size=Pt(10.5), bold=True, color=RGBColor(200, 50, 50))
p.add_run('，解决C端用户的核心痛点：了解食品配料的健康价值。').font.name = 'Microsoft YaHei'

doc.add_paragraph()

summary_table = add_table_with_header(doc,
    ['维度', '说明'],
    [
        ['核心价值', 'C端用户了解食品配料健康价值'],
        ['技术基础', '后端已有完整营养计算引擎'],
        ['开发周期', '4周（含测试）'],
        ['优先级', 'P0（核心功能）'],
        ['预期效果', '提升用户粘性和传播性'],
    ]
)

doc.add_paragraph()

p = doc.add_paragraph()
run = p.add_run('关键结论：')
set_run_font(run, size=Pt(11), bold=True)
run = p.add_run('技术方案可行，建议优先开发。')
set_run_font(run, size=Pt(11))

doc.add_page_break()

# 一、功能概述
h1 = doc.add_heading('一、功能概述', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

h2 = doc.add_heading('1.1 核心价值', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

core_value_table = add_table_with_header(doc,
    ['用户痛点', '解决方案'],
    [
        ['"这个食品配料表健康吗？"', 'AI分析配料健康价值'],
        ['"这些成分有什么功效？"', '成分功效解析'],
        ['"营养标签怎么算？"', '按GB 28050标准计算'],
        ['"有没有禁忌成分？"', '安全审查与过敏原提示'],
        ['"能不能改进配方？"', 'AI给出优化建议'],
    ]
)

doc.add_paragraph()

h2 = doc.add_heading('1.2 功能边界', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
run = p.add_run('输入：')
set_run_font(run, size=Pt(10.5), bold=True)
run = p.add_run('配料表（拍照/手动/语音）')
set_run_font(run, size=Pt(10.5))

p = doc.add_paragraph()
run = p.add_run('输出：')
set_run_font(run, size=Pt(10.5), bold=True)
run = p.add_run('营养成分表 + 健康评估 + 安全审查 + 改进建议')
set_run_font(run, size=Pt(10.5))

doc.add_page_break()

# 二、系统架构
h1 = doc.add_heading('二、系统架构', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

h2 = doc.add_heading('2.1 整体架构', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

architecture_text = '''
┌─────────────────────────────────────────────────────────────────────────────┐
│                          小程序前端（Taro + React）                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │   输入模块   │    │   分析模块   │    │   展示模块   │    │  分享模块 │  │
│  │              │    │              │    │              │    │          │  │
│  │ • 拍照识别   │    │ • 成分识别   │    │ • 营养标签   │    │ • 海报生成│  │
│  │ • 手动输入   │    │ • 营养计算   │    │ • 成分详情   │    │ • 保存到相册│ │
│  │ • 语音输入   │    │ • 健康评估   │    │ • 健康评分   │    │ • 微信分享 │  │
│  │ • 历史记录   │    │ • 安全审查   │    │ • 改进建议   │    │          │  │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓ HTTP/HTTPS
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FastAPI 后端服务                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     配料表分析服务（新增）                            │   │
│  │                                                                      │   │
│  │  POST /api/v1/nutrition/analyze      # 配料表分析                    │   │
│  │  POST /api/v1/nutrition/calculate    # 营养标签计算                  │   │
│  │  GET  /api/v1/nutrition/database     # 营养数据库查询                │   │
│  │  POST /api/v1/nutrition/safety-check # 安全审查                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
'''

p = doc.add_paragraph(architecture_text)
for run in p.runs:
    set_run_font(run, size=Pt(9), color=RGBColor(50, 50, 50))

doc.add_paragraph()

h2 = doc.add_heading('2.2 技术栈', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

tech_stack_table = add_table_with_header(doc,
    ['层级', '技术', '版本', '说明'],
    [
        ['前端框架', 'Taro', '4.1.6', '多端框架，支持微信小程序'],
        ['UI框架', 'React', '18.2.0', 'Taro支持的React版本'],
        ['组件库', 'NutUI-Taro', '4.11.0', '京东开源，Taro专属版'],
        ['状态管理', 'Zustand', '5.0.1', '轻量级，支持持久化'],
        ['后端框架', 'FastAPI', '0.104.1', 'Python异步框架'],
        ['数据库', 'PostgreSQL', '15+', '关系型数据库'],
        ['缓存', 'Redis', '7+', '缓存和会话存储'],
    ]
)

doc.add_page_break()

# 三、前端实现
h1 = doc.add_heading('三、前端实现方案', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

h2 = doc.add_heading('3.1 页面结构', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

page_structure = '''
pages/
└── ingredient-analysis/          # 配料表分析页（新增）
    ├── index.tsx                  # 主页面
    └── components/
        ├── InputPanel.tsx         # 输入面板（拍照/手动/语音）
        ├── AnalysisResult.tsx     # 分析结果展示
        ├── NutritionLabel.tsx     # 营养成分表组件
        ├── IngredientDetail.tsx   # 成分详情组件
        ├── HealthScore.tsx        # 健康评分组件
        └── ImprovementSuggestion.tsx # 改进建议组件
'''

p = doc.add_paragraph(page_structure)
for run in p.runs:
    set_run_font(run, size=Pt(10), color=RGBColor(50, 50, 50))

doc.add_paragraph()

h2 = doc.add_heading('3.2 核心组件', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

components_table = add_table_with_header(doc,
    ['组件名称', '用途', '技术要点'],
    [
        ['InputPanel', '输入面板（拍照/手动/语音）', '三种输入模式切换'],
        ['NutritionLabel', '营养成分表展示', '按GB 28050格式'],
        ['IngredientDetail', '成分详情展示', '营养成分表格'],
        ['HealthScore', '健康评分展示', '环形进度条'],
        ['ImprovementSuggestion', '改进建议展示', 'AI生成建议'],
        ['AnalysisResult', '综合分析结果', '组合以上组件'],
    ]
)

doc.add_page_break()

# 四、后端实现
h1 = doc.add_heading('四、后端实现方案', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

h2 = doc.add_heading('4.1 API设计', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

api_table = add_table_with_header(doc,
    ['接口', '方法', '功能', '状态'],
    [
        ['/api/v1/nutrition/analyze', 'POST', '配料表分析', '需开发'],
        ['/api/v1/nutrition/calculate', 'POST', '营养标签计算', '需开发'],
        ['/api/v1/nutrition/database', 'GET', '营养数据库查询', '需开发'],
        ['/api/v1/nutrition/safety-check', 'POST', '安全审查', '需开发'],
    ]
)

doc.add_paragraph()

h2 = doc.add_heading('4.2 核心服务', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

service_table = add_table_with_header(doc,
    ['服务名称', '职责', '已有/新增'],
    [
        ['NutritionLabelGenerator', '按GB 28050计算营养标签', '已有'],
        ['SafetyChecker', '安全审查（禁忌成分、过敏原）', '需新增'],
        ['HealthEvaluator', '健康评估（功效成分、健康等级）', '需新增'],
        ['NutritionDatabase', '营养数据库（50+味药材）', '已有'],
    ]
)

doc.add_paragraph()

# 五、数据库设计
h1 = doc.add_heading('五、数据库设计', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

db_table = add_table_with_header(doc,
    ['表名', '用途', '关键字段'],
    [
        ['ingredient_analysis', '分析记录', 'user_id, ingredients, nutrition_label, health_score'],
        ['ingredient_index', '成分索引', 'name, category, nutrition_data'],
    ]
)

doc.add_page_break()

# 六、开发计划
h1 = doc.add_heading('六、开发计划', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

phase_table = add_table_with_header(doc,
    ['阶段', '周期', '任务', '交付物'],
    [
        ['Phase 1', '第1周', '后端API开发', '营养分析API、安全审查API'],
        ['Phase 2', '第2周', '前端页面开发', '配料分析页面、输入组件'],
        ['Phase 3', '第3周', '组件开发', '营养标签、健康评分、成分详情组件'],
        ['Phase 4', '第4周', '联调测试', '集成测试、性能优化'],
    ]
)

doc.add_paragraph()

# 七、技术风险
h1 = doc.add_heading('七、技术风险与应对', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

risk_table = add_table_with_header(doc,
    ['风险', '影响', '应对措施'],
    [
        ['微信OCR识别准确率不高', '用户体验差', '提供手动输入作为降级方案'],
        ['营养数据库覆盖不足', '分析结果不准确', '建立用户反馈机制，持续补充数据'],
        ['复杂配料解析困难', '分析失败', '引入AI辅助解析，简化输入流程'],
        ['小程序包体积限制', '加载慢', '使用分包加载，图片压缩'],
    ]
)

doc.add_page_break()

# 八、总结
h1 = doc.add_heading('八、总结', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

conclusions = [
    '1. 技术可行性高：后端已有完整的营养计算引擎和数据库',
    '2. 用户需求强烈：C端用户想了解食品配料的健康价值',
    '3. 差异化竞争力：这是小程序与Web端的核心差异点',
    '4. 易于传播：分析结果可分享，形成裂变传播',
]
for conclusion in conclusions:
    p = doc.add_paragraph(conclusion)
    for run in p.runs:
        set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

p = doc.add_paragraph()
run = p.add_run('建议优先级：')
set_run_font(run, size=Pt(11), bold=True, color=RGBColor(200, 50, 50))
run = p.add_run('P0（核心功能），与AI对话、配方浏览并列三大核心模块。')
set_run_font(run, size=Pt(11))

doc.add_paragraph()
doc.add_paragraph()

footer = doc.add_paragraph()
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = footer.add_run(f'\n方案版本：V1.0 | 编制：RMFOOD架构组 | 日期：{datetime.date.today().strftime("%Y年%m月%d日")}')
set_run_font(run, size=Pt(10), color=RGBColor(150, 150, 150))

# 保存文档
output_path = r'D:\\RMFOODFP\\docs\\RMFOOD小程序配料表分析技术实现方案.docx'
doc.save(output_path)
print(f'技术实现方案已保存至: {output_path}')
