"""
配料表核查服务 — C端「配料表核查」MVP

功能：输入配料表文本（OCR 或粘贴）或成分名称列表，
      基于公开目录做信息比对，输出结构化报告。

比对目录（复用平台现有数据）：
- 药食同源目录（106 种，含限量）  → formula_compliance.FOOD_HERB_MAX_DOSAGE
- GB 2760 食品添加剂              → compliance_router.GB2760_ADDITIVES
- GB 14880 营养强化剂              → compliance_router.GB14880_ENRICHERS
- 中国食品安全法规禁用品清单       → compliance_router.GB_PROHIBITED_ITEMS
- 常见食品原料（内置词典）

合规边界：
本服务输出定位为「信息分析参考」，不构成食品安全合规结论、
检验报告或法律意见。所有文案避免绝对化判定（如"合规✅"）。
"""
from __future__ import annotations

import logging
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# 报告免责声明（法律安全话术）
DISCLAIMER = (
    "本结果仅为基于公开目录的信息比对参考，不构成食品安全合规结论、"
    "检验报告或法律意见。具体以国家最新发布的标准及官方解释为准。"
)

# ── 常见食品原料词典（标准化名称 → 展示名称） ──
_COMMON_FOOD_ALIASES: Dict[str, str] = {
    # 水
    "水": "水",
    "纯净水": "水",
    "饮用水": "水",
    "矿泉水": "水",
    # 糖类 / 甜味
    "白砂糖": "白砂糖",
    "蔗糖": "白砂糖",
    "绵白糖": "绵白糖",
    "红糖": "红糖",
    "冰糖": "冰糖",
    "葡萄糖": "葡萄糖",
    "果糖": "果糖",
    "麦芽糖": "麦芽糖",
    "乳糖": "乳糖",
    "葡萄糖浆": "葡萄糖浆",
    "果葡糖浆": "果葡糖浆",
    "麦芽糖浆": "麦芽糖浆",
    "淀粉糖浆": "淀粉糖浆",
    "饴糖": "饴糖",
    "蜂蜜": "蜂蜜",
    "麦芽糊精": "麦芽糊精",
    # 谷类及其制品
    "大米": "大米",
    "糯米": "糯米",
    "黑米": "黑米",
    "紫米": "紫米",
    "小米": "小米",
    "玉米": "玉米",
    "燕麦": "燕麦",
    "荞麦": "荞麦",
    "藜麦": "藜麦",
    "高粱": "高粱",
    "小麦": "小麦",
    "小麦粉": "小麦粉",
    "面粉": "小麦粉",
    "全麦粉": "全麦粉",
    "低筋面粉": "低筋面粉",
    "高筋面粉": "高筋面粉",
    "玉米粉": "玉米粉",
    "玉米糁": "玉米糁",
    "淀粉": "淀粉",
    "玉米淀粉": "玉米淀粉",
    "马铃薯淀粉": "马铃薯淀粉",
    "木薯淀粉": "木薯淀粉",
    "红薯淀粉": "红薯淀粉",
    "绿豆淀粉": "绿豆淀粉",
    "小麦淀粉": "小麦淀粉",
    "澄粉": "澄粉",
    "米粉": "米粉",
    "藕粉": "藕粉",
    "麦片": "麦片",
    "膨化玉米": "膨化玉米",
    # 油脂类
    "植物油": "植物油",
    "食用植物油": "食用植物油",
    "大豆油": "大豆油",
    "菜籽油": "菜籽油",
    "花生油": "花生油",
    "玉米油": "玉米油",
    "葵花籽油": "葵花籽油",
    "橄榄油": "橄榄油",
    "芝麻油": "芝麻油",
    "香油": "香油",
    "棕榈油": "棕榈油",
    "椰子油": "椰子油",
    "茶籽油": "茶籽油",
    "米糠油": "米糠油",
    "葡萄籽油": "葡萄籽油",
    "亚麻籽油": "亚麻籽油",
    "黄油": "黄油",
    "人造奶油": "人造奶油",
    "起酥油": "起酥油",
    "猪油": "猪油",
    "氢化植物油": "氢化植物油",
    "植脂末": "植脂末",
    # 乳及乳制品
    "牛奶": "牛奶",
    "生牛乳": "牛奶",
    "全脂乳粉": "乳粉",
    "脱脂乳粉": "乳粉",
    "奶粉": "乳粉",
    "乳清粉": "乳清粉",
    "炼乳": "炼乳",
    "淡奶油": "淡奶油",
    "奶油": "奶油",
    "奶酪": "奶酪",
    "芝士": "奶酪",
    "酸奶": "酸奶",
    "乳粉": "乳粉",
    "乳清蛋白": "乳清蛋白",
    # 蛋类
    "鸡蛋": "鸡蛋",
    "鸭蛋": "鸭蛋",
    "鹌鹑蛋": "鹌鹑蛋",
    "蛋清": "鸡蛋",
    "蛋黄": "鸡蛋",
    "全蛋液": "鸡蛋",
    "蛋粉": "蛋粉",
    # 豆类及其制品
    "大豆": "大豆",
    "黄豆": "大豆",
    "黑豆": "黑豆",
    "绿豆": "绿豆",
    "红豆": "红豆",
    "赤小豆": "赤小豆",
    "豌豆": "豌豆",
    "蚕豆": "蚕豆",
    "鹰嘴豆": "鹰嘴豆",
    "扁豆": "扁豆",
    "豆腐": "豆腐",
    "豆浆": "豆浆",
    "豆粉": "豆粉",
    "豆粕": "豆粕",
    "大豆分离蛋白": "大豆分离蛋白",
    "大豆蛋白": "大豆蛋白",
    "植物蛋白": "植物蛋白",
    # 坚果与种子
    "花生": "花生",
    "芝麻": "芝麻",
    "核桃": "核桃",
    "杏仁": "杏仁",
    "腰果": "腰果",
    "榛子": "榛子",
    "开心果": "开心果",
    "松子": "松子",
    "夏威夷果": "夏威夷果",
    "碧根果": "碧根果",
    "南瓜籽": "南瓜籽",
    "葵花籽": "葵花籽",
    "亚麻籽": "亚麻籽",
    "奇亚籽": "奇亚籽",
    "花生酱": "花生酱",
    # 蔬菜及其制品
    "洋葱": "洋葱",
    "大蒜": "大蒜",
    "生姜": "生姜",
    "葱": "葱",
    "番茄": "番茄",
    "番茄酱": "番茄酱",
    "辣椒": "辣椒",
    "胡萝卜": "胡萝卜",
    "土豆": "土豆",
    "马铃薯": "土豆",
    "南瓜": "南瓜",
    "冬瓜": "冬瓜",
    "黄瓜": "黄瓜",
    "白菜": "白菜",
    "菠菜": "菠菜",
    "西兰花": "西兰花",
    "芹菜": "芹菜",
    "韭菜": "韭菜",
    "香菇": "香菇",
    "蘑菇": "蘑菇",
    "金针菇": "金针菇",
    "木耳": "木耳",
    "银耳": "银耳",
    "海带": "海带",
    "紫菜": "紫菜",
    "山药": "山药",
    "莲藕": "莲藕",
    "萝卜": "萝卜",
    "甜菜": "甜菜",
    # 水果及其制品
    "苹果": "苹果",
    "香蕉": "香蕉",
    "橙子": "橙子",
    "柠檬": "柠檬",
    "草莓": "草莓",
    "蓝莓": "蓝莓",
    "葡萄": "葡萄",
    "梨": "梨",
    "桃": "桃",
    "枣": "枣",
    "枸杞": "枸杞",
    "芒果": "芒果",
    "菠萝": "菠萝",
    "猕猴桃": "猕猴桃",
    "苹果汁": "苹果汁",
    "浓缩果汁": "浓缩果汁",
    "果酱": "果酱",
    "果干": "果干",
    # 肉类及其制品
    "猪肉": "猪肉",
    "牛肉": "牛肉",
    "鸡肉": "鸡肉",
    "鸭肉": "鸭肉",
    "羊肉": "羊肉",
    "火腿": "火腿",
    "培根": "培根",
    "香肠": "香肠",
    "肉松": "肉松",
    "猪骨": "猪骨",
    "鸡骨": "鸡骨",
    "胶原蛋白": "胶原蛋白",
    # 水产及其制品
    "鱼": "鱼",
    "虾": "虾",
    "蟹": "蟹",
    "贝类": "贝类",
    "鱿鱼": "鱿鱼",
    "鱼糜": "鱼糜",
    "鱼露": "鱼露",
    "虾皮": "虾皮",
    "牡蛎": "牡蛎",
    "扇贝": "扇贝",
    # 调味料与辅料
    "食用盐": "食用盐",
    "食盐": "食用盐",
    "氯化钠": "食用盐",
    "酱油": "酱油",
    "食醋": "食醋",
    "料酒": "料酒",
    "味精": "味精",
    "蚝油": "蚝油",
    "沙拉酱": "沙拉酱",
    "辣椒酱": "辣椒酱",
    "豆瓣酱": "豆瓣酱",
    "甜面酱": "甜面酱",
    "胡椒粉": "胡椒粉",
    "花椒": "花椒",
    "八角": "八角",
    "桂皮": "桂皮",
    "香辛料": "香辛料",
    "香辛料粉": "香辛料粉",
    "食用香精": "食用香精",
    "食用香料": "食用香料",
    "酵母": "酵母",
    "泡打粉": "泡打粉",
    "小苏打": "小苏打",
    "碳酸氢钠": "碳酸氢钠",
    "呈味核苷酸二钠": "呈味核苷酸二钠",
    "柠檬酸": "柠檬酸",
    "苹果酸": "苹果酸",
    "乳酸": "乳酸",
    # 其他常见配料
    "明胶": "明胶",
    "卡拉胶": "卡拉胶",
    "果胶": "果胶",
    "琼脂": "琼脂",
    "黄原胶": "黄原胶",
    "瓜尔胶": "瓜尔胶",
    "山梨糖醇": "山梨糖醇",
    "木糖醇": "木糖醇",
    "麦芽糖醇": "麦芽糖醇",
    "赤藓糖醇": "赤藓糖醇",
    "三氯蔗糖": "三氯蔗糖",
    "安赛蜜": "安赛蜜",
    "阿斯巴甜": "阿斯巴甜",
    "甜菊糖苷": "甜菊糖苷",
    "焦糖色": "焦糖色",
    "可可粉": "可可粉",
    "可可脂": "可可脂",
    "巧克力": "巧克力",
    "咖啡粉": "咖啡粉",
    "茶粉": "茶粉",
    "绿茶粉": "绿茶粉",
    "红茶": "红茶",
    "绿茶": "绿茶",
    "抹茶粉": "抹茶粉",
    "维生素C": "维生素C",
    "维生素E": "维生素E",
    "碳酸钙": "碳酸钙",
}

