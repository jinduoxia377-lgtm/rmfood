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

import difflib
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

# ── 八大致敏物质关键词（GB 7718 附录 B 推荐标示；中国为推荐性非强制，仅信息提示） ──
# 🔴领域审查 P0-4/P1-1/2/3：鱼类改显式列举+白名单排除（原单字「鱼」误伤鱼腥草等药食同源植物）；
#   致敏判定只走下方「明确成员词」，绝不靠 fuzzy 归并（见 _GUARDRAIL_NOTES）。
_ALLERGEN_GROUPS: List[Tuple[str, List[str]]] = [
    ("含麸质的谷物", ["小麦", "黑麦", "大麦", "燕麦", "麸质", "麦芽"]),
    ("甲壳纲类动物", ["虾", "蟹", "龙虾", "甲壳纲", "磷虾", "虾仁", "蟹黄", "蟹肉", "小龙虾", "南极磷虾"]),
    ("鱼类", ["鲈鱼", "鳕鱼", "金枪鱼", "三文鱼", "罗非鱼", "鲤鱼", "草鱼", "带鱼", "鲢鱼", "鳙鱼", "鲫鱼", "黄花鱼", "石斑鱼", "沙丁鱼", "鳗鱼", "鳟鱼", "鱼露", "鱼糜", "鱼籽", "鱼油"]),
    ("蛋类", ["鸡蛋", "鸭蛋", "鹌鹑蛋", "蛋清", "蛋黄", "蛋粉", "咸蛋", "皮蛋", "卤蛋", "全蛋"]),
    ("花生", ["花生"]),
    ("大豆", ["大豆", "黄豆", "豆粕"]),
    ("乳及乳制品", ["牛奶", "乳粉", "奶粉", "乳清", "乳糖", "黄油", "奶酪", "炼乳", "奶油", "干酪", "芝士", "酸奶", "酥油", "乳清蛋白"]),
    ("坚果及其果仁", ["杏仁", "榛子", "核桃", "腰果", "开心果", "夏威夷果", "碧根果", "松子", "坚果", "白果", "板栗", "栗子"]),
]

# 鱼类致敏白名单排除：名称含「鱼」字但并非鱼类蛋白的成分（领域审查 P0-4）
_ALLERGEN_FISH_EXCLUDE = {"鱼腥草", "鱼腥草根", "折耳根"}

# 大豆组「植物蛋白」来源待确认提示（领域审查 P2-3：不直接断言大豆）
_PLANT_PROTEIN_ALLERGEN_NOTE = "植物蛋白（来源待确认，可能含大豆/小麦/豌豆，建议核实具体来源）"

