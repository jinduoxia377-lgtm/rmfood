/**
 * DomainKnowledge - 食品配方行业领域知识库·术语映射系统
 *
 * 提供食品配方/功能性食品/特医食品领域的专业术语标准化映射，
 * 支持 6 大类别的 200+ 条术语条目，用于 AI 对话中的语义规范化。
 *
 * @module domainKnowledge
 * @version 1.0.0
 */

export type TermCategory =
  | 'FUNCTIONAL_FACTOR'
  | 'PRODUCT_FORM'
  | 'PROCESS_TECHNOLOGY'
  | 'REGULATORY_STANDARD'
  | 'SAFETY_PARAM'
  | 'SENSORY_ATTRIBUTE'

export interface Term {
  key: string
  normalized: string
  category: TermCategory
  confidence: number
}

const TERMINOLOGY_MAP: readonly Term[] = [
  /* ================================================================
   * 类别 1: FUNCTIONAL_FACTOR 功能性因子 (58 条)
   * ================================================================ */

  // --- 肽类 ---
  { key: '多肽', normalized: '生物活性肽(Bioactive Peptides)', category: 'FUNCTIONAL_FACTOR', confidence: 0.96 },
  { key: '寡肽', normalized: '寡肽(Oligopeptide)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: '二肽', normalized: '二肽(Dipeptide)', category: 'FUNCTIONAL_FACTOR', confidence: 0.95 },
  { key: '三肽', normalized: '三肽(Tripeptide)', category: 'FUNCTIONAL_FACTOR', confidence: 0.95 },
  { key: 'ACE抑制肽', normalized: 'ACE抑制肽(ACE Inhibitory Peptide)', category: 'FUNCTIONAL_FACTOR', confidence: 0.98 },
  { key: '降血压肽', normalized: 'ACE抑制肽(ACE Inhibitory Peptide)', category: 'FUNCTIONAL_FACTOR', confidence: 0.94 },
  { key: 'DPP-IV抑制肽', normalized: 'DPP-IV抑制肽(DPP-IV Inhibitory Peptide)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: '降血糖肽', normalized: 'DPP-IV抑制肽(DPP-IV Inhibitory Peptide)', category: 'FUNCTIONAL_FACTOR', confidence: 0.93 },
  { key: '抗氧化肽', normalized: '抗氧化肽(Antioxidant Peptide)', category: 'FUNCTIONAL_FACTOR', confidence: 0.96 },
  { key: '抗菌肽', normalized: '抗菌肽(Antimicrobial Peptide / AMP)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: '胶原蛋白肽', normalized: '胶原蛋白水解肽(Collagen Hydrolysate)', category: 'FUNCTIONAL_FACTOR', confidence: 0.98 },
  { key: '胶原肽', normalized: '胶原蛋白水解肽(Collagen Hydrolysate)', category: 'FUNCTIONAL_FACTOR', confidence: 0.95 },
  { key: '鱼胶原蛋白', normalized: '鱼源胶原蛋白(Fish Collagen)', category: 'FUNCTIONAL_FACTOR', confidence: 0.96 },

  // --- 益生菌 ---
  { key: '益生菌', normalized: '益生菌(Probiotics)', category: 'FUNCTIONAL_FACTOR', confidence: 0.98 },
  { key: '乳酸菌', normalized: '乳酸菌(Lactic Acid Bacteria / LAB)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: '双歧杆菌', normalized: '双歧杆菌(Bifidobacterium)', category: 'FUNCTIONAL_FACTOR', confidence: 0.98 },
  { key: '嗜热链球菌', normalized: '嗜热链球菌(Streptococcus thermophilus)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: '植物乳杆菌', normalized: '植物乳杆菌(Lactobacillus plantarum)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: '鼠李糖乳杆菌', normalized: '鼠李糖乳杆菌(Lactobacillus rhamnosus GG)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: 'LGG', normalized: '鼠李糖乳杆菌(Lactobacillus rhamnosus GG)', category: 'FUNCTIONAL_FACTOR', confidence: 0.96 },
  { key: '发酵乳杆菌', normalized: '发酵乳杆菌(Lactobacillus fermentum)', category: 'FUNCTIONAL_FACTOR', confidence: 0.95 },
  { key: '保加利亚乳杆菌', normalized: '德氏乳杆菌保加利亚亚种(L. bulgaricus)', category: 'FUNCTIONAL_FACTOR', confidence: 0.95 },

  // --- 益生元 ---
  { key: '益生元', normalized: '益生元(Prebiotics)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: '菊粉', normalized: '菊糖/菊粉(Inulin)', category: 'FUNCTIONAL_FACTOR', confidence: 0.98 },
  { key: 'FOS', normalized: '低聚果糖(Fructooligosaccharide / FOS)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: '低聚果糖', normalized: '低聚果糖(Fructooligosaccharide / FOS)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: 'GOS', normalized: '低聚半乳糖(Galactooligosaccharide / GOS)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: '聚葡萄糖', normalized: '聚葡萄糖(Polydextrose)', category: 'FUNCTIONAL_FACTOR', confidence: 0.96 },
  { key: '抗性糊精', normalized: '抗性糊精(Resistant Dextrin)', category: 'FUNCTIONAL_FACTOR', confidence: 0.96 },
  { key: '低聚异麦芽糖', normalized: '低聚异麦芽糖(Isomaltooligosaccharide / IMO)', category: 'FUNCTIONAL_FACTOR', confidence: 0.95 },

  // --- 多糖类 ---
  { key: '多糖', normalized: '生物活性多糖(Bioactive Polysaccharide)', category: 'FUNCTIONAL_FACTOR', confidence: 0.94 },
  { key: '香菇多糖', normalized: '香菇多糖(Lentinan)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: '灵芝多糖', normalized: '灵芝多糖(Ganoderma lucidum polysaccharide)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: '枸杞多糖', normalized: '枸杞多糖(Lycium barbarum polysaccharide / LBP)', category: 'FUNCTIONAL_FACTOR', confidence: 0.96 },
  { key: '海带多糖', normalized: '褐藻胶/海带多糖(Alginate)', category: 'FUNCTIONAL_FACTOR', confidence: 0.95 },
  { key: '壳聚糖', normalized: '壳聚糖(Chitosan)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: 'β-葡聚糖', normalized: 'β-葡聚糖(β-Glucan)', category: 'FUNCTIONAL_FACTOR', confidence: 0.96 },
  { key: '燕麦β-葡聚糖', normalized: '燕麦β-葡聚糖(Oat β-Glucan)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },

  // --- 其他功能性因子 ---
  { key: '膳食纤维', normalized: ' Dietary Fiber / 膳食纤维', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: 'omega-3', normalized: 'Omega-3多不饱和脂肪酸(ω-3 PUFA)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: 'DHA', normalized: '二十二碳六烯酸(Docosahexaenoic Acid / DHA)', category: 'FUNCTIONAL_FACTOR', confidence: 0.99 },
  { key: 'EPA', normalized: '二十碳五烯酸(Eicosapentaenoic Acid / EPA)', category: 'FUNCTIONAL_FACTOR', confidence: 0.99 },
  { key: 'ALA', normalized: 'α-亚麻酸(α-Linolenic Acid / ALA)', category: 'FUNCTIONAL_FACTOR', confidence: 0.96 },
  { key: '磷脂', normalized: '磷脂(Phospholipid)', category: 'FUNCTIONAL_FACTOR', confidence: 0.95 },
  { key: '卵磷脂', normalized: '磷脂酰胆碱/卵磷脂(Lecithin / PC)', category: 'FUNCTIONAL_FACTOR', confidence: 0.96 },
  { key: '辅酶Q10', normalized: '辅酶Q10(Coenzyme Q10 / Ubiquinone)', category: 'FUNCTIONAL_FACTOR', confidence: 0.98 },
  { key: 'CoQ10', normalized: '辅酶Q10(Coenzyme Q10 / Ubiquinone)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: '褪黑素', normalized: '褪黑素(Melatonin)', category: 'FUNCTIONAL_FACTOR', confidence: 0.98 },
  { key: 'GABA', normalized: 'γ-氨基丁酸(Gamma-Aminobutyric Acid / GABA)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: '氨基丁酸', normalized: 'γ-氨基丁酸(Gamma-Aminobutyric Acid / GABA)', category: 'FUNCTIONAL_FACTOR', confidence: 0.94 },
  { key: '黄酮', normalized: '黄酮类化合物(Flavonoids)', category: 'FUNCTIONAL_FACTOR', confidence: 0.95 },
  { key: '花青素', normalized: '花青素(Anthocyanins)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: '番茄红素', normalized: '番茄红素(Lycopene)', category: 'FUNCTIONAL_FACTOR', confidence: 0.98 },
  { key: '叶黄素', normalized: '叶黄素(Lutein)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },
  { key: '玉米黄质', normalized: '玉米黄质(Zeaxanthin)', category: 'FUNCTIONAL_FACTOR', confidence: 0.96 },
  { key: '皂苷', normalized: '皂苷(Saponins)', category: 'FUNCTIONAL_FACTOR', confidence: 0.95 },
  { key: '乳铁蛋白', normalized: '乳铁蛋白(Lactoferrin / Lf)', category: 'FUNCTIONAL_FACTOR', confidence: 0.98 },
  { key: '免疫球蛋白', normalized: '免疫球蛋白(Immunoglobulin / IgG)', category: 'FUNCTIONAL_FACTOR', confidence: 0.96 },
  { key: '弹性蛋白', normalized: '弹性蛋白(Elastin)', category: 'FUNCTIONAL_FACTOR', confidence: 0.95 },
  { key: '透明质酸', normalized: '透明质酸/玻尿酸(Hyaluronic Acid / HA)', category: 'FUNCTIONAL_FACTOR', confidence: 0.98 },
  { key: '玻尿酸', normalized: '透明质酸/玻尿酸(Hyaluronic Acid / HA)', category: 'FUNCTIONAL_FACTOR', confidence: 0.96 },
  { key: 'MCT', normalized: '中链甘油三酯(Medium Chain Triglycerides / MCT)', category: 'FUNCTIONAL_FACTOR', confidence: 0.97 },

  /* ================================================================
   * 类别 2: PRODUCT_FORM 产品形态 (35 条)
   * ================================================================ */
  { key: '固体饮料', normalized: '固体饮料(Solid Drink)', category: 'PRODUCT_FORM', confidence: 0.99 },
  { key: '软糖', normalized: '软糖(Gummy / Pectin Gummy)', category: 'PRODUCT_FORM', confidence: 0.98 },
  { key: '片剂', normalized: '压片糖果/片剂(Tablet)', category: 'PRODUCT_FORM', confidence: 0.98 },
  { key: '压片糖果', normalized: '压片糖果/片剂(Tablet)', category: 'PRODUCT_FORM', confidence: 0.99 },
  { key: '胶囊', normalized: '硬胶囊/软胶囊(Capsule)', category: 'PRODUCT_FORM', confidence: 0.98 },
  { key: '硬胶囊', normalized: '硬胶囊(Hard Capsule)', category: 'PRODUCT_FORM', confidence: 0.97 },
  { key: '软胶囊', normalized: '软胶囊(Softgel / Soft Capsule)', category: 'PRODUCT_FORM', confidence: 0.97 },
  { key: '粉剂', normalized: '粉末制剂(Powder)', category: 'PRODUCT_FORM', confidence: 0.97 },
  { key: '液态饮', normalized: '液态饮品(Liquid Drink)', category: 'PRODUCT_FORM', confidence: 0.96 },
  { key: '即饮', normalized: '即饮型饮料(RTD Beverage)', category: 'PRODUCT_FORM', confidence: 0.96 },
  { key: '冲调', normalized: '冲调饮品(Instant Drink Mix)', category: 'PRODUCT_FORM', confidence: 0.95 },
  { key: '口服液', normalized: '口服液(Oral Liquid)', category: 'PRODUCT_FORM', confidence: 0.98 },
  { key: '滴剂', normalized: '滴剂(Drops / Tincture)', category: 'PRODUCT_FORM', confidence: 0.97 },
  { key: '代餐棒', normalized: '代餐棒/营养棒(Meal Replacement Bar)', category: 'PRODUCT_FORM', confidence: 0.96 },
  { key: '能量棒', normalized: '能量棒(Energy Bar / Protein Bar)', category: 'PRODUCT_FORM', confidence: 0.96 },
  { key: '蛋白棒', normalized: '能量棒(Energy Bar / Protein Bar)', category: 'PRODUCT_FORM', confidence: 0.95 },
  { key: '果冻', normalized: '功能果冻(Jelly)', category: 'PRODUCT_FORM', confidence: 0.97 },
  { key: '代餐粉', normalized: '代餐粉(Meal Replacement Powder / MRPs)', category: 'PRODUCT_FORM', confidence: 0.97 },
  { key: '奶昔', normalized: '代餐奶昔(Meal Replacement Shake)', category: 'PRODUCT_FORM', confidence: 0.95 },
  { key: '特膳食品', normalized: '特殊膳食食品(Foods for Special Dietary Uses)', category: 'PRODUCT_FORM', confidence: 0.96 },
  { key: '特医食品', normalized: '特殊医学用途配方食品(FSMP)', category: 'PRODUCT_FORM', confidence: 0.97 },
  { key: 'FSMP', normalized: '特殊医学用途配方食品(FSMP)', category: 'PRODUCT_FORM', confidence: 0.96 },
  { key: '运动营养', normalized: '运动营养食品(Sports Nutrition Food)', category: 'PRODUCT_FORM', confidence: 0.96 },
  { key: '婴幼儿辅食', normalized: '婴幼儿辅助食品(Complementary Food for Infants)', category: 'PRODUCT_FORM', confidence: 0.95 },
  { key: '调制乳粉', normalized: '调制乳粉(Formulated Milk Powder)', category: 'PRODUCT_FORM', confidence: 0.97 },
  { key: '含乳饮料', normalized: '含乳饮料(Milk Beverage)', category: 'PRODUCT_FORM', confidence: 0.96 },
  { key: '植物基饮料', normalized: '植物基饮料(Plant-based Beverage)', category: 'PRODUCT_FORM', confidence: 0.95 },
  { key: '酵素饮品', normalized: '酵素饮料(Enzyme Drink)', category: 'PRODUCT_FORM', confidence: 0.95 },
  { key: '益生菌粉', normalized: '益生菌固态制剂(Probiotics Powder)', category: 'PRODUCT_FORM', confidence: 0.96 },
  { key: '安瓶', normalized: '安瓶(Ampoule)', category: 'PRODUCT_FORM', confidence: 0.94 },
  { key: '吸管包装', normalized: '吸管包装(Straw Sachet / Stick Pack)', category: 'PRODUCT_FORM', confidence: 0.93 },
  { key: '条包', normalized: '条状小袋包装(Stick Pack / Sachet)', category: 'PRODUCT_FORM', confidence: 0.94 },
  { key: '瓶装水', normalized: '瓶装饮用水(Bottled Water)', category: 'PRODUCT_FORM', confidence: 0.93 },
  { key: '气泡水', normalized: '碳酸气泡饮料(Sparkling Water)', category: 'PRODUCT_FORM', confidence: 0.94 },
  { key: '功能茶饮', normalized: '功能性茶饮料(Functional Tea Drink)', category: 'PRODUCT_FORM', confidence: 0.93 },
  { key: '谷物脆', normalized: '膨化谷物制品(Puffed Cereal Snack)', category: 'PRODUCT_FORM', confidence: 0.92 },

  /* ================================================================
   * 类别 3: PROCESS_TECHNOLOGY 工艺技术 (45 条)
   * ================================================================ */
  { key: '喷雾干燥', normalized: '喷雾干燥(Spray Drying)', category: 'PROCESS_TECHNOLOGY', confidence: 0.97 },
  { key: '微胶囊化', normalized: '微胶囊化技术(Microencapsulation)', category: 'PROCESS_TECHNOLOGY', confidence: 0.96 },
  { key: '冷冻干燥', normalized: '真空冷冻干燥(Freeze Drying / Lyophilization)', category: 'PROCESS_TECHNOLOGY', confidence: 0.97 },
  { key: '冻干', normalized: '真空冷冻干燥(Freeze Drying / Lyophilization)', category: 'PROCESS_TECHNOLOGY', confidence: 0.96 },
  { key: '真空冷冻', normalized: '真空冷冻干燥(Freeze Drying / Lyophilization)', category: 'PROCESS_TECHNOLOGY', confidence: 0.95 },
  { key: '酶解', normalized: '酶解技术(Enzymatic Hydrolysis)', category: 'PROCESS_TECHNOLOGY', confidence: 0.96 },
  { key: '发酵', normalized: '微生物发酵技术(Fermentation Technology)', category: 'PROCESS_TECHNOLOGY', confidence: 0.96 },
  { key: '超临界萃取', normalized: '超临界流体萃取(Supercritical Fluid Extraction / SFE)', category: 'PROCESS_TECHNOLOGY', confidence: 0.97 },
  { key: '纳米乳化', normalized: '纳米乳化技术(Nanoemulsion)', category: 'PROCESS_TECHNOLOGY', confidence: 0.96 },
  { key: '高压均质', normalized: '高压均质技术(High Pressure Homogenization / HPH)', category: 'PROCESS_TECHNOLOGY', confidence: 0.96 },
  { key: '挤压膨化', normalized: '挤压膨化技术(Extrusion / Extruded Puffing)', category: 'PROCESS_TECHNOLOGY', confidence: 0.95 },
  { key: '膜分离', normalized: '膜分离技术(Membrane Separation)', category: 'PROCESS_TECHNOLOGY', confidence: 0.95 },
  { key: '离子交换', normalized: '离子交换色谱(Ion Exchange Chromatography / IEC)', category: 'PROCESS_TECHNOLOGY', confidence: 0.94 },
  { key: '分子蒸馏', normalized: '分子蒸馏(Molecular Distillation)', category: 'PROCESS_TECHNOLOGY', confidence: 0.95 },
  { key: '包埋技术', normalized: '微胶囊包埋技术(Encapsulation / Microencapsulation)', category: 'PROCESS_TECHNOLOGY', confidence: 0.95 },
  { key: '超微粉碎', normalized: '超微粉碎技术(Ultrafine Grinding / Micronization)', category: 'PROCESS_TECHNOLOGY', confidence: 0.95 },
  { key: '超声波提取', normalized: '超声辅助提取(Ultrasonic-Assisted Extraction / UAE)', category: 'PROCESS_TECHNOLOGY', confidence: 0.94 },
  { key: '微波提取', normalized: '微波辅助提取(Microwave-Assisted Extraction / MAE)', category: 'PROCESS_TECHNOLOGY', confidence: 0.94 },
  { key: '亚临界萃取', normalized: '亚临界流体萃取(Subcritical Fluid Extraction)', category: 'PROCESS_TECHNOLOGY', confidence: 0.93 },
  { key: '反渗透', normalized: '反渗透膜分离(Reverse Osmosis / RO)', category: 'PROCESS_TECHNOLOGY', confidence: 0.94 },
  { key: '纳滤', normalized: '纳滤(Nanofiltration / NF)', category: 'PROCESS_TECHNOLOGY', confidence: 0.93 },
  { key: '超滤', normalized: '超滤(Ultrafiltration / UF)', category: 'PROCESS_TECHNOLOGY', confidence: 0.93 },
  { key: '电渗析', normalized: '电渗析(Electrodialysis / ED)', category: 'PROCESS_TECHNOLOGY', confidence: 0.92 },
  { key: '凝胶过滤', normalized: '尺寸排阻色谱/凝胶过滤(Size Exclusion Chromatography / SEC)', category: 'PROCESS_TECHNOLOGY', confidence: 0.92 },
  { key: '亲和层析', normalized: '亲和层析(Affinity Chromatography)', category: 'PROCESS_TECHNOLOGY', confidence: 0.93 },
  { key: '喷雾冷却', normalized: '喷雾冷凝(Spray Cooling / Spray Congealing)', category: 'PROCESS_TECHNOLOGY', confidence: 0.93 },
  { key: '流化床制粒', normalized: '流化床造粒(Fluidized Bed Granulation)', category: 'PROCESS_TECHNOLOGY', confidence: 0.93 },
  { key: '湿法制粒', normalized: '湿法制粒(Wet Granulation)', category: 'PROCESS_TECHNOLOGY', confidence: 0.93 },
  { key: '干法制粒', normalized: '干法制粒(Dry Granulation / Roller Compaction)', category: 'PROCESS_TECHNOLOGY', confidence: 0.93 },
  { key: '直接压片', normalized: '直接压片法(Direct Compression)', category: 'PROCESS_TECHNOLOGY', confidence: 0.93 },
  { key: '沸腾制粒', normalized: '一步制粒/沸腾床制粒(Fluid Bed Granulation / One-step Granulation)', category: 'PROCESS_TECHNOLOGY', confidence: 0.92 },
  { key: 'UHT杀菌', normalized: '超高温瞬时灭菌(Ultra-High Temperature / UHT)', category: 'PROCESS_TECHNOLOGY', confidence: 0.95 },
  { key: '巴氏杀菌', normalized: '巴氏灭菌(Pasteurization)', category: 'PROCESS_TECHNOLOGY', confidence: 0.95 },
  { key: 'HTST', normalized: '高温短时杀菌(HTST Pasteurization)', category: 'PROCESS_TECHNOLOGY', confidence: 0.93 },
  { key: 'HPP', normalized: '高压加工/冷杀菌(High Pressure Processing / HPP)', category: 'PROCESS_TECHNOLOGY', confidence: 0.94 },
  { key: '辐照杀菌', normalized: '食品辐照(Irradiation)', category: 'PROCESS_TECHNOLOGY', confidence: 0.93 },
  { key: '无菌灌装', normalized: '无菌灌装技术(Aseptic Filling / Aseptic Processing)', category: 'PROCESS_TECHNOLOGY', confidence: 0.94 },
  { key: '热回流提取', normalized: '热回流提取(Heat Reflux Extraction)', category: 'PROCESS_TECHNOLOGY', confidence: 0.92 },
  { key: '渗漉提取', normalized: '渗漉法(Percolation Extraction)', category: 'PROCESS_TECHNOLOGY', confidence: 0.91 },
  { key: 'CO2超临界', normalized: '超临界CO2萃取(Supercritical CO2 Extraction)', category: 'PROCESS_TECHNOLOGY', confidence: 0.95 },
  { key: '脂质体', normalized: '脂质体包埋技术(Liposome Encapsulation)', category: 'PROCESS_TECHNOLOGY', confidence: 0.94 },
  { key: '固体分散体', normalized: '固体分散体技术(Solid Dispersion)', category: 'PROCESS_TECHNOLOGY', confidence: 0.92 },
  { key: '环糊精包合', normalized: '环糊精包合技术(Cyclodextrin Inclusion)', category: 'PROCESS_TECHNOLOGY', confidence: 0.93 },
  { key: '美拉德反应', normalized: '美拉德反应/非酶褐变(Maillard Reaction)', category: 'PROCESS_TECHNOLOGY', confidence: 0.94 },
  { key: '美拉德', normalized: '美拉德反应/非酶褐变(Maillard Reaction)', category: 'PROCESS_TECHNOLOGY', confidence: 0.92 },

  /* ================================================================
   * 类别 4: REGULATORY_STANDARD 法规标准 (35 条)
   * ================================================================ */
  { key: 'GB标准', normalized: 'GB国家标准体系(National Standard of PRC)', category: 'REGULATORY_STANDARD', confidence: 0.95 },
  { key: 'GB', normalized: 'GB国家标准体系(National Standard of PRC)', category: 'REGULATORY_STANDARD', confidence: 0.93 },
  { key: 'FDA', normalized: '美国FDA GRAS认证(FDA GRAS Status)', category: 'REGULATORY_STANDARD', confidence: 0.96 },
  { key: 'GRAS', normalized: 'GRAS一般公认安全(Generally Recognized As Safe)', category: 'REGULATORY_STANDARD', confidence: 0.95 },
  { key: '保健食品', normalized: 'GB 16740保健食品(Health Food / Health Supplements)', category: 'REGULATORY_STANDARD', confidence: 0.94 },
  { key: '蓝帽子', normalized: '中国保健食品注册批准("Blue Hat" Approval)', category: 'REGULATORY_STANDARD', confidence: 0.95 },
  { key: 'NMPA', normalized: '国家药品监督管理局(NMPA)监管体系', category: 'REGULATORY_STANDARD', confidence: 0.96 },
  { key: '药监局', normalized: '国家药品监督管理局(NMPA)监管体系', category: 'REGULATORY_STANDARD', confidence: 0.93 },
  { key: 'EFSA', normalized: '欧盟食品安全局(European Food Safety Authority)', category: 'REGULATORY_STANDARD', confidence: 0.95 },
  { key: 'EFSA Novel Food', normalized: '欧盟新型食品审批(EFSA Novel Food Authorization)', category: 'REGULATORY_STANDARD', confidence: 0.94 },
  { key: 'ISO22000', normalized: 'ISO 22000食品安全管理体系', category: 'REGULATORY_STANDARD', confidence: 0.95 },
  { key: 'HACCP', normalized: '危害分析与关键控制点(HACCP)体系', category: 'REGULATORY_STANDARD', confidence: 0.96 },
  { key: 'GMP', normalized: '良好生产规范(Good Manufacturing Practice)', category: 'REGULATORY_STANDARD', confidence: 0.96 },
  { key: 'cGMP', normalized: '现行良好生产规范(cGMP)', category: 'REGULATORY_STANDARD', confidence: 0.95 },
  { key: '有机认证', normalized: '有机产品认证(Organic Certification)', category: 'REGULATORY_STANDARD', confidence: 0.94 },
  { key: '清洁标签', normalized: '清洁标签/Clean Label理念(Clean Label)', category: 'REGULATORY_STANDARD', confidence: 0.93 },
  { key: 'Clean Label', normalized: '清洁标签/Clean Label理念(Clean Label)', category: 'REGULATORY_STANDARD', confidence: 0.94 },
  { key: '新资源食品', normalized: '新资源食品/新食品原料(Novel Food Ingredient)', category: 'REGULATORY_STANDARD', confidence: 0.95 },
  { key: '新食品原料', normalized: '新资源食品/新食品原料(Novel Food Ingredient)', category: 'REGULATORY_STANDARD', confidence: 0.95 },
  { key: '食品添加剂GB', normalized: 'GB 2760食品添加剂使用标准', category: 'REGULATORY_STANDARD', confidence: 0.95 },
  { key: 'GB2760', normalized: 'GB 2760食品添加剂使用标准', category: 'REGULATORY_STANDARD', confidence: 0.96 },
  { key: '营养强化剂', normalized: 'GB 14880食品营养强化剂使用标准', category: 'REGULATORY_STANDARD', confidence: 0.95 },
  { key: 'GB14880', normalized: 'GB 14880食品营养强化剂使用标准', category: 'REGULATORY_STANDARD', confidence: 0.95 },
  { key: '污染物限量', normalized: 'GB 2762食品中污染物限量', category: 'REGULATORY_STANDARD', confidence: 0.94 },
  { key: 'GB2762', normalized: 'GB 2762食品中污染物限量', category: 'REGULATORY_STANDARD', confidence: 0.94 },
  { key: '真菌毒素限量', normalized: 'GB 2761食品中真菌毒素限量', category: 'REGULATORY_STANDARD', confidence: 0.93 },
  { key: 'GB7718', normalized: 'GB 7718预包装食品标签通则', category: 'REGULATORY_STANDARD', confidence: 0.94 },
  { key: '标签标识', normalized: 'GB 7718预包装食品标签通则', category: 'REGULATORY_STANDARD', confidence: 0.92 },
  { key: '营养成分表', normalized: 'GB 28050预包装食品营养标签通则', category: 'REGULATORY_STANDARD', confidence: 0.93 },
  { key: 'GB28050', normalized: 'GB 28050预包装食品营养标签通则', category: 'REGULATORY_STANDARD', confidence: 0.94 },
  { key: 'Codex', normalized: '国际食品法典委员会(Codex Alimentarius)', category: 'REGULATORY_STANDARD', confidence: 0.93 },
  { key: 'CAC', normalized: '国际食品法典委员会(Codex Alimentarius Commission)', category: 'REGULATORY_STANDARD', confidence: 0.92 },
  { key: 'FDA NDIN', normalized: '美国FDA新膳食成分通知(New Dietary Ingredient Notification)', category: 'REGULATORY_STANDARD', confidence: 0.93 },
  { key: 'DSHEA', normalized: '美国DSHEA膳食补充剂健康与教育法案', category: 'REGULATORY_STANDARD', confidence: 0.93 },
  { key: 'Novel Food EU', normalized: '欧盟新型食品法规(EC) No 258/97', category: 'REGULATORY_STANDARD', confidence: 0.92 },
  { key: '清真认证', normalized: 'Halal清真食品认证(Halal Certification)', category: 'REGULATORY_STANDARD', confidence: 0.93 },
  { key: '犹太洁食', normalized: 'Kosher犹太洁食认证(Kosher Certification)', category: 'REGULATORY_STANDARD', confidence: 0.92 },

  /* ================================================================
   * 类别 5: SAFETY_PARAM 安全参数 (28 条)
   * ================================================================ */
  { key: 'ADI', normalized: '每日允许摄入量(Acceptable Daily Intake / ADI)', category: 'SAFETY_PARAM', confidence: 0.98 },
  { key: '每日允许摄入量', normalized: '每日允许摄入量(Acceptable Daily Intake / ADI)', category: 'SAFETY_PARAM', confidence: 0.96 },
  { key: 'LD50', normalized: '半数致死量(Median Lethal Dose / LD₅₀)', category: 'SAFETY_PARAM', confidence: 0.97 },
  { key: '半数致死量', normalized: '半数致死量(Median Lethal Dose / LD₅₀)', category: 'SAFETY_PARAM', confidence: 0.95 },
  { key: 'NOAEL', normalized: '未观察到有害作用水平(No Observed Adverse Effect Level)', category: 'SAFETY_PARAM', confidence: 0.96 },
  { key: 'LOAEL', normalized: '最低观察到有害作用水平(Lowest Observed Adverse Effect Level)', category: 'SAFETY_PARAM', confidence: 0.95 },
  { key: 'ARfD', normalized: '急性参考剂量(Acute Reference Dose / ARfD)', category: 'SAFETY_PARAM', confidence: 0.94 },
  { key: 'RfD', normalized: '参考剂量(Reference Dose / RfD)', category: 'SAFETY_PARAM', confidence: 0.94 },
  { key: 'MOE', normalized: '安全边际/暴露限值(Margin of Exposure / MOE)', category: 'SAFETY_PARAM', confidence: 0.93 },
  { key: '重金属限量', normalized: '重金属最大残留限量(Heavy Metal MRLs)', category: 'SAFETY_PARAM', confidence: 0.95 },
  { key: '铅镉砷汞', normalized: '重金属(Pb/Cd/As/Hg)残留限量', category: 'SAFETY_PARAM', confidence: 0.94 },
  { key: '微生物指标', normalized: '微生物限量标准(Microbiological Criteria)', category: 'SAFETY_PARAM', confidence: 0.94 },
  { key: '菌落总数', normalized: '菌落总数(Aerobic Plate Count / APC)', category: 'SAFETY_PARAM', confidence: 0.95 },
  { key: '大肠菌群', normalized: '大肠菌群(Coliforms)', category: 'SAFETY_PARAM', confidence: 0.95 },
  { key: '沙门氏菌', normalized: '沙门氏菌(Salmonella spp.)', category: 'SAFETY_PARAM', confidence: 0.96 },
  { key: '金黄色葡萄球菌', normalized: '金黄色葡萄球菌(Staphylococcus aureus)', category: 'SAFETY_PARAM', confidence: 0.95 },
  { key: '霉菌酵母', normalized: '霉菌和酵母计数(Molds & Yeasts)', category: 'SAFETY_PARAM', confidence: 0.94 },
  { key: '过敏原', normalized: '食物致敏原(Food Allergen)', category: 'SAFETY_PARAM', confidence: 0.95 },
  { key: '八大过敏原', normalized: '八大类食物致敏原(Major Food Allergens)', category: 'SAFETY_PARAM', confidence: 0.94 },
  { key: '转基因', normalized: '转基因成分检测(GMO Detection)', category: 'SAFETY_PARAM', confidence: 0.94 },
  { key: 'GMO', normalized: '转基因成分检测(GMO Detection)', category: 'SAFETY_PARAM', confidence: 0.95 },
  { key: '农残', normalized: '农药残留限量(Pesticide MRLs)', category: 'SAFETY_PARAM', confidence: 0.94 },
  { key: '兽残', normalized: '兽药残留限量(Veterinary Drug Residue Limits)', category: 'SAFETY_PARAM', confidence: 0.93 },
  { key: '三聚氰胺', normalized: '三聚氰胺限量(Melamine Limit)', category: 'SAFETY_PARAM', confidence: 0.94 },
  { key: '塑化剂', normalized: '邻苯二甲酸酯/塑化剂(Phthalates / PAEs)', category: 'SAFETY_PARAM', confidence: 0.93 },
  { key: 'PAEs', normalized: '邻苯二甲酸酯/塑化剂(Phthalates / PAEs)', category: 'SAFETY_PARAM', confidence: 0.92 },
  { key: '丙烯酰胺', normalized: '丙烯酰胺限量(Acrylamide Limit)', category: 'SAFETY_PARAM', confidence: 0.93 },
  { key: '苯并芘', normalized: '苯并[a]芘(Benzo[a]pyrene / B(a)P)', category: 'SAFETY_PARAM', confidence: 0.93 },
  { key: '黄曲霉毒素', normalized: '黄曲霉毒素(Aflatoxins / AF)', category: 'SAFETY_PARAM', confidence: 0.95 },

  /* ================================================================
   * 类别 6: SENSORY_ATTRIBUTE 感官属性 (28 条)
   * ================================================================ */
  { key: '口感', normalized: '感官质地与口感(Sensory Texture & Mouthfeel)', category: 'SENSORY_ATTRIBUTE', confidence: 0.93 },
  { key: '风味轮', normalized: '风味剖面分析(Flavor Profile / Flavor Wheel)', category: 'SENSORY_ATTRIBUTE', confidence: 0.95 },
  { key: '质构剖面', normalized: '质地剖面分析(Texture Profile Analysis / TPA)', category: 'SENSORY_ATTRIBUTE', confidence: 0.95 },
  { key: 'TPA', normalized: '质地剖面分析(Texture Profile Analysis / TPA)', category: 'SENSORY_ATTRIBUTE', confidence: 0.93 },
  { key: '色泽稳定性', normalized: '颜色稳定性(Color Stability)', category: 'SENSORY_ATTRIBUTE', confidence: 0.93 },
  { key: '溶解性', normalized: '溶解度/溶解性能(Solubility)', category: 'SENSORY_ATTRIBUTE', confidence: 0.94 },
  { key: '分散性', normalized: '分散性能(Dispersibility)', category: 'SENSORY_ATTRIBUTE', confidence: 0.93 },
  { key: '流动性', normalized: '流动性能(Flowability)', category: 'SENSORY_ATTRIBUTE', confidence: 0.93 },
  { key: '吸湿性', normalized: '吸湿特性(Hygroscopicity)', category: 'SENSORY_ATTRIBUTE', confidence: 0.93 },
  { key: '结块性', normalized: '抗结块性能(Anti-caking Property)', category: 'SENSORY_ATTRIBUTE', confidence: 0.92 },
  { key: '硬度', normalized: '硬度(Hardness)', category: 'SENSORY_ATTRIBUTE', confidence: 0.94 },
  { key: '脆性', normalized: '脆度/酥脆性(Crispness / Fracturability)', category: 'SENSORY_ATTRIBUTE', confidence: 0.93 },
  { key: '弹性', normalized: '弹性(Springiness)', category: 'SENSORY_ATTRIBUTE', confidence: 0.93 },
  { key: '粘性', normalized: '粘附性/粘性(Adhesiveness)', category: 'SENSORY_ATTRIBUTE', confidence: 0.93 },
  { key: '咀嚼性', normalized: '咀嚼性/嚼劲(Chewiness)', category: 'SENSORY_ATTRIBUTE', confidence: 0.93 },
  { key: '回弹性', normalized: '恢复性/回弹(Resilience)', category: 'SENSORY_ATTRIBUTE', confidence: 0.92 },
  { key: '凝胶强度', normalized: '凝胶强度(Gel Strength / Bloom Value)', category: 'SENSORY_ATTRIBUTE', confidence: 0.93 },
  { key: 'Bloom值', normalized: '凝胶强度(Gel Strength / Bloom Value)', category: 'SENSORY_ATTRIBUTE', confidence: 0.92 },
  { key: '浊度', normalized: '浑浊度(Turbidity)', category: 'SENSORY_ATTRIBUTE', confidence: 0.92 },
  { key: '沉淀率', normalized: '沉淀/沉降速率(Sedimentation Rate)', category: 'SENSORY_ATTRIBUTE', confidence: 0.92 },
  { key: '分层稳定性', normalized: '乳化稳定性/抗分层(Emulsion Stability / Creaming Stability)', category: 'SENSORY_ATTRIBUTE', confidence: 0.92 },
  { key: '粒径分布', normalized: '颗粒大小分布(Particle Size Distribution / PSD)', category: 'SENSORY_ATTRIBUTE', confidence: 0.92 },
  { key: '堆密度', normalized: '堆积密度(Bulk Density)', category: 'SENSORY_ATTRIBUTE', confidence: 0.92 },
  { key: '振实密度', normalized: '振实密度(Tapped Density)', category: 'SENSORY_ATTRIBUTE', confidence: 0.91 },
  { key: '休止角', normalized: '休止角(Angle of Repose)', category: 'SENSORY_ATTRIBUTE', confidence: 0.91 },
  { key: ' Carr指数', normalized: 'Carr可压缩性指数(Carr Index / CI)', category: 'SENSORY_ATTRIBUTE', confidence: 0.90 },
  { key: 'Hausner比', normalized: 'Hausner比值(Hausner Ratio)', category: 'SENSORY_ATTRIBUTE', confidence: 0.90 },
  { key: '感官评定', normalized: '感官评价方法(Sensory Evaluation Methodology)', category: 'SENSORY_ATTRIBUTE', confidence: 0.93 },
] as const

const TERM_INDEX: ReadonlyMap<string, Term> = new Map(
  TERMINOLOGY_MAP.map((term) => [term.key.toLowerCase(), term]),
)

function computeSimilarity(a: string, b: string): number {
  const la = a.length
  const lb = b.length
  if (la === 0 || lb === 0) return 0
  let matches = 0
  const longer = la >= lb ? a : b
  const shorter = la >= lb ? b : a
  for (let i = 0; i <= longer.length - shorter.length; i++) {
    let match = true
    for (let j = 0; j < shorter.length; j++) {
      if (longer[i + j] !== shorter[j]) {
        match = false
        break
      }
    }
    if (match) matches++
  }
  return matches > 0 ? Math.min(matches / shorter.length, 1) : 0
}

export function lookupTerm(keyword: string): Term | undefined {
  if (!keyword || typeof keyword !== 'string') return undefined
  const trimmed = keyword.trim()
  if (!trimmed) return undefined
  return TERM_INDEX.get(trimmed.toLowerCase())
}

export function fuzzyMatchTerms(query: string, threshold = 0.5): Term[] {
  if (!query || typeof query !== 'string') return []
  const q = query.trim().toLowerCase()
  if (!q) return []
  const results: (Term & { _score: number })[] = []
  for (const term of TERMINOLOGY_MAP) {
    const keyLower = term.key.toLowerCase()
    let score = 0
    if (keyLower === q) {
      score = 1.0
    } else if (keyLower.includes(q)) {
      score = 0.85 + (q.length / keyLower.length) * 0.14
    } else if (q.includes(keyLower)) {
      score = 0.75 + (keyLower.length / q.length) * 0.19
    } else {
      score = computeSimilarity(q, keyLower)
    }
    if (score >= threshold) {
      results.push({ ...term, _score: score })
    }
  }
  results.sort((a, b) => {
    if (Math.abs(b._score - a._score) > 0.001) return b._score - a._score
    return b.confidence - a.confidence
  })
  return results.map(({ _score, ...rest }) => rest)
}

export function getTermsByCategory(category: TermCategory): Term[] {
  return TERMINOLOGY_MAP.filter((term) => term.category === category)
}

export function getAllTerms(): readonly Term[] {
  return TERMINOLOGY_MAP
}

export function getCategoryStats(): Record<TermCategory, number> {
  const stats = {} as Record<TermCategory, number>
  for (const term of TERMINOLOGY_MAP) {
    stats[term.category] = (stats[term.category] || 0) + 1
  }
  return stats
}

export { TERMINOLOGY_MAP }
