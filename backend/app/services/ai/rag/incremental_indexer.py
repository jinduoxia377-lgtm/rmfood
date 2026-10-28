"""增量索引服务 — 文件变更自动检测与重新索引

监控知识库目录，检测文件变更（新增/修改/删除），
自动触发重新索引，保持知识库与源文件同步。

特性：
- 基于文件哈希的变更检测
- 支持目录监控（定时扫描）
- 增量索引（仅处理变更文件）
- 事件回调机制
"""

import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Dict, List, Optional

from .rag_service import RAGService

logger = logging.getLogger(__name__)

# 支持的文件类型
SUPPORTED_EXTENSIONS = {'.pdf', '.txt', '.md', '.csv', '.json', '.xlsx', '.docx'}

# 文件状态枚举
class FileStatus:
    NEW = "new"
    MODIFIED = "modified"
    DELETED = "deleted"
    UNCHANGED = "unchanged"
    INDEXED = "indexed"


class FileRecord:
    """文件记录"""

    def __init__(self, path: str, mtime: float, size: int, hash: str):
        self.path = path
        self.mtime = mtime
        self.size = size
        self.hash = hash
        self.status = FileStatus.UNCHANGED
        self.last_indexed: Optional[datetime] = None
        self.error: Optional[str] = None
        self.chunk_count: int = 0

    def to_dict(self) -> Dict:
        return {
            "path": self.path,
            "mtime": self.mtime,
            "size": self.size,
            "hash": self.hash,
            "status": self.status,
            "last_indexed": self.last_indexed.isoformat() if self.last_indexed else None,
            "error": self.error,
            "chunk_count": self.chunk_count,
        }


