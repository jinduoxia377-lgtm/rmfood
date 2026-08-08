# 超大后端文件拆分计划

> 本文档记录所有 >800 行后端文件的拆分方案，供后续迭代执行。

## 文件清单

| 文件 | 行数 | 建议拆分 |
|------|------|---------|
| `analytics_engine.py` | 1096 | `query_builder.py`, `aggregator.py`, `report_generator.py` |
| `ray_manager.py` | 1116 | `cluster_config.py`, `task_scheduler.py`, `result_collector.py` |
| `migration.py` | 1056 | `strategy.py`, `executor.py`, `validator.py` |
| `domain_events.py` | 943 | `event_bus.py`, `event_handlers.py`, `event_publisher.py` |
| `websocket_manager.py` | 881 | `connection_manager.py`, `room_manager.py`, `message_router.py` |
| `security_middleware.py` | 877 | `cors_config.py`, `rate_limiter.py`, `csrf_protection.py`, `headers.py` |

## 拆分原则

1. 每个新文件不超过 400 行
2. 保持公共 API 不变（原文件仍导出所有公开接口）
3. 使用 barrel export（`from submodule import *`）保持向后兼容
4. 拆分后运行全部测试确保无回归
