# -*- coding: utf-8 -*-
"""
RMFOOD 微信小程序深度改进版开发方案 v2.0
资深小程序专家视角深度分析 + 完整实施方案
"""

from docx import Document
from docx.shared import Pt, Inches, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.style import WD_STYLE_TYPE
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

def add_table_with_header(doc, headers, data, col_widths=None):
    """创建带表头的表格"""
    table = doc.add_table(rows=1 + len(data), cols=len(headers))
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    
    # 表头
    for i, header in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = header
        for run in cell.paragraphs[0].runs:
            set_run_font(run, size=Pt(10), bold=True)
        # 设置表头背景色
        shading_elm = OxmlElement('w:shd')
        shading_elm.set(qn('w:fill'), '2D5A3D')
        cell._tc.get_or_add_tcPr().append(shading_elm)
        for run in cell.paragraphs[0].runs:
            set_run_font(run, size=Pt(10), bold=True, color=RGBColor(255, 255, 255))
    
    # 数据行
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
run = subtitle.add_run('微信小程序开发方案（深度改进版）')
set_run_font(run, size=Pt(22), bold=True, color=RGBColor(45, 90, 61))

version = doc.add_paragraph()
version.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = version.add_run('v2.0 — 资深小程序专家深度评审版')
set_run_font(run, size=Pt(14), color=RGBColor(200, 50, 50))

doc.add_paragraph()
doc.add_paragraph()

info_para = doc.add_paragraph()
info_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = info_para.add_run(f'\n版本：V2.0\n日期：{datetime.date.today().strftime("%Y年%m月%d日")}\n编制：RMFOOD架构组\n评审：资深小程序专家组')
set_run_font(run, size=Pt(12))

doc.add_page_break()

# ===== 执行摘要 =====
h0 = doc.add_heading('执行摘要：V1.0方案核心问题分析', level=1)
for run in h0.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(200, 50, 50))

p = doc.add_paragraph()
p.add_run('经资深小程序专家组深度评审，V1.0方案存在以下关键问题需修正：').font.name = 'Microsoft YaHei'

issues = [
    ('【严重】AI流式输出技术方案错误', 
     'V1.0方案称"改用SSE或轮询"，但后端已有 /api/v1/ai/chat/stream SSE端点。'
     '真正问题是小程序无法原生支持EventSource，需通过Taro.request({enableChunked:true})或自定义HTTP分块读取实现。'),
    ('【严重】微信登录接口设计缺失', 
     '未说明微信小程序AppID/AppSecret配置、openid存储策略、与现有JWT体系的对标关系。'),
    ('【严重】NutUI版本选择错误', 
     'NutUI有Taro版和小程序原生版两个分支，需选用 @nutui/nutui-taro 而非原生版。'),
    ('【重要】包体积控制无系统性方案', 
     'NutUI全量引入约200KB，ECharts小程序版约150KB，仅这两个库就可能超限。需引入tree-shaking和按需加载。'),
    ('【重要】图片处理方案缺失', 
     '配方详情含食材图片，但未说明图片上传、CDN配置、小程序图片域名白名单等关键配置。'),
    ('【重要】语音输入能力未纳入', 
     '小程序支持微信语音识别API，是提升用户体验的关键能力，V1.0完全遗漏。'),
    ('【中等】微信订阅消息机制不明确', 
     '审核结果通知等功能涉及微信订阅消息，但未说明订阅模板配置和用户授权流程。'),
    ('【中等】分享裂变功能实现路径模糊', 
     '"生成分享海报"过于笼统，缺少具体的canvas绘制方案和图片分享流程。'),
    ('【中等】错误处理和重连策略不完善', 
     '网络异常、Token过期、SSE断连等边界情况未给出处理方案。'),
    ('【中等】汉堡导航设计过于简化', 
     '未考虑侧栏菜单的层级结构、动画效果和内容组织。'),
    ('【中等】RAG检索和配方对比功能遗漏', 
     'Web端的核心AI功能（RAG知识库问答、配方多方案对比）未在小程序中映射。'),
    ('【一般】调试方案缺失', 
     '小程序远程调试、真机调试、性能监控方案未提及。'),
]

for title_text, desc in issues:
    p = doc.add_paragraph()
    run = p.add_run(f'{title_text}：')
    set_run_font(run, size=Pt(10.5), bold=True, color=RGBColor(200, 50, 50))
    run = p.add_run(desc)
    set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

# ===== 目录 =====
heading = doc.add_heading('目录', level=1)
for run in heading.runs:
    set_run_font(run, size=Pt(18), bold=True)

toc_items = [
    ('一、V1.0方案深度问题分析', '1'),
    ('    1.1 技术选型问题诊断', '1.1'),
    ('    1.2 功能映射完整性评估', '1.2'),
    ('    1.3 小程序平台约束分析', '1.3'),
    ('    1.4 安全与合规风险', '1.4'),
    ('二、技术架构设计（改进版）', '2'),
    ('    2.1 技术选型修正', '2.1'),
    ('    2.2 系统架构图', '2.2'),
    ('    2.3 项目目录结构', '2.3'),
    ('三、前端设计方案（深度改进）', '3'),
    ('    3.1 页面规划与交互设计', '3.1'),
    ('    3.2 AI对话流式输出方案', '3.2'),
    ('    3.3 UI/UX设计规范', '3.3'),
    ('    3.4 组件设计体系', '3.4'),
    ('    3.5 状态管理与缓存策略', '3.5'),
    ('    3.6 语音输入与图片处理', '3.6'),
    ('    3.7 分享裂变与订阅消息', '3.7'),
    ('四、后端设计方案（深度改进）', '4'),
    ('    4.1 微信登录完整方案', '4.1'),
    ('    4.2 API接口完整映射', '4.2'),
    ('    4.3 AI服务对接方案', '4.3'),
    ('    4.4 数据模型设计', '4.4'),
    ('五、核心功能实现方案', '5'),
    ('    5.1 AI智能助手完整流程', '5.1'),
    ('    5.2 配方管理全链路', '5.2'),
    ('    5.3 体质诊断系统设计', '5.3'),
    ('    5.4 RAG知识库问答', '5.4'),
    ('    5.5 配方对比功能', '5.5'),
    ('六、性能与安全设计', '6'),
    ('    6.1 包体积控制方案', '6.1'),
    ('    6.2 性能优化策略', '6.2'),
    ('    6.3 安全设计', '6.3'),
    ('七、开发计划与里程碑', '7'),
    ('八、风险评估与应对', '8'),
    ('九、附录', '9'),
]

for item, num in toc_items:
    para = doc.add_paragraph()
    run = para.add_run(f'{num}  {item.strip()}')
    set_run_font(run, size=Pt(11))

doc.add_page_break()

