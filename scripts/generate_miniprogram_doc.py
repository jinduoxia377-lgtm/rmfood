# -*- coding: utf-8 -*-
from docx import Document
from docx.shared import Pt, Inches, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import datetime

doc = Document()

# ===== 样式设置 =====
style = doc.styles['Normal']
style.font.name = 'Microsoft YaHei'
style.font.size = Pt(10.5)
style.element.rPr.rFonts.set(qn('w:eastAsia'), 'Microsoft YaHei')
style.paragraph_format.line_spacing = 1.5

def set_run_font(run, font_name='Microsoft YaHei', size=Pt(10.5), bold=False, color=None):
    run.font.name = font_name
    run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)
    run.font.size = size
    run.font.bold = bold
    if color:
        run.font.color.rgb = color

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
run = subtitle.add_run('微信小程序开发方案')
set_run_font(run, size=Pt(22), bold=True, color=RGBColor(45, 90, 61))

doc.add_paragraph()
doc.add_paragraph()

info_para = doc.add_paragraph()
info_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = info_para.add_run(f'\n版本：V1.0\n日期：{datetime.date.today().strftime("%Y年%m月%d日")}\n编制：RMFOOD架构组')
set_run_font(run, size=Pt(12))

doc.add_page_break()

# ===== 目录 =====
heading = doc.add_heading('目录', level=1)
for run in heading.runs:
    set_run_font(run, size=Pt(18), bold=True)

toc_items = [
    ('一、项目概述', '1'),
    ('    1.1 项目背景', '1.1'),
    ('    1.2 建设目标', '1.2'),
    ('    1.3 范围界定', '1.3'),
    ('二、技术架构设计', '2'),
    ('    2.1 技术选型', '2.1'),
    ('    2.2 系统架构', '2.2'),
    ('    2.3 项目结构', '2.3'),
    ('三、前端设计方案', '3'),
    ('    3.1 页面规划', '3.1'),
    ('    3.2 UI/UX设计', '3.2'),
    ('    3.3 组件设计', '3.3'),
    ('    3.4 状态管理', '3.4'),
    ('    3.5 缓存策略', '3.5'),
    ('四、后端设计方案', '4'),
    ('    4.1 API接口设计', '4.1'),
    ('    4.2 认证授权方案', '4.2'),
    ('    4.3 AI服务对接', '4.3'),
    ('    4.4 数据模型设计', '4.4'),
    ('五、核心功能设计', '5'),
    ('    5.1 AI智能助手', '5.1'),
    ('    5.2 配方管理系统', '5.2'),
    ('    5.3 体质诊断功能', '5.3'),
    ('    5.4 用户中心', '5.4'),
    ('六、性能与安全设计', '6'),
    ('    6.1 性能优化', '6.1'),
    ('    6.2 安全设计', '6.2'),
    ('七、开发计划与里程碑', '7'),
    ('    7.1 开发阶段划分', '7.1'),
    ('    7.2 里程碑计划', '7.2'),
    ('八、风险评估与应对', '8'),
    ('九、附录', '9'),
]

for item, num in toc_items:
    para = doc.add_paragraph()
    run = para.add_run(f'{num}  {item.strip()}')
    set_run_font(run, size=Pt(11))

doc.add_page_break()