# ── 八大致敏物质关键词（GB 7718 附录 B 推荐标示） ──
_ALLERGEN_GROUPS: List[Tuple[str, List[str]]] = [
    ("含麸质的谷物", ["小麦", "黑麦", "大麦", "燕麦", "麸质", "麦芽"]),
    ("甲壳纲类动物", ["虾", "蟹", "龙虾", "甲壳纲"]),
    ("鱼类", ["鱼", "鲈鱼", "鳕鱼", "金枪鱼", "三文鱼", "罗非鱼"]),
    ("蛋类", ["鸡蛋", "鸭蛋", "鹌鹑蛋", "蛋清", "蛋黄", "蛋粉"]),
    ("花生", ["花生"]),
    ("大豆", ["大豆", "黄豆", "豆粕", "植物蛋白"]),
    ("乳及乳制品", ["牛奶", "乳粉", "奶粉", "乳清", "乳糖", "黄油", "奶酪", "炼乳", "奶油"]),
    ("坚果及其果仁", ["杏仁", "榛子", "核桃", "腰果", "开心果", "夏威夷果", "碧根果", "松子", "坚果"]),
]

# ── 新食品原料精选目录（国家卫健委批准；公告号以官方最新发布为准） ──
_NEW_FOOD_INGREDIENTS: Dict[str, Dict[str, str]] = {
    "玛咖粉": {"approval": "2007年第7号公告", "note": "使用范围、食用量按公告要求执行"},
    "蛹虫草": {"approval": "2009年第3号公告", "note": "不适宜人群：婴幼儿、儿童、食用真菌过敏者"},
    "雨生红球藻": {"approval": "2010年第17号公告", "note": "主要成分虾青素，食用量按公告要求执行"},
    "盐藻及提取物": {"approval": "2009年第18号公告", "note": "使用范围、食用量按公告要求执行"},
    "诺丽果浆": {"approval": "2010年第9号公告", "note": "使用范围、食用量按公告要求执行"},
    "中长链脂肪酸食用油": {"approval": "2012年第16号公告", "note": "使用范围、食用量按公告要求执行"},
    "蛋白核小球藻": {"approval": "2012年第19号公告", "note": "使用范围、食用量按公告要求执行"},
    "人参（人工种植）": {"approval": "2012年第17号公告", "note": "不适宜人群：孕妇、哺乳期妇女及婴幼儿"},
    "翅果油": {"approval": "2011年第1号公告", "note": "使用范围、食用量按公告要求执行"},
    "牡丹籽油": {"approval": "2011年第9号公告", "note": "使用范围、食用量按公告要求执行"},
    "茶叶茶氨酸": {"approval": "2014年第15号公告", "note": "使用范围、食用量按公告要求执行"},
    "壳寡糖": {"approval": "2014年第6号公告", "note": "使用范围、食用量按公告要求执行"},
    "磷虾油": {"approval": "2013年第16号公告", "note": "不适宜人群：婴幼儿、孕妇、哺乳期妇女及海鲜过敏者"},
    "奇亚籽": {"approval": "2014年第10号公告", "note": "食用量≤3克/天；不适宜人群：婴幼儿、孕妇、哺乳期妇女"},
    "广东虫草子实体": {"approval": "2013年第7号公告", "note": "使用范围、食用量按公告要求执行"},
    "透明质酸钠": {"approval": "2020年第9号公告", "note": "食用量≤200毫克/天；不适宜人群：婴幼儿、孕妇及哺乳期妇女"},
    "元宝枫籽油": {"approval": "国家卫健委批准的新食品原料（公告号以官方发布为准）", "note": "使用范围、食用量按公告要求执行"},
    "杜仲籽油": {"approval": "国家卫健委批准的新食品原料（公告号以官方发布为准）", "note": "使用范围、食用量按公告要求执行"},
    "雪莲培养物": {"approval": "国家卫健委批准的新食品原料（公告号以官方发布为准）", "note": "使用范围、食用量按公告要求执行"},
    "平卧菊三七": {"approval": "国家卫健委批准的新食品原料（公告号以官方发布为准）", "note": "使用范围、食用量按公告要求执行"},
    "枇杷叶": {"approval": "国家卫健委批准的新食品原料（公告号以官方发布为准）", "note": "使用范围、食用量按公告要求执行"},
    "米糠脂肪烷醇": {"approval": "国家卫健委批准的新食品原料（公告号以官方发布为准）", "note": "使用范围、食用量按公告要求执行"},
    "宝乐果粉": {"approval": "国家卫健委批准的新食品原料（公告号以官方发布为准）", "note": "使用范围、食用量按公告要求执行"},
    "库拉索芦荟凝胶": {"approval": "国家卫健委批准的新食品原料（公告号以官方发布为准）", "note": "使用范围、食用量按公告要求执行；孕妇、婴幼儿慎用"},
    "低聚甘露糖": {"approval": "国家卫健委批准的新食品原料（公告号以官方发布为准）", "note": "使用范围、食用量按公告要求执行"},
    "酵母β-葡聚糖": {"approval": "国家卫健委批准的新食品原料（公告号以官方发布为准）", "note": "使用范围、食用量按公告要求执行"},
    "蝉花子实体": {"approval": "国家卫健委批准的新食品原料（公告号以官方发布为准）", "note": "使用范围、食用量按公告要求执行；食用真菌过敏者慎用"},
    "桃胶": {"approval": "国家卫健委批准的新食品原料（公告号以官方发布为准）", "note": "使用范围、食用量按公告要求执行"},
}

