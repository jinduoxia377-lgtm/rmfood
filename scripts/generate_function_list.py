# -*- coding: utf-8 -*-
from docx import Document
from docx.shared import Pt, RGBColor
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
run = subtitle.add_run('微信小程序功能清单')
set_run_font(run, size=Pt(22), bold=True, color=RGBColor(45, 90, 61))

version = doc.add_paragraph()
version.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = version.add_run('v1.0 — 完整功能清单版')
set_run_font(run, size=Pt(14), color=RGBColor(50, 150, 50))

doc.add_paragraph()
doc.add_paragraph()

info_para = doc.add_paragraph()
info_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = info_para.add_run(f'\n版本：V1.0\n日期：{datetime.date.today().strftime("%Y年%m月%d日")}\n编制：RMFOOD架构组\n状态：✅ 开发准备')
set_run_font(run, size=Pt(12))

doc.add_page_break()

# 执行摘要
h0 = doc.add_heading('执行摘要', level=1)
for run in h0.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

p = doc.add_paragraph()
p.add_run('本清单汇总了RMFOOD微信小程序的全部功能，共').font.name = 'Microsoft YaHei'
run = p.add_run('50项功能')
set_run_font(run, size=Pt(10.5), bold=True, color=RGBColor(200, 50, 50))
p.add_run('，按优先级分为三层：').font.name = 'Microsoft YaHei'

doc.add_paragraph()

summary_table = add_table_with_header(doc,
    ['类别', '核心功能(P0)', '增值功能(P1)', '扩展功能(P2/P3)', '总计'],
    [
        ['页面', '7个', '3个', '1个', '11个'],
        ['组件', '7个', '6个', '3个', '16个'],
        ['Store', '4个', '-', '-', '4个'],
        ['Hook', '3个', '1个', '2个', '6个'],
        ['API', '6个', '4个', '3个', '13个'],
        ['合计', '27项', '14项', '9项', '50项'],
    ]
)

doc.add_paragraph()

p = doc.add_paragraph()
run = p.add_run('开发建议：')
set_run_font(run, size=Pt(11), bold=True)
run = p.add_run('按Phase分阶段实施，确保核心功能优先上线。')
set_run_font(run, size=Pt(11))

doc.add_page_break()

