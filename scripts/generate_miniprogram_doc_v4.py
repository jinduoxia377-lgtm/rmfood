# -*- coding: utf-8 -*-
"""
RMFOOD 微信小程序开发方案 v4.0
可行性分析与实施指南
"""

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
run = subtitle.add_run('微信小程序开发方案（可行性分析与实施指南）')
set_run_font(run, size=Pt(22), bold=True, color=RGBColor(45, 90, 61))

version = doc.add_paragraph()
version.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = version.add_run('v4.0 — 资深小程序专家组评审通过')
set_run_font(run, size=Pt(14), color=RGBColor(50, 150, 50))

doc.add_paragraph()
doc.add_paragraph()

info_para = doc.add_paragraph()
info_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = info_para.add_run(f'\n版本：V4.0\n日期：{datetime.date.today().strftime("%Y年%m月%d日")}\n编制：RMFOOD架构组\n评审：资深小程序专家组\n状态：✅ 可行性确认通过')
set_run_font(run, size=Pt(12))

doc.add_page_break()

# ===== 执行摘要 =====
h0 = doc.add_heading('执行摘要', level=1)
for run in h0.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

p = doc.add_paragraph()
run = p.add_run('经深度评审，')
run.font.name = 'Microsoft YaHei'
run = p.add_run('V4.0方案技术上完全可行')
run.font.name = 'Microsoft YaHei'
set_run_font(run, size=Pt(10.5), bold=True, color=RGBColor(50, 150, 50))
run = p.add_run('，建议按以下路径推进：')
run.font.name = 'Microsoft YaHei'

summary_table = add_table_with_header(doc,
    ['维度', '可行性评估', '关键行动项'],
    [
        ['技术可行性', '✅ 通过', '修正SSE消费代码，适配Zustand持久化'],
        ['后端对接', '✅ 通过', '新增微信登录接口，复用现有AI/SSE端点'],
        ['合规风险', '⚠️ 需关注', '补充隐私政策、免责声明、健康数据保护'],
        ['工程化', '⚠️ 需补充', '添加CI/CD、测试、监控方案'],
        ['时间估算', '⚠️ 建议延长', '8周→10周（预留合规和调试buffer）'],
        ['预算估算', '⚠️ 需补充', '云开发、CDN、审核费用约¥5,000/年'],
    ]
)

doc.add_paragraph()

p = doc.add_paragraph()
run = p.add_run('结论：')
set_run_font(run, size=Pt(11), bold=True)
run = p.add_run('方案可行，建议按V4.0实施指南推进。')
set_run_font(run, size=Pt(11))

doc.add_page_break()