# ===== 第一章：V1.0方案深度问题分析 =====
h1 = doc.add_heading('一、V1.0方案深度问题分析', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 1.1 技术选型问题诊断
h2 = doc.add_heading('1.1 技术选型问题诊断', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

diag_table = add_table_with_header(doc, 
    ['问题类别', 'V1.0方案描述', '专家诊断', '修正建议'],
    [
        ['AI流式方案', '改用SSE或轮询', '后端已有SSE端点，问题在小程序消费侧', '使用Taro.request(enableChunked:true)或自定义分块读取'],
        ['UI组件库', 'NutUI 4.x', '未区分Taro版和原生版', '选用@nutui/nutui-taro'],
        ['图表库', 'ECharts for MiniProgram', '包体积过大(~150KB)', '改用轻量级图表或条件加载'],
        ['状态管理', 'Zustand 5.x', '与Web端一致，正确', '保持不变'],
        ['请求层', 'wx.request封装', '未处理SSE分块响应', '增加enableChunked配置'],
        ['样式方案', 'SCSS + CSS变量', '未考虑rpx单位适配', '统一使用rpx+rem双单位系统'],
    ]
)

doc.add_paragraph()

# 1.2 功能映射完整性评估
h2 = doc.add_heading('1.2 功能映射完整性评估', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

func_table = add_table_with_header(doc,
    ['Web端功能', 'V1.0覆盖', '小程序适配难度', '优先级'],
    [
        ['AI智能对话（流式）', '部分覆盖', '中（需处理SSE）', 'P0'],
        ['配方浏览/搜索', '完整覆盖', '低', 'P0'],
        ['配方详情（Markdown渲染）', '部分覆盖', '中（需RichText适配）', 'P0'],
        ['配方收藏/分享', '遗漏', '低', 'P0'],
        ['体质诊断问卷', '部分覆盖', '中（多步骤表单）', 'P1'],
        ['RAG知识库问答', '遗漏', '高（需独立实现）', 'P1'],
        ['配方多方案对比', '遗漏', '中', 'P1'],
        ['安全检测/协同分析', '遗漏', '高', 'P2'],
        ['口感预测/稳定性预测', '遗漏', '高', 'P2'],
        ['语音输入', '遗漏', '低（微信原生API）', 'P1'],
        ['订阅消息通知', '部分覆盖', '中（需模板配置）', 'P1'],
        ['离线缓存', '部分覆盖', '中', 'P1'],
    ]
)

doc.add_paragraph()

# 1.3 小程序平台约束分析
h2 = doc.add_heading('1.3 小程序平台约束分析', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
p.add_run('微信小程序有以下核心约束，V1.0方案未充分考虑：').font.name = 'Microsoft YaHei'

constraints = [
    ('包体积限制', '主包≤2MB，所有包总和≤20MB。NutUI+ECharts可能超限。'),
    ('SSE支持', '小程序不支持原生EventSource，需自定义HTTP分块读取。'),
    ('WebSocket限制', '最多同时5个WS连接，且有域名白名单要求。'),
    ('图片域名', '所有图片需配置合法域名白名单，不支持本地路径。'),
    ('权限弹窗', '需拍照/录音权限时，需先获取用户授权。'),
    ('分包加载', '首次进入非首页需等待分包下载，影响体验。'),
    ('JSApi限制', '部分高级JSApi需基础库版本支持。'),
    ('审核规范', '涉及健康咨询内容需符合微信医疗类审核规范。'),
]
for title, desc in constraints:
    p = doc.add_paragraph()
    run = p.add_run(f'{title}：')
    set_run_font(run, size=Pt(10.5), bold=True)
    run = p.add_run(desc)
    set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

# 1.4 安全与合规风险
h2 = doc.add_heading('1.4 安全与合规风险', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

risk_items = [
    ('健康内容审核风险', 'AI输出的配方建议可能被判定为医疗建议，需添加免责声明。'),
    ('用户隐私合规', '体质诊断收集的健康数据属于敏感个人信息，需明示同意。'),
    ('Token安全管理', '小程序本地存储Token需加密，防止反编译窃取。'),
    ('API防刷', 'AI对话接口需增加频次限制，防止恶意调用消耗额度。'),
]
for title, desc in risk_items:
    p = doc.add_paragraph()
    run = p.add_run(f'{title}：')
    set_run_font(run, size=Pt(10.5), bold=True)
    run = p.add_run(desc)
    set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

doc.add_page_break()

# ===== 第二章：技术架构设计（改进版） =====
h1 = doc.add_heading('二、技术架构设计（改进版）', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 2.1 技术选型修正
h2 = doc.add_heading('2.1 技术选型修正', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

tech_table = add_table_with_header(doc,
    ['技术领域', '原方案', '修正方案', '理由'],
    [
        ['开发框架', 'Taro 4.x', 'Taro 4.1.6', '保持不变'],
        ['UI组件库', 'NutUI 4.x', '@nutui/nutui-taro 4.11', '必须用Taro版'],
        ['图表库', 'ECharts for MiniProgram', '内置轻量图表+条件加载', '控制包体积'],
        ['富文本', 'RichText组件', 'wxParse+自定义渲染器', '更好支持Markdown'],
        ['语音输入', '未提及', 'wx.getRecorderManager + 微信语音API', '提升交互体验'],
        ['图片处理', '未提及', 'CDN+压缩+懒加载', '解决图片域名限制'],
        ['流式输出', 'SSE/轮询', 'Taro.request(enableChunked:true)', '正确消费SSE'],
        ['状态管理', 'Zustand 5', 'Zustand 5 + 持久化中间件', '增加本地同步'],
        ['构建工具', 'Vite（Taro内置）', 'Vite 5 + Taro插件', '保持不变'],
        ['代码规范', 'ESLint 8', 'ESLint 8 + Prettier 3', '保持一致'],
    ]
)

doc.add_paragraph()

# 2.2 系统架构图
h2 = doc.add_heading('2.2 系统架构设计', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

arch_text = '''┌─────────────────────────────────────────────────────────────────────────────┐
│                              RMFOOD 小程序系统架构                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │   首页       │    │   AI对话     │    │   配方列表   │    │ 个人中心 │  │
│  │  (index)     │    │   (chat)     │    │  (formulas)  │    │ (profile)│  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └─────┬────┘  │
│         │                   │                   │                  │       │
│  ┌──────▼───────┐    ┌──────▼───────┐    ┌──────▼───────┐    ┌─────▼────┐  │
│  │   体质诊断   │    │  配方详情    │    │   搜索       │    │  设置    │  │
│  │(health-check)│    │(formula-detail)│  │  (search)    │    │ (settings)│ │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        小程序业务层（Taro + React）                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │  Pages      │  │ Components  │  │    Stores   │  │   Hooks    │  │   │
│  │  │  (7个页面)  │  │ (15+组件)   │  │ (Zustand)   │  │ (自定义)   │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │   API层     │  │  工具函数   │  │  类型定义   │  │  缓存管理  │  │   │
│  │  │ (request.ts)│  │ (utils/)    │  │  (types/)   │  │ (cache.ts) │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        请求层（wx.request 封装）                      │   │
│  │  • Token管理（localStorage加密存储）                                  │   │
│  │  • 请求拦截器（自动注入Authorization）                                │   │
│  │  • 响应拦截器（401自动刷新、错误统一处理）                            │   │
│  │  • SSE分块读取（enableChunked:true）                                  │   │
│  │  • 离线队列（网络恢复后自动同步）                                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                              ↓ HTTP/HTTPS ↓                                 │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                       FastAPI 后端服务                                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────┐  │   │
│  │  │ 认证服务 │  │ AI服务   │  │ 配方服务 │  │ 搜索服务 │  │ 通知  │  │   │
│  │  │ /auth/*  │  │ /ai/*    │  │ /formulas│  │ /search  │  │ /notify│  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └───────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                              ↓ PostgreSQL + Redis ↓                         │
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │  PostgreSQL  │    │    Redis     │    │  文件存储    │                  │
│  │  (业务数据)  │    │ (缓存/队列)  │    │  (图片/附件) │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘'''

p = doc.add_paragraph(arch_text)
for run in p.runs:
    set_run_font(run, size=Pt(8), color=RGBColor(50, 50, 50))

doc.add_paragraph()

# 2.3 项目目录结构
h2 = doc.add_heading('2.3 项目目录结构（详细版）', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

structure_text = '''miniprogram/
├── src/
│   ├── api/                          # 请求层（完整重构）
│   │   ├── request.ts                # wx.request封装 + SSE分块读取
│   │   ├── auth.ts                   # 认证API（含微信登录）
│   │   ├── chat.ts                   # 对话API（流式/非流式）
│   │   ├── formula.ts                # 配方API
│   │   ├── ai.ts                     # AI服务API
│   │   ├── search.ts                 # 搜索API
│   │   ├── notification.ts           # 通知API
│   │   └── types.ts                  # API类型定义
│   │
│   ├── pages/                        # 小程序页面
│   │   ├── index/                    # 首页
│   │   │   ├── index.vue             # 首页组件
│   │   │   └── index.scss            # 首页样式
│   │   ├── chat/                     # AI对话页
│   │   │   ├── chat.vue
│   │   │   ├── components/
│   │   │   │   ├── MessageList.vue   # 消息列表
│   │   │   │   ├── ChatInput.vue     # 输入区（含语音按钮）
│   │   │   │   ├── FormulaCard.vue   # 配方卡片内嵌
│   │   │   │   └── TypingIndicator.vue # 打字机指示器
│   │   │   └── chat.scss
│   │   ├── formulas/                 # 配方列表
│   │   │   ├── formulas.vue
│   │   │   └── formulas.scss
│   │   ├── formula-detail/           # 配方详情
│   │   │   ├── formula-detail.vue
│   │   │   └── components/
│   │   │       ├── IngredientTable.vue  # 成分表格
│   │   │       ├── MechanismText.vue    # 机理说明（RichText）
│   │   │       └── SafetyWarning.vue    # 安全提示
│   │   ├── health-check/             # 体质诊断
│   │   │   ├── health-check.vue
│   │   │   └── components/
│   │   │       ├── QuestionStep.vue    # 单题组件
│   │   │       └── ResultCard.vue      # 诊断结果
│   │   ├── profile/                  # 个人中心
│   │   │   ├── profile.vue
│   │   │   └── components/
│   │   │       ├── HistoryList.vue
│   │   │       ├── FavoriteList.vue
│   │   │       └── SettingsPanel.vue
│   │   ├── search/                   # 搜索页
│   │   │   └── search.vue
│   │   └── compare/                  # 配方对比（新增）
│   │       └── compare.vue
│   │
│   ├── components/                   # 通用组件库
│   │   ├── FormulaCard/              # 配方卡片
│   │   ├── ChatBubble/               # 对话气泡
│   │   ├── TabBar/                   # 底部导航（汉堡菜单）
│   │   ├── HamburgerMenu/            # 侧栏菜单（三条横杠）
│   │   ├── LoadingSkeleton/          # 骨架屏
│   │   ├── ErrorBoundary/            # 错误边界
│   │   ├── SafeArea/                 # 安全区域适配
│   │   └── ImageLazyLoad/            # 图片懒加载
│   │
│   ├── stores/                       # Zustand状态管理
│   │   ├── auth.store.ts             # 认证状态
│   │   ├── chat.store.ts             # 对话状态
│   │   ├── formula.store.ts          # 配方状态
│   │   ├── user.store.ts             # 用户状态
│   │   └── index.ts                  # Store聚合
│   │
│   ├── hooks/                        # 自定义Hooks
│   │   ├── useAuth.ts                # 认证Hook
│   │   ├── useChat.ts                # 对话Hook
│   │   ├── useFormula.ts             # 配方Hook
│   │   ├── useStreaming.ts           # 流式输出Hook
│   │   ├── useVoice.ts               # 语音输入Hook
│   │   └── useOffline.ts             # 离线同步Hook
│   │
│   ├── utils/
│   │   ├── cache.ts                  # 缓存管理
│   │   ├── crypto.ts                 # 加密工具（Token存储）
│   │   ├── format.ts                 # 格式化函数
│   │   ├── constants.ts              # 业务常量
│   │   └── logger.ts                 # 日志工具
│   │
│   ├── types/
│   │   ├── api.types.ts              # API类型
│   │   ├── formula.types.ts          # 配方类型
│   │   └── chat.types.ts             # 对话类型
│   │
│   ├── app.config.ts                 # 小程序配置（含分包）
│   ├── app.ts                        # 小程序入口
│   ├── app.scss                      # 全局样式
│   └── index.html                    # HTML入口
│
├── config/
│   ├── dev.ts                        # 开发环境
│   ├── prod.ts                       # 生产环境
│   └── index.ts                      # 配置合并
│
├── package.json
├── tsconfig.json
├── babel.config.js
└── taro.config.ts                    # Taro编译配置（含分包）'''

p = doc.add_paragraph(structure_text)
for run in p.runs:
    set_run_font(run, size=Pt(9), color=RGBColor(50, 50, 50))

doc.add_page_break()

# ===== 第三章：前端设计方案（深度改进） =====
h1 = doc.add_heading('三、前端设计方案（深度改进）', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 3.1 页面规划与交互设计
h2 = doc.add_heading('3.1 页面规划与交互设计', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

pages_table = add_table_with_header(doc,
    ['页面', '路径', '核心功能', '交互特色', '优先级'],
    [
        ['首页', 'pages/index/index', 'AI入口、热门配方、快捷问题', '渐变头部+搜索栏', 'P0'],
        ['AI对话', 'pages/chat/index', '流式对话、配方卡片内嵌', '打字机效果+语音输入', 'P0'],
        ['配方列表', 'pages/formulas/index', '分类浏览、搜索、收藏', '下拉刷新+上拉加载', 'P0'],
        ['配方详情', 'pages/formula-detail/index', '完整配方信息、机理说明', '长页面分段加载', 'P0'],
        ['体质诊断', 'pages/health-check/index', '多步骤问卷、AI推荐', '进度条+滑动切换', 'P1'],
        ['个人中心', 'pages/profile/index', '历史记录、收藏、设置', '侧滑菜单（汉堡）', 'P0'],
        ['搜索页', 'pages/search/index', '食材搜索、结果筛选', '联想搜索+历史', 'P1'],
        ['配方对比', 'pages/compare/index', '多方案并列对比', '横向滑动+勾选对比', 'P1'],
        ['话题设置', 'pages/settings/index', '通知开关、隐私协议', '列表式设置项', 'P2'],
    ]
)

doc.add_paragraph()

# 3.2 AI对话流式输出方案（关键改进）
h2 = doc.add_heading('3.2 AI对话流式输出方案（关键改进）', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
p.add_run('【原方案问题】').font.name = 'Microsoft YaHei'
run = p.add_run('V1.0方案称"改用SSE或轮询"，但后端已有完整的SSE流式端点。真正的问题是如何在小程序中消费SSE流。')
set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

p = doc.add_paragraph()
run = p.add_run('【修正方案】Taro.request + enableChunked 分块读取')
set_run_font(run, size=Pt(11), bold=True)

code_text = '''// src/api/request.ts - 流式请求封装
import Taro from '@tarojs/taro'

interface StreamCallback {
  onChunk: (chunk: string) => void
  onDone: (fullContent: string) => void
  onError: (error: any) => void
}

export async function streamChat(
  question: string,
  callbacks: StreamCallback,
  history?: Array<{role: string; content: string}>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const token = Taro.getStorageSync('access_token')
    
    Taro.request({
      url: `${API_BASE}/ai/chat/stream`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      // 关键：启用分块读取
      enableChunked: true,
      // 超时设置为60秒（AI生成可能需要较长时间）
      timeout: 60000,
      data: {
        question,
        history: history?.slice(-10), // 保留最近10条历史
        stream: true,
      },
      success: (res) => {
        if (res.statusCode !== 200) {
          callbacks.onError(res.data)
          reject(res.data)
          return
        }
        
        // 处理分块数据
        const reader = res.data.getReader()
        const decoder = new TextDecoder('utf-8')
        let fullContent = ''
        
        function readChunk() {
          reader.read().then(({ done, value }) => {
            if (done) {
              callbacks.onDone(fullContent)
              resolve()
              return
            }
            
            const text = decoder.decode(value, { stream: true })
            // 解析SSE格式
            const lines = text.split('\\n')
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))
                  if (data.content) {
                    fullContent += data.content
                    callbacks.onChunk(data.content)
                  } else if (data.error) {
                    callbacks.onError(data)
                    reject(new Error(data.message))
                    return
                  }
                } catch (e) {
                  // 忽略解析错误，可能是部分数据
                }
              }
            }
            
            readChunk()
          }).catch(reject)
        }
        
        readChunk()
      },
      fail: (err) => {
        callbacks.onError(err)
        reject(err)
      },
    })
  })
}'''

p = doc.add_paragraph(code_text)
for run in p.runs:
    set_run_font(run, size=Pt(8.5), color=RGBColor(50, 50, 50))

doc.add_paragraph()

# 3.3 UI/UX设计规范
h2 = doc.add_heading('3.3 UI/UX设计规范', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
run = p.add_run('3.3.1 色彩系统')
set_run_font(run, size=Pt(11), bold=True)

color_table = add_table_with_header(doc,
    ['色系', '色值', '应用场景', '对比度'],
    [
        ['主色', '#2D5A3D', '品牌色、主要按钮、导航栏', '4.5:1+'],
        ['辅助色', '#8B7355', '次级元素、边框、分割线', '4.5:1+'],
        ['强调色', '#C9A84C', '重要提示、评分、徽章', '3:1+'],
        ['背景色', '#FAF8F5', '页面底色、卡片背景', '-'],
        ['成功色', '#34A853', '完成状态、正向反馈', '4.5:1+'],
        ['警告色', '#FBBC04', '风险提示、注意事项', '3:1+'],
        ['危险色', '#EA4335', '禁用、错误提示', '4.5:1+'],
    ]
)

doc.add_paragraph()

p = doc.add_paragraph()
run = p.add_run('3.3.2 字体规范')
set_run_font(run, size=Pt(11), bold=True)

font_table = add_table_with_header(doc,
    ['层级', '字号(rpx)', '字重', '行高', '用途'],
    [
        ['一级标题', '36', 'Bold', '1.4', '页面标题、章节标题'],
        ['二级标题', '32', 'SemiBold', '1.4', '模块标题、卡片标题'],
        ['正文', '28', 'Regular', '1.6', '主要内容、说明文字'],
        ['辅助文字', '24', 'Regular', '1.5', '时间、标签、次要信息'],
        ['注释', '22', 'Regular', '1.4', '免责声明、小提示'],
    ]
)

doc.add_paragraph()

p = doc.add_paragraph()
run = p.add_run('3.3.3 汉堡导航栏设计（满足用户偏好）')
set_run_font(run, size=Pt(11), bold=True)

hamburger_spec = '''【设计规格】
• 图标：经典三横杠（三条等宽横线，间距均匀）
• 尺寸：48rpx × 48rpx（触控区域）
• 位置：导航栏左侧（右撇子友好）
• 样式：线宽3rpx，圆角端点，颜色#2D5A3D
• 动画：点击后旋转90°变为关闭图标

【侧栏菜单规格】
• 宽度：70%屏幕宽度（约504rpx）
• 高度：100vh（覆盖整个屏幕高度）
• 背景：白色，左侧阴影0 0 20px rgba(0,0,0,0.1)
• 动画：从左侧滑入，时长300ms，ease-out曲线
• 遮罩：半透明黑色遮罩（opacity: 0.5），点击关闭

【菜单内容结构】
┌─────────────────────────────────┐
│  🌿 RMFOOD 药食同源配方平台      │  ← 品牌头部
│  科学 · 精准 · 个性化            │  ← Slogan
├─────────────────────────────────┤
│  👤 个人中心                     │
│  💬 对话历史                     │
│  ❤️ 我的收藏                     │
│  📋 待审核配方                   │
│  🔔 消息通知                     │
├─────────────────────────────────┤
│  ⚙️ 设置                         │
│  📖 关于我们                     │
│  ❓ 帮助中心                     │
├─────────────────────────────────┤
│  版本号：V1.0.0                  │  ← 底部版本信息
└─────────────────────────────────┘'''

p = doc.add_paragraph(hamburger_spec)
for run in p.runs:
    set_run_font(run, size=Pt(9), color=RGBColor(50, 50, 50))

doc.add_paragraph()

# 3.4 组件设计体系
h2 = doc.add_heading('3.4 组件设计体系', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

component_text = '''核心组件清单（15+组件）：

1. FormulaCard（配方卡片）
   - 展示：配方名称、功效标签（最多3个）、克重摘要、收藏数
   - 交互：点击跳转详情、长按收藏、滑动删除
   - 样式：圆角12px，阴影0 2px 8px rgba(0,0,0,0.08)，高度自适应

2. ChatBubble（对话气泡）
   - 用户消息：右对齐，背景#2D5A3D，文字白色，圆角16px 16px 4px 16px
   - AI消息：左对齐，背景#FFFFFF，圆角16px 16px 16px 4px
   - 特殊内容：配方卡片内嵌、代码块灰色背景、链接可点击

3. SymptomInput（症状输入表单）
   - 多步骤引导式问卷（6-8步）
   - 每步1-3个问题，滑动切换
   - 实时进度指示（圆点或进度条）
   - 支持跳过和返回

4. HamburgerMenu（汉堡侧栏菜单）
   - 三横杠图标，点击展开
   - 滑入动画300ms ease-out
   - 点击遮罩关闭
   - ESC键关闭（键盘支持）

5. QuestionStep（诊断单题组件）
   - 题目序号 + 问题文本
   - 选项卡片（单选/多选）
   - 进度指示
   - 下一题/提交按钮

6. FormulaDetailSection（配方详情分段）
   - 辨证与目标
   - 推荐配方（克重表格）
   - 煎煮方法（SOP步骤）
   - 方解与机理（富文本）
   - 适配与禁忌（警告样式）
   - 监测与迭代'''

p = doc.add_paragraph(component_text)
for run in p.runs:
    set_run_font(run, size=Pt(10))

doc.add_paragraph()

# 3.5 状态管理与缓存策略
h2 = doc.add_heading('3.5 状态管理与缓存策略', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
p.add_run('采用Zustand + 持久化中间件，实现内存+本地双级缓存：').font.name = 'Microsoft YaHei'

stores_code = '''// src/stores/auth.store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import Taro from '@tarojs/taro'

interface AuthState {
  token: string | null
  user: UserInfo | null
  isAuthenticated: boolean
  
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      
      login: async (credentials) => {
        const { data } = await authApi.login(credentials)
        set({ token: data.access_token, isAuthenticated: true })
        // 同步到本地存储（加密）
        await Taro.setStorageSync('token_enc', encrypt(data.access_token))
      },
      
      logout: async () => {
        await authApi.logout()
        set({ token: null, user: null, isAuthenticated: false })
        await Taro.removeStorageSync('token_enc')
      },
      
      refresh: async () => {
        const refreshToken = Taro.getStorageSync('refresh_token')
        if (!refreshToken) throw new Error('No refresh token')
        const { data } = await authApi.refresh(refreshToken)
        set({ token: data.access_token })
        await Taro.setStorageSync('token_enc', encrypt(data.access_token))
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
    }
  )
)'''

p = doc.add_paragraph(stores_code)
for run in p.runs:
    set_run_font(run, size=Pt(8.5), color=RGBColor(50, 50, 50))

doc.add_paragraph()

# 3.6 语音输入与图片处理
h2 = doc.add_heading('3.6 语音输入与图片处理', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
run = p.add_run('3.6.1 语音输入实现方案')
set_run_font(run, size=Pt(11), bold=True)

voice_code = '''// src/hooks/useVoice.ts
import { useState, useRef } from 'react'
import Taro from '@tarojs/taro'

export function useVoice() {
  const [isRecording, setIsRecording] = useState(false)
  const recorderManager = useRef<Taro.RecorderManager | null>(null)
  
  const startRecording = async () => {
    // 检查权限
    const { authSetting } = await Taro.getSetting()
    if (!authSetting['scope.record']) {
      const result = await Taro.authorize({ scope: 'scope.record' })
      if (result.authSetting['scope.record'] === false) {
        Taro.showModal({
          title: '需要录音权限',
          content: '请在设置中开启录音权限以使用语音输入',
          showCancel: false,
        })
        return
      }
    }
    
    recorderManager.current = Taro.getRecorderManager()
    recorderManager.current.start({
      duration: 60000,  // 最长60秒
      format: 'mp3',
    })
    setIsRecording(true)
  }
  
  const stopRecording = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      recorderManager.current?.stop()
      setIsRecording(false)
      
      recorderManager.current?.onStop((res) => {
        // 调用微信语音识别API
        Taro.translateVoice({
          filePath: res.tempFilePath,
          success: (translateRes) => {
            resolve(translateRes.result)
          },
          fail: reject,
        })
      })
    })
  }
  
  return { isRecording, startRecording, stopRecording }
}'''

p = doc.add_paragraph(voice_code)
for run in p.runs:
    set_run_font(run, size=Pt(8.5), color=RGBColor(50, 50, 50))

doc.add_paragraph()

p = doc.add_paragraph()
run = p.add_run('3.6.2 图片处理方案')
set_run_font(run, size=Pt(11), bold=True)

image_text = '''【图片上传流程】
1. 用户选择图片 → wx.chooseMedia（支持相机/相册）
2. 前端压缩 → Taro.compressImage（质量80%，最大边1920px）
3. 上传至后端 → POST /api/v1/formulas/images/upload
4. 后端返回CDN URL → 存储于localStorage
5. 展示时使用CDN URL（需配置合法域名白名单）

【图片域名配置】
需要在微信公众平台后台配置：
- 服务器域名 → request合法域名：https://cdn.rmfood.com
- 上传到期时间：需设置合理的CDN存储过期策略

【图片懒加载】
使用Taro内置的 <Image mode="aspectFill" lazyLoad /> 实现
首屏只加载可视区域图片，滚动时逐步加载'''

p = doc.add_paragraph(image_text)
for run in p.runs:
    set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

# 3.7 分享裂变与订阅消息
h2 = doc.add_heading('3.7 分享裂变与订阅消息', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

share_text = '''【分享功能实现】

1. 右上角分享菜单
   - 使用onShareAppMessage生命周期
   - 分享标题：配方名称 + 功效标签
   - 分享图片：自动生成分享海报（canvas绘制）
   
2. 分享海报生成
   - 使用Taro.canvasToTempFilePath导出
   - 包含：配方名称、克重表格、二维码、品牌Logo
   - 保存到相册后分享
   
3. 分享追踪
   - 分享时携带referrer字段
   - 后端记录分享来源
   - 统计分享转化率

【订阅消息实现】

1. 模板配置（微信公众平台）
   - 模板ID：xxx（需申请）
   - 变量：formula_name, status, time
   
2. 用户授权流程
   - 点击"开启通知"按钮
   - 调用wx.requestSubscribeMessage
   - 记录用户授权状态

3. 触发场景
   - 配方审核通过/拒绝
   - 新配方推荐
   - 系统公告'''

p = doc.add_paragraph(share_text)
for run in p.runs:
    set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

doc.add_page_break()

# ===== 第四章：后端设计方案（深度改进） =====
h1 = doc.add_heading('四、后端设计方案（深度改进）', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 4.1 微信登录完整方案
h2 = doc.add_heading('4.1 微信登录完整方案', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

wechat_login_text = '''【完整认证流程】

Phase 1: 小程序侧
┌─────────────────────────────────────────────────────────────┐
│  用户点击"微信登录"                                          │
│       ↓                                                     │
│  wx.login() → 获取临时code                                   │
│       ↓                                                     │
│  发送code到后端 POST /api/v1/auth/wechat-login              │
│       ↓                                                     │
│  存储access_token至localStorage（加密）                       │
└─────────────────────────────────────────────────────────────┘

Phase 2: 后端处理
┌─────────────────────────────────────────────────────────────┐
│  1. 使用code换取openid和session_key                         │
│     → 调用微信接口：                                        │
│       GET https://api.weixin.qq.com/sns/jscode2session      │
│       ?appid=APPID&secret=SECRET&js_code=CODE&grant_type=   │
│                                                             │
│  2. 查询或创建用户                                          │
│     → 根据openid查找用户                                    │
│     → 首次登录：创建用户，绑定openid                        │
│     → 已存在：更新最后登录时间                              │
│                                                             │
│  3. 生成JWT Token                                           │
│     → access_token: 30分钟有效期                            │
│     → refresh_token: 7天有效期                              │
│     → 返回给前端                                            │
│                                                             │
│  4. 存储openid关联                                          │
│     → 用户表新增openid字段                                  │
│     → 支持多端登录（微信+账号密码）                          │
└─────────────────────────────────────────────────────────────┘

【后端新增代码结构】

backend/app/api/wechat_auth.py:
  - router = APIRouter(prefix="/wechat", tags=["微信认证"])
  - @router.post("/login")  # 微信登录
  - @router.post("/bind")   # 绑定已有账号
  - @router.get("/userinfo") # 获取微信用户信息

backend/app/services/wechat_service.py:
  - class WechatService
  - async def code_to_openid(code) -> dict
  - async def get_or_create_user(openid) -> User
  - async def generate_tokens(user) -> Token

backend/app/models/user_model.py:
  - 新增字段: openid (Optional[str])
  - 新增字段: wechat_unionid (Optional[str])
  - 新增索引: idx_user_openid'''

p = doc.add_paragraph(wechat_login_text)
for run in p.runs:
    set_run_font(run, size=Pt(9.5))

doc.add_paragraph()

# 4.2 API接口完整映射
h2 = doc.add_heading('4.2 API接口完整映射', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

api_table = add_table_with_header(doc,
    ['接口分类', '端点', '方法', '说明', '状态'],
    [
        ['认证', '/auth/login', 'POST', '账号密码登录（复用）', '已有'],
        ['', '/auth/register', 'POST', '用户注册（复用）', '已有'],
        ['', '/auth/refresh', 'POST', '刷新令牌（复用）', '已有'],
        ['', '/auth/wechat-login', 'POST', '微信授权登录（新增）', '需开发'],
        ['', '/auth/wechat-bind', 'POST', '绑定微信账号（新增）', '需开发'],
        ['配方', '/formulas', 'GET', '配方列表（精简版）', '需适配'],
        ['', '/formulas/{id}', 'GET', '配方详情（精简版）', '需适配'],
        ['', '/formulas/favorite', 'POST', '收藏/取消收藏（新增）', '需开发'],
        ['', '/formulas/images/upload', 'POST', '图片上传（新增）', '需开发'],
        ['AI对话', '/ai/chat', 'POST', 'AI对话（非流式）', '已有'],
        ['', '/ai/chat/stream', 'POST', 'AI对话（流式SSE）', '已有'],
        ['', '/ai/generate', 'POST', '配方生成（遗传算法）', '已有'],
        ['', '/ai/safety-check', 'POST', '安全检测', '已有'],
        ['', '/ai/task/{id}', 'GET', '异步任务状态', '已有'],
        ['搜索', '/search/herbs', 'GET', '食材搜索', '已有'],
        ['', '/search/formulas', 'GET', '配方搜索', '已有'],
        ['通知', '/notifications', 'GET', '通知列表', '已有'],
        ['', '/notifications/{id}/read', 'POST', '标记已读', '已有'],
        ['移动端', '/mobile/formulas', 'GET', '移动端配方列表', '已有'],
        ['', '/mobile/formulas/{id}', 'GET', '移动端配方详情', '已有'],
        ['', '/mobile/trace/{batch_id}', 'GET', '溯源查询', '已有'],
    ]
)

doc.add_paragraph()

# 4.3 AI服务对接方案
h2 = doc.add_heading('4.3 AI服务对接方案', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

ai_api_table = add_table_with_header(doc,
    ['功能场景', '接口路径', '技术方案', '预期响应时间'],
    [
        ['AI对话（实时）', '/ai/chat/stream', 'SSE流式输出', '首字<2s'],
        ['配方生成', '/ai/generate', '遗传算法异步', '5-30s'],
        ['安全检测', '/ai/safety-check', '同步检查', '<3s'],
        ['协同分析', '/ai/synergy-analysis', '同步分析', '<5s'],
        ['口感预测', '/ai/taste-predict', '模型推理', '<3s'],
        ['稳定性预测', '/ai/stability', '模型推理', '<5s'],
    ]
)

doc.add_paragraph()

# 4.4 数据模型设计
h2 = doc.add_heading('4.4 数据模型设计（小程序适配）', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

models_text = '''【User表新增字段】
  - openid: VARCHAR(64)        # 微信openid
  - wechat_unionid: VARCHAR(64) # 微信unionid（可选）
  - avatar_url: VARCHAR(512)    # 微信头像URL
  - nickname: VARCHAR(100)      # 微信昵称

【Favorite表（新增）】
  - id: INT PRIMARY KEY
  - user_id: INT FK
  - formula_id: INT FK
  - created_at: TIMESTAMP
  - UNIQUE(user_id, formula_id)

【HealthCheck表（新增）】
  - id: INT PRIMARY KEY
  - user_id: INT FK
  - constitution_type: VARCHAR(20)  # 体质类型
  - score: DECIMAL(5,2)             # 体质得分
  - question_answers: JSON          # 答题记录
  - created_at: TIMESTAMP

【ChatSession表（复用）】
  - id: INT PRIMARY KEY
  - user_id: INT FK
  - title: VARCHAR(200)
  - message_count: INT
  - created_at: TIMESTAMP
  - updated_at: TIMESTAMP

【Formula表精简版（小程序用）】
  仅返回以下字段：
  - id, code, name, description
  - target_effects, composition
  - dosage, processing_method
  - safety_check（精简）
  - ingredients[]（精简）
  - creator_name（不包含敏感信息）'''

p = doc.add_paragraph(models_text)
for run in p.runs:
    set_run_font(run, size=Pt(10))

doc.add_page_break()

# ===== 第五章：核心功能实现方案 =====
h1 = doc.add_heading('五、核心功能实现方案', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 5.1 AI智能助手完整流程
h2 = doc.add_heading('5.1 AI智能助手完整流程', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

ai_flow = '''【对话流程设计】

用户输入
    ↓
┌─────────────────────────────────────────────────────┐
│  前端：输入校验 → 显示用户消息气泡                    │
│         清空输入框 → 显示"思考中"动画                 │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│  后端：接收请求 → 查询对话历史 → 构建messages        │
│         → 调用LLM流式生成 → SSE输出                  │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│  前端：接收SSE流 → 逐字显示（打字机效果）             │
│         解析公式数据 → 内嵌FormulaCard                │
│         完成后保存对话记录                           │
└─────────────────────────────────────────────────────┘
    ↓
用户可见：AI回复 + 配方卡片 + 操作按钮（收藏/分享/追问）'''

p = doc.add_paragraph(ai_flow)
for run in p.runs:
    set_run_font(run, size=Pt(10))

doc.add_paragraph()

# 5.2 配方管理全链路
h2 = doc.add_heading('5.2 配方管理全链路', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

formula_chain = '''【配方浏览链路】
首页推荐 → 配方列表（分页） → 配方详情 → 收藏/分享

【配方详情页信息架构】
┌──────────────────────────────────────┐
│  配方名称 + 功效标签                  │
├──────────────────────────────────────┤
│  【辨证与目标】                       │
│  体质倾向 + 调理目标                  │
├──────────────────────────────────────┤
│  【推荐配方】                         │
│  成分表（名称 | 克重 | 角色）         │
│  总克重 + 配比图                     │
├──────────────────────────────────────┤
│  【制备SOP】                         │
│  步骤1: 准备食材...                   │
│  步骤2: 煎煮方法...                   │
│  步骤3: 服用方法...                   │
├──────────────────────────────────────┤
│  【方解与机理】                       │
│  现代科学解释（富文本）               │
├──────────────────────────────────────┤
│  【适配与禁忌】                       │
│  适配人群 / 不适用情况（警告样式）     │
├──────────────────────────────────────┤
│  【监测与迭代】                       │
│  建议关注指标 + 服用周期              │
├──────────────────────────────────────┤
│  [收藏] [分享] [追问AI]              │
└──────────────────────────────────────┘'''

p = doc.add_paragraph(formula_chain)
for run in p.runs:
    set_run_font(run, size=Pt(9))

doc.add_paragraph()

# 5.3 体质诊断系统设计
h2 = doc.add_heading('5.3 体质诊断系统设计', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

constitution_text = '''【诊断问卷设计】

问卷共6个维度，每个维度2-3题，总计15-18题：

维度1：寒热倾向
  Q1: 您平时怕冷还是怕热？
  A: 怕冷 / 怕热 / 都正常
  
维度2：体力状态
  Q2: 您是否容易感到疲劳？
  A: 经常 / 偶尔 / 从不
  
维度3：消化功能
  Q3: 您的 digestion 如何？
  A: 良好 / 一般 / 较差
  
维度4：睡眠状态
  Q4: 您的睡眠质量？
  A: 很好 / 一般 / 较差
  
维度5：情绪状态
  Q5: 您是否容易焦虑或抑郁？
  A: 经常 / 偶尔 / 从不
  
维度6：过敏史
  Q6: 您是否有过敏史？
  A: 有 / 无

【评分算法】
  采用加权评分法：
  - 每个选项对应不同体质得分
  - 最终得分最高的体质类型作为诊断结果
  - 允许复合体质（如气虚质+痰湿质）

【AI推荐逻辑】
  诊断结果 → 匹配对应体质配方库 → AI优化推荐 → 输出个性化方案'''

p = doc.add_paragraph(constitution_text)
for run in p.runs:
    set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

# 5.4 RAG知识库问答
h2 = doc.add_heading('5.4 RAG知识库问答（新增）', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

rag_text = '''【功能定位】
针对专业用户（研究员、配方师），提供基于知识库的深度问答。

【实现方案】
1. 后端已有RAG服务：/api/v1/rag/*
2. 小程序新增"知识库"入口
3. 问答界面与普通对话界面分离

【界面设计】
┌──────────────────────────────────┐
│  📚 知识库问答                    │
├──────────────────────────────────┤
│  [用户问题输入框]                 │
│  [发送按钮]                       │
├──────────────────────────────────┤
│  对话历史区域：                    │
│  ┌────────────────────────────┐  │
│  │ 问：枸杞的活性成分有哪些？   │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ 答：枸杞主要活性成分包括：  │  │
│  │ 1. 枸杞多糖（LBP）...      │  │
│  │ 2. 玉米黄质...             │  │
│  │ 来源：TCMSP数据库          │  │
│  └────────────────────────────┘  │
├──────────────────────────────────┤
│  [引用来源] [复制] [追问]         │
└──────────────────────────────────┘'''

p = doc.add_paragraph(rag_text)
for run in p.runs:
    set_run_font(run, size=Pt(9.5))

doc.add_paragraph()

# 5.5 配方对比功能
h2 = doc.add_heading('5.5 配方对比功能（新增）', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

compare_text = '''【功能定位】
允许用户选择多个配方进行横向对比，辅助决策。

【实现方案】
1. 配方列表支持多选模式
2. 点击"对比"按钮进入对比页
3. 对比页展示关键指标并排对比

【对比维度】
| 维度 | 配方A | 配方B | 配方C |
|------|-------|-------|-------|
| 功效强度 | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 安全性 | 高 | 中 | 高 |
| 口感评分 | 85 | 72 | 90 |
| 成本估算 | ¥45 | ¥32 | ¥58 |
| 适用周期 | 4周 | 2周 | 6周 |

【交互设计】
- 左侧固定维度标签
- 右侧横向滑动查看所有配方
- 选中配方高亮显示'''

p = doc.add_paragraph(compare_text)
for run in p.runs:
    set_run_font(run, size=Pt(10.5))

doc.add_page_break()

# ===== 第六章：性能与安全设计 =====
h1 = doc.add_heading('六、性能与安全设计', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 6.1 包体积控制方案
h2 = doc.add_heading('6.1 包体积控制方案（关键改进）', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
p.add_run('【原方案问题】').font.name = 'Microsoft YaHei'
run = p.add_run('V1.0仅提到"分包策略"，未给出具体体积控制和优化手段。')
set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

volume_table = add_table_with_header(doc,
    ['优化手段', '预计节省', '实施难度', '说明'],
    [
        ['NutUI按需引入', '~100KB', '低', '只引入使用的组件'],
        ['移除未用依赖', '~50KB', '低', '清理package.json'],
        ['图片压缩+WebP', '~200KB', '中', '自动转换+CDN'],
        ['代码分割', '~80KB', '中', '路由级懒加载'],
        ['去除测试代码', '~30KB', '低', '构建时排除'],
        ['字体子集化', '~150KB', '高', '只包含使用中文字符'],
    ]
)

doc.add_paragraph()

p = doc.add_paragraph()
run = p.add_run('【分包配置示例】')
set_run_font(run, size=Pt(11), bold=True)

subpack_config = '''// taro.config.ts
export default defineConfig({
  mini: {
    subpackages: [
      {
        root: 'packages/chat',
        name: 'chat',
        pages: ['index'],
      },
      {
        root: 'packages/formulas',
        name: 'formulas',
        pages: ['index', 'formula-detail'],
      },
      {
        root: 'packages/profile',
        name: 'profile',
        pages: ['index', 'settings'],
      },
    ],
    // 独立分包
    independentSubpackages: [
      {
        root: 'packages/health-check',
        name: 'health-check',
        pages: ['index'],
      },
    ],
  },
  // 构建优化
  compiler: {
    type: 'vite',
    vitePlugins: [
      // 自动按需引入
     ['@nutui/auto-import-resolver', { libraryName: '@nutui/nutui-taro' }],
    ],
  },
})'''

p = doc.add_paragraph(subpack_config)
for run in p.runs:
    set_run_font(run, size=Pt(8.5), color=RGBColor(50, 50, 50))

doc.add_paragraph()

# 6.2 性能优化策略
h2 = doc.add_heading('6.2 性能优化策略', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

perf_table = add_table_with_header(doc,
    ['优化项', '方案', '预期效果'],
    [
        ['首屏加载', '分包预加载 + 骨架屏 + 关键CSS内联', '< 2秒'],
        ['列表滚动', '虚拟列表 + 图片懒加载', '流畅60fps'],
        ['API响应', 'Redis缓存 + 连接池 + 分页', '< 500ms'],
        ['AI对话', '流式输出 + 打字机效果 + 本地缓存历史', '首字<2s'],
        ['包体积', '按需引入 + 图片压缩 + 代码分割', '< 1.8MB主包'],
    ]
)

doc.add_paragraph()

# 6.3 安全设计
h2 = doc.add_heading('6.3 安全设计', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

security_items = [
    ('Token安全', 'JWT Token加密存储（crypto-js），设置合理过期时间，支持自动刷新，防反编译窃取'),
    ('接口安全', '所有接口需携带有效Token，防重放攻击（nonce+timestamp），速率限制（100次/分钟）'),
    ('数据安全', '敏感数据（健康信息）脱敏处理，传输加密（HTTPS），数据库加密存储'),
    ('内容安全', '用户输入XSS过滤，AI输出敏感词过滤，健康咨询免责声明'),
    ('微信合规', '不收集非必要权限，隐私协议明确告知，健康数据本地加密存储'),
    ('代码安全', '生产环境移除console.log，敏感信息不入源码，SCSS变量统一管理'),
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

phase_table = add_table_with_header(doc,
    ['阶段', '周期', '核心任务', '交付物', '验收标准'],
    [
        ['Phase 1', '第1-2周', '项目初始化、基建搭建、微信登录', '可运行小程序骨架', '登录流程跑通'],
        ['Phase 2', '第3-4周', 'AI对话、配方浏览、流式输出', 'MVP版本', '核心功能可用'],
        ['Phase 3', '第5-6周', '体质诊断、RAG、配方对比', '测试版本', '所有P0功能完成'],
        ['Phase 4', '第7-8周', '性能优化、真机调试、提交审核', '上线版本', '审核通过'],
    ]
)

doc.add_paragraph()

# 7.2 里程碑计划
h2 = doc.add_heading('7.2 里程碑计划', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

milestone_table = add_table_with_header(doc,
    ['里程碑', '完成时间', '验收标准'],
    [
        ['M1：项目启动', '第1天', 'Taro项目初始化，CI/CD配置完成'],
        ['M2：基建完成', '第7天', '请求层、状态管理、路由配置完成'],
        ['M3：认证打通', '第10天', '微信登录+账号绑定流程跑通'],
        ['M4：AI对话', '第17天', '流式SSE输出+打字机效果完成'],
        ['M5：核心功能', '第24天', '配方浏览+详情+收藏功能可用'],
        ['M6：功能完善', '第35天', '体质诊断+RAG+对比功能完成'],
        ['M7：性能优化', '第42天', '包体积<2MB，首屏<2s'],
        ['M8：上线发布', '第49天', '微信审核通过，正式上线'],
    ]
)

doc.add_paragraph()

doc.add_page_break()

# ===== 第八章：风险评估与应对 =====
h1 = doc.add_heading('八、风险评估与应对', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

risk_table = add_table_with_header(doc,
    ['风险项', '影响程度', '发生概率', '应对策略'],
    [
        ['小程序SSE消费困难', '高', '高', '使用Taro.request(enableChunked:true)，备用轮询方案'],
        ['微信登录接口开发延迟', '中', '中', 'Phase 1优先开发，预留3天buffer'],
        ['包体积超限', '高', '中', '按需引入+图片压缩+分包，预留50KB buffer'],
        ['AI响应延迟影响体验', '中', '中', '流式输出+骨架屏+离线缓存历史'],
        ['微信审核拒审（健康类）', '高', '低', '提前准备资质材料，添加免责声明'],
        ['并发性能瓶颈', '中', '低', 'Redis缓存+限流+连接池优化'],
        ['图片域名配置问题', '中', '中', '提前申请CDN域名，准备HTTPS证书'],
        ['语音识别准确率', '低', '中', '提供文字输入备选，持续优化'],
    ]
)

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

version_table = add_table_with_header(doc,
    ['组件', '版本', '说明'],
    [
        ['Taro', '4.1.6', '多端框架（必须用Taro版）'],
        ['React', '18.2.0', 'UI库（Taro不支持React 19）'],
        ['TypeScript', '5.3.3', '类型安全'],
        ['Zustand', '5.0.1', '状态管理'],
        ['@nutui/nutui-taro', '4.11.0', 'UI组件库（Taro版）'],
        ['SCSS', '1.6.0', '样式预处理'],
        ['ESLint', '8.56.0', '代码规范'],
        ['Prettier', '3.2.0', '代码格式化'],
        ['crypto-js', '4.2.0', 'Token加密存储'],
        ['wxparse', '1.0.0', '富文本渲染（备选）'],
    ]
)

doc.add_paragraph()

# 附录B
h2 = doc.add_heading('附录B：开发环境配置', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

env_text = '''# .env.development
TARO_ENV=development
TARO_APP_ID=wx_your_appid_here
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000/api/v1/ws

# 微信开发者工具配置
# 下载地址：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
# 建议版本：1.06.2504000+
# 小程序 AppID：待申请（注册微信公众平台后获取）

# CDN配置（需在微信公众平台后台配置）
VITE_CDN_BASE_URL=https://cdn.rmfood.com'''

p = doc.add_paragraph(env_text)
for run in p.runs:
    set_run_font(run, size=Pt(9), color=RGBColor(50, 50, 50))

doc.add_paragraph()

# 附录C
h2 = doc.add_heading('附录C：相关文档链接', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

links = [
    '微信小程序官方文档：https://developers.weixin.qq.com/miniprogram/dev/framework/',
    'Taro官方文档：https://docs.taro.zone/docs/',
    'NutUI Taro版文档：https://nutui.jd.com/taro/',
    'RMFOOD后端API文档：http://localhost:8000/docs',
    '微信开放平台：https://open.weixin.qq.com/',
]
for link in links:
    p = doc.add_paragraph(link, style='List Bullet')
    for run in p.runs:
        set_run_font(run, size=Pt(10))

doc.add_paragraph()

# 保存文档
output_path = r'D:\\RMFOODFP\\docs\\RMFOOD小程序开发方案_V2.0.docx'
doc.save(output_path)
print(f'文档已保存至: {output_path}')