# ── 新食品原料精选目录（国家卫健委批准） ──
# 🔴领域审查 P0-1/P0-2/P0-3：approval 仅放已确证的真实公告号；无法确证者 approval 留空，
#   「以官方发布为准」移入 note，绝不把免责话术伪装成「依据」输出。
_NEW_FOOD_INGREDIENTS: Dict[str, Dict[str, str]] = {
    "玛咖粉": {"approval": "2011年第13号公告", "note": "使用范围、食用量按公告要求执行"},  # P0-1 修正
    "蛹虫草": {"approval": "2009年第3号公告", "note": "不适宜人群：婴幼儿、儿童、食用真菌过敏者；后续公告如有调整以最新为准"},
    "雨生红球藻": {"approval": "2010年第17号公告", "note": "主要成分虾青素，食用量按公告要求执行"},
    "盐藻及提取物": {"approval": "2009年第18号公告", "note": "使用范围、食用量按公告要求执行"},
    "诺丽果浆": {"approval": "2010年第9号公告", "note": "使用范围、食用量按公告要求执行"},
    "中长链脂肪酸食用油": {"approval": "2012年第16号公告", "note": "使用范围、食用量按公告要求执行"},
    "蛋白核小球藻": {"approval": "2012年第19号公告", "note": "使用范围、食用量按公告要求执行"},
    "人参（人工种植）": {"approval": "2012年第17号公告", "note": "不适宜人群：孕妇、哺乳期妇女及婴幼儿"},
    "翅果油": {"approval": "2011年第1号公告", "note": "使用范围、食用量按公告要求执行"},
    "牡丹籽油": {"approval": "2011年第9号公告", "note": "使用范围、食用量按公告要求执行"},  # P0-3 确证
    "茶叶茶氨酸": {"approval": "2014年第15号公告", "note": "使用范围、食用量按公告要求执行"},
    "壳寡糖": {"approval": "2014年第6号公告", "note": "使用范围、食用量按公告要求执行"},
    "磷虾油": {"approval": "2013年第16号公告", "note": "不适宜人群：婴幼儿、孕妇、哺乳期妇女及海鲜过敏者"},
    "奇亚籽": {"approval": "2014年第10号公告", "note": "食用量≤3克/天；不适宜人群：婴幼儿、孕妇、哺乳期妇女"},
    "广东虫草子实体": {"approval": "2013年第1号公告", "note": "使用范围、食用量按公告要求执行"},  # P0-2 修正
    "透明质酸钠": {"approval": "2020年第9号公告", "note": "食用量≤200毫克/天；不适宜人群：婴幼儿、孕妇及哺乳期妇女"},
    "元宝枫籽油": {"approval": "2011年第9号公告", "note": "使用范围、食用量按公告要求执行"},  # P0-3 确证
    "枇杷叶": {"approval": "2014年第20号公告", "note": "使用范围、食用量按公告要求执行"},  # P0-3 确证
    # 以下 approval 无法确证真实公告号 → 留空，「以官方为准」移入 note，不伪装成依据
    "杜仲籽油": {"approval": "", "note": "国家卫健委批准的新食品原料；批准公告号请以官方发布为准。使用范围、食用量按公告要求执行"},
    "雪莲培养物": {"approval": "", "note": "国家卫健委批准的新食品原料；批准公告号请以官方发布为准。使用范围、食用量按公告要求执行"},
    "平卧菊三七": {"approval": "", "note": "国家卫健委批准的新食品原料；批准公告号请以官方发布为准。使用范围、食用量按公告要求执行"},
    "米糠脂肪烷醇": {"approval": "", "note": "国家卫健委批准的新食品原料；批准公告号请以官方发布为准。使用范围、食用量按公告要求执行"},
    "宝乐果粉": {"approval": "", "note": "国家卫健委批准的新食品原料；批准公告号请以官方发布为准。使用范围、食用量按公告要求执行"},
    "库拉索芦荟凝胶": {"approval": "", "note": "国家卫健委批准的新食品原料；批准公告号请以官方发布为准。使用范围、食用量按公告要求执行；孕妇、婴幼儿慎用"},
    "低聚甘露糖": {"approval": "", "note": "国家卫健委批准的新食品原料；批准公告号请以官方发布为准。使用范围、食用量按公告要求执行"},
    "酵母β-葡聚糖": {"approval": "", "note": "国家卫健委批准的新食品原料；批准公告号请以官方发布为准。使用范围、食用量按公告要求执行"},
    "蝉花子实体": {"approval": "", "note": "国家卫健委批准的新食品原料；批准公告号请以官方发布为准。使用范围、食用量按公告要求执行；食用真菌过敏者慎用"},
    "桃胶": {"approval": "", "note": "国家卫健委批准的新食品原料；批准公告号请以官方发布为准。使用范围、食用量按公告要求执行"},
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


# 复合配料最大展开层数（更深层截断并记入 parse_warnings）
_MAX_COMPOUND_DEPTH = 2
# 模糊匹配置信度下限（🔴护栏，领域审查🔴-1）：低于此阈值的模糊命中一律降级为
# match_method:'none' + 人工核实，绝不落入 ordinary_food/food_homology 等安全类目。
FUZZY_MIN_CONFIDENCE = 0.85


def _normalize(name: str) -> str:
    """标准化成分名称：去空白、去全半角括号内容、统一大小写"""
    name = (name or "").strip()
    # 去掉括号内内容（复合配料展开由解析器单独处理）
    name = re.sub(r"[（(].*?[)）]", "", name)
    name = name.strip()
    return name


def _extract_spec(segment: str) -> Tuple[str, Optional[str]]:
    """
    提取数量/规格信息（括号内），如
    "白砂糖（≤5%）" → ("白砂糖", "≤5%")。
    仅当括号内容不含中文成分分隔符时视为规格，否则视为复合配料由展开器处理。
    """
    segment = segment.strip()
    m = re.match(r"^(.*?)[（(]([^（()）]*)[)）]$", segment)
    if not m:
        return segment, None
    outer = m.group(1).strip()
    inner = m.group(2).strip()
    # 含成分分隔符 → 不是规格，是复合配料（交给展开器）
    if re.search(r"[,，、;；]", inner):
        return segment, None
    return (outer or segment), (inner or None)


def _split_label_text(text: str) -> List[str]:
    """
    将配料表文本切分为候选成分段（括号深度感知）。

    仅在括号外按分隔符切分，保证复合配料如
    "植脂末（葡萄糖浆、氢化植物油）" 保持为一个整体，由 _expand_compound 再展开。

    检测未闭合/多余括号并入 parse_warnings（由调用方传入列表追加）。
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


def _detect_parse_warnings(text: str) -> List[str]:
    """检测括号异常：未闭合、多余闭合、括号不配对（全半角混用）。"""
    warnings: List[str] = []
    if not text:
        return warnings
    open_full = text.count("（")
    close_full = text.count("）")
    open_half = text.count("(")
    close_half = text.count(")")
    open_total = open_full + open_half
    close_total = close_full + close_half
    if open_total > close_total:
        warnings.append(f"检测到未闭合括号（左括号 {open_total} 个，右括号 {close_total} 个），可能影响复合配料解析。")
    elif close_total > open_total:
        warnings.append(f"检测到多余右括号（右括号 {close_total} 个，左括号 {open_total} 个）。")
    # 全半角括号混用提示
    if (open_full and open_half) or (close_full and close_half):
        warnings.append("配料表中全角/半角括号混用，已按括号配对尽力解析，建议核对原文。")
    return warnings


def _split_top_level(inner: str) -> List[str]:
    """
    括号深度感知的子成分切分：仅在「顶层」（未被括号包裹）按分隔符切分，
    保证嵌套子成分如 "酪蛋白酸钠（单甘酯、磷脂）" 保持完整，交由递归展平处理。
    """
    parts: List[str] = []
    current: List[str] = []
    depth = 0
    for ch in inner:
        if ch in "（(":
            depth += 1
            current.append(ch)
        elif ch in "）)":
            depth = max(0, depth - 1)
            current.append(ch)
        elif ch in ",，、;；" and depth == 0:
            seg = "".join(current).strip()
            if seg:
                parts.append(seg)
            current = []
        else:
            current.append(ch)
    tail = "".join(current).strip()
    if tail:
        parts.append(tail)
    return parts


def _expand_compound_segment(segment: str, depth: int, warnings: List[str]) -> Tuple[Optional[str], List[str], bool]:
    """
    递归展开复合配料（多层嵌套），返回 (整体名, 直接子成分列表, 是否为复合配料)。

    - 保留复合配料为整体（outer）再展开子成分；
    - 子成分若仍含括号则递归展开（由 _flatten_segment 驱动），
      超过 _MAX_COMPOUND_DEPTH 层截断并记入 warnings。
    """
    segment = segment.strip()
    if depth > _MAX_COMPOUND_DEPTH:
        warnings.append(f"复合配料嵌套超过 {_MAX_COMPOUND_DEPTH} 层，已截断：{segment[:20]}")
        return segment, [], False
    # 规格型括号（如 白砂糖（≤5%））不算复合配料
    name_part, spec = _extract_spec(segment)
    m = re.match(r"^(.*?)[（(](.*)[)）]$", name_part)
    if not m:
        return name_part, [], False
    outer = m.group(1).strip()
    inner = m.group(2).strip()
    # 形如 "（xx、yy）" 无整体名时，outer 为空，交由调用方处理
    subs: List[str] = []
    is_compound = bool(outer)
    for sub in _split_top_level(inner):
        sub = sub.strip()
        if not sub:
            continue
        # 嵌套子成分保留为整体名（递归展平由 _flatten_segment 处理）
        subs.append(sub)
    return (outer if outer else (subs[0] if subs else segment)), subs, is_compound


def _expand_compound(segment: str) -> List[str]:
    """
    展开复合配料：如 "植脂末（葡萄糖浆、氢化植物油）" →
    返回 ["植脂末", "葡萄糖浆", "氢化植物油"]（向后兼容的一层扁平化入口）。

    v2：内部走多层递归展开器，但返回扁平名列表，保持旧调用方式可用。
    """
    warnings: List[str] = []
    name, subs, _ = _expand_compound_segment(segment, 1, warnings)
    result: List[str] = []
    if name:
        result.append(name)
    result.extend(subs)
    return result or [segment.strip()]


# ── v2 模糊匹配安全护栏（领域审查🔴-1，强制） ──
# 原则：宁漏判为 unknown，绝不错判为安全。C 端食安入口。
# ① 禁用/剧毒药名：禁止 fuzzy 归并到任何非禁用类目，也禁止安全成分 fuzzy 成禁用品。
_TOXIC_FUZZY_NAMES: set = {
    "马钱子", "马兜铃", "曼陀罗", "蟾酥", "川乌", "草乌", "附子", "砒霜",
    "巴豆", "河豚", "雷公藤", "相思豆", "苦杏仁",
}
# ② 形近药食同源对：两两绝不可 fuzzy 归并（误并会误导用量/误食）。
#    以「禁用/剧毒名 → 安全对」为主，也涵盖安全对之间的混淆。
_FUZZY_LOOKALIKE_PAIRS: List[Tuple[str, str]] = [
    ("巴豆", "白扁豆"), ("巴豆", "赤小豆"), ("巴豆", "红豆"),
    ("相思豆", "赤小豆"), ("相思豆", "红豆"),
    ("马钱子", "马齿苋"), ("马兜铃", "马齿苋"),
    ("川乌", "乌梅"), ("草乌", "乌梅"), ("附子", "白附片"),
    ("砒霜", "白霜"), ("蟾酥", "蟾蜍"),
    ("茯苓", "茯苓皮"), ("茯苓皮", "茯苓"),
]

# 人群禁忌/安全提示（领域审查 P2-1：限量数字不足以覆盖人群禁忌）
_CAUTIONS: Dict[str, str] = {
    "白果": "儿童慎用、不宜生食（含银杏毒素，需熟制并控制量）",
    "桃仁": "不宜过量、孕妇慎用（含苦杏仁苷）",
    "火麻仁": "须为低四氢大麻酚(THC)食用品种，注意监管边界",
    "当归": "孕妇慎用、月经量多者慎用（活血）",
    "西红花": "孕妇禁用（药性强烈，兴奋子宫）",
    "杏仁": "苦杏仁含苦杏仁苷，不宜生食过量",
}


def _in_toxic_blacklist(query: str, candidate: str) -> bool:
    """判断 query/candidate 是否落在毒黑名单相关，禁止 fuzzy 归并。"""
    if query in _TOXIC_FUZZY_NAMES or candidate in _TOXIC_FUZZY_NAMES:
        return True
    for a, b in _FUZZY_LOOKALIKE_PAIRS:
        if {query, candidate} == {a, b}:
            return True
    return False


def _detect_allergen(name: str) -> Optional[str]:
    """返回命中的致敏物质组名；未命中返回 None。

    🔴P0-4：鱼类改显式列举 + 白名单排除（不再用单字「鱼」泛匹配，避免误伤鱼腥草）。
    """
    if name in _ALLERGEN_FISH_EXCLUDE:
        return None
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


# ── M2：别名索引 + 候选池（延迟构建一次） ──
# 逻辑名 → 别名链（用于展示 命中路径，如 蔗糖 → 白砂糖）
_alias_index: Optional[Dict[str, str]] = None
# 逻辑名 → 目录分类（exact 命中后复用）
_category_index: Optional[Dict[str, str]] = None


def _build_match_indexes() -> None:
    global _alias_index, _category_index
    if _category_index is not None:
        return
    ref = _get_reference_data()
    category_index: Dict[str, str] = {}
    for logical in ref["prohibited"]:
        category_index[logical] = "prohibited"
    for logical in ref["new_food"]:
        category_index[logical] = "new_food_resource"
    for logical in ref["additives"]:
        category_index[logical] = "food_additive"
    for logical in ref["enrichers"]:
        category_index[logical] = "nutrition_enricher"
    for logical in _COMMON_FOOD_ALIASES:
        category_index[logical] = "ordinary_food"
    # P2-2 归类优先级：food_homology 优先于 ordinary_food。
    # 山药/蜂蜜等「药食同源 ∩ 常见食品」重叠项归 food_homology，以保留
    # 每日限量(max_dosage)与 caution 等对用户更有价值的用量/禁忌信息；
    # 普通食品身份不影响其作为药食同源物质需注意用量的事实。
    for logical in ref["food_homology"]:
        category_index[logical] = "food_homology"
    _category_index = category_index

    # 别名索引：别名 → 逻辑名。仅收录能落到任一目录的映射。
    alias_index: Dict[str, str] = {}
    for alias, logical in _COMMON_FOOD_ALIASES.items():
        if logical in category_index and alias != logical:
            alias_index[alias] = logical
    _alias_index = alias_index


def _get_alias_index() -> Dict[str, str]:
    _build_match_indexes()
    return _alias_index or {}


def _get_category_index() -> Dict[str, str]:
    _build_match_indexes()
    return _category_index or {}


def _levenshtein(a: str, b: str) -> int:
    """标准编辑距离（无外部依赖）。"""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(
                prev[j] + 1,        # 删除
                cur[j - 1] + 1,     # 插入
                prev[j - 1] + (ca != cb),  # 替换
            ))
        prev = cur
    return prev[-1]


def _fuzzy_score(query: str, candidate: str) -> float:
    """
    保守模糊匹配打分（0-1）。返回 0.0 表示不视为匹配。

    🔴护栏（领域审查🔴-1）：
    - 置信度区间收窄为 0.85-0.95；<0.85 由调用方降级为 match_method:'none'。
    - 落在毒黑名单 / 形近药食同源对 → 一律 0.0（绝不可 fuzzy 归并）。
    - 短名（<2 字）不做模糊，避免「水」误并入「水解植物蛋白」等。
    """
    if not query or not candidate:
        return 0.0
    if _in_toxic_blacklist(query, candidate):
        return 0.0
    if len(query) < 2 or len(candidate) < 2:
        return 0.0
    if query == candidate:
        return 1.0
    # 包含关系（保守：较短者长度≥2 且长度比≥0.5）
    if candidate in query or query in candidate:
        shorter, longer = (query, candidate) if len(query) <= len(candidate) else (candidate, query)
        if len(shorter) >= 2 and len(shorter) / len(longer) >= 0.5:
            return 0.95
        return 0.0
    # 编辑距离相似度
    max_len = max(len(query), len(candidate))
    distance = _levenshtein(query, candidate)
    similarity = 1 - distance / max_len
    if similarity >= 0.90:
        return 0.95
    if similarity >= 0.85:
        return 0.85
    return 0.0


def _classify_by_logical(logical: str) -> Dict[str, Any]:
    """按逻辑名从内置目录取分类（逻辑名须已在 _category_index 中）。"""
    ref = _get_reference_data()
    category = _get_category_index().get(logical)
    if category == "prohibited":
        prohibited = ref["prohibited"].get(logical) or {}
        return {
            "name": logical,
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
    if category == "food_homology":
        max_dosage = ref["food_homology"].get(logical)
        # P2-2：重叠项（既药食同源又常见食品，如 山药/蜂蜜）自然带出普通食品身份，
        # 避免用户困惑；措辞保持中性、无许可语气（遵守 P1-5 红线）。
        overlap = logical in _COMMON_FOOD_ALIASES
        message = (
            "该成分属于《既是食品又是药品的中药材目录》内物质（信息参考），"
            f"目录参考每日限量 {max_dosage} mg"
            + ("（亦为常见食品原料）" if overlap else "")
            + "，具体使用范围与用量以官方目录及标准为准。"
        )
        return {
            "name": logical,
            "category": "food_homology",
            "category_label": "药食同源目录内物质",
            "level": "info",
            "message": message,
            "max_dosage_mg_per_day": max_dosage,
        }
    if category == "new_food_resource":
        new_food = ref["new_food"].get(logical) or {}
        # P0-3：approval 仅在确有真实公告号时作为「依据」输出；为空则不伪装成依据
        approval = (new_food.get("approval") or "").strip()
        if approval:
            message = (
                f"该成分属于国家批准的新食品原料（依据：{approval}），"
                f"{new_food.get('note', '使用范围、食用量按公告要求执行')}。"
            )
        else:
            message = (
                f"该成分属于国家批准的新食品原料。"
                f"{new_food.get('note', '使用范围、食用量按公告要求执行')}"
            )
        return {
            "name": logical,
            "category": "new_food_resource",
            "category_label": "新食品原料",
            "level": "info",
            "message": message,
            "approval": approval,
        }
    if category == "food_additive":
        additive = ref["additives"].get(logical) or {}
        return {
            "name": logical,
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
    if category == "nutrition_enricher":
        enricher = ref["enrichers"].get(logical) or {}
        return {
            "name": logical,
            "category": "nutrition_enricher",
            "category_label": "营养强化剂（GB 14880）",
            "level": "info",
            "message": (
                "该成分属于 GB 14880 允许使用的营养强化剂，"
                "需按标准规定的人群和用量范围使用。"
            ),
            "function": enricher.get("function", ""),
        }
    if category == "ordinary_food":
        return {
            "name": logical,
            "category": "ordinary_food",
            "category_label": "常见食品原料",
            "level": "info",
            "message": "该成分为常见食品原料。",
        }
    # 兜底（不应到达）
    return {
        "name": logical,
        "category": "unknown",
        "category_label": "未收录成分",
        "level": "note",
        "message": "未能在当前内置目录中匹配，建议结合企业标准或原料来源人工核实。",
    }


def _match_ingredient(name: str) -> Tuple[Dict[str, Any], str, float, List[str]]:
    """
    三级匹配：exact → alias → fuzzy → none。
    返回 (分类结果, match_method, match_confidence, aliases)。
    """
    normalized = _normalize(name)
    if not normalized:
        result = _classify_by_logical("")
        result["name"] = normalized
        return result, "none", 0.0, []

    category_index = _get_category_index()

    # 1. 精确匹配（任一目录逻辑名直接命中）
    if normalized in category_index:
        return _classify_by_logical(normalized), "exact", 1.0, []

    # 2. 别名匹配（走 _COMMON_FOOD_ALIASES 等别名表，返回别名链）
    alias_index = _get_alias_index()
    logical = alias_index.get(normalized)
    if logical:
        result = _classify_by_logical(logical)
        result["name"] = logical
        return result, "alias", 0.9, [normalized, logical]

    # 3. 保守模糊匹配（编辑距离 / 包含关系）
    # 🔴护栏：区间 0.85-0.95；<0.85 一律降级为 none + 人工核实；毒黑名单相关一律 0.0。
    if not _in_toxic_blacklist(normalized, normalized):
        best_candidate: Optional[str] = None
        best_score = 0.0
        for candidate in category_index:
            score = _fuzzy_score(normalized, candidate)
            if score > best_score:
                best_score = score
                best_candidate = candidate
        if best_candidate and best_score >= FUZZY_MIN_CONFIDENCE:
            result = _classify_by_logical(best_candidate)
            result["name"] = best_candidate
            return result, "fuzzy", best_score, [normalized, best_candidate]

    # 4. 未收录（含被护栏拦截的情况 → 强制人工核实，绝不落入安全类目）
    return {
        "name": normalized,
        "category": "unknown",
        "category_label": "未收录成分",
        "level": "note",
        "message": "未能在当前内置目录中匹配，建议结合企业标准或原料来源人工核实。",
    }, "none", 0.0, []


def classify_ingredient(name: str) -> Dict[str, Any]:
    """
    对单个成分进行分类，返回分类信息（不含过敏原标记）。

    v2：新增 match_method / match_confidence / aliases / risk_contribution 字段。
    """
    result, method, confidence, aliases = _match_ingredient(name)
    result["match_method"] = method
    result["match_confidence"] = round(confidence, 2)
    if aliases:
        result["aliases"] = aliases
    result["risk_contribution"] = _risk_contribution_for(result, method, confidence)
    return result


# ── v2「目录比对提示分」权重（领域审查🔴-2：非安全评分，risk_level 已移除） ──
# 语义：risk_score 是「目录比对提示分」，仅供内部参考，**不得对外表述为「安全评分」**。
# 规则：禁用项**一票置顶**（出现任一禁用项 → 直接 100，不复利稀释）；
#       其余按条目累加（unknown 每条 +8；添加剂/强化剂每条 +3），封顶 100。
#       致敏项不计入 risk_score（GB 7718 附录 B 在中国为推荐性标示，非违规高危，
#       改由 allergen_ingredients 单列「建议标示」提示）。
_RISK_WEIGHTS = {
    "prohibited": 100,        # 一票置顶
    "unknown": 8,
    "food_additive": 3,
    "nutrition_enricher": 3,
    "food_homology": 0,
    "new_food_resource": 0,
    "ordinary_food": 0,
    "allergen": 0,            # 推荐性标示，不计入提示分
}


def _risk_contribution_for(result: Dict[str, Any], method: str, confidence: float) -> int:
    """计算单个成分对 risk_score（目录比对提示分）的贡献分（整数）。"""
    category = result.get("category", "unknown")
    if category == "prohibited":
        return _RISK_WEIGHTS["prohibited"]
    base = _RISK_WEIGHTS.get(category, 0)
    if base == 0:
        return 0
    # 低置信度模糊命中保守降权（避免误报放大提示分）
    if method == "fuzzy" and confidence < 1.0:
        base = int(round(base * confidence))
    return base


# 🔴红线2：risk_level 已按契约 v2.1 移除（「低风险」实质构成绝对化安全判定）。
# 改用中性 risk_score（目录比对提示分）+ needs_review_count（需人工核实项数）。


# ── v2：示例配料表模板（内置典型配料表，覆盖复合配料与各类成分） ──
_LABEL_CHECK_TEMPLATES: List[Dict[str, str]] = [
    {
        "id": "beverage",
        "name": "碳酸饮料",
        "description": "典型含糖碳酸饮料，含甜味剂、防腐剂、着色剂等多种食品添加剂。",
        "text": "配料表：水、白砂糖、果葡糖浆、二氧化碳、柠檬酸、苯甲酸钠、柠檬黄、食用香精",
        "tag": "饮料",
    },
    {
        "id": "pastry",
        "name": "夹心饼干",
        "description": "含复合配料（夹心）的焙烤糕点，涉及致敏原小麦、乳、大豆。",
        "text": "配料表：小麦粉、白砂糖、植物油（棕榈油、大豆油）、葡萄糖浆、全脂乳粉、鸡蛋、食盐、碳酸氢钠、食用香精",
        "tag": "糕点",
    },
    {
        "id": "herbal_tea",
        "name": "代茶饮（药食同源）",
        "description": "以药食同源目录内物质为主的袋泡代茶饮，含每日限量参考。",
        "text": "配料表：菊花、枸杞子、金银花、决明子、山楂、甘草、罗汉果、陈皮",
        "tag": "代茶饮",
    },
    {
        "id": "dairy",
        "name": "调制乳",
        "description": "含营养强化剂的乳制品，涉及致敏原乳。",
        "text": "配料表：生牛乳、白砂糖、维生素D、维生素A、食用香精、卡拉胶",
        "tag": "乳制品",
    },
    {
        "id": "compound_seasoning",
        "name": "复合调味料",
        "description": "多层复合配料调味料，含增鲜剂、防腐剂、香辛料。",
        "text": "配料表：食盐、味精、白砂糖、酱油（水、大豆、小麦、食盐）、酵母提取物、5'-呈味核苷酸二钠、脱氢乙酸钠、香辛料（八角、桂皮、花椒）、二氧化硅",
        "tag": "复合调味料",
    },
    {
        "id": "plant_milk",
        "name": "植物蛋白饮料",
        "description": "含复合配料与多种添加剂的植物蛋白饮品，涉及致敏原大豆。",
        "text": "配料表：水、大豆、白砂糖、植脂末（葡萄糖浆、氢化植物油、酪蛋白酸钠）、碳酸氢钠、单，双甘油脂肪酸酯、蔗糖脂肪酸酯、食用盐",
        "tag": "植物蛋白饮料",
    },
    {
        "id": "candy",
        "name": "无糖硬糖",
        "description": "以糖醇类甜味剂为主的糖果，含着色剂与酸度调节剂。",
        "text": "配料表：麦芽糖醇、赤藓糖醇、柠檬酸、苹果酸、阿斯巴甜、安赛蜜、二氧化钛、食用香精、硬脂酸镁",
        "tag": "糖果",
    },
    {
        "id": "instant_noodle",
        "name": "方便面（油炸）",
        "description": "含抗氧化剂、复合配料与致敏原的油炸方便面。",
        "text": "配料表：小麦粉、棕榈油、淀粉、食盐、特丁基对苯二酚、调味酱包（水、酱油、辣椒、大蒜、白砂糖、食盐）、脱水蔬菜（胡萝卜、青葱）、鸡蛋粉",
        "tag": "方便食品",
    },
]


def get_label_check_templates() -> Dict[str, Any]:
    """返回内置示例配料表模板数组（供前端一键填入）。"""
    return {"templates": [dict(t) for t in _LABEL_CHECK_TEMPLATES]}


def get_directory_stats() -> Dict[str, Any]:
    """返回内置目录规模统计（各目录条目数量）。"""
    ref = _get_reference_data()
    return {
        "food_homology": len(ref["food_homology"]),
        "new_food": len(ref["new_food"]),
        "additives": len(ref["additives"]),
        "enrichers": len(ref["enrichers"]),
        "prohibited": len(ref["prohibited"]),
        "common_food": len(_COMMON_FOOD_ALIASES),
        "allergen_groups": len(_ALLERGEN_GROUPS),
    }


def _compute_risk_score(ingredients: List[Dict[str, Any]]) -> int:
    """禁用项一票置顶（任一禁用项 → 100）；否则累加 risk_contribution，封顶 100。

    🔴红线2：不再输出 risk_level（「低风险」构成绝对化安全判定），
    risk_score 语义为「目录比对提示分」，非安全评分。
    """
    if any(ing.get("category") == "prohibited" for ing in ingredients):
        return 100
    total = sum(int(ing.get("risk_contribution", 0) or 0) for ing in ingredients)
    return max(0, min(100, int(total)))


def _caution_for(name: str, category: str) -> Optional[str]:
    """取人群禁忌/安全提示（领域审查 P2-1：限量数字不足以覆盖人群禁忌）。"""
    if name in _CAUTIONS:
        return _CAUTIONS[name]
    # 新食品原料的 note 常含人群禁忌（孕妇/婴幼儿慎用等）
    ref = _get_reference_data()
    nf = ref["new_food"].get(name)
    if nf:
        note = nf.get("note", "")
        if any(kw in note for kw in ("慎用", "禁用", "不适宜", "孕妇", "婴幼儿", "儿童")):
            return note
    return None


def check_ingredient_names(
    names: List[str],
    parse_warnings: Optional[List[str]] = None,
    compound_expanded: int = 0,
    compound_meta: Optional[Dict[str, Dict[str, Any]]] = None,
    spec_meta: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """对成分名称列表执行核查，返回报告结构。

    v2：返回值新增 risk_score / needs_review_count / parse_warnings / stats，及每个
    ingredient 的 match_confidence / match_method / aliases / risk_contribution / caution。
    🔴红线2：不再输出 risk_level（契约 v2.1 已移除）。仅新增键，既有键保持不变（向后兼容）。

    compound_meta：可选，标准化名 → {is_compound, sub_ingredients}，用于标注
    由复合配料展开而来的整体项及其子成分（仅在文本核查路径填充）。
    spec_meta：可选，标准化名 → 带规格的原始片段（如 白砂糖（≤5%）），用于 raw_name。
    """
    ref = _get_reference_data()  # noqa: F841（确保目录已加载）
    ingredients: List[Dict[str, Any]] = []
    seen: set[str] = set()
    meta = compound_meta or {}
    specs = spec_meta or {}

    for raw in names:
        normalized = _normalize(raw)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)

        result = classify_ingredient(normalized)
        # raw_name 优先取带规格/复合括号的原始片段（如 白砂糖（≤5%））
        result["raw_name"] = specs.get(normalized) or meta.get(normalized, {}).get("raw_name") or (raw or "").strip()
        m = meta.get(normalized)
        if m:
            result["is_compound"] = bool(m.get("is_compound"))
            if m.get("sub_ingredients"):
                result["sub_ingredients"] = list(m["sub_ingredients"])
        allergen = _detect_allergen(normalized)
        result["allergen"] = bool(allergen)
        if allergen:
            result["allergen_group"] = allergen
            result["message"] = (
                f"{result['message']} 注意：该成分属于致敏物质（{allergen}），"
                f"建议在标签中显著标示。"
            )
        # 致敏项不计入 risk_score（推荐性标示，非违规高危，见🔴-2）
        caution = _caution_for(normalized, result.get("category", ""))
        if caution:
            result["caution"] = caution
        ingredients.append(result)

    counts: Dict[str, int] = {}
    for ing in ingredients:
        counts[ing["category"]] = counts.get(ing["category"], 0) + 1

    allergen_ingredients = [
        {"name": ing["name"], "group": ing.get("allergen_group", "")}
        for ing in ingredients
        if ing.get("allergen")
    ]

    risk_score = _compute_risk_score(ingredients)
    matched = sum(1 for ing in ingredients if ing["category"] != "unknown")
    # 需人工核实项数 = 未收录(unknown) + note 级（保守模糊命中的低置信项亦视为需核实）
    needs_review_count = sum(
        1 for ing in ingredients
        if ing.get("category") == "unknown" or ing.get("level") == "note"
    )

    stats = {
        "total": len(ingredients),
        "matched": matched,
        "unmatched": counts.get("unknown", 0),
        "allergen_count": len(allergen_ingredients),
        "compound_expanded": compound_expanded,
    }

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
            # 🔴P1-4：warning_count 仅统计禁用项，unknown 单列到 stats.unmatched
            "warning_count": counts.get("prohibited", 0),
            "allergen_ingredients": allergen_ingredients,
            "disclaimer": DISCLAIMER,
            # ── v2 新增（🔴红线2：移除 risk_level） ──
            "risk_score": risk_score,
            "needs_review_count": needs_review_count,
            "parse_warnings": list(parse_warnings or []),
            "stats": stats,
        },
    }


def _flatten_segment(
    segment: str,
    depth: int,
    warnings: List[str],
    names: List[str],
    compound_meta: Dict[str, Dict[str, Any]],
    spec_meta: Dict[str, str],
) -> int:
    """
    递归展平一个顶层段：把复合配料整体名与其所有子成分（含嵌套）都加入 names，
    并在 compound_meta 中记录整体项的 is_compound / sub_ingredients；
    在 spec_meta 中记录带规格（如 白砂糖（≤5%））成分的原始片段（供 raw_name）。
    返回本段中被展开的复合配料个数。
    """
    segment = segment.strip()
    if not segment:
        return 0
    if depth > _MAX_COMPOUND_DEPTH:
        warnings.append(f"复合配料嵌套超过 {_MAX_COMPOUND_DEPTH} 层，已截断：{segment[:20]}")
        if segment:
            names.append(segment)
        return 0

    name, subs, is_compound = _expand_compound_segment(segment, depth, warnings)
    # 规格提取（如 白砂糖（≤5%））：记录原始片段供 raw_name
    _, spec = _extract_spec(segment)
    expanded = 0
    if name:
        names.append(name)
        normalized = _normalize(name)
        if spec and normalized:
            spec_meta[normalized] = segment
        if normalized and (is_compound or subs):
            compound_meta[normalized] = {
                "is_compound": is_compound,
                "sub_ingredients": list(subs),
                "raw_name": segment,
            }
    if is_compound:
        expanded = 1
    for sub in subs:
        if re.search(r"[（(]", sub):
            expanded += _flatten_segment(sub, depth + 1, warnings, names, compound_meta, spec_meta)
        else:
            names.append(sub)
    return expanded


def check_label_text(text: str) -> Dict[str, Any]:
    """对配料表文本执行核查，返回报告结构（v2：多层复合配料展开 + 解析告警）。"""
    warnings: List[str] = _detect_parse_warnings(text or "")
    segments = _split_label_text(text or "")
    names: List[str] = []
    compound_meta: Dict[str, Dict[str, Any]] = {}
    spec_meta: Dict[str, str] = {}
    compound_expanded = 0

    for seg in segments:
        compound_expanded += _flatten_segment(seg, 1, warnings, names, compound_meta, spec_meta)

    return check_ingredient_names(
        names,
        parse_warnings=warnings,
        compound_expanded=compound_expanded,
        compound_meta=compound_meta,
        spec_meta=spec_meta,
    )
