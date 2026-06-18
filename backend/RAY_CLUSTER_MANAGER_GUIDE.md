# 🚀 Ray分布式计算集群管理器 - 使用指南

> 🟡 Task 3: 为RMFOOD配方平台提供分布式AI和数据分析能力

## 📋 概述

Ray集群管理器为RMFOOD配方平台提供了分布式计算能力，使大规模配方分析、批量数据处理和机器学习模型训练变得更加高效。通过在Ray框架之上构建抽象层，我们提供了一致的API和简化的配置管理。

### 主要特性

- **🧩 无缝集成**: 与现有AI服务和FastAPI框架无缝集成
- **🚀 一键集群**: 自动启动和停止Ray集群
- **📊 智能调度**: 根据任务优先级和资源需求智能调度
- **📈 实时监控**: CPU/GPU/内存使用情况实时监控
- **🛡️ 容错机制**: 任务失败自动重试和恢复
- **🔒 权限控制**: 基于用户的权限和资源限制
- **🔧 配置灵活**: 支持本地开发和云部署模式

## 🏗️ 架构设计

```
RMFOOD应用层  → FastAPI路由  → Ray集群管理器  → Ray计算集群  → 分布式工作者
            ↑              ↗             ↑
      现有AI服务      配置管理      监控和调度
```

### 组件说明

1. **RayClusterManager**: 核心管理类，处理集群生命周期和任务调度
2. **Ray路由器API**: 提供RESTful API接口
3. **任务执行引擎**: 异步任务执行和监控
4. **资源监控器**: 实时资源使用监控
5. **配置管理器**: 环境变量和运行时配置管理

## 📦 安装和配置

### 依赖安装

Ray依赖已添加到项目的`requirements/ml.in`文件中：

```bash
# 安装所有依赖（包括Ray）
cd D:\RMFOOD配方平台\backend
pip install -r requirements/ml.txt
# 或使用uv
uv pip install -r requirements/ml.txt
```

### 环境配置

在`.env`文件中添加以下配置：

```env
# ── Ray 分布式计算 (可选, 用于大规模AI任务) ──────────────────────

# 基础配置
RAY_ADDRESS=auto                           # Ray集群地址: auto | "ray://host:port"
RAY_NUM_CPUS=0                            # 0 = 使用所有CPU, 整数 = 指定CPU数量
RAY_NUM_GPUS=0                            # 0 = 使用所有GPU, 整数 = 指定GPU数量
RAY_OBJECT_STORE_MEMORY=4_000_000_000     # 对象存储内存: 4GB

# 监控配置
RAY_LOG_TO_DRIVER=true                    # 是否将日志发送到驱动程序
RAY_DASHBOARD_HOST=0.0.0.0                # Dashboard 主机
RAY_DASHBOARD_PORT=8265                   # Dashboard 端口
RAY_INCLUDE_DASHBOARD=true                # 是否包含Dashboard

# 任务配置
RAY_MAX_RESTARTS=3                        # 任务最大重启次数
RAY_REUSE_ACTORS=true                     # 是否重用Actor实例

# 高级配置
RAY_RAYLET_CONFIG={"node_manager_port": 6379, "object_store_port": 8076}
```

### 不同环境的配置示例

#### 开发环境（本地）
```env
RAY_ADDRESS=auto
RAY_NUM_CPUS=4
RAY_NUM_GPUS=0
RAY_LOG_TO_DRIVER=true
RAY_INCLUDE_DASHBOARD=true
```

#### 生产环境（单节点）
```env
RAY_ADDRESS=auto
RAY_NUM_CPUS=8
RAY_NUM_GPUS=2
RAY_LOG_TO_DRIVER=false
RAY_INCLUDE_DASHBOARD=true
RAY_TASK_TIMEOUT_SECONDS=1800
```

#### 生产环境（多节点集群）
```env
RAY_ADDRESS=ray://head-node:10001
RAY_NUM_CPUS=0  # 由集群自动分配
RAY_NUM_GPUS=0  # 由集群自动分配
RAY_LOG_TO_DRIVER=false
```

