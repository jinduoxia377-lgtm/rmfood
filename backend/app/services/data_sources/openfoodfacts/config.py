"""OpenFoodFacts 配置

对标 OFF 官方 API 文档:
https://world.openfoodfacts.org/api/v2
"""

import os
from dataclasses import dataclass, field


def _default_mirror_urls() -> list[str]:
    """从 OFF_BASE_URLS 环境变量读取镜像列表（逗号分隔）。

    未设置或全部为空时使用官方多镜像默认值，提升对本机 IP 被
    world.openfoodfacts.org 限流（503）时的故障转移能力。
    """
    env = os.environ.get("OFF_BASE_URLS", "").strip()
    if env:
        urls = [u.strip().rstrip("/") for u in env.split(",") if u.strip()]
        if urls:
            return urls
    return [
        "https://world.openfoodfacts.org",
        "https://world-en.openfoodfacts.org",
        "https://us.openfoodfacts.org",
        "https://de.openfoodfacts.org",
        "https://fr.openfoodfacts.org",
    ]


@dataclass(frozen=True)
class OFFConfig:
    """OpenFoodFacts API 配置"""

    # ── API 端点 ──
    BASE_URL: str = "https://world.openfoodfacts.org"
    SEARCH_ENDPOINT: str = "/cgi/search.pl"
    PRODUCT_ENDPOINT: str = "/api/v2/product/{code}.json"
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
    MIRROR_URLS: list[str] = field(default_factory=_default_mirror_urls)

    # ── PostgreSQL FTS 配置 ──
    FTS_REGCONFIG: str = "simple"

    # ── 镜像探测配置 ──
    MIRROR_PROBE_TIMEOUT: float = 15.0
    MIRROR_PROBE_DELAY: float = 0.5

    # ── JSONL 增量同步 ──
    JSONL_GZIP: bool = True
    JSONL_BATCH_SIZE: int = 1000