# ── 补充精选 GB 2760 食品添加剂（用于扩充内置目录，用量以标准为准） ──
_EXTRA_ADDITIVES: Dict[str, Dict[str, str]] = {
    # 防腐剂
    "脱氢乙酸钠": {"function": "防腐剂", "max_usage": "按 GB 2760 规定使用"},
    "双乙酸钠": {"function": "防腐剂", "max_usage": "按 GB 2760 规定使用"},
    "丙酸钙": {"function": "防腐剂", "max_usage": "按 GB 2760 规定使用"},
    "丙酸钠": {"function": "防腐剂", "max_usage": "按 GB 2760 规定使用"},
    "乳酸链球菌素": {"function": "防腐剂", "max_usage": "按 GB 2760 规定使用"},
    "纳他霉素": {"function": "防腐剂", "max_usage": "按 GB 2760 规定使用"},
    "溶菌酶": {"function": "防腐剂", "max_usage": "按 GB 2760 规定使用"},
    "ε-聚赖氨酸": {"function": "防腐剂", "max_usage": "按 GB 2760 规定使用"},
    # 甜味剂
    "山梨糖醇": {"function": "甜味剂、膨松剂、乳化剂、水分保持剂", "max_usage": "按 GB 2760 规定使用"},
    "木糖醇": {"function": "甜味剂", "max_usage": "按 GB 2760 规定使用"},
    "麦芽糖醇": {"function": "甜味剂、稳定剂、水分保持剂", "max_usage": "按 GB 2760 规定使用"},
    "赤藓糖醇": {"function": "甜味剂", "max_usage": "按 GB 2760 规定使用"},
    "三氯蔗糖": {"function": "甜味剂", "max_usage": "按 GB 2760 规定使用"},
    "安赛蜜": {"function": "甜味剂", "max_usage": "按 GB 2760 规定使用"},
    "阿斯巴甜": {"function": "甜味剂", "max_usage": "按 GB 2760 规定使用"},
    "甜蜜素": {"function": "甜味剂", "max_usage": "按 GB 2760 规定使用"},
    "糖精钠": {"function": "甜味剂", "max_usage": "按 GB 2760 规定使用"},
    "甜菊糖苷": {"function": "甜味剂", "max_usage": "按 GB 2760 规定使用"},
    # 酸度调节剂
    "柠檬酸钠": {"function": "酸度调节剂", "max_usage": "按 GB 2760 规定使用"},
    "柠檬酸钾": {"function": "酸度调节剂", "max_usage": "按 GB 2760 规定使用"},
    "苹果酸": {"function": "酸度调节剂", "max_usage": "按 GB 2760 规定使用"},
    "DL-苹果酸": {"function": "酸度调节剂", "max_usage": "按 GB 2760 规定使用"},
    "酒石酸": {"function": "酸度调节剂", "max_usage": "按 GB 2760 规定使用"},
    "富马酸": {"function": "酸度调节剂", "max_usage": "按 GB 2760 规定使用"},
    "乳酸钠": {"function": "水分保持剂、酸度调节剂", "max_usage": "按 GB 2760 规定使用"},
    "碳酸钠": {"function": "酸度调节剂", "max_usage": "按 GB 2760 规定使用"},
    "碳酸氢钠": {"function": "膨松剂、酸度调节剂", "max_usage": "按 GB 2760 规定使用"},
    # 水分保持剂 / 磷酸盐
    "焦磷酸钠": {"function": "水分保持剂、膨松剂", "max_usage": "按 GB 2760 规定使用"},
    "六偏磷酸钠": {"function": "水分保持剂", "max_usage": "按 GB 2760 规定使用"},
    "三聚磷酸钠": {"function": "水分保持剂", "max_usage": "按 GB 2760 规定使用"},
    "磷酸氢二钠": {"function": "水分保持剂、酸度调节剂", "max_usage": "按 GB 2760 规定使用"},
    "丙二醇": {"function": "稳定剂、凝固剂、抗结剂", "max_usage": "按 GB 2760 规定使用"},
    "甘油": {"function": "水分保持剂", "max_usage": "按 GB 2760 规定使用"},
    # 乳化剂
    "单，双甘油脂肪酸酯": {"function": "乳化剂", "max_usage": "按 GB 2760 规定使用"},
    "蔗糖脂肪酸酯": {"function": "乳化剂", "max_usage": "按 GB 2760 规定使用"},
    "聚氧乙烯山梨醇酐单油酸酯": {"function": "乳化剂", "max_usage": "按 GB 2760 规定使用"},
    "山梨醇酐单硬脂酸酯": {"function": "乳化剂", "max_usage": "按 GB 2760 规定使用"},
    # 增稠剂 / 胶体
    "羧甲基纤维素钠": {"function": "增稠剂", "max_usage": "按 GB 2760 规定使用"},
    "黄原胶": {"function": "增稠剂", "max_usage": "按 GB 2760 规定使用"},
    "瓜尔胶": {"function": "增稠剂", "max_usage": "按 GB 2760 规定使用"},
    "刺槐豆胶": {"function": "增稠剂", "max_usage": "按 GB 2760 规定使用"},
    "海藻酸钠": {"function": "增稠剂", "max_usage": "按 GB 2760 规定使用"},
    "卡拉胶": {"function": "增稠剂", "max_usage": "按 GB 2760 规定使用"},
    "果胶": {"function": "增稠剂", "max_usage": "按 GB 2760 规定使用"},
    "结冷胶": {"function": "增稠剂", "max_usage": "按 GB 2760 规定使用"},
    "微晶纤维素": {"function": "抗结剂、增稠剂", "max_usage": "按 GB 2760 规定使用"},
    "阿拉伯胶": {"function": "增稠剂", "max_usage": "按 GB 2760 规定使用"},
    "可得然胶": {"function": "增稠剂", "max_usage": "按 GB 2760 规定使用"},
    "明胶": {"function": "增稠剂", "max_usage": "按 GB 2760 规定使用"},
    # 着色剂
    "二氧化钛": {"function": "着色剂", "max_usage": "按 GB 2760 规定使用"},
    "柠檬黄": {"function": "着色剂", "max_usage": "按 GB 2760 规定使用"},
    "日落黄": {"function": "着色剂", "max_usage": "按 GB 2760 规定使用"},
    "胭脂红": {"function": "着色剂", "max_usage": "按 GB 2760 规定使用"},
    "苋菜红": {"function": "着色剂", "max_usage": "按 GB 2760 规定使用"},
    "亮蓝": {"function": "着色剂", "max_usage": "按 GB 2760 规定使用"},
    "诱惑红": {"function": "着色剂", "max_usage": "按 GB 2760 规定使用"},
    "靛蓝": {"function": "着色剂", "max_usage": "按 GB 2760 规定使用"},
    "焦糖色": {"function": "着色剂", "max_usage": "按 GB 2760 规定使用"},
    # 漂白剂 / 护色剂
    "二氧化硫": {"function": "漂白剂、防腐剂", "max_usage": "按 GB 2760 规定使用"},
    "焦亚硫酸钠": {"function": "漂白剂、防腐剂", "max_usage": "按 GB 2760 规定使用"},
    "亚硫酸氢钠": {"function": "漂白剂", "max_usage": "按 GB 2760 规定使用"},
    "亚硝酸钠": {"function": "护色剂、防腐剂", "max_usage": "按 GB 2760 规定使用"},
    "硝酸钠": {"function": "护色剂", "max_usage": "按 GB 2760 规定使用"},
    # 抗氧化剂
    "丁基羟基茴香醚": {"function": "抗氧化剂", "max_usage": "按 GB 2760 规定使用"},
    "二丁基羟基甲苯": {"function": "抗氧化剂", "max_usage": "按 GB 2760 规定使用"},
    "特丁基对苯二酚": {"function": "抗氧化剂", "max_usage": "按 GB 2760 规定使用"},
    "没食子酸丙酯": {"function": "抗氧化剂", "max_usage": "按 GB 2760 规定使用"},
    "D-异抗坏血酸钠": {"function": "抗氧化剂", "max_usage": "按 GB 2760 规定使用"},
    "抗坏血酸": {"function": "抗氧化剂", "max_usage": "按 GB 2760 规定使用"},
    "植酸": {"function": "抗氧化剂", "max_usage": "按 GB 2760 规定使用"},
    "茶多酚": {"function": "抗氧化剂", "max_usage": "按 GB 2760 规定使用"},
    "迷迭香提取物": {"function": "抗氧化剂", "max_usage": "按 GB 2760 规定使用"},
    # 其他
    "海藻糖": {"function": "甜味剂、稳定剂", "max_usage": "按 GB 2760 规定使用"},
    "聚葡萄糖": {"function": "增稠剂、膨松剂、水分保持剂", "max_usage": "按 GB 2760 规定使用"},
}


