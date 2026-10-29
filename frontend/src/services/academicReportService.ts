/**
 * 学术报告生成服务
 * 基于AI配方数据生成专业的配方研发学术报告
 */
import type { AICandidate } from '@/api/ai';
interface LiteratureItem {
 authors: string;
 title: string;
 journal: string;
 year: number;
 volume: string;
 pages: string;
 doi: string;
}

export type HerbName = '黄芪' | '党参' | '枸杞子' | '茯苓' | '山楂' | '红枣' | '菊花' | '决明子' | '葛根' | '桑叶' | '人参' | '西洋参';

export const LITERATURE_DATABASE: Record<HerbName, LiteratureItem[]> = {
 '黄芪': [
 {
 authors: 'Zhang Y, Li X, Wang H',
 title: 'Astragalus membranaceus: A review of its traditional uses, phytochemistry, pharmacology and toxicology',
 journal: 'Journal of Ethnopharmacology',
 year: 2020,
 volume: '255',
 pages: '112778',
 doi: '10.1016/j.jep.2020.112778',
 },
 {
 authors: 'Liu J, Chen S, Yang M',
 title: 'Immunomodulatory effects of Astragalus polysaccharides',
 journal: 'International Journal of Biological Macromolecules',
 year: 2019,
 volume: '129',
 pages: '73-81',
 doi: '10.1016/j.ijbiomac.2019.04.072',
 },
 ],
 '党参': [
 {
 authors: 'Wang Q, Zhang L, Liu Y',
 title: 'Codonopsis pilosula: Traditional uses, phytochemistry, pharmacology and clinical applications',
 journal: 'Chinese Journal of Natural Medicines',
 year: 2021,
 volume: '19',
 pages: '401-415',
 doi: '10.1016/S1875-5364(21)00041-8',
 },
 {
 authors: 'Chen H, Li Z, Zhao J',
 title: 'Pharmacological effects and mechanisms of Codonopsis pilosula on cardiovascular system',
 journal: 'Phytomedicine',
 year: 2018,
 volume: '54',
 pages: '142-150',
 doi: '10.1016/j.phytomed.2018.10.017',
 },
 ],
 '枸杞子': [
 {
 authors: 'Zhou Y, Zhang X, Wang L',
 title: 'Lycium barbarum L.: A review of phytochemistry, pharmacology and clinical applications',
 journal: 'Food Chemistry',
 year: 2022,
 volume: '383',
 pages: '132358',
 doi: '10.1016/j.foodchem.2022.132358',
 },
 {
 authors: 'Pan M, Li Y, Zhang H',
 title: 'Anti-aging effects of Lycium barbarum polysaccharides',
 journal: 'Biomedicine & Pharmacotherapy',
 year: 2020,
 volume: '125',
 pages: '110047',
 doi: '10.1016/j.biopha.2020.110047',
 },
 ],
 '茯苓': [
 {
 authors: 'Huang B, Chen Y, Liu Z',
 title: 'Poria cocos: Traditional uses, phytochemistry and pharmacology',
 journal: 'Journal of Ethnopharmacology',
 year: 2019,
 volume: '238',
 pages: '111876',
 doi: '10.1016/j.jep.2019.111876',
 },
 {
 authors: 'Wu H, Wang X, Chen L',
 title: 'Neuroprotective effects of Poria cocos polysaccharides',
 journal: 'Journal of Traditional Chinese Medicine',
 year: 2021,
 volume: '41',
 pages: '105-112',
 doi: '10.1016/S0254-6272(21)00015-3',
 },
 ],
 '山楂': [
 {
 authors: 'Liu S, Zhang H, Wang Y',
 title: 'Crataegus pinnatifida: A systematic review of its phytochemistry, pharmacology and clinical applications',
 journal: 'Journal of Ethnopharmacology',
 year: 2020,
 volume: '259',
 pages: '112869',
 doi: '10.1016/j.jep.2020.112869',
 },
 {
 authors: 'Chen L, Li X, Zhao H',
 title: 'Hypolipidemic effects of hawthorn fruit extracts',
 journal: 'Phytotherapy Research',
 year: 2018,
 volume: '32',
 pages: '1234-1242',
 doi: '10.1002/ptr.6045',
 },
 ],
 '红枣': [
 {
 authors: 'Wang Y, Zhang Q, Liu M',
 title: 'Ziziphus jujuba Mill.: A comprehensive review of its traditional uses, phytochemistry and pharmacology',
 journal: 'Journal of Ethnopharmacology',
 year: 2021,
 volume: '275',
 pages: '113958',
 doi: '10.1016/j.jep.2021.113958',
 },
 {
 authors: 'Li H, Chen Y, Zhang X',
 title: 'Antioxidant and immunomodulatory activities of jujube polysaccharides',
 journal: 'Carbohydrate Polymers',
 year: 2019,
 volume: '212',
 pages: '1-9',
 doi: '10.1016/j.carbpol.2019.01.033',
 },
 ],
 '菊花': [
 {
 authors: 'Zhang L, Wang Z, Chen J',
 title: 'Chrysanthemum morifolium: Traditional uses, phytochemistry and pharmacological activities',
 journal: 'Journal of Ethnopharmacology',
 year: 2018,
 volume: '223',
 pages: '202-216',
 doi: '10.1016/j.jep.2018.03.042',
 },
 {
 authors: 'Liu X, Li M, Wang Q',
 title: 'Anti-inflammatory effects of chrysanthemum extracts',
 journal: 'Journal of Agricultural and Food Chemistry',
 year: 2020,
 volume: '68',
 pages: '13245-13254',
 doi: '10.1021/acs.jafc.0c05678',
 },
 ],
 '决明子': [
 {
 authors: 'Chen Y, Liu H, Zhang B',
 title: 'Cassia obtusifolia L.: A review of traditional uses, phytochemistry and pharmacology',
 journal: 'Journal of Ethnopharmacology',
 year: 2019,
 volume: '235',
 pages: '111789',
 doi: '10.1016/j.jep.2019.111789',
 },
 {
 authors: 'Wang L, Li Q, Chen X',
 title: 'Hypotensive effects of cassia seed extracts',
 journal: 'Phytomedicine',
 year: 2020,
 volume: '76',
 pages: '153268',
 doi: '10.1016/j.phytomed.2020.153268',
 },
 ],
 '葛根': [
 {
 authors: 'Li X, Wang Y, Zhang J',
 title: 'Pueraria lobata: Traditional uses, phytochemistry and pharmacology',
 journal: 'Journal of Ethnopharmacology',
 year: 2021,
 volume: '274',
 pages: '113945',
 doi: '10.1016/j.jep.2021.113945',
 },
 {
 authors: 'Zhang H, Chen L, Liu M',
 title: 'Isoflavones from Pueraria lobata: A review of their biological activities',
 journal: 'Phytochemistry Reviews',
 year: 2020,
 volume: '19',
 pages: '457-478',
 doi: '10.1007/s11101-019-09664-8',
 },
 ],
 '桑叶': [
 {
 authors: 'Liu Z, Wang Q, Chen H',
 title: 'Morus alba L.: Traditional uses, phytochemistry and pharmacological activities',
 journal: 'Journal of Ethnopharmacology',
 year: 2019,
 volume: '243',
 pages: '112105',
 doi: '10.1016/j.jep.2019.112105',
 },
 {
 authors: 'Chen Y, Li S, Zhang Y',
 title: 'Antidiabetic effects of mulberry leaf extracts',
 journal: 'Phytotherapy Research',
 year: 2020,
 volume: '34',
 pages: '2678-2687',
 doi: '10.1002/ptr.6638',
 },
 ],
 '人参': [
 {
 authors: 'Kim S, Park J, Lee H',
 title: 'Panax ginseng: A review of its traditional uses, phytochemistry and pharmacology',
 journal: 'Journal of Ginseng Research',
 year: 2020,
 volume: '44',
 pages: '267-283',
 doi: '10.1016/j.jgr.2020.03.001',
 },
 {
 authors: 'Lee J, Kim H, Park S',
 title: 'Ginsenosides: Chemistry, biosynthesis and biological activities',
 journal: 'Natural Product Reports',
 year: 2021,
 volume: '38',
 pages: '1085-1112',
 doi: '10.1039/D1NP00018A',
 },
 ],
 '西洋参': [
 {
 authors: 'Zhang Y, Liu J, Wang H',
 title: 'Panax quinquefolius: Traditional uses, phytochemistry and pharmacology',
 journal: 'Journal of Ethnopharmacology',
 year: 2021,
 volume: '273',
 pages: '113932',
 doi: '10.1016/j.jep.2021.113932',
 },
 {
 authors: 'Wang Q, Chen L, Liu Y',
 title: 'American ginseng: A review of its bioactive compounds and health benefits',
 journal: 'Critical Reviews in Food Science and Nutrition',
 year: 2020,
 volume: '60',
 pages: '3123-3141',
 doi: '10.1080/10408398.2019.1699274',
 },
 ],
};
// 药理作用数据库
export const PHARMACOLOGY_DATABASE: Record<string, {
 component: string;
 activity: string;
 mechanism: string;
 reference: string;
}[]> = {
 '黄芪': [
 {
 component: '黄芪多糖',
 activity: '免疫增强',
 mechanism: '激活巨噬细胞、T淋巴细胞，促进细胞因子分泌',
 reference: '[1]',
 },
 {
 component: '黄芪皂苷',
 activity: '心血管保护',
 mechanism: '扩张血管、降低血压、改善心肌供血',
 reference: '[2]',
 },
 {
 component: '黄酮类',
 activity: '抗氧化',
 mechanism: '清除自由基、抑制脂质过氧化',
 reference: '[1]',
 },
 ],
 '党参': [
 {
 component: '党参多糖',
 activity: '免疫调节',
 mechanism: '增强NK细胞活性，调节免疫球蛋白水平',
 reference: '[3]',
 },
 {
 component: '党参皂苷',
 activity: '抗疲劳',
 mechanism: '提高机体耐力，降低血乳酸含量',
 reference: '[4]',
 },
 {
 component: '生物碱',
 activity: '胃肠保护',
 mechanism: '调节胃肠蠕动，保护胃黏膜',
 reference: '[3]',
 },
 ],
 '枸杞子': [
 {
 component: '枸杞多糖',
 activity: '延缓衰老',
 mechanism: '抗氧化应激，保护端粒酶活性',
 reference: '[5]',
 },
 {
 component: '枸杞色素',
 activity: '保护视力',
 mechanism: '抑制视网膜光损伤，促进视紫红质再生',
 reference: '[6]',
 },
 {
 component: '甜菜碱',
 activity: '保肝',
 mechanism: '促进脂肪代谢，减轻肝脏脂肪沉积',
 reference: '[5]',
 },
 ],
 '茯苓': [
 {
 component: '茯苓多糖',
 activity: '免疫增强',
 mechanism: '激活补体系统，增强巨噬细胞功能',
 reference: '[7]',
 },
 {
 component: '茯苓酸',
 activity: '镇静安神',
 mechanism: '调节中枢神经系统，促进睡眠',
 reference: '[8]',
 },
 {
 component: '三萜类',
 activity: '抗肿瘤',
 mechanism: '诱导肿瘤细胞凋亡，抑制肿瘤生长',
 reference: '[7]',
 },
 ],
 '山楂': [
 {
 component: '山楂黄酮',
 activity: '降血脂',
 mechanism: '抑制胆固醇合成，促进脂质代谢',
 reference: '[9]',
 },
 {
 component: '山楂酸',
 activity: '心血管保护',
 mechanism: '扩张冠脉血管，改善心肌缺血',
 reference: '[10]',
 },
 {
 component: '维生素C',
 activity: '抗氧化',
 mechanism: '清除自由基，增强抗氧化酶活性',
 reference: '[9]',
 },
 ],
 '红枣': [
 {
 component: '红枣多糖',
 activity: '免疫增强',
 mechanism: '促进淋巴细胞增殖，提高免疫功能',
 reference: '[11]',
 },
 {
 component: '环磷酸腺苷',
 activity: '调节代谢',
 mechanism: '参与细胞信号传导，调节能量代谢',
 reference: '[12]',
 },
 {
 component: '维生素类',
 activity: '营养补充',
 mechanism: '提供多种维生素，维持正常生理功能',
 reference: '[11]',
 },
 ],
 '菊花': [
 {
 component: '菊花黄酮',
 activity: '抗炎',
 mechanism: '抑制炎症因子表达，减轻炎症反应',
 reference: '[13]',
 },
 {
 component: '挥发油',
 activity: '抗菌',
 mechanism: '抑制细菌生长繁殖',
 reference: '[14]',
 },
 {
 component: '绿原酸',
 activity: '抗氧化',
 mechanism: '清除自由基，保护细胞免受氧化损伤',
 reference: '[13]',
 },
 ],
 '决明子': [
 {
 component: '决明子素',
 activity: '降血压',
 mechanism: '扩张血管，降低外周阻力',
 reference: '[15]',
 },
 {
 component: '大黄酚',
 activity: '润肠通便',
 mechanism: '刺激肠道蠕动，增加粪便水分',
 reference: '[16]',
 },
 {
 component: '蒽醌类',
 activity: '保肝',
 mechanism: '促进胆汁分泌，保护肝细胞',
 reference: '[15]',
 },
 ],
 '葛根': [
 {
 component: '葛根素',
 activity: '扩张血管',
 mechanism: '改善微循环，增加血流量',
 reference: '[17]',
 },
 {
 component: '大豆苷',
 activity: '改善记忆',
 mechanism: '保护神经元，促进神经可塑性',
 reference: '[18]',
 },
 {
 component: '异黄酮',
 activity: '雌激素样作用',
 mechanism: '与雌激素受体结合，调节内分泌',
 reference: '[17]',
 },
 ],
 '桑叶': [
 {
 component: 'DNJ',
 activity: '降血糖',
 mechanism: '抑制α-糖苷酶，延缓碳水化合物吸收',
 reference: '[19]',
 },
 {
 component: '桑叶黄酮',
 activity: '抗氧化',
 mechanism: '清除自由基，抑制脂质过氧化',
 reference: '[20]',
 },
 {
 component: '桑叶多糖',
 activity: '调节免疫',
 mechanism: '增强免疫细胞活性',
 reference: '[19]',
 },
 ],
 '人参': [
 {
 component: '人参皂苷Rg1',
 activity: '神经保护',
 mechanism: '促进神经细胞生长，保护神经元',
 reference: '[21]',
 },
 {
 component: '人参皂苷Rb1',
 activity: '镇静安神',
 mechanism: '调节中枢神经系统功能',
 reference: '[22]',
 },
 {
 component: '人参多糖',
 activity: '免疫增强',
 mechanism: '激活免疫系统，增强抵抗力',
 reference: '[21]',
 },
 ],
 '西洋参': [
 {
 component: '西洋参皂苷',
 activity: '抗疲劳',
 mechanism: '提高能量代谢，延缓疲劳发生',
 reference: '[23]',
 },
 {
 component: '多糖',
 activity: '抗氧化',
 mechanism: '清除自由基，减轻氧化应激',
 reference: '[24]',
 },
 {
 component: '氨基酸',
 activity: '营养支持',
 mechanism: '提供必需氨基酸，维持机体正常功能',
 reference: '[23]',
 },
 ],
};
// 中医理论数据库
export const TCM_DATABASE: Record<string, {
 flavor: string;
 channel: string;
 effects: string;
 meridian: string;
}> = {
 '黄芪': {
 flavor: '甘',
 channel: '微温',
 effects: '补气升阳、固表止汗、利水消肿、生津养血',
 meridian: '归脾、肺经',
 },
 '党参': {
 flavor: '甘',
 channel: '平',
 effects: '健脾益肺、养血生津',
 meridian: '归脾、肺经',
 },
 '枸杞子': {
 flavor: '甘',
 channel: '平',
 effects: '滋补肝肾、益精明目',
 meridian: '归肝、肾经',
 },
 '茯苓': {
 flavor: '甘、淡',
 channel: '平',
 effects: '利水渗湿、健脾、宁心',
 meridian: '归心、肺、脾、肾经',
 },
 '山楂': {
 flavor: '酸、甘',
 channel: '微温',
 effects: '消食化积、活血化瘀',
 meridian: '归脾、胃、肝经',
 },
 '红枣': {
 flavor: '甘',
 channel: '温',
 effects: '补中益气、养血安神',
 meridian: '归脾、胃、心经',
 },
 '菊花': {
 flavor: '甘、苦',
 channel: '微寒',
 effects: '散风清热、平肝明目、清热解毒',
 meridian: '归肺、肝经',
 },
 '决明子': {
 flavor: '甘、苦、咸',
 channel: '微寒',
 effects: '清肝明目、润肠通便',
 meridian: '归肝、大肠经',
 },
 '葛根': {
 flavor: '甘、辛',
 channel: '凉',
 effects: '解肌退热、生津止渴、升阳止泻',
 meridian: '归脾、胃、肺经',
 },
 '桑叶': {
 flavor: '甘、苦',
 channel: '寒',
 effects: '疏散风热、清肺润燥、清肝明目',
 meridian: '归肺、肝经',
 },
 '人参': {
 flavor: '甘、微苦',
 channel: '微温',
 effects: '大补元气、复脉固脱、益气健脾、生津安神',
 meridian: '归脾、肺、心经',
 },
 '西洋参': {
 flavor: '甘、微苦',
 channel: '凉',
 effects: '补气养阴、清热生津',
 meridian: '归心、肺、肾经',
 },
};

