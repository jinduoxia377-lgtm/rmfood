/**
 * 学术报告PDF导出服务 - 增强版
 * 支持将配方学术报告导出为PDF格式，解决中文乱码问题
 */
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { AICandidate } from '@/types'

export interface ReportExportOptions {
  filename?: string
  includeCharts?: boolean
  pageSize?: 'a4' | 'letter'
  orientation?: 'portrait' | 'landscape'
}

export interface ExportProgress {
  stage: 'preparing' | 'rendering' | 'generating' | 'complete' | 'error'
  message: string
  percent: number
}

interface RenderedReportData {
  candidate: AICandidate
  effects: string[]
}

class ReportExportService {
  /**
   * 创建PDF专用HTML模板
   */
  private createPrintableHTML(data: RenderedReportData): string {
    const { candidate, effects } = data
    const herbs = candidate.herb_combination || []
    const warnings = candidate.safety_details?.warnings || []
    const safetyScore = ((candidate as { safety_score?: number }).safety_score || (candidate.safety_passed ? 0.85 : 0.6)) * 100
    const tasteScore = ((candidate as { taste_score?: number }).taste_score || 0.6) * 100
    const stabilityScore = ((candidate as { stability_score?: number }).stability_score || 0.7) * 100
    const synergyScore = (candidate.synergy_score || 0) * 100
    const overallScore = (candidate.overall_score || 0) * 100

    const herbRows = herbs.map((herb, index) => `
      <tr style="background-color: ${index % 2 === 1 ? '#f9fafb' : '#ffffff'}">
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif;">${herb.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif;">${herb.role || '辅助'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif;">${(herb).dosage || '1.0-3.0g'}</td>
      </tr>
    `).join('')

    const effectBadges = effects.length > 0
      ? effects.map(e => `<span style="display: inline-block; padding: 4px 12px; background-color: #E8F4FD; color: #003E87; border-radius: 4px; margin: 2px; font-size: 12px; font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif;">${e}</span>`).join('')
      : '<span style="color: #9ca3af; font-family: \'Noto Sans SC\', \'Microsoft YaHei\', sans-serif;">暂无功效说明</span>'

    const warningItems = warnings.length > 0
      ? warnings.map((w: string) => `<li style="margin: 4px 0; font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif;">• ${w}</li>`).join('')
      : ''

    const safetyStatus = candidate.safety_passed
      ? `<span style="color: #16a34a; font-weight: bold; font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif;">✓ 安全评估通过 - 适合人群使用</span>`
      : `<span style="color: #B91C1C; font-weight: bold; font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif;">⚠ 需要关注的安全问题 - 建议在专业人员指导下使用</span>`

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>配方学术报告</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', sans-serif;
      color: #1f2937;
      background-color: #ffffff;
      font-size: 14px;
      line-height: 1.6;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
    }
    .header h1 {
      font-size: 28px;
      font-weight: 700;
      color: #007AFF;
      margin-bottom: 10px;
    }
    .header .subtitle {
      font-size: 12px;
      color: #6b7280;
    }
    .section {
      margin-bottom: 25px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    .score-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
    }
    .score-card {
      background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    .score-card.purple { background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%); }
    .score-card.yellow { background: linear-gradient(135deg, #fef9c3 0%, #fef08a 100%); }
    .score-card.blue { background: linear-gradient(135deg, #E8F4FD 0%, #D2EFFF 100%); }
    .score-card.green { background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); }
    .score-card .label {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 5px;
    }
    .score-card .value {
      font-size: 24px;
      font-weight: 700;
    }
    .score-card.purple .value { color: #9333ea; }
    .score-card.yellow .value { color: #ca8a04; }
    .score-card.blue .value { color: #007AFF; }
    .score-card.green .value { color: #16a34a; }
    .score-bar {
      width: 100%;
      height: 6px;
      background-color: rgba(0,0,0,0.1);
      border-radius: 3px;
      margin-top: 8px;
      overflow: hidden;
    }
    .score-bar-fill {
      height: 100%;
      border-radius: 3px;
    }
    .score-card.purple .score-bar-fill { background-color: #9333ea; }
    .score-card.yellow .score-bar-fill { background-color: #ca8a04; }
    .score-card.blue .score-bar-fill { background-color: #007AFF; }
    .score-card.green .score-bar-fill { background-color: #16a34a; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    thead {
      background-color: #f3f4f6;
    }
    th {
      padding: 10px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
    }
    .effects-container {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .safety-passed {
      background-color: #dcfce7;
      border: 1px solid #4ADE80;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 10px;
    }
    .safety-warning {
      background-color: #FFF3CD;
      border: 1px solid #FFB340;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 10px;
    }
    .conclusion-text {
      color: #4b5563;
      line-height: 1.8;
      margin-bottom: 10px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 11px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="container" id="report-content">
    <div class="header">
      <h1>${candidate.formula_name || '配方学术报告'}</h1>
      <p class="subtitle">生成时间: ${new Date().toLocaleString('zh-CN')}</p>
    </div>

    <div class="section">
      <h2 class="section-title">一、综合评分</h2>
      <div class="score-grid">
        <div class="score-card purple">
          <div class="label">协同作用</div>
          <div class="value">${synergyScore.toFixed(0)}</div>
          <div class="score-bar"><div class="score-bar-fill" style="width: ${synergyScore}%;"></div></div>
        </div>
        <div class="score-card yellow">
          <div class="label">口感风味</div>
          <div class="value">${tasteScore.toFixed(0)}</div>
          <div class="score-bar"><div class="score-bar-fill" style="width: ${tasteScore}%;"></div></div>
        </div>
        <div class="score-card blue">
          <div class="label">稳定性</div>
          <div class="value">${stabilityScore.toFixed(0)}</div>
          <div class="score-bar"><div class="score-bar-fill" style="width: ${stabilityScore}%;"></div></div>
        </div>
        <div class="score-card green">
          <div class="label">综合评分</div>
          <div class="value">${overallScore.toFixed(0)}</div>
          <div class="score-bar"><div class="score-bar-fill" style="width: ${overallScore}%;"></div></div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">二、配方组成</h2>
      <table>
        <thead>
          <tr>
            <th>成分名称</th>
            <th>角色</th>
            <th>用量</th>
          </tr>
        </thead>
        <tbody>
          ${herbRows}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2 class="section-title">三、功效说明</h2>
      <div class="effects-container">
        ${effectBadges}
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">四、安全性评估</h2>
      <div class="${candidate.safety_passed ? 'safety-passed' : 'safety-warning'}">
        ${safetyStatus}
      </div>
      ${warningItems ? `<div style="margin-top: 10px;"><strong style="color: #B45309;">注意事项：</strong><ul style="margin-left: 20px; color: #D97706;">${warningItems}</ul></div>` : ''}
    </div>

    <div class="section">
      <h2 class="section-title">五、结论与建议</h2>
      <p class="conclusion-text">
        本配方以中医药理论为指导，结合现代营养学研究成果，采用君臣佐使配伍原则，
        实现多成分、多靶点、多途径的协同增效作用。
      </p>
      <p class="conclusion-text">
        <strong>适宜人群：</strong>${effects.length > 0 ? effects.join('、') : '一般人群'}需求者，建议每日用量根据个体情况调整。
      </p>
      <p class="conclusion-text">
        <strong>建议服用周期：</strong>连续服用 4 周后休息 1 周，三个月为一个调理周期。
      </p>
    </div>

    <div class="footer">
      <p>本报告由 AI 配方生成系统自动生成，仅供参考。具体使用请遵医嘱或咨询专业人士。</p>
    </div>
  </div>
</body>
</html>
    `
  }

  /**
   * 导出学术报告为PDF（使用HTML渲染解决中文乱码）
   */
  async exportToPDF(
    candidate: AICandidate,
    effects: string[],
    options: ReportExportOptions = {},
    onProgress?: (progress: ExportProgress) => void,
  ): Promise<Blob> {
    const { filename = '配方学术报告.pdf' } = options

    try {
      onProgress?.({
        stage: 'preparing',
        message: '正在准备报告数据...',
        percent: 10,
      })

      // 1. 创建HTML模板
      const htmlContent = this.createPrintableHTML({ candidate, effects })

      onProgress?.({
        stage: 'rendering',
        message: '正在渲染报告内容...',
        percent: 30,
      })

      // 2. 创建隐藏的iframe来渲染HTML
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:absolute;width:800px;height:1200px;left:-9999px;top:-9999px;'
      document.body.appendChild(iframe)

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (!iframeDoc) {
        throw new Error('无法创建iframe文档')
      }

      iframeDoc.open()
      iframeDoc.write(htmlContent)
      iframeDoc.close()

      // 等待字体加载
      await new Promise(resolve => setTimeout(resolve, 500))

      // 3. 获取报告容器并渲染为canvas
      const reportElement = iframeDoc.getElementById('report-content')
      if (!reportElement) {
        throw new Error('无法获取报告内容元素')
      }

      onProgress?.({
        stage: 'generating',
        message: '正在生成PDF文件...',
        percent: 60,
      })

      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 800,
        height: reportElement.scrollHeight + 40,
      })

      // 清理iframe
      document.body.removeChild(iframe)

      onProgress?.({
        stage: 'generating',
        message: '正在处理PDF...',
        percent: 80,
      })

      // 4. 创建PDF并添加图片
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      // 如果内容超过一页，需要分页
      let heightLeft = imgHeight
      let position = 0

      const imgData = canvas.toDataURL('image/jpeg', 0.95)

      // 添加第一页
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      // 如果内容超过一页，添加更多页面
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      // 添加页脚
      const totalPages = pdf.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i)
        pdf.setFontSize(8)
        pdf.setTextColor(156, 163, 175)
        pdf.text(
          '本报告由 AI 配方生成系统自动生成，仅供参考。具体使用请遵医嘱或咨询专业人士。',
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' },
        )
        pdf.text(
          `第 ${i} 页 / 共 ${totalPages} 页`,
          pageWidth - 15,
          pageHeight - 8,
          { align: 'right' },
        )
      }

      onProgress?.({
        stage: 'complete',
        message: '导出完成！',
        percent: 100,
      })

      return new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' })
    } catch (error) {
      onProgress?.({
        stage: 'error',
        message: error instanceof Error ? error.message : '导出失败',
        percent: 0,
      })
      throw error
    }
  }

  /**
   * 下载PDF文件
   */
  downloadPDF(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

// 导出单例
export const reportExportService = new ReportExportService()