# 一、核心功能
h1 = doc.add_heading('一、核心功能（P0优先级）', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 1.1 认证模块
h2 = doc.add_heading('1.1 认证模块', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

auth_table = add_table_with_header(doc,
    ['功能项', '功能描述', '技术实现', '状态'],
    [
        ['微信登录', '用户点击一键登录，获取openid并绑定账号', 'wx.login() + 后端/wechat/login', '需开发'],
        ['Token管理', '自动存储、刷新、过期处理', 'AES加密存储 + 自动刷新机制', '需开发'],
        ['退出登录', '清除本地Token，返回登录页', '清除Storage + 跳转首页', '需开发'],
        ['账号绑定', '已有用户绑定微信账号', '后端/wechat/bind', '需开发'],
    ]
)

doc.add_paragraph()

# 1.2 AI对话模块
h2 = doc.add_heading('1.2 AI对话模块', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

chat_table = add_table_with_header(doc,
    ['功能项', '功能描述', '技术实现', '状态'],
    [
        ['流式对话', '实时显示AI回复，打字机效果', 'fetch API + ReadableStream', '需开发'],
        ['对话历史', '保存最近10条对话记录', 'Zustand store + 本地缓存', '需开发'],
        ['快捷问题', '首页推荐常见问题入口', '预设问题列表', '需开发'],
        ['配方卡片', 'AI回复中内嵌配方卡片', 'FormulaCard组件', '需开发'],
        ['语音输入', '支持语音提问', 'wx.getRecorderManager', '需开发'],
        ['免责声明', '每条AI回复后展示免责声明', 'Disclaimer组件', '需开发'],
    ]
)

doc.add_paragraph()

# 1.3 配方浏览模块
h2 = doc.add_heading('1.3 配方浏览模块', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

formula_table = add_table_with_header(doc,
    ['功能项', '功能描述', '技术实现', '状态'],
    [
        ['配方列表', '分页展示配方，下拉刷新、上拉加载', '分页API + 虚拟列表', '需开发'],
        ['配方分类', '按功效分类浏览配方', '分类筛选API', '需开发'],
        ['配方搜索', '关键词搜索配方名称、功效', '搜索API', '需开发'],
        ['配方详情', '展示完整配方信息（成分、机理、禁忌）', '详情API + Markdown渲染', '需开发'],
        ['配方收藏', '收藏/取消收藏配方', 'POST /formulas/favorite', '需开发'],
        ['配方分享', '生成分享海报，保存到相册', 'canvas绘制 + saveImageToPhotosAlbum', '需开发'],
    ]
)

doc.add_paragraph()

# 1.4 隐私合规模块
h2 = doc.add_heading('1.4 隐私合规模块', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

privacy_table = add_table_with_header(doc,
    ['功能项', '功能描述', '技术实现', '状态'],
    [
        ['隐私弹窗', '首次启动强制显示隐私政策弹窗', 'Taro.showModal + Storage标记', '需开发'],
        ['隐私政策页', '独立的隐私政策展示页面', '富文本渲染', '需开发'],
        ['用户协议页', '独立的用户协议展示页面', '富文本渲染', '需开发'],
        ['健康声明', '固定位置展示健康免责声明', 'Disclaimer组件', '需开发'],
    ]
)

doc.add_page_break()

# 二、增值功能
h1 = doc.add_heading('二、增值功能（P1优先级）', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 2.1 体质诊断模块
h2 = doc.add_heading('2.1 体质诊断模块', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

health_table = add_table_with_header(doc,
    ['功能项', '功能描述', '技术实现', '状态'],
    [
        ['问卷引导', '6维度15题引导式问卷', '多步骤表单组件', '需开发'],
        ['评分算法', '加权评分计算体质类型', '后端算法或前端计算', '需开发'],
        ['结果展示', '展示体质类型、得分、建议', 'ResultCard组件', '需开发'],
        ['AI推荐', '根据体质推荐对应配方', '调用AI接口推荐', '需开发'],
    ]
)

doc.add_paragraph()

# 2.2 个人中心模块
h2 = doc.add_heading('2.2 个人中心模块', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

profile_table = add_table_with_header(doc,
    ['功能项', '功能描述', '技术实现', '状态'],
    [
        ['对话历史', '展示历史对话记录', '历史记录API', '需开发'],
        ['我的收藏', '展示收藏的配方列表', '收藏API', '需开发'],
        ['诊断历史', '展示体质诊断历史记录', '诊断历史API', '需开发'],
        ['设置页面', '通知开关、隐私设置', '设置组件', '需开发'],
        ['关于我们', '平台介绍、联系方式', '静态页面', '需开发'],
    ]
)

doc.add_paragraph()

# 2.3 搜索模块
h2 = doc.add_heading('2.3 搜索模块', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

search_table = add_table_with_header(doc,
    ['功能项', '功能描述', '技术实现', '状态'],
    [
        ['食材搜索', '搜索食材名称、功效', '/api/v1/search/herbs', '已有'],
        ['配方搜索', '搜索配方名称、功效', '/api/v1/search/formulas', '已有'],
        ['联想搜索', '输入联想推荐', '前端防抖 + 后端搜索', '需开发'],
        ['搜索历史', '记录搜索历史', '本地Storage', '需开发'],
    ]
)

doc.add_paragraph()

# 2.4 配方对比模块
h2 = doc.add_heading('2.4 配方对比模块', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

compare_table = add_table_with_header(doc,
    ['功能项', '功能描述', '技术实现', '状态'],
    [
        ['多选配方', '列表页多选配方进入对比', '多选组件', '需开发'],
        ['对比展示', '横向滑动展示对比结果', '横向ScrollView', '需开发'],
        ['对比维度', '功效、安全性、口感、成本等', '对比表格组件', '需开发'],
    ]
)

doc.add_page_break()

# 三、扩展功能
h1 = doc.add_heading('三、扩展功能（P2/P3优先级）', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

expand_table = add_table_with_header(doc,
    ['功能项', '功能描述', '技术实现', '优先级'],
    [
        ['语音输入', '长按录音，松开识别', 'wx.getRecorderManager', 'P2'],
        ['语音转文字', '微信语音识别API', 'wx.translateVoice', 'P2'],
        ['语音播报', 'AI回复语音朗读', 'wx.createInnerAudioContext', 'P3'],
        ['订阅消息', '审核结果、新配方推荐通知', 'wx.requestSubscribeMessage', 'P2'],
        ['消息中心', '展示所有订阅消息', '通知列表页', 'P2'],
        ['已读标记', '标记消息为已读', 'POST /notifications/{id}/read', '已有'],
        ['扫码功能', '扫描商品二维码', 'wx.scanCode', 'P3'],
        ['溯源查询', '查询产品溯源信息', '/api/mobile/trace/{batch_id}', '已有'],
        ['离线缓存', '缓存配方数据，弱网可用', 'Taro.setStorageSync', 'P2'],
        ['离线队列', '网络恢复后自动同步', '离线队列机制', 'P3'],
        ['缓存策略', '按优先级缓存核心数据', 'CacheManager类', 'P2'],
    ]
)

doc.add_page_break()

# 四、页面清单
h1 = doc.add_heading('四、页面清单', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

pages_table = add_table_with_header(doc,
    ['序号', '页面名称', '路径', '分包', '优先级', '说明'],
    [
        ['1', '首页', 'pages/index/index', '主包', 'P0', 'AI入口、热门配方、快捷问题'],
        ['2', 'AI对话', 'packages/chat/index', 'chat', 'P0', '流式对话、配方卡片内嵌'],
        ['3', '配方列表', 'packages/formulas/index', 'formulas', 'P0', '分类浏览、搜索、收藏'],
        ['4', '配方详情', 'packages/formula-detail/index', 'formulas', 'P0', '完整配方信息、机理说明'],
        ['5', '体质诊断', 'packages/health-check/index', 'health-check', 'P1', '多步骤问卷、AI推荐'],
        ['6', '个人中心', 'packages/profile/index', 'profile', 'P0', '历史记录、收藏、设置'],
        ['7', '搜索页', 'pages/search/index', '主包', 'P1', '食材搜索、联想搜索'],
        ['8', '配方对比', 'pages/compare/index', '主包', 'P1', '多方案并列对比'],
        ['9', '设置页', 'pages/settings/index', 'profile', 'P2', '通知开关、隐私设置'],
        ['10', '隐私政策', 'pages/privacy/index', '主包', 'P0', '隐私政策展示（合规必需）'],
        ['11', '用户协议', 'pages/agreement/index', '主包', 'P0', '用户协议展示（合规必需）'],
    ]
)

doc.add_page_break()

# 五、开发优先级
h1 = doc.add_heading('五、开发优先级建议', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

phase_table = add_table_with_header(doc,
    ['阶段', '周期', '核心任务', '交付物'],
    [
        ['Phase 1', '第1-2周', '核心功能', '登录、对话、配方浏览、隐私合规'],
        ['Phase 2', '第3-4周', '增值功能', '体质诊断、收藏、分享、语音输入'],
        ['Phase 3', '第5-6周', '扩展功能', '订阅消息、离线缓存、扫码溯源'],
        ['Phase 4', '第7-8周', '优化与测试', '性能优化、真机测试、微信审核'],
    ]
)

doc.add_paragraph()

# 总结
h1 = doc.add_heading('总结', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

p = doc.add_paragraph()
run = p.add_run('小程序共规划')
set_run_font(run, size=Pt(11))
run = p.add_run('50项功能')
set_run_font(run, size=Pt(11), bold=True, color=RGBColor(200, 50, 50))
p.add_run('，其中核心功能27项（P0），增值功能14项（P1），扩展功能9项（P2/P3）。建议按Phase分阶段实施，确保核心功能优先上线。').font.name = 'Microsoft YaHei'

doc.add_paragraph()
doc.add_paragraph()

footer = doc.add_paragraph()
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = footer.add_run(f'\n文档版本：V1.0 | 编制：RMFOOD架构组 | 日期：{datetime.date.today().strftime("%Y年%m月%d日")}')
set_run_font(run, size=Pt(10), color=RGBColor(150, 150, 150))

# 保存文档
output_path = r'D:\\RMFOODFP\\docs\\RMFOOD小程序功能清单.docx'
doc.save(output_path)
print(f'功能清单文档已保存至: {output_path}')