# ===== 第一章：项目概述 =====
h1 = doc.add_heading('一、项目概述', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 1.1 项目背景
h2 = doc.add_heading('1.1 项目背景', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
p.add_run('RMFOOD（食源性药食同源配方平台）是一个集传统中医食疗智慧与现代营养科学于一体的专业配方设计系统。平台核心能力包括：').font.name = 'Microsoft YaHei'

bullets = [
    'AI驱动的个性化配方设计（基于多目标优化算法）',
    '药食同源食材数据库（整合TCMSP、PubMed等权威文献）',
    '安全性评估与合规检查（符合GB 16740-2014标准）',
    '协同效应分析与功效预测',
    '完整的配方生命周期管理'
]
for bullet in bullets:
    p = doc.add_paragraph(bullet, style='List Bullet')
    for run in p.runs:
        set_run_font(run, size=Pt(10.5))

p = doc.add_paragraph()
p.add_run('当前平台已具备完善的Web端应用（React 19 + FastAPI后端），但在移动端场景存在明显空白：研究人员无法随时随地查阅配方、终端用户缺乏便捷的健康咨询入口。开发微信小程序是填补这一空白的关键举措。').font.name = 'Microsoft YaHei'

# 1.2 建设目标
h2 = doc.add_heading('1.2 建设目标', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

goals_table = doc.add_table(rows=6, cols=3)
goals_table.style = 'Table Grid'
goals_table.alignment = WD_TABLE_ALIGNMENT.CENTER

headers = ['目标维度', '具体目标', '衡量指标']
for i, header in enumerate(headers):
    cell = goals_table.rows[0].cells[i]
    cell.text = header
    for paragraph in cell.paragraphs:
        for run in paragraph.runs:
            set_run_font(run, size=Pt(10), bold=True)
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER

data_rows = [
    ['核心功能', 'AI配方咨询、配方浏览、体质诊断', '功能完整度≥90%'],
    ['用户体验', '流畅交互、专业设计、即时反馈', 'NPS≥40分'],
    ['性能指标', '首屏加载<2s，API响应<500ms', 'P95延迟达标'],
    ['安全合规', '微信审核通过、数据安全合规', '零安全事故'],
    ['上线周期', '8周内完成MVP上线', '按期交付']
]
for i, row_data in enumerate(data_rows):
    for j, text in enumerate(row_data):
        cell = goals_table.rows[i+1].cells[j]
        cell.text = text
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                set_run_font(run, size=Pt(10))

doc.add_paragraph()

# 1.3 范围界定
h2 = doc.add_heading('1.3 范围界定', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

scope_table = doc.add_table(rows=5, cols=3)
scope_table.style = 'Table Grid'

headers = ['范围', '是否包含', '说明']
for i, header in enumerate(headers):
    cell = scope_table.rows[0].cells[i]
    cell.text = header
    for run in cell.paragraphs[0].runs:
        set_run_font(run, size=Pt(10), bold=True)

scope_data = [
    ['小程序客户端', '✅ 包含', '基于Taro框架开发，支持微信生态'],
    ['后端API扩展', '✅ 包含', '新增微信登录、精简接口'],
    ['现有Web前端重构', '❌ 不包含', '保持独立，不迁移代码'],
    ['原生APP开发', '❌ 不包含', '后续评估Taro多端输出'],
]
for i, row_data in enumerate(scope_data):
    for j, text in enumerate(row_data):
        cell = scope_table.rows[i+1].cells[j]
        cell.text = text
        for run in cell.paragraphs[0].runs:
            set_run_font(run, size=Pt(10))

doc.add_paragraph()

doc.add_page_break()

# ===== 第二章：技术架构设计 =====
h1 = doc.add_heading('二、技术架构设计', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 2.1 技术选型
h2 = doc.add_heading('2.1 技术选型', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

tech_table = doc.add_table(rows=9, cols=4)
tech_table.style = 'Table Grid'

headers = ['技术领域', '技术方案', '版本', '选型理由']
for i, header in enumerate(headers):
    cell = tech_table.rows[0].cells[i]
    cell.text = header
    for run in cell.paragraphs[0].runs:
        set_run_font(run, size=Pt(10), bold=True)

tech_data = [
    ['开发框架', 'Taro 4.x', '4.1.6', 'React语法，多端输出，团队零学习成本'],
    ['UI组件库', 'NutUI 4.x', '4.11.0', '京东出品，微信原生体验最优'],
    ['状态管理', 'Zustand', '5.0', '与Web端保持一致，逻辑可复用'],
    ['请求层', 'wx.request封装', '-', '替换axios，适配小程序环境'],
    ['样式方案', 'SCSS + CSS变量', '1.6', '替代Tailwind，支持主题切换'],
    ['图表库', 'ECharts for MiniProgram', '5.4', '支持复杂数据可视化'],
    ['富文本', 'RichText组件', '-', '微信官方组件，支持HTML'],
    ['构建工具', 'Vite（Taro内置）', '5.x', '快速编译，热更新支持'],
]
for i, row_data in enumerate(tech_data):
    for j, text in enumerate(row_data):
        cell = tech_table.rows[i+1].cells[j]
        cell.text = text
        for run in cell.paragraphs[0].runs:
            set_run_font(run, size=Pt(10))

doc.add_paragraph()

# 2.2 系统架构
h2 = doc.add_heading('2.2 系统架构', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
p.add_run('系统采用分层架构设计，各层职责清晰：').font.name = 'Microsoft YaHei'

architecture_layers = [
    ('表现层（Presentation Layer）', 'Taro小程序页面、组件、路由'),
    ('业务逻辑层（Business Logic Layer）', 'Zustand Stores、自定义Hooks、工具函数'),
    ('数据访问层（Data Access Layer）', 'API客户端封装、请求拦截器、缓存管理'),
    ('服务层（Service Layer）', 'FastAPI后端、AI引擎、数据库'),
    ('基础设施层（Infrastructure Layer）', 'PostgreSQL、Redis、消息队列'),
]

for title, desc in architecture_layers:
    p = doc.add_paragraph()
    run = p.add_run(f'{title}：')
    set_run_font(run, size=Pt(10.5), bold=True)
    run = p.add_run(desc)
    set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

# 数据流示意
p = doc.add_paragraph()
run = p.add_run('数据流示意：')
set_run_font(run, size=Pt(10.5), bold=True)

flow_text = '''
用户操作 → 页面组件 → Store状态更新 → API请求 → FastAPI后端 → PostgreSQL/Redis
    ↑                                                                          ↓
    ←—————— 响应返回 ←—————— 状态更新 ←—————— UI渲染 ←——————
'''
p = doc.add_paragraph(flow_text)
for run in p.runs:
    set_run_font(run, size=Pt(9), color=RGBColor(100, 100, 100))

doc.add_paragraph()

# 2.3 项目结构
h2 = doc.add_heading('2.3 项目结构', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

structure_text = '''miniprogram/
├── src/
│   ├── api/                      # 请求层
│   │   ├── request.ts            # wx.request封装（Token管理、错误处理）
│   │   ├── auth.ts               # 认证相关API
│   │   ├── chat.ts               # 对话相关API
│   │   ├── formula.ts            # 配方相关API
│   │   └── ai.ts                 # AI服务API
│   │
│   ├── pages/                    # 小程序页面（微信规范）
│   │   ├── index/                # 首页（AI助手入口）
│   │   ├── chat/                 # 对话页
│   │   ├── formulas/             # 配方列表
│   │   ├── formula-detail/       # 配方详情
│   │   ├── health-check/         # 体质诊断
│   │   ├── profile/              # 个人中心
│   │   └── search/               # 搜索页
│   │
│   ├── components/               # 通用组件
│   │   ├── FormulaCard/          # 配方卡片
│   │   ├── ChatBubble/           # 对话气泡
│   │   ├── SymptomInput/         # 症状输入表单
│   │   └── TabBar/               # 底部导航
│   │
│   ├── stores/                   # Zustand状态管理
│   │   ├── auth.store.ts
│   │   ├── chat.store.ts
│   │   └── formula.store.ts
│   │
│   ├── types/                    # TypeScript类型
│   │   ├── api.types.ts
│   │   └── formula.types.ts
│   │
│   ├── utils/
│   │   ├── cache.ts              # 本地缓存工具
│   │   ├── format.ts             # 格式化函数
│   │   └── constants.ts          # 业务常量
│   │
│   ├── app.config.ts             # 小程序配置文件
│   ├── app.ts                    # 小程序入口
│   └── app.scss                  # 全局样式
│
├── config/
│   ├── dev.ts                    # 开发环境配置
│   ├── prod.ts                   # 生产环境配置
│   └── index.ts                  # 配置合并
│
├── package.json
├── tsconfig.json
└── taro.config.ts                # Taro编译配置'''

p = doc.add_paragraph(structure_text)
for run in p.runs:
    set_run_font(run, size=Pt(9), color=RGBColor(50, 50, 50))

doc.add_page_break()

# ===== 第三章：前端设计方案 =====
h1 = doc.add_heading('三、前端设计方案', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 3.1 页面规划
h2 = doc.add_heading('3.1 页面规划', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

pages_table = doc.add_table(rows=8, cols=4)
pages_table.style = 'Table Grid'

headers = ['页面名称', '页面路径', '核心功能', '优先级']
for i, header in enumerate(headers):
    cell = pages_table.rows[0].cells[i]
    cell.text = header
    for run in cell.paragraphs[0].runs:
        set_run_font(run, size=Pt(10), bold=True)

pages_data = [
    ['首页', 'pages/index/index', 'AI入口、热门配方、快捷问题', 'P0'],
    ['AI对话', 'pages/chat/index', '消息列表、输入框、历史记录', 'P0'],
    ['配方列表', 'pages/formulas/index', '分类浏览、搜索、收藏', 'P0'],
    ['配方详情', 'pages/formula-detail/index', '完整配方信息、机理说明', 'P0'],
    ['体质诊断', 'pages/health-check/index', '问卷引导、AI推荐', 'P1'],
    ['个人中心', 'pages/profile/index', '用户信息、历史记录、设置', 'P0'],
    ['搜索页', 'pages/search/index', '食材搜索、结果筛选', 'P1'],
]
for i, row_data in enumerate(pages_data):
    for j, text in enumerate(row_data):
        cell = pages_table.rows[i+1].cells[j]
        cell.text = text
        for run in cell.paragraphs[0].runs:
            set_run_font(run, size=Pt(10))

doc.add_paragraph()

# 3.2 UI/UX设计
h2 = doc.add_heading('3.2 UI/UX设计', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
run = p.add_run('3.2.1 色彩系统')
set_run_font(run, size=Pt(11), bold=True)

color_table = doc.add_table(rows=7, cols=3)
color_table.style = 'Table Grid'

headers = ['色系', '色值', '应用场景']
for i, header in enumerate(headers):
    cell = color_table.rows[0].cells[i]
    cell.text = header
    for run in cell.paragraphs[0].runs:
        set_run_font(run, size=Pt(10), bold=True)

color_data = [
    ['主色', '#2D5A3D', '品牌色、主要按钮、导航栏'],
    ['辅助色', '#8B7355', '次级元素、边框、分割线'],
    ['强调色', '#C9A84C', '重要提示、评分、徽章'],
    ['背景色', '#FAF8F5', '页面底色、卡片背景'],
    ['成功色', '#34A853', '完成状态、正向反馈'],
    ['警告色', '#FBBC04', '风险提示、注意事项'],
]
for i, row_data in enumerate(color_data):
    for j, text in enumerate(row_data):
        cell = color_table.rows[i+1].cells[j]
        cell.text = text
        for run in cell.paragraphs[0].runs:
            set_run_font(run, size=Pt(10))

doc.add_paragraph()

p = doc.add_paragraph()
run = p.add_run('3.2.2 字体规范')
set_run_font(run, size=Pt(11), bold=True)

font_table = doc.add_table(rows=5, cols=3)
font_table.style = 'Table Grid'

headers = ['层级', '字号', '用途']
for i, header in enumerate(headers):
    cell = font_table.rows[0].cells[i]
    cell.text = header
    for run in cell.paragraphs[0].runs:
        set_run_font(run, size=Pt(10), bold=True)

font_data = [
    ['一级标题', '36rpx', '页面标题、章节标题'],
    ['二级标题', '32rpx', '模块标题、卡片标题'],
    ['正文', '28rpx', '主要内容、说明文字'],
    ['辅助文字', '24rpx', '时间、标签、次要信息'],
]
for i, row_data in enumerate(font_data):
    for j, text in enumerate(row_data):
        cell = font_table.rows[i+1].cells[j]
        cell.text = text
        for run in cell.paragraphs[0].runs:
            set_run_font(run, size=Pt(10))

doc.add_paragraph()

# 3.3 组件设计
h2 = doc.add_heading('3.3 组件设计', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

components_text = '''核心组件清单：

1. FormulaCard（配方卡片）
   - 展示：配方名称、功效标签、用量摘要、收藏数
   - 交互：点击跳转详情、长按收藏
   - 样式：圆角12px，阴影0 2px 8px rgba(0,0,0,0.08)

2. ChatBubble（对话气泡）
   - 用户消息：右对齐，绿色背景
   - AI消息：左对齐，白色背景，圆角8px
   - 特殊内容：配方卡片内嵌、代码块渲染

3. SymptomInput（症状输入表单）
   - 多步骤引导式问卷
   - 滑动选择 + 文本输入混合
   - 实时进度指示

4. TabBar（底部导航）
   - 4个Tab：AI助手、配方、搜索、我的
   - 图标+文字，高度56px
   - 选中态：主色填充图标（经典三条横杠汉堡菜单）'''

p = doc.add_paragraph(components_text)
for run in p.runs:
    set_run_font(run, size=Pt(10))

doc.add_paragraph()

# 3.4 状态管理
h2 = doc.add_heading('3.4 状态管理', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
p.add_run('采用Zustand进行状态管理，与Web端保持技术栈一致：').font.name = 'Microsoft YaHei'

stores_text = '''
// 认证状态Store
const useAuthStore = create((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  
  login: async (credentials) => { /* ... */ },
  logout: () => { /* ... */ },
  refresh: async () => { /* ... */ },
}))

// 对话状态Store
const useChatStore = create((set) => ({
  sessions: [],
  currentSession: null,
  messages: [],
  
  createSession: async (title) => { /* ... */ },
  sendMessage: async (content) => { /* ... */ },
  loadHistory: async (sessionId) => { /* ... */ },
}))

// 配方状态Store
const useFormulaStore = create((set) => ({
  formulas: [],
  favorites: [],
  currentFormula: null,
  
  fetchFormulas: async (params) => { /* ... */ },
  toggleFavorite: async (formulaId) => { /* ... */ },
}))
'''

p = doc.add_paragraph(stores_text)
for run in p.runs:
    set_run_font(run, size=Pt(9), color=RGBColor(50, 50, 50))

doc.add_paragraph()

# 3.5 缓存策略
h2 = doc.add_heading('3.5 缓存策略', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
p.add_run('遵循用户偏好：按优先级实施缓存，不破坏正常运行功能。').font.name = 'Microsoft YaHei'

cache_table = doc.add_table(rows=5, cols=4)
cache_table.style = 'Table Grid'

headers = ['缓存层级', '存储方式', 'TTL', '适用场景']
for i, header in enumerate(headers):
    cell = cache_table.rows[0].cells[i]
    cell.text = header
    for run in cell.paragraphs[0].runs:
        set_run_font(run, size=Pt(10), bold=True)

cache_data = [
    ['内存缓存', 'Zustand Store', '会话级', '当前页面数据、临时状态'],
    ['本地缓存', 'wx.setStorage', '24小时', '配方列表、对话历史'],
    ['离线缓存', '小程序分包', '永久', '静态资源、模板'],
    ['网络缓存', 'HTTP Cache-Control', '按需', 'API响应结果'],
]
for i, row_data in enumerate(cache_data):
    for j, text in enumerate(row_data):
        cell = cache_table.rows[i+1].cells[j]
        cell.text = text
        for run in cell.paragraphs[0].runs:
            set_run_font(run, size=Pt(10))

doc.add_paragraph()

doc.add_page_break()

# ===== 第四章：后端设计方案 =====
h1 = doc.add_heading('四、后端设计方案', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 4.1 API接口设计
h2 = doc.add_heading('4.1 API接口设计', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
p.add_run('后端采用FastAPI框架，所有API遵循RESTful规范。小程序需要以下接口支持：').font.name = 'Microsoft YaHei'

# 认证接口
p = doc.add_paragraph()
run = p.add_run('4.1.1 认证相关接口')
set_run_font(run, size=Pt(11), bold=True)

auth_api_table = doc.add_table(rows=6, cols=4)
auth_api_table.style = 'Table Grid'

headers = ['接口', '方法', '说明', '状态']
for i, header in enumerate(headers):
    cell = auth_api_table.rows[0].cells[i]
    cell.text = header
    for run in cell.paragraphs[0].runs:
        set_run_font(run, size=Pt(10), bold=True)

auth_api_data = [
    ['/api/v1/auth/login', 'POST', '账号密码登录（已有）', '复用'],
    ['/api/v1/auth/register', 'POST', '用户注册（已有）', '复用'],
    ['/api/v1/auth/refresh', 'POST', '刷新令牌（已有）', '复用'],
    ['/api/v1/auth/wechat-login', 'POST', '微信授权登录（新增）', '需开发'],
    ['/api/v1/auth/wechat-refresh', 'POST', '微信Token刷新（新增）', '需开发'],
]
for i, row_data in enumerate(auth_api_data):
    for j, text in enumerate(row_data):
        cell = auth_api_table.rows[i+1].cells[j]
        cell.text = text
        for run in cell.paragraphs[0].runs:
            set_run_font(run, size=Pt(10))

doc.add_paragraph()

# 配方接口
p = doc.add_paragraph()
run = p.add_run('4.1.2 配方相关接口')
set_run_font(run, size=Pt(11), bold=True)

formula_api_table = doc.add_table(rows=7, cols=4)
formula_api_table.style = 'Table Grid'

headers = ['接口', '方法', '说明', '状态']
for i, header in enumerate(headers):
    cell = formula_api_table.rows[0].cells[i]
    cell.text = header
    for run in cell.paragraphs[0].runs:
        set_run_font(run, size=Pt(10), bold=True)

formula_api_data = [
    ['/api/v1/formulas', 'GET', '配方列表（精简版）', '需适配'],
    ['/api/v1/formulas/{id}', 'GET', '配方详情（精简版）', '需适配'],
    ['/api/v1/formulas/favorite', 'POST', '收藏/取消收藏', '需新增'],
    ['/api/v1/formulas/{id}/versions', 'GET', '配方版本历史', '复用'],
    ['/api/v1/mobile/formulas/pending-review', 'GET', '待审核配方列表', '已有'],
    ['/api/v1/mobile/formulas/{id}/quick-approve', 'POST', '移动端快速审批', '已有'],
]
for i, row_data in enumerate(formula_api_data):
    for j, text in enumerate(row_data):
        cell = formula_api_table.rows[i+1].cells[j]
        cell.text = text
        for run in cell.paragraphs[0].runs:
            set_run_font(run, size=Pt(10))

doc.add_paragraph()

# AI接口
p = doc.add_paragraph()
run = p.add_run('4.1.3 AI服务接口')
set_run_font(run, size=Pt(11), bold=True)

ai_api_table = doc.add_table(rows=6, cols=4)
ai_api_table.style = 'Table Grid'

headers = ['接口', '方法', '说明', '状态']
for i, header in enumerate(headers):
    cell = ai_api_table.rows[0].cells[i]
    cell.text = header
    for run in cell.paragraphs[0].runs:
        set_run_font(run, size=Pt(10), bold=True)

ai_api_data = [
    ['/api/v1/ai/chat', 'POST', 'AI对话（非流式）', '复用'],
    ['/api/v1/ai/chat/stream', 'POST', 'AI对话（流式SSE）', '需新增'],
    ['/api/v1/ai/generate', 'POST', '配方生成', '复用'],
    ['/api/v1/ai/safety-check', 'POST', '安全检测', '复用'],
    ['/api/v1/ai/task/{id}', 'GET', '异步任务状态查询', '复用'],
]
for i, row_data in enumerate(ai_api_data):
    for j, text in enumerate(row_data):
        cell = ai_api_table.rows[i+1].cells[j]
        cell.text = text
        for run in cell.paragraphs[0].runs:
            set_run_font(run, size=Pt(10))

doc.add_paragraph()

# 4.2 认证授权方案
h2 = doc.add_heading('4.2 认证授权方案', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
p.add_run('微信小程序认证流程：').font.name = 'Microsoft YaHei'

auth_flow = '''
1. 用户点击"微信登录"
2. 小程序调用 wx.login() 获取临时code
3. 前端将code发送至后端 /api/v1/auth/wechat-login
4. 后端使用code换取openid和session_key
5. 后端生成JWT Token，返回给前端
6. 前端存储Token至本地（wx.setStorageSync）
7. 后续请求携带Authorization: Bearer {token}
'''

p = doc.add_paragraph(auth_flow)
for run in p.runs:
    set_run_font(run, size=Pt(10))

doc.add_paragraph()

# 4.3 AI服务对接
h2 = doc.add_heading('4.3 AI服务对接', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
p.add_run('AI服务对接方案：').font.name = 'Microsoft YaHei'

ai_integration_table = doc.add_table(rows=4, cols=3)
ai_integration_table.style = 'Table Grid'

headers = ['场景', '技术方案', '说明']
for i, header in enumerate(headers):
    cell = ai_integration_table.rows[0].cells[i]
    cell.text = header
    for run in cell.paragraphs[0].runs:
        set_run_font(run, size=Pt(10), bold=True)

ai_data = [
    ['实时对话', 'SSE流式响应', 'POST /ai/chat/stream，后端返回text/event-stream'],
    ['异步任务', '任务轮询', 'POST提交task_id，GET轮询任务状态'],
    ['配方生成', '遗传算法优化', 'NSGA-II + 多目标评分'],
]
for i, row_data in enumerate(ai_data):
    for j, text in enumerate(row_data):
        cell = ai_integration_table.rows[i+1].cells[j]
        cell.text = text
        for run in cell.paragraphs[0].runs:
            set_run_font(run, size=Pt(10))

doc.add_paragraph()

# 4.4 数据模型设计
h2 = doc.add_heading('4.4 数据模型设计', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
p.add_run('小程序涉及的核心数据模型：').font.name = 'Microsoft YaHei'

models_text = '''
1. User（用户）
   - id, openid, username, email, role, created_at
   
2. Formula（配方）
   - id, code, name, description, status, version
   - target_effects, composition, dosage
   - ingredients[], peptides[]
   
3. ChatSession（对话会话）
   - id, user_id, title, message_count, created_at
   
4. ChatMessage（对话消息）
   - id, session_id, role, content, created_at
   
5. Favorite（收藏记录）
   - id, user_id, formula_id, created_at
'''

p = doc.add_paragraph(models_text)
for run in p.runs:
    set_run_font(run, size=Pt(10))

doc.add_page_break()

# ===== 第五章：核心功能设计 =====
h1 = doc.add_heading('五、核心功能设计', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 5.1 AI智能助手
h2 = doc.add_heading('5.1 AI智能助手', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
p.add_run('AI智能助手是小程序的核心功能，提供专业的药食同源配方咨询服务。').font.name = 'Microsoft YaHei'

p = doc.add_paragraph()
run = p.add_run('功能流程：')
set_run_font(run, size=Pt(11), bold=True)

flow_steps = [
    '用户输入症状或健康需求（如"长期熬夜，眼睛干涩"）',
    'AI进行分析：中医体质辨识 + 现代健康指标匹配',
    'AI生成推荐配方（精确克重配比 + 功效机理说明）',
    '用户查看配方详情，可选择收藏或分享',
]
for i, step in enumerate(flow_steps, 1):
    p = doc.add_paragraph(f'{i}. {step}')
    for run in p.runs:
        set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

p = doc.add_paragraph()
run = p.add_run('AI响应格式规范：')
set_run_font(run, size=Pt(11), bold=True)

ai_response_text = '''
{
  "content": "根据您的需求，我为您推荐以下配方...",
  "formula": {
    "name": "枸杞红枣明目饮",
    "ingredients": [
      {"name": "枸杞子", "dosage": 15, "unit": "g"},
      {"name": "红枣", "dosage": 10, "unit": "g"},
      {"name": "菊花", "dosage": 5, "unit": "g"}
    ],
    "mechanism": "枸杞多糖通过调节XX通路改善视力...",
    "contraindications": "脾胃虚寒者慎用"
  },
  "suggestion": "建议连续服用2周后观察效果..."
}
'''

p = doc.add_paragraph(ai_response_text)
for run in p.runs:
    set_run_font(run, size=Pt(9), color=RGBColor(50, 50, 50))

doc.add_paragraph()

# 5.2 配方管理系统
h2 = doc.add_heading('5.2 配方管理系统', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
p.add_run('配方管理模块提供完整的配方浏览、搜索、收藏功能。').font.name = 'Microsoft YaHei'

formula_features = [
    ('配方列表', '分页展示、分类筛选、关键词搜索'),
    ('配方详情', '完整配方信息、成分表、机理说明、食用方法'),
    ('配方收藏', '一键收藏、我的收藏管理'),
    ('配方分享', '生成分享卡片、微信分享'),
]

for title, desc in formula_features:
    p = doc.add_paragraph()
    run = p.add_run(f'{title}：')
    set_run_font(run, size=Pt(10.5), bold=True)
    run = p.add_run(desc)
    set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

# 5.3 体质诊断功能
h2 = doc.add_heading('5.3 体质诊断功能', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
p.add_run('体质诊断模块通过引导式问卷，帮助用户了解自身体质类型，并推荐对应配方。').font.name = 'Microsoft YaHei'

p = doc.add_paragraph()
run = p.add_run('中医九种体质：')
set_run_font(run, size=Pt(11), bold=True)

constitution_table = doc.add_table(rows=10, cols=3)
constitution_table.style = 'Table Grid'

headers = ['体质类型', '主要特征', '调理方向']
for i, header in enumerate(headers):
    cell = constitution_table.rows[0].cells[i]
    cell.text = header
    for run in cell.paragraphs[0].runs:
        set_run_font(run, size=Pt(10), bold=True)

constitution_data = [
    ['平和质', '阴阳气血调和', '保持良好生活习惯'],
    ['气虚质', '疲乏无力、气短', '补气健脾'],
    ['阳虚质', '畏寒肢冷', '温阳散寒'],
    ['阴虚质', '口干咽燥、手足心热', '滋阴清热'],
    ['痰湿质', '体型肥胖、胸闷痰多', '化痰祛湿'],
    ['湿热质', '面部油光、易生痤疮', '清热利湿'],
    ['血瘀质', '面色晦暗、易有瘀斑', '活血化瘀'],
    ['气郁质', '忧郁脆弱、敏感多虑', '疏肝解郁'],
    ['特禀质', '过敏体质', '防风固表'],
]
for i, row_data in enumerate(constitution_data):
    for j, text in enumerate(row_data):
        cell = constitution_table.rows[i+1].cells[j]
        cell.text = text
        for run in cell.paragraphs[0].runs:
            set_run_font(run, size=Pt(10))

doc.add_paragraph()

# 5.4 用户中心
h2 = doc.add_heading('5.4 用户中心', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

profile_features = [
    '用户头像与昵称（微信授权信息）',
    '我的对话记录（历史记录查看）',
    '我的收藏配方',
    '个人设置（通知开关、隐私协议）',
    '关于我们（平台介绍、联系方式）',
]

for feature in profile_features:
    p = doc.add_paragraph(feature, style='List Bullet')
    for run in p.runs:
        set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

doc.add_page_break()

# ===== 第六章：性能与安全设计 =====
h1 = doc.add_heading('六、性能与安全设计', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 6.1 性能优化
h2 = doc.add_heading('6.1 性能优化', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

perf_table = doc.add_table(rows=6, cols=3)
perf_table.style = 'Table Grid'

headers = ['优化项', '方案', '预期效果']
for i, header in enumerate(headers):
    cell = perf_table.rows[0].cells[i]
    cell.text = header
    for run in cell.paragraphs[0].runs:
        set_run_font(run, size=Pt(10), bold=True)

perf_data = [
    ['首屏加载', '分包预加载 + 骨架屏', '< 2秒'],
    ['列表滚动', '虚拟列表 + 懒加载', '流畅60fps'],
    ['图片加载', 'CDN加速 + WebP格式', '压缩60%'],
    ['API响应', 'Redis缓存 + 连接池', '< 500ms'],
    ['包体积', '按需引入 + 代码分割', '< 2MB主包'],
]
for i, row_data in enumerate(perf_data):
    for j, text in enumerate(row_data):
        cell = perf_table.rows[i+1].cells[j]
        cell.text = text
        for run in cell.paragraphs[0].runs:
            set_run_font(run, size=Pt(10))

doc.add_paragraph()

# 6.2 安全设计
h2 = doc.add_heading('6.2 安全设计', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

security_items = [
    ('Token安全', 'JWT Token存储于加密存储，设置合理过期时间，支持自动刷新'),
    ('接口安全', '所有接口需携带有效Token，防重放攻击，速率限制'),
    ('数据安全', '敏感数据脱敏处理，传输加密（HTTPS）'),
    ('内容安全', '用户输入校验，防止XSS攻击，敏感词过滤'),
    ('微信合规', '不收集非必要用户信息，隐私协议明确告知'),
]

for title, desc in security_items:
    p = doc.add_paragraph()
    run = p.add_run(f'{title}：')
    set_run_font(run, size=Pt(10.5), bold=True)
    run = p.add_run(desc)
    set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

doc.add_page_break()

# ===== 第七章：开发计划与里程碑 =====
h1 = doc.add_heading('七、开发计划与里程碑', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 7.1 开发阶段划分
h2 = doc.add_heading('7.1 开发阶段划分', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

phase_table = doc.add_table(rows=5, cols=4)
phase_table.style = 'Table Grid'

headers = ['阶段', '周期', '核心任务', '交付物']
for i, header in enumerate(headers):
    cell = phase_table.rows[0].cells[i]
    cell.text = header
    for run in cell.paragraphs[0].runs:
        set_run_font(run, size=Pt(10), bold=True)

phase_data = [
    ['Phase 1', '第1-2周', '项目初始化、基建搭建、认证模块', '可运行小程序骨架'],
    ['Phase 2', '第3-4周', '核心功能开发（AI对话、配方浏览）', 'MVP版本'],
    ['Phase 3', '第5-6周', '完善功能、性能优化、真机调试', '测试版本'],
    ['Phase 4', '第7-8周', '提交审核、灰度发布、迭代优化', '正式上架'],
]
for i, row_data in enumerate(phase_data):
    for j, text in enumerate(row_data):
        cell = phase_table.rows[i+1].cells[j]
        cell.text = text
        for run in cell.paragraphs[0].runs:
            set_run_font(run, size=Pt(10))

doc.add_paragraph()

# 7.2 里程碑计划
h2 = doc.add_heading('7.2 里程碑计划', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

milestone_table = doc.add_table(rows=7, cols=3)
milestone_table.style = 'Table Grid'

headers = ['里程碑', '完成时间', '验收标准']
for i, header in enumerate(headers):
    cell = milestone_table.rows[0].cells[i]
    cell.text = header
    for run in cell.paragraphs[0].runs:
        set_run_font(run, size=Pt(10), bold=True)

milestone_data = [
    ['M1：项目启动', '第1天', 'Taro项目初始化完成，CI/CD流水线配置'],
    ['M2：基建完成', '第7天', '请求层、状态管理、路由配置完成'],
    ['M3：认证打通', '第10天', '微信登录流程跑通，Token管理正常'],
    ['M4：核心功能', '第21天', 'AI对话、配方浏览功能可用'],
    ['M5：功能完善', '第35天', '所有P0功能开发完成，内部测试通过'],
    ['M6：上线发布', '第49天', '小程序审核通过，正式上线'],
]
for i, row_data in enumerate(milestone_data):
    for j, text in enumerate(row_data):
        cell = milestone_table.rows[i+1].cells[j]
        cell.text = text
        for run in cell.paragraphs[0].runs:
            set_run_font(run, size=Pt(10))

doc.add_paragraph()

doc.add_page_break()

# ===== 第八章：风险评估 =====
h1 = doc.add_heading('八、风险评估与应对', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

risk_table = doc.add_table(rows=7, cols=4)
risk_table.style = 'Table Grid'

headers = ['风险项', '影响程度', '发生概率', '应对策略']
for i, header in enumerate(headers):
    cell = risk_table.rows[0].cells[i]
    cell.text = header
    for run in cell.paragraphs[0].runs:
        set_run_font(run, size=Pt(10), bold=True)

risk_data = [
    ['小程序WebSocket域名限制', '高', '高', '改用SSE或轮询方案'],
    ['后端微信登录接口开发延迟', '中', '中', 'Phase 1优先开发'],
    ['包体积超2MB限制', '高', '中', '分包策略 + 图片压缩'],
    ['AI响应延迟影响体验', '中', '中', '流式输出 + 骨架屏'],
    ['微信审核拒审', '高', '低', '提前熟悉审核规范'],
    ['并发性能瓶颈', '中', '低', 'Redis缓存 + 限流'],
]
for i, row_data in enumerate(risk_data):
    for j, text in enumerate(row_data):
        cell = risk_table.rows[i+1].cells[j]
        cell.text = text
        for run in cell.paragraphs[0].runs:
            set_run_font(run, size=Pt(10))

doc.add_paragraph()

doc.add_page_break()

# ===== 第九章：附录 =====
h1 = doc.add_heading('九、附录', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 附录A
h2 = doc.add_heading('附录A：技术栈版本清单', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

version_table = doc.add_table(rows=10, cols=3)
version_table.style = 'Table Grid'

headers = ['组件', '版本', '说明']
for i, header in enumerate(headers):
    cell = version_table.rows[0].cells[i]
    cell.text = header
    for run in cell.paragraphs[0].runs:
        set_run_font(run, size=Pt(10), bold=True)

version_data = [
    ['Taro', '4.1.6', '多端框架'],
    ['React', '18.2.0', 'UI库（Taro不支持React 19）'],
    ['TypeScript', '5.3.3', '类型安全'],
    ['Zustand', '5.0.1', '状态管理'],
    ['NutUI', '4.11.0', 'UI组件库'],
    ['SCSS', '1.6.0', '样式预处理'],
    ['ESLint', '8.56.0', '代码规范'],
    ['Prettier', '3.2.0', '代码格式化'],
    ['ECharts', '5.4.3', '图表库'],
]
for i, row_data in enumerate(version_data):
    for j, text in enumerate(row_data):
        cell = version_table.rows[i+1].cells[j]
        cell.text = text
        for run in cell.paragraphs[0].runs:
            set_run_font(run, size=Pt(10))

doc.add_paragraph()

# 附录B
h2 = doc.add_heading('附录B：相关文档链接', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

links = [
    '微信小程序开发文档：https://developers.weixin.qq.com/miniprogram/dev/framework/',
    'Taro官方文档：https://docs.taro.zone/docs/',
    'NutUI组件库文档：https://nutui.jd.com/',
    'RMFOOD后端API文档：http://localhost:8000/docs',
]
for link in links:
    p = doc.add_paragraph(link, style='List Bullet')
    for run in p.runs:
        set_run_font(run, size=Pt(10))

doc.add_paragraph()

# 附录C
h2 = doc.add_heading('附录C：开发环境配置', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

env_text = '''
# 开发环境配置
NODE_VERSION=20.x
TARO_ENV=development
TARO_APP_ID=wx_your_appid_here

# 后端API地址
VITE_API_BASE_URL=http://localhost:8000/api/v1

# 微信开发者工具
- 下载地址：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
- 建议版本：1.06.2504000+
'''

p = doc.add_paragraph(env_text)
for run in p.runs:
    set_run_font(run, size=Pt(9), color=RGBColor(50, 50, 50))

doc.add_paragraph()

# 保存文档
output_path = r'D:\RMFOODFP\docs\RMFOOD小程序开发方案.docx'
doc.save(output_path)
print(f'文档已保存至: {output_path}')
