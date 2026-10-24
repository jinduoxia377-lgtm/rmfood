import { describe, it, expect } from 'vitest'
import i18n from '../../../../../i18n'

describe('i18n AI 模块合并', () => {
  it('resolves ai.synergy.synergyTab.title', () => {
    expect(i18n.t('ai.synergy.synergyTab.title')).toBe('协同作用分析')
  })

  it('resolves ai.formula.generateTab.loading', () => {
    const v = i18n.t('ai.formula.generateTab.loading')
    expect(v).not.toContain('ai.formula')
  })

  it('resolves ai.chat.chatTab.title', () => {
    expect(i18n.t('ai.chat.chatTab.title')).toBe('智能对话')
  })

  it('resolves ai.safety tab keys', () => {
    expect(i18n.t('ai.synergy.synergyTab.analyze')).toBe('分析')
  })

  it('supports German (de-DE) resources after language switch', async () => {
    await i18n.changeLanguage('de-DE')
    expect(i18n.t('ai.chat.chatTab.title')).toBe('Intelligenter Chat')
    expect(i18n.t('ai.formula.title')).toBe('Intelligente Formelgenerierung')
    expect(i18n.t('ai.synergy.synergyTab.analyze')).toBe('Analysieren')

    // 切回默认中文，避免影响后续测试
    await i18n.changeLanguage('zh-CN')
  })

  it('provides nav and dashboard translations in all languages', async () => {
    // 中文
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('nav.items.dashboard')).toBe('系统概览')
    expect(i18n.t('nav.groups.core')).toBe('核心工作')
    expect(i18n.t('pages.dashboard.welcomeBack')).toBe('欢迎回来')
    expect(i18n.t('common.statusLabels.approved')).toBe('已通过')

    // 英文
    await i18n.changeLanguage('en-US')
    expect(i18n.t('nav.items.dashboard')).toBe('Overview')
    expect(i18n.t('pages.dashboard.welcomeBack')).toBe('Welcome back')
    expect(i18n.t('common.statusLabels.approved')).toBe('Approved')

    // 德语
    await i18n.changeLanguage('de-DE')
    expect(i18n.t('nav.items.dashboard')).toBe('Übersicht')
    expect(i18n.t('pages.dashboard.welcomeBack')).toBe('Willkommen zurück')
    expect(i18n.t('pages.dashboard.cards.statsFormulas')).toBe('Formeln gesamt')
    expect(i18n.t('common.statusLabels.approved')).toBe('Genehmigt')

    // 切回默认中文
    await i18n.changeLanguage('zh-CN')
  })

  it('provides formula module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.formula.title')).toBe('配方管理')
    expect(i18n.t('pages.formula.newFormula')).toBe('新建配方')
    expect(i18n.t('pages.formula.exportCsv.code')).toBe('编号')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.formula.title')).toBe('Formula Management')
    expect(i18n.t('pages.formula.newFormula')).toBe('New Formula')
    expect(i18n.t('pages.formula.exportCsv.code')).toBe('Code')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.formula.title')).toBe('Formelverwaltung')
    expect(i18n.t('pages.formula.newFormula')).toBe('Neue Formel')
    expect(i18n.t('pages.formula.pendingReview')).toBe('In Prüfung')
    expect(i18n.t('pages.formula.exportCsv.code')).toBe('Code')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides batch module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.batch.title')).toBe('批记录管理')
    expect(i18n.t('pages.batch.newBatch')).toBe('新建批记录')
    expect(i18n.t('common.statusLabels.closed')).toBe('已关闭')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.batch.title')).toBe('Batch Management')
    expect(i18n.t('pages.batch.newBatch')).toBe('New Batch Record')
    expect(i18n.t('common.statusLabels.closed')).toBe('Closed')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.batch.title')).toBe('Chargenverwaltung')
    expect(i18n.t('pages.batch.newBatch')).toBe('Neues Chargenprotokoll')
    expect(i18n.t('common.statusLabels.closed')).toBe('Geschlossen')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides experiment module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.experiment.title')).toBe('实验管理')
    expect(i18n.t('pages.experiment.newExperiment')).toBe('新建实验')
    expect(i18n.t('pages.experiment.columnStatus')).toBe('状态')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.experiment.title')).toBe('Experiment Management')
    expect(i18n.t('pages.experiment.newExperiment')).toBe('New Experiment')
    expect(i18n.t('pages.experiment.columnStatus')).toBe('Status')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.experiment.title')).toBe('Experimentverwaltung')
    expect(i18n.t('pages.experiment.newExperiment')).toBe('Neues Experiment')
    expect(i18n.t('pages.experiment.columnStatus')).toBe('Status')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides stability module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.stability.title')).toBe('稳定性分析')
    expect(i18n.t('pages.stability.runStabilityPrediction')).toBe('运行稳定性预测')
    expect(i18n.t('pages.stability.q10Interpretation.high')).toBe('高度敏感，建议冷链运输')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.stability.title')).toBe('Stability Analysis')
    expect(i18n.t('pages.stability.runStabilityPrediction')).toBe('Run Stability Prediction')
    expect(i18n.t('pages.stability.q10Interpretation.high')).toBe('Highly sensitive, cold-chain transport recommended')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.stability.title')).toBe('Stabilitätsanalyse')
    expect(i18n.t('pages.stability.runStabilityPrediction')).toBe('Stabilitätsprognose ausführen')
    expect(i18n.t('pages.stability.q10Interpretation.high')).toBe('Stark empfindlich, Kühlkette empfohlen')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides document extraction module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.document.title')).toBe('文档智能提取')
    expect(i18n.t('pages.document.startExtract')).toBe('开始提取')
    expect(i18n.t('pages.document.coaType')).toBe('CoA 检验报告')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.document.title')).toBe('Document Extraction')
    expect(i18n.t('pages.document.startExtract')).toBe('Start Extraction')
    expect(i18n.t('pages.document.coaType')).toBe('CoA Certificate')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.document.title')).toBe('Dokumentextraktion')
    expect(i18n.t('pages.document.startExtract')).toBe('Extraktion starten')
    expect(i18n.t('pages.document.coaType')).toBe('CoA-Zertifikat')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides doe module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.doe.title')).toBe('DOE 实验设计')
    expect(i18n.t('pages.doe.tabDesign')).toBe('实验设计')
    expect(i18n.t('pages.doe.generateCCD')).toBe('生成 CCD 设计')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.doe.title')).toBe('DOE Experiment Design')
    expect(i18n.t('pages.doe.tabDesign')).toBe('Design')
    expect(i18n.t('pages.doe.generateCCD')).toBe('Generate CCD Design')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.doe.title')).toBe('DOE Versuchsplanung')
    expect(i18n.t('pages.doe.tabDesign')).toBe('Design')
    expect(i18n.t('pages.doe.generateCCD')).toBe('CCD-Design erzeugen')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides compliance module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.compliance.title')).toBe('合规检查')
    expect(i18n.t('pages.compliance.runCheck')).toBe('执行合规检查')
    expect(i18n.t('pages.compliance.tabProhibited')).toBe('禁忌组合')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.compliance.title')).toBe('Compliance Check')
    expect(i18n.t('pages.compliance.runCheck')).toBe('Run Compliance Check')
    expect(i18n.t('pages.compliance.tabProhibited')).toBe('Prohibited Combinations')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.compliance.title')).toBe('Compliance-Prüfung')
    expect(i18n.t('pages.compliance.runCheck')).toBe('Compliance-Prüfung ausführen')
    expect(i18n.t('pages.compliance.tabProhibited')).toBe('Verbotene Kombinationen')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides label check module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.labelCheck.title')).toBe('配料表核查')
    expect(i18n.t('pages.labelCheck.startCheck')).toBe('开始核查')
    expect(i18n.t('pages.labelCheck.categoryFoodHomology')).toBe('药食同源')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.labelCheck.title')).toBe('Label Check')
    expect(i18n.t('pages.labelCheck.startCheck')).toBe('Start Check')
    expect(i18n.t('pages.labelCheck.categoryFoodHomology')).toBe('Food Homology')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.labelCheck.title')).toBe('Zutatenliste-Prüfung')
    expect(i18n.t('pages.labelCheck.startCheck')).toBe('Prüfung starten')
    expect(i18n.t('pages.labelCheck.categoryFoodHomology')).toBe('Lebensmittel-Homologie')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides ingredient analysis module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.ingredient.title')).toBe('配料六维分析')
    expect(i18n.t('pages.ingredient.runAnalyze')).toBe('执行六维分析')
    expect(i18n.t('pages.ingredient.radarDimensions.safety')).toBe('安全性')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.ingredient.title')).toBe('Ingredient Analysis')
    expect(i18n.t('pages.ingredient.runAnalyze')).toBe('Run Analysis')
    expect(i18n.t('pages.ingredient.radarDimensions.safety')).toBe('Safety')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.ingredient.title')).toBe('Inhaltsstoffanalyse')
    expect(i18n.t('pages.ingredient.runAnalyze')).toBe('Analyse ausführen')
    expect(i18n.t('pages.ingredient.radarDimensions.safety')).toBe('Sicherheit')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides label generator module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.label.title')).toBe('标签生成器')
    expect(i18n.t('pages.label.generateLabel')).toBe('生成标签')
    expect(i18n.t('pages.label.entityTypes.batch')).toBe('批记录')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.label.title')).toBe('Label Generator')
    expect(i18n.t('pages.label.generateLabel')).toBe('Generate Label')
    expect(i18n.t('pages.label.entityTypes.batch')).toBe('Batch')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.label.title')).toBe('Etikettengenerator')
    expect(i18n.t('pages.label.generateLabel')).toBe('Etikett erzeugen')
    expect(i18n.t('pages.label.entityTypes.batch')).toBe('Charge')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides agent module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.agent.title')).toBe('智能体协作中心')
    expect(i18n.t('pages.agent.navBots')).toBe('智能体')
    expect(i18n.t('pages.agent.backToList')).toBe('返回列表')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.agent.title')).toBe('Agent Collaboration Center')
    expect(i18n.t('pages.agent.navBots')).toBe('Agents')
    expect(i18n.t('pages.agent.backToList')).toBe('Back to list')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.agent.title')).toBe('Agenten-Kollaborationszentrum')
    expect(i18n.t('pages.agent.navBots')).toBe('Agenten')
    expect(i18n.t('pages.agent.backToList')).toBe('Zurück zur Liste')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides peptide structure module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.peptide.title')).toBe('肽序列结构与活性预测分析')
    expect(i18n.t('pages.peptide.startAnalyze')).toBe('开始分析')
    expect(i18n.t('pages.peptide.featureDeep')).toBe('深度分析')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.peptide.title')).toBe('Peptide Sequence Structure & Activity Prediction')
    expect(i18n.t('pages.peptide.startAnalyze')).toBe('Start Analysis')
    expect(i18n.t('pages.peptide.featureDeep')).toBe('Deep Analysis')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.peptide.title')).toBe('Peptidsequenz-Struktur & Aktivitätsprognose')
    expect(i18n.t('pages.peptide.startAnalyze')).toBe('Analyse starten')
    expect(i18n.t('pages.peptide.featureDeep')).toBe('Tiefenanalyse')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides academic report module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.academic.title')).toBe('学术报告管理')
    expect(i18n.t('pages.academic.newReport')).toBe('新建报告')
    expect(i18n.t('pages.academic.statusPublished')).toBe('已发布')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.academic.title')).toBe('Academic Report Management')
    expect(i18n.t('pages.academic.newReport')).toBe('New Report')
    expect(i18n.t('pages.academic.statusPublished')).toBe('Published')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.academic.title')).toBe('Akademische Berichtsverwaltung')
    expect(i18n.t('pages.academic.newReport')).toBe('Neuer Bericht')
    expect(i18n.t('pages.academic.statusPublished')).toBe('Veröffentlicht')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides workflow module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.workflow.title')).toBe('工作流管理')
    expect(i18n.t('pages.workflow.createWorkflow')).toBe('创建工作流')
    expect(i18n.t('pages.workflow.taskTypeLabels.approve')).toBe('批准')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.workflow.title')).toBe('Workflow Management')
    expect(i18n.t('pages.workflow.createWorkflow')).toBe('Create Workflow')
    expect(i18n.t('pages.workflow.taskTypeLabels.approve')).toBe('Approve')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.workflow.title')).toBe('Workflow-Verwaltung')
    expect(i18n.t('pages.workflow.createWorkflow')).toBe('Workflow erstellen')
    expect(i18n.t('pages.workflow.taskTypeLabels.approve')).toBe('Genehmigen')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides regulations module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.regulations.title')).toBe('法规库')
    expect(i18n.t('pages.regulations.tabStandards')).toBe('国家标准目录')
    expect(i18n.t('pages.regulations.statusCompliant')).toBe('合规')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.regulations.title')).toBe('Regulations')
    expect(i18n.t('pages.regulations.tabStandards')).toBe('National Standards')
    expect(i18n.t('pages.regulations.statusCompliant')).toBe('Compliant')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.regulations.title')).toBe('Vorschriften')
    expect(i18n.t('pages.regulations.tabStandards')).toBe('Nationale Standards')
    expect(i18n.t('pages.regulations.statusCompliant')).toBe('Konform')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides terminology module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.terminology.title')).toBe('术语库')
    expect(i18n.t('pages.terminology.tabTerms')).toBe('术语管理')
    expect(i18n.t('pages.terminology.statTotalTerms')).toBe('术语总数')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.terminology.title')).toBe('Terminology')
    expect(i18n.t('pages.terminology.tabTerms')).toBe('Terms')
    expect(i18n.t('pages.terminology.statTotalTerms')).toBe('Total Terms')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.terminology.title')).toBe('Terminologie')
    expect(i18n.t('pages.terminology.tabTerms')).toBe('Begriffe')
    expect(i18n.t('pages.terminology.statTotalTerms')).toBe('Begriffe gesamt')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides database module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.database.title')).toBe('数据库检索中心')
    expect(i18n.t('pages.database.tabHerbs')).toBe('中药材')
    expect(i18n.t('pages.database.statHerbs')).toBe('中药材')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.database.title')).toBe('Database Search Center')
    expect(i18n.t('pages.database.tabHerbs')).toBe('Herbs')
    expect(i18n.t('pages.database.statHerbs')).toBe('Herbs')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.database.title')).toBe('Datenbanksuchzentrum')
    expect(i18n.t('pages.database.tabHerbs')).toBe('Kräuter')
    expect(i18n.t('pages.database.statHerbs')).toBe('Kräuter')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides analytics module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.analytics.title')).toBe('数据分析中心')
    expect(i18n.t('pages.analytics.tabOverview')).toBe('概览')
    expect(i18n.t('pages.analytics.statTotalFormulas')).toBe('配方总数')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.analytics.title')).toBe('Analytics Center')
    expect(i18n.t('pages.analytics.tabOverview')).toBe('Overview')
    expect(i18n.t('pages.analytics.statTotalFormulas')).toBe('Total Formulas')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.analytics.title')).toBe('Analytics-Zentrum')
    expect(i18n.t('pages.analytics.tabOverview')).toBe('Übersicht')
    expect(i18n.t('pages.analytics.statTotalFormulas')).toBe('Formeln gesamt')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides integrations module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.integrations.title')).toBe('集成与 API')
    expect(i18n.t('pages.integrations.tabApiKeys')).toBe('API 密钥')
    expect(i18n.t('pages.integrations.connected')).toBe('已连接')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.integrations.title')).toBe('Integrations & API')
    expect(i18n.t('pages.integrations.tabApiKeys')).toBe('API Keys')
    expect(i18n.t('pages.integrations.connected')).toBe('Connected')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.integrations.title')).toBe('Integrationen & API')
    expect(i18n.t('pages.integrations.tabApiKeys')).toBe('API-Schlüssel')
    expect(i18n.t('pages.integrations.connected')).toBe('Verbunden')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides notification module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.notification.title')).toBe('通知中心')
    expect(i18n.t('pages.notification.markAllRead')).toBe('全部已读')
    expect(i18n.t('pages.notification.typeReview')).toBe('审核')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.notification.title')).toBe('Notification Center')
    expect(i18n.t('pages.notification.markAllRead')).toBe('Mark All Read')
    expect(i18n.t('pages.notification.typeReview')).toBe('Review')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.notification.title')).toBe('Benachrichtigungszentrum')
    expect(i18n.t('pages.notification.markAllRead')).toBe('Alle als gelesen markieren')
    expect(i18n.t('pages.notification.typeReview')).toBe('Prüfung')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides audit log module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.auditLog.title')).toBe('审计日志')
    expect(i18n.t('pages.auditLog.actionCreate')).toBe('创建')
    expect(i18n.t('pages.auditLog.thTime')).toBe('时间')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.auditLog.title')).toBe('Audit Log')
    expect(i18n.t('pages.auditLog.actionCreate')).toBe('Create')
    expect(i18n.t('pages.auditLog.thTime')).toBe('Time')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.auditLog.title')).toBe('Auditprotokoll')
    expect(i18n.t('pages.auditLog.actionCreate')).toBe('Erstellen')
    expect(i18n.t('pages.auditLog.thTime')).toBe('Zeit')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides organizations module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.organizations.title')).toBe('组织管理')
    expect(i18n.t('pages.organizations.tabOverview')).toBe('概览')
    expect(i18n.t('pages.organizations.planFree')).toBe('免费版')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.organizations.title')).toBe('Organization Management')
    expect(i18n.t('pages.organizations.tabOverview')).toBe('Overview')
    expect(i18n.t('pages.organizations.planFree')).toBe('Free')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.organizations.title')).toBe('Organisationsverwaltung')
    expect(i18n.t('pages.organizations.tabOverview')).toBe('Übersicht')
    expect(i18n.t('pages.organizations.planFree')).toBe('Kostenlos')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides user management module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.userManagement.title')).toBe('用户管理')
    expect(i18n.t('pages.userManagement.newUser')).toBe('新增用户')
    expect(i18n.t('pages.userManagement.thUsername')).toBe('用户名')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.userManagement.title')).toBe('User Management')
    expect(i18n.t('pages.userManagement.newUser')).toBe('New User')
    expect(i18n.t('pages.userManagement.thUsername')).toBe('Username')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.userManagement.title')).toBe('Benutzerverwaltung')
    expect(i18n.t('pages.userManagement.newUser')).toBe('Neuer Benutzer')
    expect(i18n.t('pages.userManagement.thUsername')).toBe('Benutzername')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides settings module translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.settings.title')).toBe('系统设置')
    expect(i18n.t('pages.settings.tabLocale')).toBe('语言')
    expect(i18n.t('pages.settings.changePassword')).toBe('修改密码')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.settings.title')).toBe('System Settings')
    expect(i18n.t('pages.settings.tabLocale')).toBe('Language')
    expect(i18n.t('pages.settings.changePassword')).toBe('Change Password')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.settings.title')).toBe('Systemeinstellungen')
    expect(i18n.t('pages.settings.tabLocale')).toBe('Sprache')
    expect(i18n.t('pages.settings.changePassword')).toBe('Passwort ändern')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides AI assistant page shell translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('ai.page.pageTitle')).toBe('AI 智能助手中心')
    expect(i18n.t('ai.page.searchPlaceholder')).toBe('搜索配方、药材、分析工具…')
    expect(i18n.t('ai.page.panelChat')).toBe('智能对话 面板')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('ai.page.pageTitle')).toBe('AI Assistant Center')
    expect(i18n.t('ai.page.searchPlaceholder')).toBe('Search formulas, herbs, analysis tools…')
    expect(i18n.t('ai.page.panelChat')).toBe('Smart chat panel')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('ai.page.pageTitle')).toBe('KI-Assistentenzentrum')
    expect(i18n.t('ai.page.searchPlaceholder')).toBe('Formeln, Kräuter, Analysetools suchen…')
    expect(i18n.t('ai.page.panelChat')).toBe('Intelligenter Chat-Bereich')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides experiment sub-page translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.experimentForm.titleNew')).toBe('新建实验')
    expect(i18n.t('pages.experimentForm.typeStability')).toBe('稳定性实验')
    expect(i18n.t('pages.experimentCalendar.title')).toBe('实验日历')
    expect(i18n.t('pages.experimentShare.publicShare')).toBe('公开分享')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.experimentForm.titleNew')).toBe('New Experiment')
    expect(i18n.t('pages.experimentForm.typeStability')).toBe('Stability Test')
    expect(i18n.t('pages.experimentCalendar.title')).toBe('Experiment Calendar')
    expect(i18n.t('pages.experimentShare.publicShare')).toBe('Public Share')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.experimentForm.titleNew')).toBe('Neues Experiment')
    expect(i18n.t('pages.experimentForm.typeStability')).toBe('Stabilitätstest')
    expect(i18n.t('pages.experimentCalendar.title')).toBe('Experimentkalender')
    expect(i18n.t('pages.experimentShare.publicShare')).toBe('Öffentliche Freigabe')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides experiment detail translations in all languages', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('pages.experimentDetail.startExperiment')).toBe('开始实验')
    expect(i18n.t('pages.experimentDetail.experimentData')).toBe('实验数据')
    expect(i18n.t('pages.experimentDetail.timelinePlanned')).toBe('计划中')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('pages.experimentDetail.startExperiment')).toBe('Start Experiment')
    expect(i18n.t('pages.experimentDetail.experimentData')).toBe('Experiment Data')
    expect(i18n.t('pages.experimentDetail.timelinePlanned')).toBe('Planned')

    await i18n.changeLanguage('de-DE')
    expect(i18n.t('pages.experimentDetail.startExperiment')).toBe('Experiment starten')
    expect(i18n.t('pages.experimentDetail.experimentData')).toBe('Experimentdaten')
    expect(i18n.t('pages.experimentDetail.timelinePlanned')).toBe('Geplant')

    await i18n.changeLanguage('zh-CN')
  })

  it('provides AI page feature-area and chat chrome translations in all languages', async () => {
    // 中文
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('ai.page.tabs.chat')).toBe('智能对话')
    expect(i18n.t('ai.page.tabGroups.core')).toBe('核心功能')
    expect(i18n.t('ai.page.modelStatus.online')).toBe('模型在线')
    expect(i18n.t('ai.page.stats.chatSubtitle', { count: 319 })).toBe('累计 319 次对话')
    expect(i18n.t('ai.chat.topbar.scenarioAcademician')).toBe('学者顾问')
    expect(i18n.t('ai.chat.quick.categories.herbKnowledge')).toBe('药材知识')
    expect(i18n.t('ai.chat.input.hint')).toBe('Enter 发送 · Shift+Enter 换行 · Esc 清空 · 拖拽图片上传')

    // 英文
    await i18n.changeLanguage('en-US')
    expect(i18n.t('ai.page.tabs.chat')).toBe('Smart Chat')
    expect(i18n.t('ai.page.tabGroups.core')).toBe('Core Features')
    expect(i18n.t('ai.page.modelStatus.online')).toBe('Model Online')
    expect(i18n.t('ai.page.stats.chatSubtitle', { count: 319 })).toBe('319 total conversations')
    expect(i18n.t('ai.chat.topbar.scenarioAcademician')).toBe('Academic Advisor')
    expect(i18n.t('ai.chat.quick.categories.herbKnowledge')).toBe('Herb Knowledge')
    expect(i18n.t('ai.chat.input.hint')).toBe('Enter to send · Shift+Enter for newline · Esc to clear · Drag & drop image upload')

    // 德语
    await i18n.changeLanguage('de-DE')
    expect(i18n.t('ai.page.tabs.chat')).toBe('Intelligenter Chat')
    expect(i18n.t('ai.page.tabGroups.core')).toBe('Kernfunktionen')
    expect(i18n.t('ai.page.modelStatus.online')).toBe('Modell online')
    expect(i18n.t('ai.page.stats.chatSubtitle', { count: 319 })).toBe('319 Gespräche insgesamt')
    expect(i18n.t('ai.chat.topbar.scenarioAcademician')).toBe('Akademischer Berater')
    expect(i18n.t('ai.chat.quick.categories.herbKnowledge')).toBe('Kräuterwissen')

    // 切回默认中文
    await i18n.changeLanguage('zh-CN')
  })
})