class IncrementalIndexer:
    """增量索引器

    监控指定目录，检测文件变更并自动重新索引。
    """

    def __init__(
        self,
        watch_dir: str,
        rag_service: RAGService,
        scan_interval: int = 300,  # 5 分钟
        user_id: str = "system",
    ):
        """
        Args:
            watch_dir: 监控目录路径
            rag_service: RAG 服务实例
            scan_interval: 扫描间隔（秒）
            user_id: 用户 ID（租户隔离）
        """
        self.watch_dir = Path(watch_dir)
        self.rag_service = rag_service
        self.scan_interval = scan_interval
        self.user_id = user_id

        # 文件记录（path -> FileRecord）
        self.file_records: Dict[str, FileRecord] = {}

        # 回调函数
        self.on_file_indexed: Optional[Callable[[FileRecord], None]] = None
        self.on_file_error: Optional[Callable[[FileRecord, str], None]] = None
        self.on_scan_complete: Optional[Callable[[Dict[str, int]], None]] = None

        # 运行状态
        self._running = False
        self._scan_task: Optional[asyncio.Task] = None
        self._last_scan: Optional[datetime] = None

        logger.info("增量索引器初始化: watch_dir=%s, interval=%ds", watch_dir, scan_interval)

    def start(self) -> None:
        """启动监控"""
        if self._running:
            logger.warning("增量索引器已在运行")
            return

        self._running = True
        self._scan_task = asyncio.create_task(self._scan_loop())
        logger.info("增量索引器已启动")

    async def stop(self) -> None:
        """停止监控"""
        self._running = False
        if self._scan_task:
            self._scan_task.cancel()
            try:
                await self._scan_task
            except asyncio.CancelledError:
                pass
        logger.info("增量索引器已停止")

    async def _scan_loop(self) -> None:
        """扫描循环"""
        while self._running:
            try:
                await self._scan_directory()
                self._last_scan = datetime.now(timezone.utc)
            except Exception as e:
                logger.error("扫描循环异常: %s", e, exc_info=True)
            await asyncio.sleep(self.scan_interval)

    async def _scan_directory(self) -> Dict[str, int]:
        """扫描目录，检测文件变更

        Returns:
            统计信息（new/modified/deleted/unchanged）
        """
        if not self.watch_dir.exists():
            logger.warning("监控目录不存在: %s", self.watch_dir)
            return {}

        current_files: Dict[str, FileRecord] = {}
        stats = {"new": 0, "modified": 0, "deleted": 0, "unchanged": 0, "indexed": 0, "error": 0}

        # 遍历目录
        for file_path in self.watch_dir.rglob("*"):
            if not file_path.is_file():
                continue
            if file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                continue

            path_str = str(file_path)
            try:
                stat = file_path.stat()
                mtime = stat.st_mtime
                size = stat.st_size

                # 计算文件哈希
                file_hash = self._compute_hash(file_path)

                # 检查是否已存在记录
                existing = self.file_records.get(path_str)

                if existing is None:
                    # 新文件
                    record = FileRecord(path_str, mtime, size, file_hash)
                    record.status = FileStatus.NEW
                    current_files[path_str] = record
                    stats["new"] += 1
                    logger.info("检测到新文件: %s", path_str)

                elif existing.hash != file_hash or existing.mtime != mtime:
                    # 文件已修改
                    existing.hash = file_hash
                    existing.mtime = mtime
                    existing.size = size
                    existing.status = FileStatus.MODIFIED
                    current_files[path_str] = existing
                    stats["modified"] += 1
                    logger.info("检测到文件修改: %s", path_str)

                else:
                    # 文件未变化
                    existing.status = FileStatus.UNCHANGED
                    current_files[path_str] = existing
                    stats["unchanged"] += 1

            except Exception as e:
                logger.error("处理文件失败 %s: %s", path_str, e)
                record = FileRecord(path_str, 0, 0, "")
                record.error = str(e)
                record.status = FileStatus.UNCHANGED
                current_files[path_str] = record
                stats["error"] += 1

        # 检测删除的文件
        for path_str in list(self.file_records.keys()):
            if path_str not in current_files:
                record = self.file_records.pop(path_str)
                record.status = FileStatus.DELETED
                stats["deleted"] += 1
                logger.info("检测到文件删除: %s", path_str)

        # 更新文件记录
        self.file_records = current_files

        # 处理变更文件
        for path_str, record in current_files.items():
            if record.status in (FileStatus.NEW, FileStatus.MODIFIED):
                indexed = await self._index_file(record)
                if indexed:
                    stats["indexed"] += 1

        # 触发回调
        if self.on_scan_complete:
            self.on_scan_complete(stats)

        logger.info("目录扫描完成: %s", stats)
        return stats

    async def _index_file(self, record: FileRecord) -> bool:
        """索引单个文件

        Returns:
            是否成功索引
        """
        try:
            file_path = Path(record.path)
            if not file_path.exists():
                record.error = "文件不存在"
                return False

            # 读取文件内容
            with open(file_path, 'rb') as f:
                content = f.read()

            # 调用 RAG 服务索引
            doc_info = await self.rag_service.ingest_document(
                content=content,
                filename=record.path,
                user_id=self.user_id,
            )

            # 更新记录
            record.status = FileStatus.INDEXED
            record.last_indexed = datetime.now(timezone.utc)
            record.chunk_count = doc_info.chunk_count
            record.error = None

            logger.info("文件索引成功: %s (%d 块)", record.path, doc_info.chunk_count)

            # 触发回调
            if self.on_file_indexed:
                self.on_file_indexed(record)

            return True

        except Exception as e:
            record.error = str(e)
            logger.error("文件索引失败 %s: %s", record.path, e)

            # 触发回调
            if self.on_file_error:
                self.on_file_error(record, str(e))

            return False

    def _compute_hash(self, file_path: Path) -> str:
        """计算文件哈希（MD5）"""
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()

    def get_status(self) -> Dict:
        """获取索引器状态"""
        return {
            "watch_dir": str(self.watch_dir),
            "running": self._running,
            "scan_interval": self.scan_interval,
            "last_scan": self._last_scan.isoformat() if self._last_scan else None,
            "total_files": len(self.file_records),
            "indexed_files": sum(1 for r in self.file_records.values() if r.status == FileStatus.INDEXED),
            "pending_files": sum(1 for r in self.file_records.values() if r.status in (FileStatus.NEW, FileStatus.MODIFIED)),
            "error_files": sum(1 for r in self.file_records.values() if r.error),
        }

    def get_file_records(self) -> List[Dict]:
        """获取所有文件记录"""
        return [r.to_dict() for r in self.file_records.values()]

    def force_rescan(self) -> Dict:
        """强制重新扫描（同步版本，用于测试）"""
        return asyncio.run(self._scan_directory())


# 全局单例
_indexer_instance: Optional[IncrementalIndexer] = None


def get_incremental_indexer(
    watch_dir: str,
    rag_service: RAGService,
    user_id: str = "system",
) -> IncrementalIndexer:
    """获取全局增量索引器单例"""
    global _indexer_instance
    if _indexer_instance is None:
        _indexer_instance = IncrementalIndexer(
            watch_dir=watch_dir,
            rag_service=rag_service,
            user_id=user_id,
        )
    return _indexer_instance