## 🚀 快速开始

### 1. 启动服务

确保RMFOOD后端服务正常启动：

```bash
cd D:\RMFOOD配方平台\backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 启动Ray集群

```bash
curl -X POST http://localhost:8000/api/v1/ray/cluster/start \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"wait_for_ready": true}'
```

响应：
```json
{
  "success": true,
  "status": {
    "state": "running",
    "address": "auto",
    "dashboard_url": "http://localhost:8265",
    "node_count": 1,
    "active_workers": 0,
    "total_tasks": 0,
    "completed_tasks": 0,
    "failed_tasks": 0,
    "uptime_seconds": 0.5,
    "started_at": "2026-06-17T10:30:00Z"
  },
  "message": "集群启动成功"
}
```

### 3. 提交分析任务

#### 单个配方分析
```bash
curl -X POST http://localhost:8000/api/v1/ray/analysis/recipe \
  -H "Authorization: Bearer <user_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "recipe_id": "recipe_001",
    "analysis_types": ["composition", "similarity", "nutrition"]
  }'
```

响应：
```json
{
  "task_id": "task_a1b2c3d4",
  "message": "配方分析任务已提交",
  "estimated_completion": "2026-06-17T10:31:00Z"
}
```

#### 批量配方分析
```bash
curl -X POST http://localhost:8000/api/v1/ray/analysis/batch \
  -H "Authorization: Bearer <user_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "recipe_ids": ["recipe_001", "recipe_002", "recipe_003", "recipe_004"],
    "analysis_types": ["composition"],
    "use_gpu": true
  }'
```

### 4. 查询任务状态

```bash
curl -X GET http://localhost:8000/api/v1/ray/tasks/task_a1b2c3d4 \
  -H "Authorization: Bearer <user_token>"
```

响应：
```json
{
  "task_id": "task_a1b2c3d4",
  "status": {
    "task_id": "task_a1b2c3d4",
    "state": "completed",
    "progress": 1.0,
    "start_time": "2026-06-17T10:30:05Z",
    "end_time": "2026-06-17T10:30:45Z",
    "result": {
      "recipe_id": "recipe_001",
      "analysis_results": {
        "composition": {
          "ingredients": 15,
          "nutrition_score": 85,
          "complexity": 3.5,
          "recommendations": ["减少盐分", "增加蔬菜比例"]
        },
        "similarity": {
          "similar_recipes": ["recipe_002", "recipe_005", "recipe_012"],
          "similarity_scores": [0.85, 0.72, 0.68]
        }
      },
      "timestamp": "2026-06-17T10:30:45Z",
      "processing_time_seconds": 40.0
    },
    "retry_count": 0
  }
}
```

### 5. 监控集群状态

```bash
curl -X GET http://localhost:8000/api/v1/ray/health \
  -H "Authorization: Bearer <user_token>"
```

## 📚 API参考

### 集群管理

| 端点 | 方法 | 描述 | 权限 |
|------|------|------|------|
| `/ray/cluster/start` | POST | 启动Ray集群 | 管理员 |
| `/ray/cluster/stop` | POST | 停止Ray集群 | 管理员 |
| `/ray/cluster/status` | GET | 获取集群状态 | 所有用户 |

### 任务管理

| 端点 | 方法 | 描述 | 权限 |
|------|------|------|------|
| `/ray/tasks/submit` | POST | 提交通用任务 | 所有用户 |
| `/ray/tasks/{task_id}` | GET | 获取任务状态 | 任务所有者 |
| `/ray/tasks/{task_id}/cancel` | POST | 取消任务 | 任务所有者 |
| `/ray/tasks` | GET | 列出任务 | 所有用户 |

### 便捷接口

| 端点 | 方法 | 描述 | 权限 |
|------|------|------|------|
| `/ray/analysis/recipe` | POST | 分析单个配方 | 所有用户 |
| `/ray/analysis/batch` | POST | 批量分析配方 | 所有用户 |

### 监控指标

| 端点 | 方法 | 描述 | 权限 |
|------|------|------|------|
| `/ray/resources` | GET | 获取资源使用情况 | 所有用户 |
| `/ray/health` | GET | 健康检查 | 所有用户 |
| `/ray/stats` | GET | 统计信息 | 所有用户 |

### 系统管理

| 端点 | 方法 | 描述 | 权限 |
|------|------|------|------|
| `/ray/maintenance/cleanup` | POST | 清理旧任务 | 管理员 |
| `/ray/dashboard/url` | GET | 获取Dashboard URL | 管理员 |

## 🔧 高级用法

### Python SDK使用

#### 1. 使用RayClusterManager

```python
import asyncio
from app.core.ray_manager import RayClusterManager, RayConfig