def _normalize(name: str) -> str:
    """标准化成分名称：去空白、去全半角括号内容、统一大小写"""
    name = (name or "").strip()
    # 去掉括号内内容（复合配料展开由解析器单独处理）
    name = re.sub(r"[（(].*?[)）]", "", name)
    name = name.strip()
    return name


def _split_label_text(text: str) -> List[str]:
    """
    将配料表文本切分为候选成分段（括号深度感知）。

    仅在括号外按分隔符切分，保证复合配料如
    "植脂末（葡萄糖浆、氢化植物油）" 保持为一个整体，由 _expand_compound 再展开。
    """
    if not text:
        return []
    # 去除"配料表/配料："等前缀
    text = re.sub(r"^(配料表|配料|成分表|原料|原材料)\s*[:：]", "", text.strip())
    parts: List[str] = []
    current: List[str] = []
    depth = 0
    for ch in text:
        if ch in "（(":
            depth += 1
            current.append(ch)
        elif ch in "）)":
            depth = max(0, depth - 1)
            current.append(ch)
        elif ch in ",，、;；\n\r。" and depth == 0:
            seg = "".join(current).strip()
            if seg:
                parts.append(seg)
            current = []
        else:
            current.append(ch)
    tail = "".join(current).strip()
    if tail:
        parts.append(tail)

    items: List[str] = []
    for part in parts:
        # 去掉序号前缀（1. ① A. 等）
        p = re.sub(r"^\s*(?:[0-9]+[.、)）]|[①-⑩]|[A-Za-z][.、)])\s*", "", part)
        if not p:
            continue
        # 若片段无中文字符且含空格（英文配料表场景），按空白进一步切分
        if " " in p and not re.search(r"[\u4e00-\u9fff]", p):
            for word in re.split(r"\s+", p):
                if word:
                    items.append(word)
        else:
            items.append(p)
    return items


