"""OpenFoodFacts 配置

对标 OFF 官方 API 文档:
https://world.openfoodfacts.org/api/v2
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class OFFConfig:
    """OpenFoodFacts API 配置"""

    # ── API 端点 ──
    BASE_URL: str = "https://world.openfoodfacts.org"
    SEARCH_ENDPOINT: str = "/cgi/search.pl"
    PRODUCT_ENDPOINT: str = "/api/v2/{code}.json"
    BARCODES_ENDPOINT: str = "/data/barcodes/{code}.json"
    JSONL_DIFF_BASE: str = "https://static.openfoodfacts.org/data/diffs"

    # ── 搜索参数默认值 ──
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100
    SEARCH_SIMPLE: int = 1
    SEARCH_ACTION: str = "process"
    SEARCH_JSON: str = "1"

    # ── HTTP 客户端配置 ──
    USER_AGENT: str = "RMFOOD-DataPipeline/1.0"
    HTTP_TIMEOUT: float = 30.0
    MIRROR_URLS: list[str] = field(default_factory=lambda: [
        "https://world.openfoodfacts.org",
        "https://world-en.openfoodfacts.org",
    ])

    # ── PostgreSQL FTS 配置 ──
    FTS_REGCONFIG: str = "simple"

    # ── 镜像探测配置 ──
    MIRROR_PROBE_TIMEOUT: float = 15.0
    MIRROR_PROBE_DELAY: float = 0.5

    # ── JSONL 增量同步 ──
    JSONL_GZIP: bool = True
    JSONL_BATCH_SIZE: int = 1000