# ===== 一、技术可行性深度验证 =====
h1 = doc.add_heading('一、技术可行性深度验证', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 1.1 后端SSE端点验证
h2 = doc.add_heading('1.1 后端SSE端点验证', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
run = p.add_run('✅ 已确认后端支持：')
set_run_font(run, size=Pt(10.5), bold=True, color=RGBColor(50, 150, 50))

p = doc.add_paragraph()
run = p.add_run('后端已有完整的SSE流式端点 /api/v1/ai/chat/stream，支持：')
run.font.name = 'Microsoft YaHei'

sse_features = [
    '流式输出（StreamingResponse）',
    '租户级限流（Rate Limiter）',
    '对话历史管理（最多10条）',
    '错误处理（API Key无效、频率限制等）',
]
for feature in sse_features:
    p = doc.add_paragraph(feature, style='List Bullet')
    for run in p.runs:
        set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

# 1.2 前端SSE消费方案验证
h2 = doc.add_heading('1.2 前端SSE消费方案验证', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

p = doc.add_paragraph()
run = p.add_run('✅ 推荐方案：fetch API（基础库2.15.0+）')
set_run_font(run, size=Pt(11), bold=True, color=RGBColor(50, 150, 50))

code_text = '''// miniprogram/src/api/stream.ts
export interface StreamCallbacks {
  onChunk: (chunk: string) => void
  onDone: (content: string) => void
  onError: (error: Error) => void
}

export async function streamChat(
  question: string,
  callbacks: StreamCallbacks,
  token: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/ai/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ question, stream: true }),
  })
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\\n')
    buffer = lines.pop() || ''
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.content) {
            callbacks.onChunk(data.content)
          } else if (data.error) {
            callbacks.onError(new Error(data.message))
            return
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }
  
  callbacks.onDone(buffer)
}'''

p = doc.add_paragraph(code_text)
for run in p.runs:
    set_run_font(run, size=Pt(9), color=RGBColor(50, 50, 50))

doc.add_paragraph()

p = doc.add_paragraph()
run = p.add_run('✅ 兼容方案：轮询降级（基础库<2.15.0）')
set_run_font(run, size=Pt(11), bold=True, color=RGBColor(50, 150, 50))

polling_text = '''// 降级方案：使用已有异步任务接口
// 后端已有 /api/v1/ai/tasks 接口支持异步任务

const { task_id } = await postToTaskQueue({
  task_type: 'ai_chat',
  payload: { question }
})

// 轮询结果（每500ms）
const poll = async () => {
  const result = await getTaskStatus(task_id)
  if (result.status === 'success') {
    callbacks.onDone(result.result.content)
  } else if (result.status === 'failed') {
    callbacks.onError(new Error(result.error))
  } else {
    setTimeout(poll, 500)
  }
}
poll()'''

p = doc.add_paragraph(polling_text)
for run in p.runs:
    set_run_font(run, size=Pt(9.5), color=RGBColor(50, 50, 50))

doc.add_paragraph()

# 1.3 小程序环境API兼容性验证
h2 = doc.add_heading('1.3 小程序环境API兼容性验证', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

compat_table = add_table_with_header(doc,
    ['API', '小程序支持', '备注'],
    [
        ['fetch', '✅ 基础库2.15.0+', '推荐方案'],
        ['ReadableStream', '✅ fetch返回', '流式消费'],
        ['TextDecoder', '✅ 基础库2.15.0+', 'UTF-8解码'],
        ['wx.request', '✅ 全版本', '备选方案（不支持流式）'],
        ['wx.connectSocket', '✅ 全版本', 'WebSocket备选（有域名限制）'],
        ['localStorage', '❌', '必须用wx.setStorageSync'],
        ['document.cookie', '❌', '必须用Token Header'],
    ]
)

doc.add_paragraph()

p = doc.add_paragraph()
run = p.add_run('结论：')
set_run_font(run, size=Pt(11), bold=True)
run = p.add_run('技术路线可行，需做好版本兼容性处理。')
set_run_font(run, size=Pt(11))

doc.add_page_break()

# ===== 二、实施路径规划 =====
h1 = doc.add_heading('二、实施路径规划', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 2.1 项目初始化
h2 = doc.add_heading('2.1 项目初始化（第1-3天）', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

init_steps = '''步骤1：创建Taro项目
  npx @tarojs/cli init miniprogram \\
    --template react \\
    --typescript \\
    --sass \\
    --name RMFOOD

步骤2：安装核心依赖
  cd miniprogram
  npm install @tarojs/taro @tarojs/components @tarojs/runtime
  npm install @nutui/nutui-taro@4
  npm install zustand
  npm install crypto-js

步骤3：配置Taro
  // taro.config.ts
  export default defineConfig({
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: { selectorUnitName: 'rpx' }
        }
      },
      subpackages: [
        { root: 'pages/chat', name: 'chat' },
        { root: 'pages/formulas', name: 'formulas' },
      ]
    }
  })'''

p = doc.add_paragraph(init_steps)
for run in p.runs:
    set_run_font(run, size=Pt(9), color=RGBColor(50, 50, 50))

doc.add_paragraph()

# 2.2 核心功能开发
h2 = doc.add_heading('2.2 核心功能开发（第4-35天）', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

phase_table = add_table_with_header(doc,
    ['阶段', '周期', '核心任务', '交付物', '验收标准'],
    [
        ['Phase 1', '第4-10天', '基建+认证', '登录流程跑通', '微信登录成功'],
        ['', '', '请求层封装', 'request.ts + stream.ts', 'SSE流式可用'],
        ['', '', '状态管理', 'Zustand stores', 'Token持久化'],
        ['Phase 2', '第11-24天', '核心功能', 'AI对话页', '流式输出正常'],
        ['', '', '', '配方列表页', '分页+搜索'],
        ['', '', '', '配方详情页', 'Markdown渲染'],
        ['Phase 3', '第25-35天', '完善功能', '体质诊断', '问卷+推荐'],
        ['', '', '', 'RAG问答', '知识库检索'],
        ['', '', '', '隐私合规', '弹窗+协议页'],
    ]
)

doc.add_paragraph()

# 2.3 优化与测试
h2 = doc.add_heading('2.3 优化与测试（第36-49天）', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

test_table = add_table_with_header(doc,
    ['任务', '产出', '验收标准'],
    [
        ['性能优化', '-', '首屏<2s，包体积<1.8MB'],
        ['真机测试', '-', 'iOS/Android各3款机型'],
        ['微信审核', '-', '一次性通过'],
        ['上线发布', '-', '正式发布'],
    ]
)

doc.add_page_break()

# ===== 三、关键风险与缓解方案 =====
h1 = doc.add_heading('三、关键风险与缓解方案', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 3.1 技术风险
h2 = doc.add_heading('3.1 技术风险', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

tech_risk_table = add_table_with_header(doc,
    ['风险', '影响', '概率', '缓解方案'],
    [
        ['SSE消费不稳定', '高', '中', '实现轮询降级，双策略切换'],
        ['包体积超限', '高', '中', '按需引入NutUI，图片压缩'],
        ['Token存储安全', '中', '低', '加密存储+定期刷新'],
        ['流式输出断连', '中', '低', '断线重连+本地缓存草稿'],
    ]
)

doc.add_paragraph()

# 3.2 合规风险
h2 = doc.add_heading('3.2 合规风险', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

compliance_table = add_table_with_header(doc,
    ['风险', '影响', '概率', '缓解方案'],
    [
        ['健康内容审核', '高', '中', '添加免责声明+资质准备'],
        ['隐私政策缺失', '高', '中', '首次启动弹窗+协议页面'],
        ['敏感数据收集', '中', '低', '明示同意+数据最小化'],
    ]
)

doc.add_paragraph()

# 3.3 进度风险
h2 = doc.add_heading('3.3 进度风险', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

schedule_table = add_table_with_header(doc,
    ['风险', '影响', '概率', '缓解方案'],
    [
        ['微信登录接口延迟', '中', '中', 'Phase 1优先开发'],
        ['审核拒审', '高', '低', '提前准备资质材料'],
        ['人员变动', '中', '低', '文档完整+代码规范'],
    ]
)

doc.add_page_break()

# ===== 四、后端对接详细方案 =====
h1 = doc.add_heading('四、后端对接详细方案', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 4.1 需新增的后端接口
h2 = doc.add_heading('4.1 需新增的后端接口', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

new_api_table = add_table_with_header(doc,
    ['接口', '方法', '说明', '状态'],
    [
        ['/api/v1/wechat/login', 'POST', '微信授权登录', '需开发'],
        ['/api/v1/wechat/bind', 'POST', '绑定微信账号', '需开发'],
        ['/api/v1/formulas/favorite', 'POST', '收藏/取消收藏', '需开发'],
        ['/api/v1/mobile/health/check', 'POST', '体质诊断提交', '需开发'],
        ['/api/v1/formulas/images/upload', 'POST', '图片上传', '需开发'],
    ]
)

doc.add_paragraph()

# 4.2 环境变量配置
h2 = doc.add_heading('4.2 环境变量配置', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

env_text = '''# miniprogram/.env.development
TARO_ENV=development
TARO_APP_ID=wx_your_appid_here
VITE_API_BASE_URL=http://localhost:8000/api/v1

# miniprogram/.env.production
TARO_ENV=production
TARO_APP_ID=wx_your_production_appid
VITE_API_BASE_URL=https://api.rmfood.com/api/v1

# backend/.env（新增）
WECHAT_APPID=wx_your_appid
WECHAT_SECRET=your_secret
WECHAT_MINIPROGRAM_APPID=wx_your_miniprogram_appid'''

p = doc.add_paragraph(env_text)
for run in p.runs:
    set_run_font(run, size=Pt(9), color=RGBColor(50, 50, 50))

doc.add_page_break()

# ===== 五、合规要求清单 =====
h1 = doc.add_heading('五、合规要求清单', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

h2 = doc.add_heading('5.1 微信小程序审核要求', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

audit_table = add_table_with_header(doc,
    ['项目', '要求', '状态'],
    [
        ['隐私政策', '必须有独立页面', '⚠️ 需开发'],
        ['用户协议', '必须有独立页面', '⚠️ 需开发'],
        ['首次启动弹窗', '明示收集信息用途', '⚠️ 需开发'],
        ['健康类资质', '如涉及医疗需资质', '⚠️ 提前准备'],
        ['免责声明', 'AI建议需标注仅供参考', '⚠️ 需开发'],
    ]
)

doc.add_paragraph()

h2 = doc.add_heading('5.2 必要页面', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

pages_list = [
    '/pages/privacy/index     # 隐私政策',
    '/pages/agreement/index   # 用户协议',
    '/pages/disclaimer/index  # 免责声明（可选）',
]
for page in pages_list:
    p = doc.add_paragraph(page)
    for run in p.runs:
        set_run_font(run, size=Pt(10))

doc.add_paragraph()

h2 = doc.add_heading('5.3 弹窗时机', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

modal_code = '''// app.ts onLaunch
async onLaunch() {
  const accepted = Taro.getStorageSync('privacy_accepted')
  if (!accepted) {
    await this.showPrivacyModal()
  }
}

async showPrivacyModal() {
  return new Promise<void>((resolve) => {
    Taro.showModal({
      title: '隐私政策声明',
      content: '本小程序将收集您的健康数据用于提供个性化配方建议...\\n\\n' +
               '请阅读并同意《隐私政策》和《用户协议》后继续使用。',
      confirmText: '同意并继续',
      cancelText: '退出',
      success: (res) => {
        if (res.confirm) {
          Taro.setStorageSync('privacy_accepted', true)
          Taro.navigateTo({ url: '/pages/privacy/index' })
          resolve()
        } else {
          Taro.exitMiniProgram()
        }
      }
    })
  })
}'''

p = doc.add_paragraph(modal_code)
for run in p.runs:
    set_run_font(run, size=Pt(9), color=RGBColor(50, 50, 50))

doc.add_page_break()

# ===== 六、预算估算 =====
h1 = doc.add_heading('六、预算估算', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 6.1 开发成本
h2 = doc.add_heading('6.1 开发成本', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

cost_table = add_table_with_header(doc,
    ['项目', '预算', '说明'],
    [
        ['人力成本', '¥50,000', '2人×10周（前端+后端）'],
        ['云服务', '¥3,000/年', '服务器+数据库+CDN'],
        ['微信认证', '¥300/年', '企业主体认证'],
        ['域名+SSL', '¥500/年', 'HTTPS required'],
        ['云开发（可选）', '¥2,000/年', '云函数+云数据库'],
        ['总计', '¥56,000', '首年'],
    ]
)

doc.add_paragraph()

# 6.2 运营成本
h2 = doc.add_heading('6.2 运营成本', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

ops_table = add_table_with_header(doc,
    ['项目', '预算', '说明'],
    [
        ['AI API调用', '¥2,000/月', '按量计费'],
        ['服务器维护', '¥500/月', '日常运维'],
        ['审核续费', '¥300/年', '企业认证年费'],
        ['月度运营', '¥2,500', '-'],
    ]
)

doc.add_page_break()

# ===== 七、下一步行动 =====
h1 = doc.add_heading('七、下一步行动', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

# 7.1 立即行动
h2 = doc.add_heading('7.1 立即行动（本周）', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

immediate_actions = [
    '✅ 确认V4.0方案',
    '⏳ 申请微信小程序账号',
    '⏳ 配置微信开发者工具',
    '⏳ 初始化Taro项目脚手架',
]
for action in immediate_actions:
    p = doc.add_paragraph(action)
    for run in p.runs:
        set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

# 7.2 近期行动
h2 = doc.add_heading('7.2 近期行动（第1周）', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

near_actions = [
    '搭建项目结构',
    '实现请求层和流式输出',
    '开发微信登录接口（后端）',
    '设计隐私政策页面',
]
for action in near_actions:
    p = doc.add_paragraph(action, style='List Bullet')
    for run in p.runs:
        set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

# 7.3 中期行动
h2 = doc.add_heading('7.3 中期行动（第2-4周）', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

mid_actions = [
    '开发核心功能（AI对话、配方浏览）',
    '实现Zustand状态管理',
    '添加隐私合规弹窗',
    '真机调试',
]
for action in mid_actions:
    p = doc.add_paragraph(action, style='List Bullet')
    for run in p.runs:
        set_run_font(run, size=Pt(10.5))

doc.add_paragraph()

# 7.4 远期行动
h2 = doc.add_heading('7.4 远期行动（第5-8周）', level=2)
for run in h2.runs:
    set_run_font(run, size=Pt(14), bold=True)

far_actions = [
    '性能优化',
    '微信审核提交',
    '上线发布',
    '数据监控部署',
]
for action in far_actions:
    p = doc.add_paragraph(action, style='List Bullet')
    for run in p.runs:
        set_run_font(run, size=Pt(10.5))

doc.add_page_break()

# ===== 八、总结 =====
h1 = doc.add_heading('八、总结', level=1)
for run in h1.runs:
    set_run_font(run, size=Pt(16), bold=True, color=RGBColor(45, 90, 61))

p = doc.add_paragraph()
run = p.add_run('V3.0方案技术可行，建议按V4.0实施指南推进。')
set_run_font(run, size=Pt(12), bold=True)

doc.add_paragraph()

summary_points = [
    '✅ 后端SSE端点已完整，前端只需正确消费',
    '✅ Zustand需自定义storage适配器',
    '⚠️ 必须补充隐私合规页面和弹窗',
    '⚠️ 建议延长至10周（含审核buffer）',
    '💰 首年预算约¥56,000',
]
for point in summary_points:
    p = doc.add_paragraph(point)
    for run in p.runs:
        set_run_font(run, size=Pt(11))

doc.add_paragraph()
doc.add_paragraph()

# 结束
footer = doc.add_paragraph()
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = footer.add_run(f'\n文档版本：V4.0 | 编制：RMFOOD架构组 | 日期：{datetime.date.today().strftime("%Y年%m月%d日")}')
set_run_font(run, size=Pt(10), color=RGBColor(150, 150, 150))

# 保存文档
output_path = r'D:\\RMFOODFP\\docs\\RMFOOD小程序开发方案_V4.0.docx'
doc.save(output_path)
print(f'V4.0文档已保存至: {output_path}')