def _expand_compound(segment: str) -> List[str]:
    """
    展开复合配料：如 "植脂末（葡萄糖浆、氢化植物油）" →
    返回 ["植脂末", "葡萄糖浆", "氢化植物油"]
    """
    segment = segment.strip()
    m = re.match(r"^(.*?)[（(](.*)[)）]$", segment)
    if not m:
        return [segment]
    outer = m.group(1).strip()
    inner = m.group(2).strip()
    result = []
    if outer:
        result.append(outer)
    for sub in re.split(r"[,，、;；]+", inner):
        sub = sub.strip()
        if sub:
            result.append(sub)
    return result


def _detect_allergen(name: str) -> Optional[str]:
    """返回命中的致敏物质组名；未命中返回 None"""
    for group, keywords in _ALLERGEN_GROUPS:
        for kw in keywords:
            if kw in name:
                return group
    return None


# ── 目录数据（延迟导入，避免启动时加载巨大模块） ──
def _load_reference_data() -> Dict[str, Any]:
    from app.api.v1.compliance_router import (
        GB2760_ADDITIVES,
        GB14880_ENRICHERS,
        GB_PROHIBITED_ITEMS,
    )
    from app.services.compliance.formula_compliance import FOOD_HERB_MAX_DOSAGE

    # 合并补充添加剂（不修改 compliance_router 大文件）
    additives = {item["name"]: item for item in GB2760_ADDITIVES}
    additives.update(_EXTRA_ADDITIVES)

    return {
        "food_homology": FOOD_HERB_MAX_DOSAGE,  # name -> max_dosage(mg)
        "new_food": _NEW_FOOD_INGREDIENTS,
        "additives": additives,
        "enrichers": {item["name"]: item for item in GB14880_ENRICHERS},
        "prohibited": {item["name"]: item for item in GB_PROHIBITED_ITEMS},
    }