async def analyze_recipes_batch():
    """批量分析配方示例"""
    
    # 创建管理器
    config = RayConfig(
        address="auto",
        num_cpus=4,
        object_store_memory=4_000_000_000
    )
    
    # 使用上下文管理器（推荐）
    async with RayClusterManager(config=config) as manager:
        
        # 提交批量分析任务
        task_ids = []
        recipe_ids = [f"recipe_{i:03d}" for i in range(100)]
        
        # 分批提交（防止内存溢出）
        batch_size = 10
        for i in range(0, len(recipe_ids), batch_size):
            batch = recipe_ids[i:i+batch_size]
            task_id = await manager.submit_batch_analysis(batch)
            task_ids.append(task_id)
            print(f"提交批次 {i//batch_size + 1}: {len(batch)} 个配方")
        
        # 等待所有任务完成
        while task_ids:
            for task_id in task_ids[:]:
                status = await manager.get_task_status(task_id)
                if status and status.state == "completed":
                    print(f"任务 {task_id} 完成: {status.result}")
                    task_ids.remove(task_id)
            await asyncio.sleep(1)
    
    print("所有分析任务完成！")

# 运行
if __name__ == "__main__":
    asyncio.run(analyze_recipes_batch())
```

#### 2. 任务配置自定义

```python
from app.core.ray_manager import TaskConfig

# 自定义任务配置
custom_task = TaskConfig(
    task_type="recipe_analysis",
    payload={
        "recipe_id": "special_recipe_001",
        "analysis_types": ["composition", "safety", "cost"],
        "detailed_report": True,
        "include_recommendations": True
    },
    priority=9,  # 高优先级
    timeout_seconds=600,  # 10分钟超时
    max_retries=3,  # 最多重试3次
    retry_delay_seconds=10,
    require_gpu=False
)
```

### 集成现有AI服务

Ray集群管理器可以与现有AI服务无缝集成：

```python
from app.core.ai_models import AIModelManager
from app.core.ray_manager import execute_distributed_analysis

async def enhanced_ai_analysis():
    """增强型AI分析：结合AI服务和Ray分布式计算"""
    
    # 1. 使用AI服务生成分析建议
    ai_manager = AIModelManager()
    ai_suggestions = await ai_manager.chat(
        messages=[{"role": "user", "content": "分析这些配方的主要营养成分"}],
        model="gpt-4",
        tenant_id="tenant_001"
    )
    
    # 2. 使用Ray进行大规模数据分析
    recipe_ids = get_batch_recipes()  # 获取配方列表
    distributed_results = await execute_distributed_analysis(
        recipe_ids=recipe_ids,
        analysis_type="nutrition"
    )
    
    # 3. 结合AI建议和数据结果
    enhanced_results = {
        "ai_suggestions": ai_suggestions,
        "distributed_analysis": distributed_results,
        "summary": combine_results(ai_suggestions, distributed_results)
    }
    
    return enhanced_results
```

## 🧪 测试

### 运行单元测试

```bash
cd D:\RMFOOD配方平台\backend

# 运行所有Ray相关测试
pytest tests/test_ray_manager.py -v -x

# 运行带标记的测试
pytest tests/test_ray_manager.py -m "ray and unit" -v
pytest tests/test_ray_manager.py -m "integration" -v  # 需要实际Ray环境

