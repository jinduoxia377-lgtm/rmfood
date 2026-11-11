/**
 * 中文「配料表核查」模块翻译 — v2
 *
 * 命名与契约 `docs/label-check-v2-contract.md` 第五节一致，统一挂在 pages.labelCheck.* 下。
 * 合规红线：文案不出现绝对化合规判定 / 安全定级 / 功效声称；risk_score 仅称「目录比对提示分」。
 */
export default {
  labelCheck: {
    // 基础 / 输入
    title: '配料表核查',
    subtitle: '粘贴或扫描配料表文本，基于药食同源目录 / GB 2760 / GB 14880 等公开标准做信息比对',
    inputTitle: '输入配料表',
    placeholder: '例如：\n配料：水、白砂糖、植脂末（葡萄糖浆、氢化植物油）、山梨酸钾、小麦粉',
    startCheck: '开始核查',
    uploadImage: '上传图片识别',
    uploadAria: '上传配料表图片',
    clear: '清空',
    ocrText: 'OCR 识别文本：',

    // 结果 / 摘要
    resultTitle: '核查结果',
    reportId: '报告编号：{{id}}',

    // 分类
    categoryFoodHomology: '药食同源',
    categoryNewFood: '新食品原料',
    categoryAdditive: '添加剂',
    categoryOrdinary: '常规原料',
    categoryEnricher: '营养强化',
    categoryProhibited: '禁用/风险',
    categoryUnknown: '未收录',

    // 成分明细
    ingredientDetails: '成分明细',
    allergen: '过敏原：{{group}}',
    compound: '复合配料',
    levelInfo: '提示',
    levelNote: '注意',
    levelWarning: '警示',
    detailRawName: '原始片段',
    detailMatchMethod: '匹配方式',
    detailConfidence: '置信度',
    detailAliases: '别名链',
    detailCaution: '人群禁忌',
    detailMaxDosage: '每日限量',
    detailFunction: '功能',
    detailMaxUsage: '最大使用量',
    detailSource: '来源法规',
    detailRiskContribution: '提示分贡献',
    detailSubIngredients: '子成分',

    // M3 风险看板（中性措辞，非安全定级）
    riskBoardTitle: '目录比对看板',
    riskScore: '目录比对提示分',
    riskScoreLabel: '目录比对提示分',
    riskNote: '内部参考，非安全评分；结果不构成合规结论',
    riskUnavailable: '提示分暂不可用',
    needsReviewCount: '需人工核实项：{{count}}',
    needsReviewNote: '未收录或需注意成分，建议人工复核',
    categoryDistTitle: '分类分布',
    allergenGroupTitle: '致敏分组',
    allergenNone: '未识别到致敏物质',
    allergenNote: '建议标示（GB 7718 附录 B 推荐性），非强制',
    noData: '暂无数据',
    statsTotal: '识别成分',
    statsMatched: '命中目录',
    statsUnmatched: '未收录',
    statsCompound: '复合配料展开',

    // M1 解析告警
    parseWarnings: '解析告警',

    // M5 历史记录（仅本地）
    historyTitle: '历史记录',
    historyToggle: '历史记录',
    historyEmpty: '暂无本地历史记录',
    historyRecheck: '复查',
    historyDelete: '删除',
    historyClear: '清空',
    historyTypeText: '文本',
    historyTypeOcr: 'OCR',
    historyPrivacy: '仅保存在本地浏览器，不上传服务器',

    // M6 导出
    exportTitle: '导出报告',
    exportMarkdown: 'Markdown',
    exportJson: 'JSON',

    // M7 示例模板
    templatesTitle: '示例模板',
    templatesEmpty: '暂无示例模板',
    templatesError: '模板加载失败',
    toastTemplatePicked: '已填入示例模板',

    // M8 过滤/搜索
    filterCategory: '分类',
    filterLevel: '级别',
    filterAllergen: '致敏',
    filterAll: '全部',
    filterAllergenYes: '含致敏',
    filterAllergenNo: '不含致敏',
    filterReset: '重置',
    filterShowing: '显示 {{shown}} / {{total}} 项',
    searchPlaceholder: '搜索成分名 / 别名 / 说明',
    filterEmpty: '没有符合筛选条件的成分',

    // 合规免责（始终展示）
    disclaimerFallback: '本结果仅为基于公开目录的信息比对参考，不构成食品安全合规结论、检验报告或法律意见。具体以国家最新发布的标准及官方解释为准。',

    // 提示
    toastInputRequired: '请输入配料表内容',
    toastRecognized: '已识别 {{count}} 项配料',
    toastFailed: '核查失败，请稍后重试',
    toastOcrSuccess: 'OCR 识别成功，共 {{count}} 项配料',
    toastOcrUnavailable: 'OCR 识别不可用，请粘贴文本',
  },
}