_reference_data: Optional[Dict[str, Any]] = None


def _get_reference_data() -> Dict[str, Any]:
    global _reference_data
    if _reference_data is None:
        _reference_data = _load_reference_data()
    return _reference_data


def classify_ingredient(name: str) -> Dict[str, Any]:
    """
    对单个成分进行分类，返回分类信息（不含过敏原标记）。
    """
    ref = _get_reference_data()
    normalized = _normalize(name)

    # 1. 禁用/风险物质（最高优先级）
    prohibited = ref["prohibited"].get(normalized)
    if prohibited:
        return {
            "name": normalized,
            "category": "prohibited",
            "category_label": "禁用/风险物质",
            "level": "warning",
            "message": (
                f"该成分出现在国家食品安全法规禁用品清单中"
                f"（依据：{prohibited.get('source_law', '相关法规')}），"
                f"不建议作为食品原料使用。"
            ),
            "source": prohibited.get("source_law", ""),
        }

    # 2. 药食同源目录
    if normalized in ref["food_homology"]:
        max_dosage = ref["food_homology"][normalized]
        return {
            "name": normalized,
            "category": "food_homology",
            "category_label": "药食同源目录内物质",
            "level": "info",
            "message": (
                "该成分属于《既是食品又是药品的中药材目录》内物质，"
                "可作为食品原料使用。"
            ),
            "max_dosage_mg_per_day": max_dosage,
        }

    # 3. 新食品原料（国家卫健委批准）
    new_food = ref["new_food"].get(normalized)
    if new_food:
        return {
            "name": normalized,
            "category": "new_food_resource",
            "category_label": "新食品原料",
            "level": "info",
            "message": (
                f"该成分属于国家批准的新食品原料（依据：{new_food.get('approval', '卫健委公告')}），"
                f"{new_food.get('note', '使用范围、食用量按公告要求执行')}。"
            ),
            "approval": new_food.get("approval", ""),
        }

    # 4. GB 2760 食品添加剂
    additive = ref["additives"].get(normalized)
    if additive:
        return {
            "name": normalized,
            "category": "food_additive",
            "category_label": "食品添加剂（GB 2760）",
            "level": "info",
            "message": (
                f"该成分属于 GB 2760 允许使用的食品添加剂"
                f"（功能：{additive.get('function', '未标注')}），"
                f"需按标准规定的适用范围和残留量使用。"
            ),
            "function": additive.get("function", ""),
            "max_usage": additive.get("max_usage", ""),
        }

    # 5. GB 14880 营养强化剂
    enricher = ref["enrichers"].get(normalized)
    if enricher:
        return {
            "name": normalized,
            "category": "nutrition_enricher",
            "category_label": "营养强化剂（GB 14880）",
            "level": "info",
            "message": (
                "该成分属于 GB 14880 允许使用的营养强化剂，"
                "需按标准规定的人群和用量范围使用。"
            ),
            "function": enricher.get("function", ""),
        }

    # 6. 常见食品原料
    common = _COMMON_FOOD_ALIASES.get(normalized)
    if common:
        return {
            "name": normalized,
            "category": "ordinary_food",
            "category_label": "常见食品原料",
            "level": "info",
            "message": "该成分为常见食品原料。",
        }

    # 7. 未收录
    return {
        "name": normalized,
        "category": "unknown",
        "category_label": "未收录成分",
        "level": "note",
        "message": "未能在当前内置目录中匹配，建议结合企业标准或原料来源人工核实。",
    }