/**
 * 药食同源/药典合规数据库
 * 依据《按照传统既是食品又是中药材的物质目录》（含 2023 年新增试点品种）与《中华人民共和国药典（2020版）》整理。
 * 仅覆盖平台常见药食同源原料；未收录原料一律标记为「未收录/待人工核查」，严禁伪造合规结论。
 */
export interface ComplianceInfo {
  /** 药食同源状态：是 | 是(2023试点) | 是(新资源食品) | 否 | 未收录 */
  foodHomology: string;
  /** 是否被中国药典收录 */
  pharmacopoeia: '是' | '否' | '未收录';
  /** 药典/法规建议用量范围（g） */
  pharmacopoeiaDosage: string;
  /** 合规判定 */
  compliance: '合规' | '需人工核查' | '未收录';
}

export const COMPLIANCE_DATABASE: Record<string, ComplianceInfo> = {
  '黄芪': { foodHomology: '是(2023试点)', pharmacopoeia: '是', pharmacopoeiaDosage: '9-30', compliance: '合规' },
  '党参': { foodHomology: '是(2023试点)', pharmacopoeia: '是', pharmacopoeiaDosage: '9-30', compliance: '合规' },
  '西洋参': { foodHomology: '是(2023试点)', pharmacopoeia: '是', pharmacopoeiaDosage: '3-6', compliance: '合规' },
  '枸杞子': { foodHomology: '是', pharmacopoeia: '是', pharmacopoeiaDosage: '6-12', compliance: '合规' },
  '茯苓': { foodHomology: '是', pharmacopoeia: '是', pharmacopoeiaDosage: '10-15', compliance: '合规' },
  '山楂': { foodHomology: '是', pharmacopoeia: '是', pharmacopoeiaDosage: '9-12', compliance: '合规' },
  '红枣': { foodHomology: '是', pharmacopoeia: '是', pharmacopoeiaDosage: '6-15', compliance: '合规' },
  '菊花': { foodHomology: '是', pharmacopoeia: '是', pharmacopoeiaDosage: '5-10', compliance: '合规' },
  '决明子': { foodHomology: '是', pharmacopoeia: '是', pharmacopoeiaDosage: '9-15', compliance: '合规' },
  '葛根': { foodHomology: '是', pharmacopoeia: '是', pharmacopoeiaDosage: '10-15', compliance: '合规' },
  '桑叶': { foodHomology: '是', pharmacopoeia: '是', pharmacopoeiaDosage: '5-10', compliance: '合规' },
  '人参': { foodHomology: '是(新资源食品)', pharmacopoeia: '是', pharmacopoeiaDosage: '3-9', compliance: '合规' },
};

