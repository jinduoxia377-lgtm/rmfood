"""RMFOOD 常量定义"""

# 配方状态
class FormulaStatus:
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    ARCHIVED = "archived"


# 实验状态
class ExperimentStatus:
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# 工作流状态
class WorkflowStatus:
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


# 通知类型
class NotificationType:
    SYSTEM = "system"
    FORMULA_REVIEW = "formula_review"
    EXPERIMENT_COMPLETE = "experiment_complete"
    AI_TASK_DONE = "ai_task_done"
    DATA_SYNC = "data_sync"


# 通知状态
class NotificationStatus:
    UNREAD = "unread"
    READ = "read"
    ARCHIVED = "archived"


# 功效分类
EFFICACY_CATEGORIES = [
    "增强免疫",
    "抗氧化",
    "辅助降血糖",
    "辅助降血脂",
    "缓解体力疲劳",
    "改善睡眠",
    "清咽润喉",
    "对化学性肝损伤有辅助保护",
    "促进消化",
    "润肠通便",
    "减肥",
    "补铁",
    "补充维生素",
    "补充矿物质",
    "延缓衰老",
    "改善记忆",
    "改善视力",
    "调节肠道菌群",
]


# 药食同源物质名单（2023版）
FOOD_HOMOLOGY_CATALOG = [
    "丁香", "八角茴香", "刀豆", "小茴香", "小蓟", "山药", "山楂", "马齿苋",
    "乌梢蛇", "乌梅", "木瓜", "火麻仁", "玉竹", "甘草", "白芷", "白果", "白扁豆",
    "白扁豆花", "龙眼肉", "决明子", "百合", "肉桂", "余甘子", "佛手", "沙棘",
    "芡实", "花椒", "赤小豆", "阿胶", "鸡内金", "青果", "鱼腥草", "姜(生姜、干姜)",
    "枳椇子", "枸杞子", "栀子", "砂仁", "胖大海", "茯苓", "香橼", "香薷", "桃仁",
    "桑叶", "桑椹", "橘红", "桔梗", "益智仁", "荷叶", "莱菔子", "莲子", "高良姜",
    "淡竹叶", "淡豆豉", "菊花", "菊苣", "黄芥子", "黄精", "紫苏", "紫苏籽",
    "葛根", "黑芝麻", "黑胡椒", "槐米", "槐花", "蒲公英", "蜂蜜", "酸枣仁",
    "鲜白茅根", "鲜芦根", "蝮蛇", "橘皮", "薄荷", "薏苡仁", "薤白", "覆盆子",
    "藿香", "人参", "土人参", "大枣", "山银花", "川陈皮", "川贝母", "天冬",
    "天麻", "丹参", "巴戟天", "石斛", "石菖蒲", "艾叶", "平贝母", "玄参",
    "生地黄", "白术", "白芍", "西红花", "西洋参", "红豆杉", "当归", "竹茹",
    "红花", "红景天", "麦冬", "龟甲", "玫瑰花", "侧柏叶", "制大黄", "制何首乌",
    "刺五加", "北沙参", "白及", "白豆蔻", "玄参", "半夏", "龙眼肉", "百合",
]


# 数据库来源
class DataSource:
    TCMSP = "TCMSP"
    DFBP = "DFBP"
    CHEMBL = "ChEMBL"
    DRUGBANK = "DrugBank"


# 文件上传配置
class UploadConfig:
    ALLOWED_EXTENSIONS = [
        ".pdf", ".doc", ".docx", ".xls", ".xlsx",
        ".png", ".jpg", ".jpeg", ".gif", ".svg",
        ".csv", ".json", ".zip", ".rar",
    ]
    MAX_FILE_SIZE_MB = 50
    MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
