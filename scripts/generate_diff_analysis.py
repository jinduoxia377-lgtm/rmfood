# -*- coding: utf-8 -*-
"""
RMFOOD 小程序与Web端功能差异分析报告
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

# ===== 标题页 =====
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
run = subtitle.add_run('小程序与Web端功能差异分析报告')
set_run_font(run, size=Pt(22), bold=True, color=RGBColor(45, 90, 61))

version = doc.add_paragraph()
version.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = version.add_run('v1.0 — 功能对比分析版')
set_run_font(run, size=Pt(14), color=RGBColor(50, 150, 50))

doc.add_paragraph()
doc.add_paragraph()

info_para = doc.add_paragraph()
info_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = info_para.add_run(f'\n版本：V1.0\n日期：{datetime.date.today().strftime("%Y年%m月%d日")}\n编制：RMFOOD架构组')
set_run_font(run, size=Pt(12))

doc.add_page_break()

# ===== 执行摘要 =====
h0 = doc.add_heading('执行摘要', level=1)
for run in h0.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

p = doc.add_paragraph()
p.add_run('本报告对比分析了RMFOOD微信小程序与Web端核心平台的功能差异。').font.name = 'Microsoft YaHei'

doc.add_paragraph()

summary_table = add_table_with_header(doc,
    ['对比维度', '差异数量', '说明'],
    [
        ['核心功能差异', '12项', 'Web端独有功能'],
        ['新增小程序功能', '5项', '小程序专属能力'],
        ['功能优先级', 'P0-P3', '明确各功能优先级'],
        ['实现策略', '复用/新增', '后端API复用率80%'],
    ]
)

doc.add_paragraph()

p = doc.add_paragraph()
run = p.add_run('核心结论：')
set_run_font(run, size=Pt(11), bold=True)
run = p.add_run('小程序聚焦C端用户场景，Web端面向B端专业用户。两者定位不同，功能互补。')
set_run_font(run, size=Pt(11))

doc.add_page_break()

# ===== 一、Web端核心功能清单 =====
h1 = doc.add_heading('一、Web端核心功能清单', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 1.1 主要功能模块
h2 = doc.add_heading('1.1 主要功能模块', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

modules_text = '''Web端包含四大核心功能模块：

1. AI智能模块
   - 流式对话（SSE）
   - 配方生成（遗传算法）
   - RAG知识库检索
   - 安全检查、协同分析

2. 配方管理模块
   - 配方列表、搜索、筛选
   - 配方详情、版本历史
   - 配方编辑、模板创建
   - 多配方对比、案例库

3. 团队协作模块
   - 成员管理、角色权限
   - 消息通知、评论讨论
   - 工作流审批、任务分配
   - 进度跟踪、绩效监控

4. 数据分析模块
   - 数据可视化、趋势分析
   - 实验设计（DOE）
   - 报告生成、导出打印
   - 知识图谱、文献检索'''

p = doc.add_paragraph(modules_text)
for run in p.runs:
    set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

# 1.2 Web端页面详情
h2 = doc.add_heading('1.2 Web端页面详情（26+页面）', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

web_pages_table = add_table_with_header(doc,
    ['页面分类', '页面名称', '核心功能', '文件数'],
    [
        ['AI模块', 'AIAssistantPage', '流式对话、配方生成、RAG检索', '1'],
        ['配方模块', 'FormulaListPage', '配方列表、搜索、筛选', '1'],
        ['', 'FormulaDetailPage', '配方详情、版本历史、协同编辑', '1'],
        ['', 'FormulaEditPage', '配方编辑、成分调整', '1'],
        ['', 'FormulaNewPage', '新建配方、向导模式', '1'],
        ['', 'FormulaComparePage', '多配方对比、差异分析', '1'],
        ['', 'FormulaTemplatesPage', '配方模板、快速创建', '1'],
        ['', 'FormulaCasesPage', '案例库、成功案例', '1'],
        ['仪表盘', 'DashboardPage', '数据统计、快捷入口', '1'],
        ['数据库', 'DatabasePage', '食材库、文献库、标准库', '1+'],
        ['实验', 'ExperimentPage', '实验设计、执行、记录', '1'],
        ['分析', 'AnalyticsPage', '数据可视化、趋势分析', '1+'],
        ['团队', 'TeamPage', '成员管理、角色权限', '1'],
        ['工作流', 'WorkflowPage', '审批流程、任务分配', '1'],
        ['报告', 'ReportPage', '报告生成、导出', '1'],
        ['学术', 'AcademicPage', '文献检索、知识图谱', '1'],
        ['合规', 'RegulationsPage', '法规查询、合规检查', '1'],
        ['集成', 'IntegrationsPage', 'API管理、插件配置', '1'],
        ['设置', 'SettingsPage', '系统配置、个性化', '1'],
        ['管理', 'AdminPage', '租户管理、系统监控', '1'],
        ['通知', 'NotificationPage', '消息中心、订阅管理', '1'],
        ['认证', 'AuthPage', '登录、注册、权限验证', '1'],
    ]
)

doc.add_paragraph()

# 1.3 Web端后端API
h2 = doc.add_heading('1.3 Web端后端API（50+模块）', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

api_list = '''backend/app/api/v1/
├── agent_router.py          # AI Agent接口
├── ai_task_router.py        # AI任务接口
├── chat_schemas.py          # 对话接口
├── compliance_router.py     # 合规检查接口
├── core_router.py           # 核心业务接口
├── data_flywheel_router.py  # 数据飞轮接口
├── experiment_data_router.py # 实验数据接口
├── explainability_router.py # 可解释性接口
├── formula_cases.py         # 配方案例接口
├── import_router.py         # 数据导入接口
├── kg_router.py             # 知识图谱接口
├── metrics_router.py        # 指标接口
├── mo_stream_endpoint.py    # 多目标优化流式接口
├── notification_router.py   # 通知接口
├── plugin_router.py         # 插件接口
├── query_routes.py          # 查询接口
├── quota_router.py          # 配额接口
├── ray_router.py            # Ray分布式接口
├── report_export_router.py  # 报告导出接口
├── report_router.py         # 报告接口
├── sync_router.py           # 同步接口
├── team_dashboard_router.py # 团队仪表盘接口
├── team_router.py           # 团队接口
├── tenant_router.py         # 租户接口
├── version_router.py        # 版本管理接口
├── websocket_router.py      # WebSocket接口
└── workflow_exec_router.py  # 工作流执行接口'''

p = doc.add_paragraph(api_list)
for run in p.runs:
    set_run_font(run, size=Pt(9), color=RGBColor(50, 50, 50))

doc.add_page_break()

# ===== 二、小程序功能清单 =====
h1 = doc.add_heading('二、小程序功能清单', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 2.1 小程序页面
h2 = doc.add_heading('2.1 小程序页面（10个页面）', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

mini_pages_table = add_table_with_header(doc,
    ['页面', '路径', '核心功能', '优先级'],
    [
        ['首页', 'pages/index/index', 'AI入口、热门配方、快捷问题', 'P0'],
        ['AI对话', 'packages/chat/index', '流式对话、配方卡片内嵌', 'P0'],
        ['配方列表', 'packages/formulas/index', '分类浏览、搜索、收藏', 'P0'],
        ['配方详情', 'packages/formula-detail/index', '完整配方信息、机理说明', 'P0'],
        ['体质诊断', 'packages/health-check/index', '多步骤问卷、AI推荐', 'P1'],
        ['个人中心', 'packages/profile/index', '历史记录、收藏、设置', 'P0'],
        ['搜索页', 'pages/search/index', '食材搜索、结果筛选', 'P1'],
        ['配方对比', 'pages/compare/index', '多方案并列对比', 'P1'],
        ['设置页', 'pages/settings/index', '通知开关、隐私协议', 'P2'],
        ['隐私政策', 'pages/privacy/index', '隐私政策展示', 'P0'],
        ['用户协议', 'pages/agreement/index', '用户协议展示', 'P0'],
    ]
)

doc.add_paragraph()

# 2.2 小程序后端API需求
h2 = doc.add_heading('2.2 小程序后端API需求', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

mini_api_table = add_table_with_header(doc,
    ['API类别', '端点', '方法', '说明', '状态'],
    [
        ['认证', '/api/v1/wechat/login', 'POST', '微信授权登录', '需开发'],
        ['', '/api/v1/auth/refresh', 'POST', 'Token刷新', '已有'],
        ['配方', '/api/v1/formulas', 'GET', '配方列表', '需适配'],
        ['', '/api/v1/formulas/{id}', 'GET', '配方详情', '需适配'],
        ['', '/api/v1/formulas/favorite', 'POST', '收藏/取消', '需开发'],
        ['', '/api/v1/formulas/images/upload', 'POST', '图片上传', '需开发'],
        ['AI对话', '/api/v1/ai/chat/stream', 'POST', '流式对话', '已有'],
        ['', '/api/v1/ai/generate', 'POST', '配方生成', '已有'],
        ['', '/api/v1/ai/safety-check', 'POST', '安全检测', '已有'],
        ['搜索', '/api/v1/search/herbs', 'GET', '食材搜索', '已有'],
        ['', '/api/v1/search/formulas', 'GET', '配方搜索', '已有'],
        ['体质诊断', '/api/v1/mobile/health/check', 'POST', '提交诊断', '需开发'],
        ['通知', '/api/v1/notifications', 'GET', '通知列表', '已有'],
        ['', '/api/v1/notifications/{id}/read', 'POST', '标记已读', '已有'],
    ]
)

doc.add_paragraph()

p = doc.add_paragraph()
run = p.add_run('后端API复用率：')
set_run_font(run, size=Pt(11), bold=True)
run = p.add_run('约80%')
set_run_font(run, size=Pt(11), color=RGBColor(50, 150, 50))

doc.add_page_break()

# ===== 三、功能差异对比 =====
h1 = doc.add_heading('三、功能差异对比', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 3.1 Web端独有功能
h2 = doc.add_heading('3.1 Web端独有功能（小程序暂不支持）', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

web_unique_table = add_table_with_header(doc,
    ['#', '功能模块', 'Web端功能', '差异说明', '优先级'],
    [
        ['1', '实验设计', 'DOE设计、实验执行、参数优化', '专业实验功能，复杂交互', 'P2'],
        ['2', '团队协作', '成员管理、角色权限、消息通知', 'B端协作功能', 'P2'],
        ['3', '工作流审批', '审批流程、任务分配、进度跟踪', '企业级工作流', 'P2'],
        ['4', '数据分析', '数据可视化、趋势分析、导出报告', '专业分析工具', 'P2'],
        ['5', '知识图谱', '食材关系、成分关联、网络分析', '高级学术功能', 'P3'],
        ['6', '版本控制', '配方版本历史、差异对比、回滚', '版本管理', 'P3'],
        ['7', '合规检查', '法规查询、合规审查、审计日志', '合规管理', 'P3'],
        ['8', '集成扩展', 'API管理、插件系统、Webhook', '开发者功能', 'P3'],
        ['9', '数据导入', 'Excel/CSV导入、批量操作', '数据管理', 'P3'],
        ['10', '报告生成', 'PDF报告、导出打印', '报告功能', 'P3'],
        ['11', '系统管理', '租户管理、系统配置、监控', '管理员功能', 'P3'],
        ['12', '学术功能', '文献检索、案例库、标准库', '学术研究', 'P3'],
    ]
)

doc.add_paragraph()

# 3.2 小程序新增功能
h2 = doc.add_heading('3.2 小程序新增功能（Web端无）', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

mini_new_table = add_table_with_header(doc,
    ['#', '功能', '小程序特色', '技术实现'],
    [
        ['1', '语音输入', '微信语音识别API，便捷输入', 'Taro.getRecorderManager'],
        ['2', '扫码溯源', '扫描商品二维码查询溯源信息', 'Taro.scanCode'],
        ['3', '分享裂变', '生成分享海报，微信传播', 'canvas绘制'],
        ['4', '订阅消息', '审核结果、推荐配方通知', 'wx.requestSubscribeMessage'],
        ['5', '离线缓存', '本地缓存配方，弱网可用', 'Taro.setStorageSync'],
    ]
)

doc.add_paragraph()

# 3.3 功能复用分析
h2 = doc.add_heading('3.3 功能复用分析', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

reuse_table = add_table_with_header(doc,
    ['API类别', 'Web端接口', '小程序复用方式', '适配需求'],
    [
        ['认证', '/api/v1/auth/*', '新增wechat/login', '需开发微信登录'],
        ['配方', '/api/v1/formulas/*', '直接复用', '需精简字段'],
        ['AI对话', '/api/v1/ai/chat/stream', '直接复用', '无需适配'],
        ['搜索', '/api/v1/search/*', '直接复用', '无需适配'],
        ['通知', '/api/v1/notifications/*', '直接复用', '无需适配'],
        ['移动端', '/api/mobile/*', '直接复用', '已有精简接口'],
    ]
)

doc.add_page_break()

# ===== 四、用户场景差异 =====
h1 = doc.add_heading('四、用户场景差异', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 4.1 Web端用户画像
h2 = doc.add_heading('4.1 Web端用户画像', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

web_users_table = add_table_with_header(doc,
    ['用户类型', '使用场景', '核心需求', '功能偏好'],
    [
        ['研究员', '实验室/办公室', '深度分析、实验设计、团队协作', '数据可视化、版本控制、协同编辑'],
        ['配方师', '研发部门', '配方设计、合规检查、报告生成', '专业工具、法规查询、报告导出'],
        ['管理者', '管理层', '团队管理、进度跟踪、数据分析', '仪表盘、审批流程、绩效监控'],
        ['管理员', 'IT部门', '系统配置、租户管理、安全审计', '系统管理、权限控制、日志审计'],
    ]
)

doc.add_paragraph()

# 4.2 小程序用户画像
h2 = doc.add_heading('4.2 小程序用户画像', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

mini_users_table = add_table_with_header(doc,
    ['用户类型', '使用场景', '核心需求', '功能偏好'],
    [
        ['C端消费者', '移动场景', '健康咨询、配方浏览、个性化推荐', '简单易用、快速响应、隐私保护'],
        ['B端用户', '外出/差旅', '随时查看配方、接收通知、扫码溯源', '离线可用、消息推送、扫码功能'],
        ['研究员（移动）', '现场调研', '快速查询、语音输入、分享传播', '语音输入、分享海报、订阅消息'],
    ]
)

doc.add_paragraph()

# 4.3 使用场景对比
h2 = doc.add_heading('4.3 使用场景对比', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

scenario_table = add_table_with_header(doc,
    ['场景', 'Web端', '小程序'],
    [
        ['使用时长', '长时间深度使用（30分钟+）', '短时间碎片化使用（5-15分钟）'],
        ['使用频率', '工作日高频使用', '随时使用，依赖推送'],
        ['网络环境', '稳定WiFi/有线网络', 'WiFi/4G/弱网均可'],
        ['设备类型', 'PC/Mac + 大屏', '手机为主，平板辅助'],
        ['交互方式', '鼠标键盘，复杂交互', '触摸滑动，简单交互'],
        ['功能深度', '完整功能，专业工具', '核心功能，便捷易用'],
    ]
)

doc.add_page_break()

# ===== 五、功能优先级建议 =====
h1 = doc.add_heading('五、功能优先级建议', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

h2 = doc.add_heading('5.1 小程序功能优先级', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

priority_table = add_table_with_header(doc,
    ['优先级', '功能', '说明', '开发周期'],
    [
        ['P0', 'AI对话', '核心功能，流式输出', '1周'],
        ['P0', '配方浏览', '基础功能，列表+详情', '1周'],
        ['P0', '微信登录', '必要功能，认证体系', '3天'],
        ['P0', '隐私合规', '审核必需，免责声明', '2天'],
        ['P1', '体质诊断', '差异化功能，问卷+AI', '1周'],
        ['P1', '配方收藏', '用户粘性功能', '3天'],
        ['P1', '分享裂变', '传播功能，海报生成', '3天'],
        ['P2', '语音输入', '体验优化', '3天'],
        ['P2', '订阅消息', '用户触达', '2天'],
        ['P3', '扫码溯源', '扩展功能', '2天'],
    ]
)

doc.add_paragraph()

h2 = doc.add_heading('5.2 与Web端功能映射关系', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

mapping_table = add_table_with_header(doc,
    ['Web端功能', '小程序对应', '差异说明'],
    [
        ['AI对话页', '→ AI对话页', '✅ 完全对应'],
        ['配方列表页', '→ 配方列表页', '✅ 完全对应'],
        ['配方详情页', '→ 配方详情页', '⚠️ 简化版'],
        ['公式对比页', '→ 配方对比页', '✅ 完全对应'],
        ['体质诊断', '→ 体质诊断页', '✅ 新增功能'],
        ['团队协作', '→ ❌ 不支持', '📵 B端功能'],
        ['实验设计', '→ ❌ 不支持', '📵 专业功能'],
        ['数据分析', '→ ❌ 不支持', '📵 专业功能'],
        ['知识图谱', '→ ❌ 不支持', '📵 学术功能'],
        ['合规检查', '→ ❌ 不支持', '📵 专业功能'],
    ]
)

doc.add_page_break()

# ===== 六、实施建议 =====
h1 = doc.add_heading('六、实施建议', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

h2 = doc.add_heading('6.1 功能差异化策略', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

strategy_text = '''1. 聚焦核心
   - 只做C端核心功能，不做B端复杂功能
   - 实验设计、团队协作等专业功能暂不开发

2. 场景适配
   - 根据移动端场景优化交互
   - 表单输入、数据展示更简洁

3. 性能优先
   - 优化加载速度和响应时间
   - 图片压缩、列表虚拟滚动

4. 离线可用
   - 关键数据本地缓存
   - 弱网环境下核心功能可用

5. 社交裂变
   - 利用微信生态传播
   - 分享海报、订阅消息'''

p = doc.add_paragraph(strategy_text)
for run in p.runs:
    set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

h2 = doc.add_heading('6.2 分阶段实施计划', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

phase_table = add_table_with_header(doc,
    ['阶段', '周期', '核心任务', '交付物'],
    [
        ['Phase 1', '第1-4周', '核心功能', '登录、对话、配方浏览、隐私合规'],
        ['Phase 2', '第5-7周', '增值功能', '体质诊断、收藏、分享、语音输入'],
        ['Phase 3', '第8-10周', '优化扩展', '订阅消息、扫码溯源、性能优化'],
    ]
)

doc.add_paragraph()

h2 = doc.add_heading('6.3 与Web端协同策略', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

sync_table = add_table_with_header(doc,
    ['协同点', '策略', '说明'],
    [
        ['数据同步', '双向同步', '小程序数据实时同步到Web端'],
        ['账号体系', '统一账号', '微信登录映射到已有用户体系'],
        ['权限继承', '角色继承', '小程序权限继承Web端角色'],
        ['消息推送', '双向通知', 'Web端审批结果推送到小程序'],
    ]
)

doc.add_page_break()

# ===== 七、总结 =====
h1 = doc.add_heading('七、总结', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

h2 = doc.add_heading('7.1 核心差异总结', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

summary_diff_table = add_table_with_header(doc,
    ['维度', 'Web端', '小程序'],
    [
        ['定位', 'B端专业工具', 'C端便捷服务'],
        ['功能数', '26+页面', '10个页面'],
        ['API数', '50+模块', '复用80%'],
        ['用户', '研究员/管理者', '消费者/研究员'],
        ['场景', '办公室深度使用', '移动碎片化使用'],
        ['复杂度', '高（专业工具）', '低（简洁易用）'],
    ]
)

doc.add_paragraph()

h2 = doc.add_heading('7.2 关键结论', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

conclusions = [
    '1. 定位不同：Web端是专业研发工具，小程序是便捷服务入口',
    '2. 功能聚焦：小程序只做核心功能，不做复杂专业功能',
    '3. API复用：80%后端API可直接复用，降低开发成本',
    '4. 体验差异：小程序强调简洁、快速、离线可用',
    '5. 协同互补：两者数据互通，形成完整产品矩阵',
]
for conclusion in conclusions:
    p = doc.add_paragraph(conclusion)
    for run in p.runs:
        set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

h2 = doc.add_heading('7.3 建议', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

recommendations = [
    '✅ 立即开发：P0核心功能（登录、对话、配方）',
    '✅ 近期补充：P1增值功能（诊断、收藏、分享）',
    '✅ 远期规划：P2/P3扩展功能（语音、溯源）',
    '❌ 暂不开发：B端复杂功能（实验、协作、分析）',
]
for rec in recommendations:
    p = doc.add_paragraph(rec)
    for run in p.runs:
        set_run_font(run, size=Pt(10.5))

doc.add_paragraph()
doc.add_paragraph()

footer = doc.add_paragraph()
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = footer.add_run(f'\n报告版本：V1.0 | 编制：RMFOOD架构组 | 日期：{datetime.date.today().strftime("%Y年%m月%d日")}')
set_run_font(run, size=Pt(10), color=RGBColor(150, 150, 150))

# 保存文档
output_path = r'D:\\RMFOODFP\\docs\\RMFOOD小程序与Web端功能差异分析报告.docx'
doc.save(output_path)
print(f'差异分析报告已保存至: {output_path}')
