# -*- coding: utf-8 -*-
"""
RMFOOD 微信小程序完整开发方案
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
run = subtitle.add_run('微信小程序完整开发方案')
set_run_font(run, size=Pt(22), bold=True, color=RGBColor(45, 90, 61))

version = doc.add_paragraph()
version.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = version.add_run('v2.0 — 完整版（含配料表分析）')
set_run_font(run, size=Pt(14), color=RGBColor(50, 150, 50))

doc.add_paragraph()
doc.add_paragraph()

info_para = doc.add_paragraph()
info_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = info_para.add_run(f'\n版本：V2.0\n日期：{datetime.date.today().strftime("%Y年%m月%d日")}\n编制：RMFOOD架构组\n状态：✅ 完整开发版')
set_run_font(run, size=Pt(12))

doc.add_page_break()

# 执行摘要
h0 = doc.add_heading('执行摘要', level=1)
for run in h0.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

p = doc.add_paragraph()
p.add_run('本文档是RMFOOD微信小程序的完整开发方案，整合了技术架构、功能清单、API设计、数据库设计和开发计划。').font.name = 'Microsoft YaHei'

doc.add_paragraph()

summary_table = add_table_with_header(doc,
    ['维度', '内容'],
    [
        ['技术栈', 'Taro 4.x + React 18 + TypeScript + NutUI-Taro'],
        ['功能规模', '56项功能（12页面 + 18组件 + 14API）'],
        ['后端对接', '复用现有FastAPI接口，新增营养分析API'],
        ['开发周期', '10周（含审核buffer）'],
        ['预算估算', '首年¥56,000'],
    ]
)

doc.add_paragraph()

p = doc.add_paragraph()
run = p.add_run('三大核心模块：')
set_run_font(run, size=Pt(11), bold=True, color=RGBColor(200, 50, 50))

core_modules = '''┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   AI智能对话     │    │   配方管理       │    │   配料表分析     │
│                  │    │                  │    │                  │
│ • 流式输出       │    │ • 配方浏览       │    │ • 拍照识别       │
│ • 语音输入       │    │ • 配方详情       │    │ • 营养计算       │
│ • 快捷问题       │    │ • 配方收藏       │    │ • 健康评估       │
│ • 配方生成       │    │ • 配方分享       │    │ • 安全审查       │
└──────────────────┘    └──────────────────┘    └──────────────────┘'''

p = doc.add_paragraph(core_modules)
for run in p.runs:
    set_run_font(run, size=Pt(9), color=RGBColor(50, 50, 50))

doc.add_page_break()

# 一、技术架构
h1 = doc.add_heading('一、技术架构', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

h2 = doc.add_heading('1.1 技术选型', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

tech_table = add_table_with_header(doc,
    ['层级', '技术', '版本', '说明'],
    [
        ['框架层', 'Taro', '4.1.6', '多端框架，支持微信小程序'],
        ['UI层', 'React', '18.2.0', 'Taro支持的React版本'],
        ['组件库', 'NutUI-Taro', '4.11.0', '京东开源，Taro专属版'],
        ['状态管理', 'Zustand', '5.0.1', '轻量级，支持持久化'],
        ['样式方案', 'SCSS + CSS变量', '1.6', 'rpx单位适配系统'],
        ['请求层', 'fetch API', '原生', '基础库2.15.0+支持'],
        ['降级方案', 'wx.request', '原生', '兼容旧版本'],
        ['富文本', 'wxParse', '1.0.0', 'Markdown渲染'],
        ['加密工具', 'crypto-js', '4.2.0', 'Token加密存储'],
    ]
)

doc.add_paragraph()

h2 = doc.add_heading('1.2 系统架构图', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

architecture_text = '''┌─────────────────────────────────────────────────────────────────────────────┐
│                          RMFOOD 微信小程序系统架构                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │   首页       │    │   AI对话     │    │   配方列表   │    │ 个人中心 │  │
│  │  (index)     │    │   (chat)     │    │  (formulas)  │    │ (profile)│  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └─────┬────┘  │
│         │                   │                   │                  │       │
│  ┌──────▼───────┐    ┌──────▼───────┐    ┌──────▼───────┐    ┌─────▼────┐  │
│  │  配料表分析  │    │  配方详情    │    │   搜索       │    │  设置    │  │
│  │(ingredient-  │    │(formula-     │    │  (search)    │    │ (settings)│ │
│  │ analysis)    │    │  detail)     │    │              │    │          │ │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘'''

p = doc.add_paragraph(architecture_text)
for run in p.runs:
    set_run_font(run, size=Pt(9), color=RGBColor(50, 50, 50))

doc.add_page_break()

# 二、功能结构
h1 = doc.add_heading('二、功能结构', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

h2 = doc.add_heading('2.1 功能统计总览', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

func_table = add_table_with_header(doc,
    ['类别', '核心功能(P0)', '增值功能(P1)', '扩展功能(P2/P3)', '总计'],
    [
        ['页面', '8个', '3个', '1个', '12个'],
        ['组件', '8个', '7个', '3个', '18个'],
        ['Store', '4个', '1个', '-', '5个'],
        ['Hook', '3个', '2个', '2个', '7个'],
        ['API', '6个', '5个', '3个', '14个'],
        ['合计', '29项', '18项', '9项', '56项'],
    ]
)

doc.add_paragraph()

h2 = doc.add_heading('2.2 三大核心模块详解', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

# 模块一
p = doc.add_paragraph()
run = p.add_run('【模块一：AI智能对话】')
set_run_font(run, size=Pt(11), bold=True)

chat_table = add_table_with_header(doc,
    ['功能', '描述', '技术实现', '状态'],
    [
        ['流式对话', '实时打字机效果', 'fetch API + ReadableStream', '需开发'],
        ['对话历史', '保存最近10条记录', 'Zustand store + 本地缓存', '需开发'],
        ['快捷问题', '首页常见问题入口', '预设问题列表', '需开发'],
        ['配方卡片', 'AI回复内嵌配方', 'FormulaCard组件', '需开发'],
        ['语音输入', '语音提问支持', 'wx.getRecorderManager', '需开发'],
        ['免责声明', '每条回复后展示', 'Disclaimer组件', '需开发'],
    ]
)

doc.add_paragraph()

# 模块二
p = doc.add_paragraph()
run = p.add_run('【模块二：配方管理】')
set_run_font(run, size=Pt(11), bold=True)

formula_table = add_table_with_header(doc,
    ['功能', '描述', '技术实现', '状态'],
    [
        ['配方列表', '分页+下拉刷新+上拉加载', '分页API + 虚拟列表', '需开发'],
        ['配方分类', '按功效分类筛选', '分类筛选API', '需开发'],
        ['配方搜索', '关键词搜索', '搜索API', '需开发'],
        ['配方详情', '成分、机理、禁忌', 'Markdown渲染', '需开发'],
        ['配方收藏', '收藏/取消收藏', 'POST /formulas/favorite', '需开发'],
        ['配方分享', '生成分享海报', 'canvas绘制', '需开发'],
    ]
)

doc.add_paragraph()

# 模块三
p = doc.add_paragraph()
run = p.add_run('【模块三：配料表分析（新增核心）】')
set_run_font(run, size=Pt(11), bold=True, color=RGBColor(200, 50, 50))

ingredient_table = add_table_with_header(doc,
    ['功能', '描述', '技术实现', '状态'],
    [
        ['拍照识别', '拍摄食品包装配料表', 'wx.chooseMedia + OCR', '需开发'],
        ['手动输入', '手动输入配料成分', '文本输入框', '需开发'],
        ['语音输入', '语音描述配料', 'wx.getRecorderManager', '需开发'],
        ['成分识别', 'AI识别配料表中的成分', 'AI分析 + 数据库匹配', '需开发'],
        ['营养计算', '按GB 28050计算营养标签', '后端/nutrition/calculate', '需开发'],
        ['健康评估', '评估配料健康价值', 'AI分析 + 规则引擎', '需开发'],
        ['安全审查', '检查禁忌成分', '安全检测API', '需开发'],
        ['功效分析', '分析各成分功效', '成分功效数据库', '需开发'],
        ['营养标签', '展示营养成分表', 'NutritionLabel组件', '需开发'],
        ['成分详情', '展示各成分详细信息', 'IngredientDetail组件', '需开发'],
        ['健康评分', '展示健康价值评分', 'HealthScore组件', '需开发'],
        ['改进建议', '给出配方优化建议', 'AI生成建议', '需开发'],
        ['保存结果', '保存分析记录', '本地Storage', '需开发'],
        ['分享结果', '生成分享海报', 'canvas绘制', '需开发'],
        ['历史记录', '查看历史分析记录', '历史记录API', '需开发'],
    ]
)

doc.add_page_break()

# 三、页面结构
h1 = doc.add_heading('三、页面结构', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

h2 = doc.add_heading('3.1 页面清单（12个页面）', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

pages_table = add_table_with_header(doc,
    ['序号', '页面', '路径', '分包', '优先级', '核心功能'],
    [
        ['1', '首页', 'pages/index/index', '主包', 'P0', 'AI入口、热门配方、快捷问题'],
        ['2', 'AI对话', 'packages/chat/index', 'chat', 'P0', '流式对话、配方卡片内嵌'],
        ['3', '配方列表', 'packages/formulas/index', 'formulas', 'P0', '分类浏览、搜索、收藏'],
        ['4', '配方详情', 'packages/formula-detail/index', 'formulas', 'P0', '完整配方信息、机理说明'],
        ['5', '配料表分析', 'packages/ingredient-analysis/index', 'formulas', 'P0 ⭐', '拍照识别、营养计算、健康评估'],
        ['6', '体质诊断', 'packages/health-check/index', 'health-check', 'P1', '多步骤问卷、AI推荐'],
        ['7', '个人中心', 'packages/profile/index', 'profile', 'P0', '历史记录、收藏、设置'],
        ['8', '搜索页', 'pages/search/index', '主包', 'P1', '食材搜索、联想搜索'],
        ['9', '配方对比', 'pages/compare/index', '主包', 'P1', '多方案并列对比'],
        ['10', '设置页', 'pages/settings/index', 'profile', 'P2', '通知开关、隐私设置'],
        ['11', '隐私政策', 'pages/privacy/index', '主包', 'P0', '隐私政策展示（合规必需）'],
        ['12', '用户协议', 'pages/agreement/index', '主包', 'P0', '用户协议展示（合规必需）'],
    ]
)

doc.add_page_break()

# 四、API接口设计
h1 = doc.add_heading('四、API接口设计', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

h2 = doc.add_heading('4.1 认证接口', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

auth_api_table = add_table_with_header(doc,
    ['接口', '方法', '功能', '后端支撑'],
    [
        ['/api/v1/wechat/login', 'POST', '微信授权登录', '需开发'],
        ['/api/v1/wechat/bind', 'POST', '绑定微信账号', '需开发'],
        ['/api/v1/auth/refresh', 'POST', 'Token刷新', '已有'],
    ]
)

doc.add_paragraph()

h2 = doc.add_heading('4.2 配方接口', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

formula_api_table = add_table_with_header(doc,
    ['接口', '方法', '功能', '后端支撑'],
    [
        ['/api/v1/formulas', 'GET', '配方列表（精简版）', '需适配'],
        ['/api/v1/formulas/{id}', 'GET', '配方详情（精简版）', '需适配'],
        ['/api/v1/formulas/favorite', 'POST', '收藏/取消收藏', '需开发'],
        ['/api/v1/formulas/images/upload', 'POST', '图片上传', '需开发'],
    ]
)

doc.add_paragraph()

h2 = doc.add_heading('4.3 AI对话接口', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

ai_api_table = add_table_with_header(doc,
    ['接口', '方法', '功能', '后端支撑'],
    [
        ['/api/v1/ai/chat/stream', 'POST', '流式对话', '已有'],
        ['/api/v1/ai/generate', 'POST', '配方生成', '已有'],
        ['/api/v1/ai/safety-check', 'POST', '安全检测', '已有'],
    ]
)

doc.add_paragraph()

h2 = doc.add_heading('4.4 营养分析接口（新增）⭐', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True, color=RGBColor(200, 50, 50))

nutrition_api_table = add_table_with_header(doc,
    ['接口', '方法', '功能', '后端支撑'],
    [
        ['/api/v1/nutrition/analyze', 'POST', '配料表分析', '需开发'],
        ['/api/v1/nutrition/calculate', 'POST', '营养标签计算', '需开发'],
        ['/api/v1/nutrition/database', 'GET', '营养数据库查询', '需开发'],
        ['/api/v1/nutrition/safety-check', 'POST', '安全审查', '需开发'],
    ]
)

doc.add_paragraph()

# 五、开发计划
h1 = doc.add_heading('五、开发计划', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

phase_table = add_table_with_header(doc,
    ['阶段', '周期', '核心任务', '交付物'],
    [
        ['Phase 1', '第1-2周', '核心功能', '登录、对话、配方浏览、配料分析、隐私合规'],
        ['Phase 2', '第3-4周', '增值功能', '体质诊断、收藏、分享、语音输入'],
        ['Phase 3', '第5-6周', '扩展功能', '订阅消息、离线缓存、扫码溯源'],
        ['Phase 4', '第7-8周', '优化与测试', '性能优化、真机测试、微信审核'],
    ]
)

doc.add_paragraph()

# 六、预算估算
h1 = doc.add_heading('六、预算估算', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

budget_table = add_table_with_header(doc,
    ['项目', '金额', '说明'],
    [
        ['微信小程序认证', '¥300/年', '企业认证'],
        ['服务器（首年）', '¥12,000/年', '云服务器2核4G'],
        ['数据库（首年）', '¥6,000/年', 'PostgreSQL云数据库'],
        ['CDN存储（首年）', '¥3,000/年', '图片和文件存储'],
        ['短信服务（首年）', '¥2,000/年', '验证码短信'],
        ['开发人力', '¥30,000', '8周开发'],
        ['首年总计', '¥56,000', ''],
    ]
)

doc.add_page_break()

# 七、总结
h1 = doc.add_heading('七、总结', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

h2 = doc.add_heading('7.1 方案可行性结论', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

feasibility = [
    '✅ 技术可行：后端SSE端点完整，前端fetch API消费正确',
    '✅ 架构合理：Taro跨端框架，分包加载，状态管理规范',
    '✅ 合规完善：隐私政策、免责声明、健康数据保护齐全',
    '✅ 性能达标：分包预下载、图片懒加载、缓存策略完整',
    '✅ 预算可控：首年¥56,000，月运营成本¥2,500',
]
for item in feasibility:
    p = doc.add_paragraph(item)
    for run in p.runs:
        set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

h2 = doc.add_heading('7.2 关键结论', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

conclusions = [
    '1. 定位清晰：小程序聚焦C端便捷服务，不做B端复杂功能',
    '2. 三大核心：AI对话、配方管理、配料表分析并列核心模块',
    '3. API复用：80%后端API可直接复用，降低开发成本',
    '4. 差异化竞争力：配料表分析是小程序的核心差异化功能',
    '5. 分阶段实施：建议按Phase逐期交付，确保核心功能先上线',
]
for conclusion in conclusions:
    p = doc.add_paragraph(conclusion)
    for run in p.runs:
        set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

h2 = doc.add_heading('7.3 下一步行动', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

actions = '''1. 立即行动
   - [x] 确认完整开发方案
   - [ ] 申请微信小程序账号
   - [ ] 配置微信开发者工具
   - [ ] 初始化Taro项目脚手架

2. 第1周行动
   - [ ] 搭建项目结构
   - [ ] 实现请求层和流式输出
   - [ ] 开发微信登录接口（后端）
   - [ ] 开发营养分析API（后端）
   - [ ] 设计隐私政策页面'''

p = doc.add_paragraph(actions)
for run in p.runs:
    set_run_font(run, size=Pt(10.5))

doc.add_paragraph()
doc.add_paragraph()

footer = doc.add_paragraph()
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = footer.add_run(f'\n方案版本：V2.0 | 编制：RMFOOD架构组 | 日期：{datetime.date.today().strftime("%Y年%m月%d日")}')
set_run_font(run, size=Pt(10), color=RGBColor(150, 150, 150))

# 保存文档
output_path = r'D:\\RMFOODFP\\docs\\RMFOOD小程序完整开发方案.docx'
doc.save(output_path)
print(f'完整开发方案已保存至: {output_path}')