def check_ingredient_names(names: List[str]) -> Dict[str, Any]:
    """对成分名称列表执行核查，返回报告结构"""
    ref = _get_reference_data()  # noqa: F841（确保目录已加载）
    ingredients: List[Dict[str, Any]] = []
    seen: set[str] = set()

    for raw in names:
        normalized = _normalize(raw)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)

        result = classify_ingredient(normalized)
        allergen = _detect_allergen(normalized)
        result["allergen"] = bool(allergen)
        if allergen:
            result["allergen_group"] = allergen
            result["message"] = (
                f"{result['message']} 注意：该成分属于致敏物质（{allergen}），"
                f"建议在标签中显著标示。"
            )
        ingredients.append(result)

    counts: Dict[str, int] = {}
    for ing in ingredients:
        counts[ing["category"]] = counts.get(ing["category"], 0) + 1

    allergen_ingredients = [
        {"name": ing["name"], "group": ing.get("allergen_group", "")}
        for ing in ingredients
        if ing.get("allergen")
    ]

    summary = (
        f"共识别 {len(ingredients)} 项配料，其中药食同源目录内物质 "
        f"{counts.get('food_homology', 0)} 项、新食品原料 {counts.get('new_food_resource', 0)} 项、"
        f"食品添加剂 {counts.get('food_additive', 0)} 项、"
        f"常见食品原料 {counts.get('ordinary_food', 0)} 项、"
        f"未收录成分 {counts.get('unknown', 0)} 项、"
        f"禁用/风险物质 {counts.get('prohibited', 0)} 项。"
    )

    return {
        "success": True,
        "data": {
            "report_id": f"lc_{uuid.uuid4().hex[:12]}",
            "summary": summary,
            "ingredients": ingredients,
            "category_counts": counts,
            "unknown_count": counts.get("unknown", 0),
            "warning_count": counts.get("prohibited", 0) + counts.get("unknown", 0),
            "allergen_ingredients": allergen_ingredients,
            "disclaimer": DISCLAIMER,
        },
    }


def check_label_text(text: str) -> Dict[str, Any]:
    """对配料表文本执行核查，返回报告结构"""
    segments = _split_label_text(text)
    names: List[str] = []
    for seg in segments:
        names.extend(_expand_compound(seg))
    return check_ingredient_names(names)
