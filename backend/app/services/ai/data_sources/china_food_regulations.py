"""中国食品安全法规数据"""

FOOD_SAFETY_STANDARDS = [
    {"title": "食品安全国家标准 保健食品", "standard_code": "GB 16740-2014", "category": "保健食品", "status": "现行", "publish_date": "2014-12-24", "implementation_date": "2015-06-01", "summary": "规定了保健食品的功能评价方法和检验要求"},
    {"title": "食品安全国家标准 预包装食品营养标签通则", "standard_code": "GB 28050-2011", "category": "营养标签", "status": "现行", "publish_date": "2011-10-12", "implementation_date": "2013-01-01", "summary": "规定了预包装食品营养标签标示要求"},
    {"title": "食品安全国家标准 食品中污染物限量", "standard_code": "GB 2762-2022", "category": "污染物", "status": "现行", "publish_date": "2022-06-30", "implementation_date": "2023-06-30", "summary": "规定了食品中污染物限量"},
    {"title": "食品安全国家标准 食品中真菌毒素限量", "standard_code": "GB 2761-2017", "category": "真菌毒素", "status": "现行", "publish_date": "2017-03-17", "implementation_date": "2017-09-17", "summary": "规定了食品中真菌毒素限量"},
]

FOOD_HOMOLOGY_MATERIALS = [
    {"name": "人参", "latin_name": "Panax ginseng", "category": "根茎类", "approval_date": "2023-01-01", "status": "可用", "max_dosage": "3-9g", "restrictions": ["孕妇慎用", "儿童减量"]},
    {"name": "黄芪", "latin_name": "Astragalus membranaceus", "category": "根茎类", "approval_date": "2018-11-30", "status": "可用", "max_dosage": "6-12g"},
    {"name": "枸杞子", "latin_name": "Lycium barbarum", "category": "果实类", "approval_date": "2012-03-01", "status": "可用", "max_dosage": "6-12g"},
    {"name": "山药", "latin_name": "Dioscorea opposita", "category": "根茎类", "approval_date": "2012-03-01", "status": "可用", "max_dosage": "15-30g"},
    {"name": "红枣", "latin_name": "Ziziphus jujuba", "category": "果实类", "approval_date": "2012-03-01", "status": "可用", "max_dosage": "10-15g"},
    {"name": "茯苓", "latin_name": "Poria cocos", "category": "菌核类", "approval_date": "2023-01-01", "status": "可用", "max_dosage": "9-15g"},
    {"name": "菊花", "latin_name": "Chrysanthemum morifolium", "category": "花类", "approval_date": "2023-01-01", "status": "可用", "max_dosage": "5-10g"},
    {"name": "山楂", "latin_name": "Crataegus pinnatifida", "category": "果实类", "approval_date": "2012-03-01", "status": "可用", "max_dosage": "10-15g"},
    {"name": "陈皮", "latin_name": "Citrus reticulata", "category": "果皮类", "approval_date": "2012-03-01", "status": "可用", "max_dosage": "3-10g"},
    {"name": "玫瑰花", "latin_name": "Rosa rugosa", "category": "花类", "approval_date": "2023-01-01", "status": "可用", "max_dosage": "3-6g"},
]

NEW_FOOD_MATERIALS = [
    {"name": "透明质酸钠", "english_name": "Sodium Hyaluronate", "source": "发酵法", "approval_date": "2021-01-08", "status": "可用", "daily_intake": "≤200mg/天"},
    {"name": "乳清蛋白", "english_name": "Whey Protein", "source": "牛奶提取", "approval_date": "2009-06-01", "status": "可用", "daily_intake": "按生产需要"},
]

FOOD_ADDITIVES = [
    {"name": "柠檬酸", "code": "E330", "function": "酸度调节剂", "max_level": "按生产需要", "allowed_foods": ["饮料", "糖果", "果酱"]},
    {"name": "柠檬酸钠", "code": "E331", "function": "酸度调节剂", "max_level": "按生产需要", "allowed_foods": ["饮料", "加工食品"]},
    {"name": "β-胡萝卜素", "code": "E160a", "function": "着色剂", "max_level": "按生产需要", "allowed_foods": ["饮料", "糖果", "烘焙食品"]},
]