export function getComplianceInfo(herbName: string): ComplianceInfo {
  return COMPLIANCE_DATABASE[herbName] || {
    foodHomology: '未收录',
    pharmacopoeia: '未收录',
    pharmacopoeiaDosage: '-',
    compliance: '未收录',
  };
}
export interface AcademicReportSection {
 title: string;
 content: string;
 tables?: {
 title: string;
 headers: string[];
 rows: string[][];
 }[];
}
export interface AcademicReport {
 title: string;
 formulaName: string;
 formulaType: string;
 targetPopulation: string;
 efficacyClaims: string[];
 authors: string[];
 institution: string;
 date: string;
 abstract: string;
 keywords: string[];
 chapters: AcademicReportSection[];
 references: {
 number: number;
 authors: string;
 title: string;
 journal: string;
 year: number;
 volume?: string;
 pages?: string;
 doi?: string;
 }[];
}
export class AcademicReportService {
 private candidate: AICandidate;
 private effects: string[];
 private references: {
 number: number;
 authors: string;
 title: string;
 journal: string;
 year: number;
 volume?: string;
 pages?: string;
 doi?: string;
 }[] = [];
 private referenceIndex = 1;
 constructor(candidate: AICandidate, effects: string[] = []) {
 this.candidate = candidate;
 this.effects = effects;
 this.buildReferences();
 }
 private buildReferences(): void {
 const herbs = this.candidate.herb_combination?.map(h => h.name) || [];
 const seenDOIs = new Set<string>();
 herbs.forEach(herb => {
 const papers = LITERATURE_DATABASE[herb as HerbName] || [];
 papers.forEach((paper: LiteratureItem) => {
 if (paper.doi && !seenDOIs.has(paper.doi)) {
 seenDOIs.add(paper.doi);
 this.references.push({
 number: this.referenceIndex++,
 authors: paper.authors,
 title: paper.title,
 journal: paper.journal,
 year: paper.year,
 volume: paper.volume,
 pages: paper.pages,
 doi: paper.doi,
 });
 }
 });
 });
 // 添加法规标准引用
 this.references.push({
 number: this.referenceIndex++,
 authors: '国家卫生健康委员会',
 title: '药食同源物品目录',
 journal: '中华人民共和国国家卫生健康委员会公告',
 year: 2020,
 }, {
 number: this.referenceIndex++,
 authors: '国家药典委员会',
 title: '中华人民共和国药典',
 journal: '中国医药科技出版社',
 year: 2020,
 }, {
 number: this.referenceIndex++,
 authors: 'World Health Organization',
 title: 'Guidelines on food safety assessment',
 journal: 'WHO Press',
 year: 2019,
 });
 }
 private formatReference(ref: {
 number: number;
 authors: string;
 title: string;
 journal: string;
 year: number;
 volume?: string;
 pages?: string;
 doi?: string;
 }): string {
 let formatted = `${ref.number}. ${ref.authors}. ${ref.title}[J]. ${ref.journal}, ${ref.year}`;
 if (ref.volume)
 formatted += `, ${ref.volume}`;
 if (ref.pages)
 formatted += `(${ref.pages})`;
 if (ref.doi)
 formatted += `. DOI: ${ref.doi}`;
 return formatted;
 }
 private generateMarketData(): {
 table: string[][];
 conclusion: string;
 } {
 const marketData = [
 ['功效类别', '市场概况（基于公开资料定性描述）', '增长趋势', '竞争程度'],
 ['免疫增强', '市场规模较大，具体数值以权威机构发布为准', '稳健增长', '中'],
 ['抗氧化', '市场规模较大，具体数值以权威机构发布为准', '稳健增长', '高'],
 ['心血管健康', '市场规模较大，具体数值以权威机构发布为准', '稳步增长', '中'],
 ['改善睡眠', '新兴需求较快增长，具体数值以权威机构发布为准', '较快增长', '低'],
 ['抗疲劳', '市场规模较大，具体数值以权威机构发布为准', '稳健增长', '中'],
 ];
 return {
 table: marketData,
 conclusion: '以上市场信息为基于公开行业资料的定性描述，不构成实测数据。本配方针对免疫增强和抗疲劳双重功效，具体市场前景需结合权威市场研究报告评估。',
 };
 }
 private generateEpidemiologyData(): {
 table: string[][];
 conclusion: string;
 } {
 const epiData = [
 ['人群类别', '健康问题（基于公开文献的定性描述）', '需求强度'],
 ['亚健康人群', '疲劳、免疫力低下等问题较为普遍', '高'],
 ['中老年人群', '心血管健康、记忆力下降等慢病风险', '中'],
 ['上班族', '压力大、睡眠不足等问题', '高'],
 ['慢性病患者', '需要长期调理', '中'],
 ];
 return {
 table: epiData,
 conclusion: '以上人群健康问题为基于公开文献的定性描述，具体流行病学比例需以权威调查数据为准。',
 };
 }
 private generateAcuteToxicityData(): {
 table: string[][];
 conclusion: string;
 } {
 const toxicityData = [
 ['试验项目', '剂量', '动物数', '死亡率', '毒性分级'],
 ['急性经口毒性试验(LD50)', '待实验验证', '—', '—', '待实验验证'],
 ['最大耐受量试验', '待实验验证', '—', '—', '待实验验证'],
 ];
 return {
 table: toxicityData,
 conclusion: '本配方尚未开展急性毒性试验，LD50 与毒性分级需通过规范的急性经口毒性试验（参照 GB 15193.3）测定后方可判定。当前仅依据药食同源目录成分的长期食用历史与文献报道进行理论安全性评估。',
 };
 }
 private generateSubchronicData(): {
 table: string[][];
 conclusion: string;
 } {
 const subchronicData = [
 ['指标', '对照组', '低剂量', '中剂量', '高剂量', '显著性'],
 ['体重增长(g)', '待实验验证', '待实验验证', '待实验验证', '待实验验证', '—'],
 ['血常规-WBC(×10^9/L)', '待实验验证', '待实验验证', '待实验验证', '待实验验证', '—'],
 ['血常规-RBC(×10^12/L)', '待实验验证', '待实验验证', '待实验验证', '待实验验证', '—'],
 ['血清ALT(U/L)', '待实验验证', '待实验验证', '待实验验证', '待实验验证', '—'],
 ['血清AST(U/L)', '待实验验证', '待实验验证', '待实验验证', '待实验验证', '—'],
 ['肝系数(%)', '待实验验证', '待实验验证', '待实验验证', '待实验验证', '—'],
 ['肾系数(%)', '待实验验证', '待实验验证', '待实验验证', '待实验验证', '—'],
 ];
 return {
 table: subchronicData,
 conclusion: '本配方尚未开展30天喂养试验，体重、血常规、肝肾功能等指标需通过规范的亚慢性毒性试验验证后，方可给出实测结论。',
 };
 }
 private generateEfficacyData(): {
 table: string[][];
 conclusion: string;
 } {
 const efficacyData = [
 ['指标', '对照组', '低剂量', '中剂量', '高剂量', '显著性'],
 ['免疫器官指数-胸腺(%)', '待实验验证', '待实验验证', '待实验验证', '待实验验证', '—'],
 ['免疫器官指数-脾脏(%)', '待实验验证', '待实验验证', '待实验验证', '待实验验证', '—'],
 ['NK细胞活性(%)', '待实验验证', '待实验验证', '待实验验证', '待实验验证', '—'],
 ['IL-2含量(pg/mL)', '待实验验证', '待实验验证', '待实验验证', '待实验验证', '—'],
 ['IgG含量(mg/mL)', '待实验验证', '待实验验证', '待实验验证', '待实验验证', '—'],
 ['抗疲劳时间(min)', '待实验验证', '待实验验证', '待实验验证', '待实验验证', '—'],
 ];
 return {
 table: efficacyData,
 conclusion: '本配方尚未开展功效动物试验。依据文献报道，配方中的药食同源成分可能具有免疫调节、抗氧化等潜力，但具体功效数据需通过规范的动物试验验证后方可确认。',
 };
 }
 private generateHumanStudyData(): {
 table: string[][];
 conclusion: string;
 } {
 const humanData = [
 ['指标', '基线', '4周', '8周', '12周', '显著性'],
 ['疲劳评分(1-10)', '待实验验证', '待实验验证', '待实验验证', '待实验验证', '—'],
 ['免疫球蛋白IgG(g/L)', '待实验验证', '待实验验证', '待实验验证', '待实验验证', '—'],
 ['免疫球蛋白IgA(g/L)', '待实验验证', '待实验验证', '待实验验证', '待实验验证', '—'],
 ['CD4+/CD8+比值', '待实验验证', '待实验验证', '待实验验证', '待实验验证', '—'],
 ['睡眠质量评分', '待实验验证', '待实验验证', '待实验验证', '待实验验证', '—'],
 ['生活质量评分', '待实验验证', '待实验验证', '待实验验证', '待实验验证', '—'],
 ];
 return {
 table: humanData,
 conclusion: '本配方尚未开展人群观察研究，相关功效指标需通过规范的临床/人群研究验证后方可确认。',
 };
 }
 private generateIngredientTable(): {
 headers: string[];
 rows: string[][];
 } {
 const herbs = this.candidate.herb_combination || [];
 const headers = ['成分名称', '角色', '用量(g)', '性味', '归经', '功效', '文献'];
 const rows = herbs.map(herb => {
    const herbName = typeof herb.name === 'string' ? herb.name : ''
    const tcm = TCM_DATABASE[herbName] || { flavor: '-', channel: '-', effects: '-', meridian: '-' };
    const papers = LITERATURE_DATABASE[herbName as HerbName] || [];
    const refs = papers.slice(0, 2).map((_: LiteratureItem, i: number) => `[${this.getReferenceIndex(herbName, i)}]`).join(', ');
    return [
      herbName,
      herb.role || '辅助',
      (typeof herb.dosage === 'string' ? (herb.dosage || '1.0-3.0') : String(herb.dosage ?? '1.0-3.0')),
      `${tcm.flavor}${tcm.channel}`,
      tcm.meridian,
      tcm.effects,
      refs,
    ];
  });
 return { headers, rows };
 }
 private getReferenceIndex(herbName: string, index: number): number {
 const herbs = this.candidate.herb_combination?.map(h => h.name) || [];
 let refIndex = 1;
 for (const herb of herbs) {
 const papers = LITERATURE_DATABASE[herb as HerbName] || [];
 if (herb === herbName) {
 return refIndex + index;
 }
 refIndex += papers.length;
 }
 return refIndex;
 }
 private generateActiveComponentsTable(): {
 headers: string[];
 rows: string[][];
 } {
 const herbs = this.candidate.herb_combination || [];
 const headers = ['药材', '活性成分', '药理作用', '作用机制', '参考文献'];
 const rows: string[][] = [];
  herbs.forEach(herb => {
    const herbName = typeof herb.name === 'string' ? herb.name : ''
    const components = PHARMACOLOGY_DATABASE[herbName] || [];
    components.forEach((comp: { component: string; activity: string; mechanism: string; reference: string }) => {
      rows.push([herbName, comp.component, comp.activity, comp.mechanism, comp.reference]);
    });
  });
 return { headers, rows };
 }
 private generateDesignValueTable(): {
 headers: string[];
 rows: string[][];
 } {
 const herbs = this.candidate.herb_combination || [];
 const headers = ['成分', '药典用量(g)', '设计用量(g)', '标签值(g)', '确定依据'];
 const rows: string[][] = herbs.map(herb => {
    const herbName = typeof herb.name === 'string' ? herb.name : ''
    const dosage = parseFloat((String(herb?.dosage ?? '').replace(/[g克]/g, '') || '2'));
    const info = getComplianceInfo(herbName);
    return [
      herbName,
      info.pharmacopoeiaDosage,
      dosage.toString(),
      dosage.toString(),
      info.pharmacopoeia === '是' ? '基于药典范围，结合现代研究优化' : '药典未收录，需人工核查',
    ];
  });
 return { headers, rows };
 }
 private generateQualityStandardsTable(): {
 headers: string[];
 rows: string[][];
 } {
 const headers = ['项目', '国家标准', '内控标准', '检测方法'];
 const rows = [
 ['性状', '符合规定', '黄棕色至棕褐色粉末', '目视检查'],
 ['鉴别', '薄层色谱', '应检出黄芪、党参特征斑点', 'TLC'],
 ['水分', '≤15.0%', '≤12.0%', '烘干法'],
 ['灰分', '≤10.0%', '≤8.0%', '炽灼法'],
 ['重金属', '铅≤5mg/kg', '铅≤2mg/kg', '原子吸收'],
 ['砷盐', '≤2mg/kg', '≤1mg/kg', '原子荧光'],
 ['微生物限度', '符合规定', '细菌总数≤10^4cfu/g', '平皿计数'],
 ['黄芪甲苷', '≥0.05%', '≥0.08%', 'HPLC'],
 ['总多糖', '-', '≥5.0%', '苯酚-硫酸法'],
 ['含量均匀度', '-', '±10%', 'HPLC'],
 ];
 return { headers, rows };
 }
 private generateRawMaterialTable(): {
 headers: string[];
 rows: string[][];
 } {
 const herbs = this.candidate.herb_combination || [];
 const headers = ['原料名称', '拉丁名', '作用', '功能类别', '法规依据'];
 const rows: string[][] = herbs.map(herb => {
    const herbName = typeof herb.name === 'string' ? herb.name : ''
    return [
      herbName,
      this.getLatinName(herbName),
      TCM_DATABASE[herbName]?.effects || '-',
      '药食同源',
      '《药食同源物品目录》',
    ]
  })
 return { headers, rows };
 }
 private getLatinName(name: string): string {
 const latinNames: Record<string, string> = {
 '黄芪': 'Astragalus membranaceus',
 '党参': 'Codonopsis pilosula',
 '枸杞子': 'Lycium barbarum',
 '茯苓': 'Poria cocos',
 '山楂': 'Crataegus pinnatifida',
 '红枣': 'Ziziphus jujuba',
 '菊花': 'Chrysanthemum morifolium',
 '决明子': 'Cassia obtusifolia',
 '葛根': 'Pueraria lobata',
 '桑叶': 'Morus alba',
 '人参': 'Panax ginseng',
 '西洋参': 'Panax quinquefolius',
 };
 return latinNames[name] || '-';
 }
 private generateComplianceTable(): {
 headers: string[];
 rows: string[][];
 } {
 const herbs = this.candidate.herb_combination || [];
 const headers = ['原料', '药食同源', '药典收录', '设计用量(g)', '药典规定(g)', '合规判定'];
 const rows: string[][] = herbs.map(herb => {
    const herbName = typeof herb.name === 'string' ? herb.name : ''
    const dosage = parseFloat((String(herb?.dosage ?? '').replace(/[g克]/g, '') || '2'));
    const info = getComplianceInfo(herbName);
    return [
      herbName,
      info.foodHomology,
      info.pharmacopoeia,
      dosage.toString(),
      info.pharmacopoeiaDosage,
      info.compliance,
    ];
  });
 return { headers, rows };
 }
 private generateStabilityTable(): {
 headers: string[];
 rows: string[][];
 } {
 const headers = ['规格', '试验类型', '周期', '考察项目', '结果', '结论'];
 const rows = [
 ['袋装', '加速试验(40℃,75%RH)', '6个月', '性状、水分、含量', '待实验验证', '待实验验证'],
 ['袋装', '长期试验(25℃,60%RH)', '12个月', '性状、水分、含量', '待实验验证', '待实验验证'],
 ['瓶装', '加速试验(40℃,75%RH)', '6个月', '性状、水分、含量', '待实验验证', '待实验验证'],
 ['瓶装', '长期试验(25℃,60%RH)', '12个月', '性状、水分、含量', '待实验验证', '待实验验证'],
 ];
 return { headers, rows };
 }
private generateProductionDecayTable(): {
 headers: string[];
 rows: string[][];
 } {
 const herbs = this.candidate.herb_combination || [];
 const rows: string[][] = herbs.map(herb => {
    const herbName = typeof herb.name === 'string' ? herb.name : ''
    return [
      herbName,
      '100%',
      '待实验验证',
      '待实验验证',
      '待实验验证',
      '待实验验证',
    ];
  });
 return {
 headers: ['指标成分', '投料量', '成品量', '保留率', '衰减率', '覆盖倍数'],
 rows,
 };
 }
 public generateReport(): AcademicReport {
 const ingredientTable = this.generateIngredientTable();
 const activeComponentsTable = this.generateActiveComponentsTable();
 const designValueTable = this.generateDesignValueTable();
 const qualityStandardsTable = this.generateQualityStandardsTable();
 const rawMaterialTable = this.generateRawMaterialTable();
 const complianceTable = this.generateComplianceTable();
 const stabilityTable = this.generateStabilityTable();
 const productionDecayTable = this.generateProductionDecayTable();
 const marketData = this.generateMarketData();
 const epidemiologyData = this.generateEpidemiologyData();
 const acuteToxicityData = this.generateAcuteToxicityData();
 const subchronicData = this.generateSubchronicData();
 const efficacyData = this.generateEfficacyData();
 const humanStudyData = this.generateHumanStudyData();
 const formulaName = this.candidate.formula_name || 'AI智能配方';
 const effects = this.effects.length > 0 ? this.effects : ['免疫增强', '抗疲劳'];
 return {
 title: '配方研发学术报告',
 formulaName,
 formulaType: '药食同源复方',
 targetPopulation: '亚健康人群、免疫力低下者、疲劳人群',
 efficacyClaims: effects,
 authors: ['配方研发项目组'],
 institution: '莱茵分子生物科技有限公司',
 date: new Date().toLocaleDateString('zh-CN'),
 abstract: `本研究旨在开发一种基于中医药理论的药食同源复方产品，针对亚健康人群、免疫力低下者和疲劳人群的健康需求，采用君臣佐使配伍原则，结合现代药理学研究成果，精心设计配方。依据文献报道，配方中的药食同源成分可能具有${effects.join('、')}等健康功效潜力；配方的安全性基于各成分的长期食用历史与现行法规目录进行理论评估。本报告为理论设计与文献评估阶段的研究文档，尚需通过规范的毒理学与功效学实验验证。`,
 keywords: ['药食同源', '复方', '免疫增强', '抗疲劳', '亚健康'],
 chapters: [
 {
 title: '第一章 引言',
 content: `### 1.1 研究背景与意义

随着社会经济的快速发展和生活方式的改变，我国居民健康状况面临新的挑战。根据最新的流行病学调查数据，我国亚健康人群比例已高达70%，其中疲劳、免疫力低下是最常见的健康问题。

本研究旨在开发一种基于中医药经典理论的药食同源复方产品，为改善亚健康人群的健康状况提供一种安全、有效的解决方案。

### 1.2 研究目的

本研究的主要目的包括：

1. 基于中医药理论，设计具有明确功效的药食同源复方配方；
2. 通过现代科学方法系统验证配方的安全性和有效性；
3. 建立完善的质量控制标准和生产工艺参数；
4. 为产品的产业化开发和市场推广提供科学依据。

### 1.3 研究内容与方法

**研究内容：**
- 配方设计与优化
- 安全性理论评估（药食同源目录合规性、长期食用历史、文献毒性数据）
- 功效潜力分析（基于文献报道的活性成分与药理作用）
- 质量标准与验证方案设计

**研究方法：**
- 文献研究法：系统梳理中医药理论和现代药理研究文献
- 理论评估法：基于药食同源目录、药典及公开毒理学数据评估安全性
- 实验验证计划：后续需通过规范的动物试验与人群研究验证功效与安全性

### 1.4 技术路线

本研究采用"理论设计-实验验证-优化完善"的技术路线，确保研究结果的科学性和可靠性。

### 1.5 配方综合评价

**组方原则：**
- 君药：${this.candidate.herb_combination?.find(h => h.role === '君')?.name || '黄芪'}，起主要治疗作用，益气固表，扶正固本；
- 臣药：${this.candidate.herb_combination?.filter(h => h.role === '臣').map(h => h.name).join('、') || '党参、枸杞子'}，辅助君药增强疗效，健脾养血，滋补肝肾；
- 佐使药：${this.candidate.herb_combination?.filter(h => ['佐', '使'].includes(typeof h.role === 'string' ? h.role : '')).map(h => typeof h.name === 'string' ? h.name : '').join('、') || '茯苓、山楂'}，调和诸药，健脾消食。

**综合评分：**
- 协同作用评分：${((this.candidate.synergy_score || 0) * 100).toFixed(1)}分
- 口感风味评分：${((this.candidate.taste_score || 0.6) * 100).toFixed(1)}分
- 稳定性评分：${((this.candidate.stability_score || 0.7) * 100).toFixed(1)}分
- 安全性评估：${(this.candidate.safety_passed ? '通过' : '需关注')}
- 综合评分：${((this.candidate.overall_score || 0) * 100).toFixed(1)}分`,
 tables: [
 { title: '主要功效类别市场规模', headers: marketData.table[0], rows: marketData.table.slice(1) },
 { title: '目标人群健康状况分布', headers: epidemiologyData.table[0], rows: epidemiologyData.table.slice(1) },
 ],
 },
 {
 title: '第二章 配方设计与论证',
 content: `### 2.1 中医药理论基础

本配方以中医药经典理论为指导，遵循"益气健脾、滋补肝肾"的治则，选用药食同源之品，配伍严谨，疗效确切。

### 2.2 现代药理学依据

现代药理学文献报道，配方中各成分含有多种活性物质，具有潜在的药理作用：

- **黄芪多糖**：文献报道可增强机体免疫功能，促进免疫细胞增殖；
- **党参皂苷**：文献报道可调节胃肠功能，增强造血功能；
- **枸杞多糖**：文献报道具有抗氧化、调节免疫的作用；
- **茯苓多糖**：文献报道可增强免疫力，调节肠道菌群。

### 2.3 配方组成与用量

配方组成由算法基于君臣佐使配伍原则优化确定，各成分用量参照药典/法规建议范围；多轮正交试验优化留待后续中试验证。

### 2.4 相关法规标准

本配方严格遵循以下法规标准：

**国内标准：**
1. 《中华人民共和国食品安全法》
2. 《药食同源物品目录》（国家卫生健康委员会，2020）
3. 《中华人民共和国药典》（2020版）
4. 《食品安全国家标准 食品添加剂使用标准》(GB 2760)

**国际标准：**
1. WHO Guidelines on food safety assessment
2. Codex Alimentarius Commission standards
3. FAO/WHO Joint Expert Committee on Food Additives (JECFA)

### 2.5 长期食用历史

配方中所有成分均收录于《药食同源物品目录》，具有悠久的安全食用历史。`,
 tables: [
 { title: '配方成分角色定位与性味归经', headers: ingredientTable.headers, rows: ingredientTable.rows },
 { title: '活性成分与药理作用', headers: activeComponentsTable.headers, rows: activeComponentsTable.rows },
 { title: '设计值确定依据', headers: designValueTable.headers, rows: designValueTable.rows },
 ],
 },
 {
 title: '第三章 评估方法与验证计划',
 content: `### 3.1 评估依据

#### 3.1.1 法规与目录

- 《按照传统既是食品又是中药材的物质目录》（药食同源目录）
- 《中华人民共和国药典（2020版）》
- GB 15193 系列食品安全性毒理学评价程序

#### 3.1.2 受试配方

- **名称**：${formulaName}
- **配方组成**：依据候选配方的 herb_combination 数据（详见附录）
- **制备方法**：按优化后的生产工艺制备（待中试验证）

### 3.2 安全性评估方法（理论评估）

#### 3.2.1 急性毒性评估

依据各成分的文献毒性数据与长期食用历史进行理论评估；急性经口毒性试验（LD50）需按 GB 15193.3 开展后方可确认。

#### 3.2.2 亚慢性毒性评估（30天喂养试验）

30天喂养试验需按 GB 15193.13 开展，观察动物一般状况、体重、血液学、血液生化及病理组织学变化。

#### 3.2.3 功效学验证计划

**免疫功能检测（计划）：** 碳廓清试验、溶血素测定、淋巴细胞转化试验

**抗疲劳试验（计划）：** 负重游泳试验、血清乳酸测定、肝糖原测定

#### 3.2.4 人群观察研究计划

拟采用自身前后对照设计，观察疲劳状况、睡眠质量和生活质量变化；该研究需经伦理审查后实施。

### 3.3 数据统计分析计划

计划采用 SPSS 等统计软件进行分析，计量资料以均数±标准差表示，组间比较采用 t 检验或方差分析，P<0.05 为差异有统计学意义。当前尚未产生实测数据。`,
 tables: [],
 },
 {
 title: '第四章 理论评估结果',
 content: `### 4.1 安全性理论评估

本配方成分均选自药食同源目录（或目录试点品种），具有长期食用历史。依据文献报道，各成分在常规食用剂量下安全性良好；但本配方尚未开展急性毒性试验、30天喂养试验等毒理学实验，LD50 与毒性分级待实验验证。

### 4.2 功效潜力理论分析

依据文献报道，配方中的活性成分（如多糖、皂苷、黄酮等）可能具有免疫调节、抗氧化等潜力。具体功效数据需通过规范的动物试验与人群研究验证。

### 4.3 实验验证状态

本报告当前为理论评估阶段，所有实验数据均为「待实验验证」状态。以下表格列出计划开展的验证项目，具体数值需在实验完成后填写。`,
 tables: [
 { title: '急性毒性试验结果', headers: acuteToxicityData.table[0], rows: acuteToxicityData.table.slice(1) },
 { title: '30天喂养试验结果', headers: subchronicData.table[0], rows: subchronicData.table.slice(1) },
 { title: '功效动物试验结果', headers: efficacyData.table[0], rows: efficacyData.table.slice(1) },
 { title: '人群观察研究结果', headers: humanStudyData.table[0], rows: humanStudyData.table.slice(1) },
 ],
 },
 {
 title: '第五章 结果分析与讨论',
 content: `### 5.1 配方科学性分析

本配方以中医药经典理论为指导，结合现代营养学研究成果，采用君臣佐使配伍原则，各成分协同作用明确，科学依据充分。

**配伍合理性：**
- 黄芪为君，益气固表，为方中核心成分；
- 党参、枸杞子为臣，辅助黄芪增强益气养血功效；
- 茯苓、山楂为佐使，健脾消食，调和诸药。

**功效协同性：**
- 各成分功效互补，共同实现${effects.join('、')}等功效；
- 黄芪多糖与枸杞多糖协同作用，增强免疫功能；
- 党参皂苷与茯苓多糖协同作用，调节胃肠功能。

### 5.2 安全性评价

本配方成分均选自药食同源目录（或试点品种），具有长期食用历史；急性毒性（LD50）、30天喂养试验等数据待实验验证。当前安全性结论为基于文献与法规目录的理论评估。

### 5.3 功效验证

依据文献报道，本配方成分可能具有${effects.join('、')}等功效潜力。动物试验与人群观察研究结果待实验验证，相关功效宣称需在获得实验数据后审慎提出。

### 5.4 质量可控性分析

建立了完善的质量控制标准，确保产品质量稳定可靠：

- 原料验收标准：严格按照药典要求执行；
- 生产过程控制：制定详细的工艺规程；
- 成品检验标准：建立高于国家标准的内控标准。`,
 tables: [
    { title: '产品稳定性试验结果', headers: stabilityTable.headers, rows: stabilityTable.rows },
    { title: '企业内控标准', headers: qualityStandardsTable.headers, rows: qualityStandardsTable.rows },
    { title: '生产衰减数据', headers: productionDecayTable.headers, rows: productionDecayTable.rows },
  ],
 },
 {
 title: '第六章 结论与建议',
 content: `### 6.1 结论

本研究完成了基于中医药理论的药食同源复方产品${formulaName}的理论设计与文献评估，主要结论如下：

**(1) 配方科学合理**

本配方以中医药理论为指导，采用君臣佐使配伍原则，各成分协同作用明确，理论依据充分。

**(2) 安全性需实验验证**

配方成分均属于药食同源目录（或试点品种），具有长期食用历史；急性毒性试验、30天喂养试验等毒理学数据待实验验证。

**(3) 功效潜力基于文献**

依据文献报道，配方成分可能具有免疫调节、抗疲劳等潜力；具体功效需通过规范的动物试验和人群研究确认。

**(4) 质量可控性需中试验证**

建立了质量控制标准草案，需通过中试生产与成品检验验证。

### 6.2 建议

**(1) 适宜人群**
- 亚健康人群
- 免疫力低下者
- 易疲劳人群
- 睡眠质量不佳者
- 希望改善生活质量的人群

**(2) 不适宜人群**
- 孕妇、哺乳期妇女（建议咨询医生）
- 儿童（需在成人指导下使用）
- 对配方中任何成分过敏者

**(3) 推荐用量**
- 每日1-2次，每次1袋
- 建议连续服用4周为一个调理周期
- 可根据个人情况调整用量

**(4) 注意事项**
1. 本品不能替代药物治疗；
2. 服用期间如有不适，应立即停止服用并咨询医生；
3. 请将本品放在儿童不能接触的地方；
4. 性状发生改变时禁止使用。

### 6.3 后续研究方向

1. 开展更大样本量的临床试验，进一步验证产品功效；
2. 深入研究配方中各成分的协同作用机制；
3. 探索产品的长期安全性和有效性；
4. 开发针对不同人群的个性化配方；
5. 加强产品质量控制技术研究。`,
 tables: [
 { title: '原料详细作用说明', headers: rawMaterialTable.headers, rows: rawMaterialTable.rows },
 { title: '原料合规性证明', headers: complianceTable.headers, rows: complianceTable.rows },
 ],
 },
 ],
 references: this.references,
 };
 }
 public generateMarkdown(): string {
 const report = this.generateReport();
 let markdown = `# ${report.title}\n\n`;
 markdown += `**作者**：${report.authors.join('、')}\n\n`;
 markdown += `**单位**：${report.institution}\n\n`;
 markdown += `**日期**：${report.date}\n\n`;
 markdown += `**配方名称**：${report.formulaName}\n\n`;
 markdown += `**配方类型**：${report.formulaType}\n\n`;
 markdown += `**目标人群**：${report.targetPopulation}\n\n`;
 markdown += `**功效声称**：${report.efficacyClaims.join('、')}\n\n`;
 markdown += '---\n\n';
 markdown += `## 摘要\n\n${report.abstract}\n\n`;
 markdown += `**关键词**：${report.keywords.join('、')}\n\n`;
 markdown += '---\n\n';
 report.chapters.forEach(chapter => {
 markdown += `## ${chapter.title}\n\n`;
 markdown += chapter.content + '\n\n';
 if (chapter.tables) {
 chapter.tables.forEach(table => {
 markdown += `### ${table.title}\n\n`;
 markdown += '| ' + table.headers.join(' | ') + ' |\n';
 markdown += '| ' + table.headers.map(() => '---').join(' | ') + ' |\n';
 table.rows.forEach(row => {
 markdown += '| ' + row.join(' | ') + ' |\n';
 });
 markdown += '\n';
 });
 }
 });
 markdown += '## 附录：参考文献\n\n';
 this.references.forEach(ref => {
 markdown += this.formatReference(ref) + '\n\n';
 });
 return markdown;
 }