# 生成覆盖率报告
pytest tests/test_ray_manager.py --cov=app.core.ray_manager --cov-report=html
```

### 测试标记说明

| 标记 | 描述 | 运行时间 |
|------|------|----------|
| `@pytest.mark.ray` | Ray相关测试 | 快速 |
| `@pytest.mark.unit` | 单元测试 | 快速 |
| `@pytest.mark.integration` | 集成测试 | 中等 |
| `@pytest.mark.performance` | 性能测试 | 可能较长 |
| `@pytest.mark.slow` | 慢速测试（需要实际Ray环境） | 较长 |

## 🔍 故障排除

### 常见问题

#### 1. Ray集群启动失败
```bash
# 检查Ray是否安装
python -c "import ray; print(f'Ray version: {ray.__version__}')"

# 检查环境变量
printenv | grep RAY_

# 查看日志
tail -f logs/ray.log
```

#### 2. 任务提交失败
- **错误**: `RuntimeError: 集群未运行`
- **解决方案**: 先启动集群

#### 3. 资源不足
- **症状**: 任务执行缓慢或失败
- **解决方案**: 增加资源或调整配置
  ```env
  RAY_NUM_CPUS=8
  RAY_OBJECT_STORE_MEMORY=8_000_000_000
  ```

#### 4. Dashboard无法访问
```bash
# 检查端口是否被占用
netstat -tulpn | grep :8265

# 检查防火墙设置
firewall-cmd --list-ports  # Linux
# 或
netsh advfirewall firewall show rule name=all | findstr 8265  # Windows
```

### 监控和调试

1. **访问Ray Dashboard**: `http://localhost:8265`
2. **查看集群日志**: `tail -f /tmp/ray/session_latest/logs/*.log`
3. **使用API健康检查**:
   ```bash
   curl -X GET http://localhost:8000/api/v1/ray/health
   ```

## 📊 性能优化

### 配置调优

```env
# 针对大数据集优化
RAY_OBJECT_STORE_MEMORY=8_000_000_000
RAY_TASK_TIMEOUT_SECONDS=1800
RAY_MAX_CONCURRENT_TASKS=20

# 针对模型训练优化
RAY_NUM_GPUS=2
RAY_REUSE_ACTORS=true
RAY_MAX_RESTARTS=5

# 针对低延迟任务优化
RAY_RUNTIME_ENV_PIP_IGNORE_INSTALLED=True
RAY_RAYLET_CONFIG={"local_gc_interval_s": 60}
```

### 任务调优策略

1. **批量大小优化**:
   ```python
   # 根据数据大小调整批处理大小
   def optimal_batch_size(data_size):
       if data_size < 1000:
           return data_size  # 小数据集，全部处理
       elif data_size < 10000:
           return 1000       # 中等数据集，分批处理
       else:
           return 500        # 大数据集，小批处理
   ```

2. **优先级策略**:
   ```python
   # 根据任务类型设置不同优先级
   priority_map = {
       "recipe_analysis": 8,
       "batch_analysis": 6,
       "model_training": 9,
       "data_processing": 5
   }
   ```

## 🔮 未来扩展

### 计划功能

1. **动态伸缩**: 根据负载自动调整集群规模
2. **多集群管理**: 支持跨多个Ray集群的统一管理
3. **高级调度**: 支持DAG任务和工作流
4. **数据管道**: 集成数据ETL管道
5. **模型部署**: 支持模型服务化和A/B测试

### 集成扩展

1. **MLflow集成**: 实验跟踪和模型管理
2. **Prometheus集成**: 监控指标导出
3. **Airflow集成**: 工作流编排
4. **Kubernetes集成**: 容器化部署

## 📄 License

Ray集群管理器作为RMFOOD配方平台的一部分，遵循项目主许可证。

## 🤝 贡献指南

1. **代码规范**: 遵循现有项目的编码规范和风格
2. **测试要求**: 新功能必须包含测试用例，覆盖率不低于80%
3. **文档更新**: 所有变更必须更新相关文档
4. **API兼容**: 保持向后兼容性，重大变更需要版本管理

---

> **文档版本**: v1.0.0  
> **最后更新**: 2026-06-17  
> **维护团队**: RMFOOD开发团队