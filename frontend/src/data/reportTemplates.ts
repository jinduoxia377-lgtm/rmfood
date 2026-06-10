/**
 * 学术报告模板预设数据
 */
import type { TemplatePreset, Chapter, CitationStyle } from '@/types/academicReport';

// 生成章节ID
const generateId = () => `ch-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

// 期刊论文模板
const journalTemplate: Chapter[] = [
 {
 id: generateId(),
 title: '摘要',
 content: '',
 level: 1,
 order: 1,
 },
 {
 id: generateId(),
 title: '关键词',
 content: '',
 level: 1,
 order: 2,
 },
 {
 id: generateId(),
 title: '1 引言',
 content: '',
 level: 1,
 order: 3,
 children: [
 { id: generateId(), title: '1.1 研究背景', content: '', level: 2, order: 1 },
 { id: generateId(), title: '1.2 研究目的', content: '', level: 2, order: 2 },
 { id: generateId(), title: '1.3 研究意义', content: '', level: 2, order: 3 },
 ],
 },
 {
 id: generateId(),
 title: '2 材料与方法',
 content: '',
 level: 1,
 order: 4,
 children: [
 { id: generateId(), title: '2.1 实验材料', content: '', level: 2, order: 1 },
 { id: generateId(), title: '2.2 实验方法', content: '', level: 2, order: 2 },
 { id: generateId(), title: '2.3 数据处理', content: '', level: 2, order: 3 },
 ],
 },
 {
 id: generateId(),
 title: '3 结果',
 content: '',
 level: 1,
 order: 5,
 children: [
 { id: generateId(), title: '3.1 实验结果', content: '', level: 2, order: 1 },
 { id: generateId(), title: '3.2 数据分析', content: '', level: 2, order: 2 },
 ],
 },
 {
 id: generateId(),
 title: '4 讨论',
 content: '',
 level: 1,
 order: 6,
 children: [
 { id: generateId(), title: '4.1 结果分析', content: '', level: 2, order: 1 },
 { id: generateId(), title: '4.2 与其他研究的比较', content: '', level: 2, order: 2 },
 { id: generateId(), title: '4.3 研究局限性', content: '', level: 2, order: 3 },
 ],
 },
 {
 id: generateId(),
 title: '5 结论',
 content: '',
 level: 1,
 order: 7,
 },
 {
 id: generateId(),
 title: '参考文献',
 content: '',
 level: 1,
 order: 8,
 },
];

// 学位论文模板
const thesisTemplate: Chapter[] = [
 {
 id: generateId(),
 title: '摘要',
 content: '',
 level: 1,
 order: 1,
 },
 {
 id: generateId(),
 title: 'ABSTRACT',
 content: '',
 level: 1,
 order: 2,
 },
 {
 id: generateId(),
 title: '关键词',
 content: '',
 level: 1,
 order: 3,
 },
 {
 id: generateId(),
 title: 'KEYWORDS',
 content: '',
 level: 1,
 order: 4,
 },
 {
 id: generateId(),
 title: '第一章 绪论',
 content: '',
 level: 1,
 order: 5,
 children: [
 { id: generateId(), title: '1.1 研究背景与意义', content: '', level: 2, order: 1 },
 { id: generateId(), title: '1.2 国内外研究现状', content: '', level: 2, order: 2 },
 { id: generateId(), title: '1.3 研究目标与内容', content: '', level: 2, order: 3 },
 { id: generateId(), title: '1.4 研究方法与技术路线', content: '', level: 2, order: 4 },
 ],
 },
 {
 id: generateId(),
 title: '第二章 理论基础与相关技术',
 content: '',
 level: 1,
 order: 6,
 children: [
 { id: generateId(), title: '2.1 相关理论基础', content: '', level: 2, order: 1 },
 { id: generateId(), title: '2.2 关键技术介绍', content: '', level: 2, order: 2 },
 { id: generateId(), title: '2.3 本章小结', content: '', level: 2, order: 3 },
 ],
 },
 {
 id: generateId(),
 title: '第三章 系统设计',
 content: '',
 level: 1,
 order: 7,
 children: [
 { id: generateId(), title: '3.1 需求分析', content: '', level: 2, order: 1 },
 { id: generateId(), title: '3.2 架构设计', content: '', level: 2, order: 2 },
 { id: generateId(), title: '3.3 数据库设计', content: '', level: 2, order: 3 },
 { id: generateId(), title: '3.4 关键模块设计', content: '', level: 2, order: 4 },
 { id: generateId(), title: '3.5 本章小结', content: '', level: 2, order: 5 },
 ],
 },
 {
 id: generateId(),
 title: '第四章 系统实现',
 content: '',
 level: 1,
 order: 8,
 children: [
 { id: generateId(), title: '4.1 开发环境与工具', content: '', level: 2, order: 1 },
 { id: generateId(), title: '核心模块实现', content: '', level: 2, order: 2 },
 { id: generateId(), title: '4.3 关键代码分析', content: '', level: 2, order: 3 },
 { id: generateId(), title: '4.4 本章小结', content: '', level: 2, order: 4 },
 ],
 },
 {
 id: generateId(),
 title: '第五章 系统测试与验证',
 content: '',
 level: 1,
 order: 9,
 children: [
 { id: generateId(), title: '5.1 测试环境与方法', content: '', level: 2, order: 1 },
 { id: generateId(), title: '5.2 功能测试', content: '', level: 2, order: 2 },
 { id: generateId(), title: '5.3 性能测试', content: '', level: 2, order: 3 },
 { id: generateId(), title: '5.4 测试结果分析', content: '', level: 2, order: 4 },
 { id: generateId(), title: '5.5 本章小结', content: '', level: 2, order: 5 },
 ],
 },
 {
 id: generateId(),
 title: '第六章 总结与展望',
 content: '',
 level: 1,
 order: 10,
 children: [
 { id: generateId(), title: '6.1 研究成果总结', content: '', level: 2, order: 1 },
 { id: generateId(), title: '6.2 研究创新点', content: '', level: 2, order: 2 },
 { id: generateId(), title: '6.3 研究不足与展望', content: '', level: 2, order: 3 },
 ],
 },
 {
 id: generateId(),
 title: '参考文献',
 content: '',
 level: 1,
 order: 11,
 },
 {
 id: generateId(),
 title: '附录',
 content: '',
 level: 1,
 order: 12,
 },
 {
 id: generateId(),
 title: '致谢',
 content: '',
 level: 1,
 order: 13,
 },
];

// 研究报告模板
const researchTemplate: Chapter[] = [
 {
 id: generateId(),
 title: '摘要',
 content: '',
 level: 1,
 order: 1,
 },
 {
 id: generateId(),
 title: '一、项目概况',
 content: '',
 level: 1,
 order: 2,
 children: [
 { id: generateId(), title: '1.1 项目背景', content: '', level: 2, order: 1 },
 { id: generateId(), title: '1.2 项目目标', content: '', level: 2, order: 2 },
 { id: generateId(), title: '1.3 项目范围', content: '', level: 2, order: 3 },
 ],
 },
 {
 id: generateId(),
 title: '二、研究方法',
 content: '',
 level: 1,
 order: 3,
 children: [
 { id: generateId(), title: '2.1 研究设计', content: '', level: 2, order: 1 },
 { id: generateId(), title: '2.2 数据采集', content: '', level: 2, order: 2 },
 { id: generateId(), title: '2.3 分析方法', content: '', level: 2, order: 3 },
 ],
 },
 {
 id: generateId(),
 title: '三、研究结果',
 content: '',
 level: 1,
 order: 4,
 children: [
 { id: generateId(), title: '3.1 主要发现', content: '', level: 2, order: 1 },
 { id: generateId(), title: '3.2 数据分析', content: '', level: 2, order: 2 },
 { id: generateId(), title: '3.3 关键指标', content: '', level: 2, order: 3 },
 ],
 },
 {
 id: generateId(),
 title: '四、讨论与结论',
 content: '',
 level: 1,
 order: 5,
 children: [
 { id: generateId(), title: '4.1 结果解读', content: '', level: 2, order: 1 },
 { id: generateId(), title: '4.2 研究结论', content: '', level: 2, order: 2 },
 { id: generateId(), title: '4.3 建议与措施', content: '', level: 2, order: 3 },
 ],
 },
 {
 id: generateId(),
 title: '五、参考文献',
 content: '',
 level: 1,
 order: 6,
 },
];

// 综述论文模板
const reviewTemplate: Chapter[] = [
 {
 id: generateId(),
 title: '摘要',
 content: '',
 level: 1,
 order: 1,
 },
 {
 id: generateId(),
 title: '关键词',
 content: '',
 level: 1,
 order: 2,
 },
 {
 id: generateId(),
 title: '1 引言',
 content: '',
 level: 1,
 order: 3,
 children: [
 { id: generateId(), title: '1.1 研究领域概述', content: '', level: 2, order: 1 },
 { id: generateId(), title: '1.2 综述目的与范围', content: '', level: 2, order: 2 },
 ],
 },
 {
 id: generateId(),
 title: '2 发展历程',
 content: '',
 level: 1,
 order: 4,
 children: [
 { id: generateId(), title: '2.1 早期研究阶段', content: '', level: 2, order: 1 },
 { id: generateId(), title: '2.2 中期发展阶段', content: '', level: 2, order: 2 },
 { id: generateId(), title: '2.3 当前研究现状', content: '', level: 2, order: 3 },
 ],
 },
 {
 id: generateId(),
 title: '3 研究热点与趋势',
 content: '',
 level: 1,
 order: 5,
 children: [
 { id: generateId(), title: '3.1 主要研究方向', content: '', level: 2, order: 1 },
 { id: generateId(), title: '3.2 关键技术突破', content: '', level: 2, order: 2 },
 { id: generateId(), title: '3.3 未来发展趋势', content: '', level: 2, order: 3 },
 ],
 },
 {
 id: generateId(),
 title: '4 存在问题与挑战',
 content: '',
 level: 1,
 order: 6,
 children: [
 { id: generateId(), title: '4.1 当前研究局限性', content: '', level: 2, order: 1 },
 { id: generateId(), title: '4.2 面临的主要挑战', content: '', level: 2, order: 2 },
 ],
 },
 {
 id: generateId(),
 title: '5 结论与展望',
 content: '',
 level: 1,
 order: 7,
 },
 {
 id: generateId(),
 title: '参考文献',
 content: '',
 level: 1,
 order: 8,
 },
];

// 技术报告模板
const technicalTemplate: Chapter[] = [
 {
 id: generateId(),
 title: '摘要',
 content: '',
 level: 1,
 order: 1,
 },
 {
 id: generateId(),
 title: '1 概述',
 content: '',
 level: 1,
 order: 2,
 children: [
 { id: generateId(), title: '1.1 项目背景', content: '', level: 2, order: 1 },
 { id: generateId(), title: '1.2 技术目标', content: '', level: 2, order: 2 },
 ],
 },
 {
 id: generateId(),
 title: '2 技术方案',
 content: '',
 level: 1,
 order: 3,
 children: [
 { id: generateId(), title: '2.1 总体架构', content: '', level: 2, order: 1 },
 { id: generateId(), title: '2.2 关键技术', content: '', level: 2, order: 2 },
 { id: generateId(), title: '2.3 技术选型', content: '', level: 2, order: 3 },
 ],
 },
 {
 id: generateId(),
 title: '3 实现细节',
 content: '',
 level: 1,
 order: 4,
 children: [
 { id: generateId(), title: '3.1 核心模块实现', content: '', level: 2, order: 1 },
 { id: generateId(), title: '3.2 关键代码说明', content: '', level: 2, order: 2 },
 { id: generateId(), title: '3.3 接口规范', content: '', level: 2, order: 3 },
 ],
 },
 {
 id: generateId(),
 title: '4 测试与验证',
 content: '',
 level: 1,
 order: 5,
 children: [
 { id: generateId(), title: '4.1 测试方案', content: '', level: 2, order: 1 },
 { id: generateId(), title: '4.2 测试结果', content: '', level: 2, order: 2 },
 { id: generateId(), title: '4.3 性能指标', content: '', level: 2, order: 3 },
 ],
 },
 {
 id: generateId(),
 title: '5 部署与维护',
 content: '',
 level: 1,
 order: 6,
 children: [
 { id: generateId(), title: '5.1 部署方案', content: '', level: 2, order: 1 },
 { id: generateId(), title: '5.2 维护说明', content: '', level: 2, order: 2 },
 ],
 },
 {
 id: generateId(),
 title: '6 结论',
 content: '',
 level: 1,
 order: 7,
 },
 {
 id: generateId(),
 title: '参考文献',
 content: '',
 level: 1,
 order: 8,
 },
 {
 id: generateId(),
 title: '附录',
 content: '',
 level: 1,
 order: 9,
 },
];

// 模板预设配置
export const templatePresets: TemplatePreset[] = [
 {
 type: 'journal',
 name: '期刊论文',
 description: '适用于学术期刊投稿的标准论文格式',
 defaultChapters: journalTemplate,
 },
 {
 type: 'thesis',
 name: '学位论文',
 description: '学士、硕士、博士学位论文格式',
 defaultChapters: thesisTemplate,
 },
 {
 type: 'research',
 name: '研究报告',
 description: '科研项目研究成果报告格式',
 defaultChapters: researchTemplate,
 },
 {
 type: 'review',
 name: '综述论文',
 description: '文献综述和系统评价格式',
 defaultChapters: reviewTemplate,
 },
 {
 type: 'technical',
 name: '技术报告',
 description: '技术说明和工程报告格式',
 defaultChapters: technicalTemplate,
 },
];

// 获取模板预设
export const getTemplatePreset = (type: string): TemplatePreset | undefined => {
 return templatePresets.find(preset => preset.type === type);
};

// 创建新文档
export const createNewDocument = (type: string) => {
 const preset = getTemplatePreset(type);
 if (!preset) {
 throw new Error(`Unknown template type: ${type}`);
 }

 return {
 id: `doc-${Date.now()}`,
 title: `新${preset.name}`,
 type: preset.type,
 templateId: preset.type,
 authors: [],
 institution: '',
 date: new Date().toISOString().split('T')[0],
 abstractChinese: '',
 abstractEnglish: '',
 keywords: [],
 chapters: JSON.parse(JSON.stringify(preset.defaultChapters)),
 citations: [],
 citationStyle: 'gbt7714' as CitationStyle,
 headerConfig: {
 showHeader: true,
 headerText: { left: '', center: 'chapter', right: 'page' },
 showFooter: true,
 footerText: { left: '', center: '', right: '' },
 },
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 };
};
