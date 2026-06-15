# ADR-008: CI/CD 流水线与持续交付策略

## 状态
✅ 已接受 (2026-06-15)

## 上下文

RMFOOD 平台需要自动化构建、测试、部署流程:
1. 代码提交后自动运行 lint + type check + tests
2. 构建 Docker 镜像并推送到镜像仓库
3. 多环境部署 (dev → staging → production)
4. 数据库迁移自动化
5. 回滚能力

## 决策

### 基于 GitHub Actions 的 CI/CD

- CI 工作流: `.github/workflows/ci-cd.yml`
- Security Scan: `.github/workflows/security-scan.yml`
- Docker: 多阶段构建 (backend/frontend/Dockerfile)
- K8s: Helm Charts (`deploy/helm/rmfood/`)
- Compose: `docker-compose.prod.yml`

### 流水线阶段

| 阶段 | 工具 | 阈值 |
|:-----|:-----|:-----|
| Lint | ruff (backend), eslint (frontend) | 0 warnings |
| Type Check | mypy (backend), tsc (frontend) | 0 errors |
| Unit Test | pytest + coverage | ≥ 75% |
| Integration Test | pytest (DB + Redis) | 全部通过 |
| Build | Docker multi-stage | 成功 |
| Deploy | Helm + kubectl / docker-compose | 健康检查通过 |

### 分支策略

| 分支 | 用途 | 保护 |
|:-----|:-----|:-----|
| main | 生产就绪 | 要求 PR + CI 通过 |
| staging | 预发布 | 自动从 main 合并 |
| develop | 开发集成 | 允许直接推送 |
| feature/* | 新功能 | 开 PR 到 develop |

## 实施检查清单

- [x] GitHub Actions CI/CD 配置
- [x] Security Scan 工作流
- [x] Docker 多阶段构建
- [x] Helm Charts (K8s 部署)
- [x] docker-compose.prod.yml
- [ ] 自动部署到 staging (计划 v2.0)
- [ ] 自动部署到 production (计划 v2.0)
- [ ] 数据库迁移自动化 (计划 v2.0)