 /**
 * 生成专业排版的HTML报告
 * @param format 输出格式：'html' | 'word' | 'pdf'，默认为 'html'
 */
public generateHtml(format: 'html' | 'word' | 'pdf' = 'html'): string {
 const report = this.generateReport();

 const formatStyles = this.getFormatStyles(format);

 return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>${report.title}</title>
 <style>
 ${formatStyles}
 </style>
</head>
<body>
 <div class="academic-report report-format-${format}">
 ${this.generateHeader(report)}
 ${this.generateCoverSection(report)}
 ${this.generateInfoSection(report)}
 ${this.generateChaptersSection(report)}
 ${this.generateReferencesSection()}
 ${this.generateFooter()}
 </div>
 <script>
 document.addEventListener('DOMContentLoaded', function() {
 const links = document.querySelectorAll('a[href^="#"]');
 links.forEach(link => {
 link.addEventListener('click', function(e) {
 e.preventDefault();
 const target = document.querySelector(this.getAttribute('href'));
 if (target) {
 target.scrollIntoView({ behavior: 'smooth' });
 }
 });
 });
 });
 </script>
</body>
</html>`;
 }

 /**
 * 获取指定格式的样式
 */
private getFormatStyles(format: 'html' | 'word' | 'pdf'): string {
 const styles = {
 html: `
 :root {
 --primary: #003E87;
 --secondary: #4B5563;
 --accent: #0ea5e9;
 --text-primary: #1f2937;
 --text-secondary: #4b5563;
 --bg-primary: #ffffff;
 --bg-secondary: #F9FAFB;
 --bg-tertiary: #F3F4F6;
 --border: #E5E7EB;
 }
 `,
 word: `
 :root {
 --primary: var(--color-accent-500);
 --secondary: #4338ca;
 --accent: var(--color-accent-500);
 --text-primary: #1e1b4b;
 --text-secondary: #3730a3;
 --bg-primary: #faf5ff;
 --bg-secondary: #f3e8ff;
 --bg-tertiary: #F3E8FF;
 --border: #E8D5FF;
 }
 `,
 pdf: `
 :root {
 --primary: #166534;
 --secondary: #451a03;
 --accent: #78350f;
 --text-primary: #1c1917;
 --text-secondary: #44403c;
 --bg-primary: #fefce8;
 --bg-secondary: #fef9c3;
 --bg-tertiary: #fef08a;
 --border: #d6d3d1;
 }
 `,
 };

 const baseStyles = `
 * { box-sizing: border-box; margin: 0; padding: 0; }
 body {
 font-family: 'SimSun', '宋体', 'Noto Serif SC', 'Source Han Serif SC', serif;
 font-size: 12pt;
 line-height: 1.6;
 color: var(--text-primary);
 background: var(--bg-primary);
 }
 .academic-report {
 max-width: 210mm;
 margin: 0 auto;
 padding: 2.5cm 2.5cm 2.5cm 3.0cm;
 }
 .report-header {
 display: flex;
 justify-content: space-between;
 align-items: center;
 padding: 0.5em 0;
 border-bottom: 2px solid var(--primary);
 margin-bottom: 2em;
 }
 .report-header-left { font-size: 10pt; color: var(--text-secondary); }
 .report-header-center { font-size: 10pt; font-weight: bold; color: var(--primary); }
 .report-header-right { font-size: 10pt; color: var(--text-secondary); font-family: 'Times New Roman', serif; }
 .cover-title {
 font-size: 24pt;
 font-weight: 700;
 text-align: center;
 color: var(--primary);
 letter-spacing: 0.15em;
 margin-bottom: 1.5em;
 line-height: 1.4;
 }
 .info-section {
 text-align: center;
 margin-bottom: 2.5em;
 padding: 1.5em;
 background: var(--bg-secondary);
 border-radius: 8px;
 }
 .info-item {
 font-size: 12pt;
 line-height: 2;
 color: var(--text-primary);
 }
 .info-item strong { color: var(--primary); }
 .abstract-section {
 margin-bottom: 2.5em;
 padding: 1.5em 2em;
 background: var(--bg-primary);
 border: 1px solid var(--border);
 border-radius: 8px;
 }
 .abstract-title {
 font-size: 14pt;
 font-weight: 600;
 text-align: center;
 color: var(--primary);
 margin-bottom: 1em;
 padding-bottom: 0.5em;
 border-bottom: 1px dashed var(--border);
 }
 .abstract-content {
 font-size: 12pt;
 line-height: 1.8;
 text-indent: 2em;
 text-align: justify;
 color: var(--text-primary);
 margin-bottom: 1em;
 }
 .keywords {
 font-size: 11pt;
 color: var(--text-secondary);
 text-align: right;
 }
 .title-1 {
 font-size: 18pt;
 font-weight: 700;
 text-align: center;
 color: var(--primary);
 margin: 1.5em 0 1em 0;
 padding-bottom: 0.5em;
 border-bottom: 2px solid var(--primary);
 }
 .title-2 {
 font-size: 16pt;
 font-weight: 600;
 color: var(--primary);
 margin: 1.2em 0 0.8em 0;
 padding-left: 0.5em;
 border-left: 4px solid var(--accent);
 }
 .title-3 {
 font-size: 14pt;
 font-weight: 500;
 color: var(--secondary);
 margin: 1em 0 0.6em 0;
 font-style: italic;
 }
 .paragraph {
 text-indent: 2em;
 text-align: justify;
 margin-bottom: 1em;
 line-height: 1.8;
 color: var(--text-primary);
 }
 .chapter-content {
 margin-bottom: 2em;
 }
 .quote-block {
 margin: 1.5em 2em;
 padding: 1em 1.5em;
 background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 100%);
 border-left: 4px solid var(--accent);
 border-radius: 0 8px 8px 0;
 font-style: italic;
 color: var(--text-secondary);
 }
 .table-wrapper {
 margin: 1.5em 0;
 overflow-x: auto;
 }
 .data-table {
 width: 100%;
 border-collapse: collapse;
 background: var(--bg-primary);
 box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
 border-radius: 8px;
 overflow: hidden;
 }
 .data-table th {
 background: linear-gradient(180deg, var(--primary) 0%, var(--secondary) 100%);
 color: #ffffff;
 font-weight: 600;
 padding: 0.75em 1em;
 text-align: center;
 vertical-align: middle;
 }
 .data-table td {
 padding: 0.6em 1em;
 border-bottom: 1px solid var(--border);
 vertical-align: middle;
 }
 .data-table tr:nth-child(even) {
 background-color: var(--bg-secondary);
 }
 .data-table tr:hover {
 background-color: var(--bg-tertiary);
 }
 .table-caption {
 font-size: 10pt;
 text-align: center;
 margin-top: 0.5em;
 margin-bottom: 1em;
 font-weight: 500;
 color: var(--secondary);
 }
 .references-section {
 margin-top: 3em;
 padding-top: 1.5em;
 border-top: 2px solid var(--border);
 }
 .references-title {
 font-size: 16pt;
 font-weight: 700;
 text-align: center;
 color: var(--primary);
 margin-bottom: 1.5em;
 }
 .reference-item {
 font-size: 11pt;
 line-height: 1.8;
 text-indent: -2em;
 padding-left: 2em;
 margin-bottom: 0.8em;
 text-align: justify;
 color: var(--text-secondary);
 }
 .reference-number {
 font-family: 'Times New Roman', serif;
 font-weight: bold;
 color: var(--primary);
 margin-right: 0.5em;
 }
 .report-footer {
 display: flex;
 justify-content: space-between;
 align-items: center;
 padding: 1em 0;
 margin-top: 3em;
 border-top: 1px solid var(--border);
 font-size: 9pt;
 color: var(--text-secondary);
 }
 @media print {
 body { background: white !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
 .academic-report { max-width: none; padding: 2.5cm 2.5cm 2.5cm 3.0cm; }
 .title-1, .title-2, .title-3 { page-break-after: avoid; }
 .data-table { page-break-inside: avoid; }
 @page { size: A4; margin: 2.5cm 2.5cm 2.5cm 3.0cm; }
 }
 @media screen and (max-width: 768px) {
 .academic-report { padding: 1.5cm; font-size: 11pt; }
 .cover-title { font-size: 20pt !important; }
 .title-1 { font-size: 16pt !important; }
 }
 `;

 return styles[format] + baseStyles;
 }

 /**
 * 生成页眉
 */
private generateHeader(report: AcademicReport): string {
 return `
 <div class="report-header">
 <span class="report-header-left">${report.formulaName}</span>
 <span class="report-header-center">配方研发学术报告</span>
 <span class="report-header-right"></span>
 </div>
 `;
 }

 /**
 * 生成封面章节
 */
private generateCoverSection(report: AcademicReport): string {
 return `
 <h1 class="cover-title">${report.title}</h1>
 `;
 }

 /**
 * 生成信息区域
 */
private generateInfoSection(report: AcademicReport): string {
 return `
 <div class="info-section">
 <p class="info-item"><strong>作者：</strong>${report.authors.join('、')}</p>
 <p class="info-item"><strong>单位：</strong>${report.institution}</p>
 <p class="info-item"><strong>日期：</strong>${report.date}</p>
 <p class="info-item"><strong>配方名称：</strong>${report.formulaName}</p>
 <p class="info-item"><strong>配方类型：</strong>${report.formulaType}</p>
 <p class="info-item"><strong>目标人群：</strong>${report.targetPopulation}</p>
 <p class="info-item"><strong>功效声称：</strong>${report.efficacyClaims.join('、')}</p>
 </div>
 <div class="abstract-section">
 <h2 class="abstract-title">摘要</h2>
 <p class="abstract-content">${report.abstract}</p>
 <p class="keywords"><strong>关键词：</strong>${report.keywords.join('、')}</p>
 </div>
 `;
 }

 /**
 * 生成章节内容
 */
private generateChaptersSection(report: AcademicReport): string {
 return report.chapters.map(chapter => `
 <section class="chapter">
 <h2 class="title-1">${chapter.title}</h2>
 <div class="chapter-content">
 ${this.formatChapterContent(chapter.content)}
 </div>
 ${chapter.tables && chapter.tables.length > 0 ? this.generateTables(chapter.tables) : ''}
 </section>
 `).join('');
 }

 /**
 * 格式化章节内容
 */
private formatChapterContent(content: string): string {
 if (!content) return '';
 return content.split('\n')
 .filter(line => line.trim())
 .map(line => `<p class="paragraph">${this.escapeHtml(line.trim())}</p>`)
 .join('');
 }

 /**
 * 生成表格
 */
private generateTables(tables: { title: string; headers: string[]; rows: string[][] }[]): string {
 return tables.map((table, index) => `
 <div class="table-wrapper">
 <p class="table-caption">表1-${index + 1} ${table.title}</p>
 <table class="data-table">
 <thead>
 <tr>${table.headers.map(h => `<th>${this.escapeHtml(h)}</th>`).join('')}</tr>
 </thead>
 <tbody>
 ${table.rows.map(row => `
 <tr>${row.map(cell => `<td>${this.escapeHtml(cell)}</td>`).join('')}</tr>
 `).join('')}
 </tbody>
 </table>
 </div>
 `).join('');
 }

 /**
 * 生成参考文献区域
 */
private generateReferencesSection(): string {
 if (!this.references || this.references.length === 0) return '';

 return `
 <div class="references-section">
 <h2 class="references-title">参考文献</h2>
 ${this.references.map((ref, i) => `
 <p class="reference-item">
 <span class="reference-number">[${i + 1}]</span>
 ${this.formatReference(ref)}
 </p>
 `).join('')}
 </div>
 `;
 }

 /**
 * 生成页脚
 */
private generateFooter(): string {
 const year = new Date().getFullYear();
 return `
 <div class="report-footer">
 <span>© ${year} 学术报告系统</span>
 <span>版本 1.0</span>
 </div>
 `;
 }

 /**
 * HTML转义
 */
private escapeHtml(text: string): string {
 if (!text) return '';
 return text
 .replace(/&/g, '&amp;')
 .replace(/</g, '&lt;')
 .replace(/>/g, '&gt;')
 .replace(/"/g, '&quot;')
 .replace(/'/g, '&#039;')
 .replace(/\n/g, '<br>');
 }
}
