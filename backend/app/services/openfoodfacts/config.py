"""
Open Food Facts 数据接入配置

集中管理所有 OFF 数据管道的参数。
"""
import os


class OFFConfig:
    """OFF 数据接入配置"""

    # ── 数据源 URL ──
    API_BASE = os.getenv("OFF_API_BASE", "https://world.openfoodfacts.org")
    API_SEARCH = f"{API_BASE}/cgi/search.pl"

    # ── FTS 文本搜索配置 ──
    # 'simple' = 逐字符匹配（中文无分词，噪音大）
    # 'chinese' / 'jieba' = 需要 pg_jieba 或 zhparser 扩展
    # 默认 'simple' 作为降级方案，安装中文分词扩展后可改为 'jieba'
    FTS_REGCONFIG = os.getenv("OFF_FTS_REGCONFIG", "simple")

    # 全量 TSV 下载
    BULK_TSV_URL = "https://world.openfoodfacts.org/data/openfoodfacts-products.tsv.gz"

    # JSONL 日增量 (2024 年起可用)
    JSONL_DIFFS_URL_TEMPLATE = "https://static.openfoodfacts.org/data/diffs/{date}.jsonl.gz"

    # ── API 参数 ──
    RATE_LIMIT_RPM = 60  # OFF 政策: 每分钟最多 60 次请求
    API_TIMEOUT = 30  # 单次 API 调用超时 (秒)
    API_FIELDS = (
        "code,product_name,brands,categories_tags,nutriments,"
        "ingredients_text,image_front_url,countries,"
        "last_modified_t,quantity,nutrition_grade_fr,nova_group,"
        "additives_tags,allergens_tags,ecoscore_grade,labels_tags,"
        "purchase_places,stores,traces_tags,contaminants,"
        "product_quantity,main_category,status,origins,"
        "creator,created_t"
    )

    # ── 导入参数 ──
    CHUNK_SIZE = 500  # 每批次 upsert 行数
    BATCH_EMBED_SIZE = 100  # 嵌入生成每批行数
    CHINA_ONLY = True  # Phase B: 仅导入中国相关产品
    MIN_DATA_QUALITY = 0.3  # 最低数据质量阈值

    # ── 中国产品过滤 ──
    CHINA_COUNTRY_KEYWORDS = [
        "china", "chinese", "hong kong", "taiwan", "macau",
        "中国", "香港", "台湾", "澳门",
    ]

    # ── 连接池 ──
    IMPORT_POOL_SIZE = 10  # 导入专用连接池大小
    IMPORT_MAX_OVERFLOW = 5

    # ── 重试 ──
    MAX_RETRIES = 5
    RETRY_BACKOFF_FACTOR = 2  # 1s, 2s, 4s, 8s, 16s

    # ── 日志 ──
    LOG_DIR = os.getenv("OFF_LOG_DIR", "logs/off_import")
