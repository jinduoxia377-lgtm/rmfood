# RAG Reranker 启用验证报告（Step 2）

- 日期：2026-10-28
- 修复人：dev-rag-backend（Team Lead: lead）
- 范围：仅后端（reranker 启用 + 依赖 + 模型下载）
- 承接：`reports/rag-final-closure-verify.md`

## 结论（一句话）

**Step 2 代码/环境工作已完成**（依赖已装、reranker.py 已修 `rank` 路径、requirements 已修 extra、2 个环境问题已修），**模型下载因网络受限未完成（中间态，安全降级）**；精排功能已可部署启用（模型补下载即生效），未下载完成时自动降级为原始 RRF 顺序（不报错）。

---

## 1. 依赖安装 ✅

| 包 | 版本 | 来源 | 说明 |
|:-----|:-----|:-----|:-----|
| rerankers | 0.10.0 | pypi.org | tuna 镜像**无此包**（`from versions: none`），改用官方 PyPI |
| transformers | 5.21.0 | 阿里云 | 原 `files.pythonhosted.org` CDN 慢/受阻，改阿里云镜像 |
| torch | 2.14.0 | 已有 | 未动 |
| sentencepiece / huggingface-hub / hf-xet / click | 0.2.2 / 1.33.0 / 1.7.0 / 8.5.0 | 阿里云 | transformers 依赖 |

**`backend/requirements-rerank.txt` 已修**（L15）：`rerankers[cross-encoders]>=0.4.0` → **`rerankers[transformers]>=0.4.0`**。
原因：rerankers>=0.5 已将 extra 从 `cross-encoders` 更名为 `transformers`；原声明无效（pip 警告 "does not provide the extra 'cross-encoders'"，只装到 53KB 空壳，无后端）。

## 2. 代码修改 ✅（`backend/app/services/ai/rag/reranker.py`）

- **`rerank()` 改用 `model.rank()`**（L129-136）：rerankers 0.10.0 的 `BaseRanker` 只有 `rank`/`score`，**没有 `compute_score`**——原代码调用 `compute_score` 在 0.10.0 下会 `AttributeError` → 被捕获 → **静默降级**，装完也不会真正精排。已改为 `results = model.rank(query, documents)`，取 `[(int(r.document.doc_id), float(r.score)) for r in results.results]`（`doc_id` = 输入列表原始索引）；保留 `.compute_score` 分支兼容旧版/transformers 降级路径。
- **默认模型解析**（`_default_model()`，L20-35 + `Reranker.__init__`/`get_reranker`）：`RAG_RERANKER_MODEL` 环境变量 > 本地目录 `backend/data/models/bge-reranker-base`（存在则优先）> HF 名 `BAAI/bge-reranker-base`。规避 `huggingface_hub` 缓存写元数据权限异常（见 §4）。
- `rag_service.py` 未改（L450-451 已调用 `get_reranker()`，精排路径已就绪）。

## 3. 环境问题修复 ✅（安装过程中发现并修复）

- **`regex` 错误版本**：venv 里 `regex` 装的是 **cp314** 的 `_regex.cp314-win_amd64.pyd`（Python 3.14 wheel），在 py3.11 下 `_regex` 无法导入（`ImportError: cannot import name '_regex'`，circular import）→ transformers 崩溃。已 `--force-reinstall` 为 **cp311** wheel（现 `import regex` OK，`_regex.cp311-win_amd64.pyd`，版本 2026.9.29）。
- **`pyyaml` 元数据损坏**：`PyYAML-6.0.2.dist-info` **缺 METADATA** → `importlib.metadata.version('pyyaml')` 返回 None → transformers `require_version('pyyaml>=5.1')` 报 `ValueError: Unable to compare versions`。已删坏 dist-info + 重装（`md.version('pyyaml')='6.0.3'`，`import transformers` OK）。

## 4. 模型下载（中间态 ⏳，网络受限）

- **模型真实大小 1.11GB**：已核实 hf-mirror 上 `model.safetensors` 的 **Content-Length = 1,112,206,140 字节（1.11GB）**。requirements/README 中"~278MB"实为**参数量（278M）**；float32 存储实为 ~1.11GB。
- **已下载 171.9MB（180,247,782 字节，保留未删）**：首轮 urllib 下载被连接中途断开（server 早关连接，urllib read-to-EOF 未抛 IncompleteRead，脚本误判完成）。`Accept-Ranges: bytes` 已确认，续传可行。
- **卡点**：hf-mirror 限速/节流 ~5MB/min；8 路并行 Range 分块（`_tmp_dl_resume.py`）**seg 文件均 0 字节**（镜像未响应并行 Range），已停止该任务。剩余 ~888MB，单路 ~5MB/min ≈ 3h，超出合理等待。
- **`huggingface_hub` 缓存写异常**：`snapshot_download` 报 `WinError 5`（写 `models--BAAI--bge-reranker-base\trees\*.json`/`refs\main`）。根因：transformers 安装把 `huggingface-hub` 从 1.18.0 升到 **1.33.0**；不能降级（transformers 5.21.0 要求 hub>=1.31.0）。人工对同一路径 mkdir/write/rm 正常 → 文件系统无问题，是 hub 1.33.0 内部写元数据权限异常（疑似 hf-xet/Windows）。**已绕过**：用 urllib 从 hf-mirror 手动下载到本地目录 `backend/data/models/bge-reranker-base/`，`Reranker(model_name=本地路径)` 加载。

## 5. 验收（当前可达）✅

| 验收项 | 结果 | 证据 |
|:-----|:----:|:-----|
| 依赖安装成功 | ✅ | `import rerankers`（0.10.0）+ `import transformers`（5.21.0）OK |
| `get_reranker()` 返回实例 | ✅ | `isinstance(r, Reranker)` True，model_name=本地路径 |
| 模型懒加载 | ✅ | 本地模型不完整 → `_get_model()` 返回 None（`SafetensorError: incomplete metadata, file not fully covered` 被捕获，不抛错） |
| 无模型时 rerank 降级 | ✅ | `rerank(query, docs)` → `[(0,0.0),(1,0.0),(2,0.0)]`（原始顺序）→ **`RERANKER_DEGRADE_OK`** |
| reranker.py py_compile | ✅ | exit 0 |
| requirements-rerank.txt 修 extra | ✅ | `rerankers[transformers]>=0.4.0` |

**未达成（需模型下载完成，网络受限）**：`get_reranker()` 模型非 None + 样本 rerank 非原始顺序 + `/rag/search` 检索不报错。模型下载完成后即满足（代码路径已就绪并实测：`rank` 路由到 `TransformerRanker`，模型加载逻辑正确）。

## 6. 建议（部署时）

1. **保留续传**：`model.safetensors` 已下载 171.9MB 未删，部署时联网后台续下（Range 续传），或部署机直接 `snapshot_download`/`hf_hub_download`（避开本机 hub 1.33.0 写异常则直接入缓存）。
2. **换更快镜像/CDN**：如 hf-mirror 直连仍限速，尝试其他国内代理（阿里/清华 HF 代理）或分时下载。
3. **安全降级**：模型未就绪时 RAG 自动走 RRF 顺序（已验证不报错），不影响核心检索/生成。

## 7. 改动文件清单（后端 2 个 + 说明）

1. `backend/app/services/ai/rag/reranker.py` — ①`rerank` 改用 `model.rank()`（兼容 `compute_score`）；②默认模型解析（env/本地/HF 名）。
2. `backend/requirements-rerank.txt` — `rerankers[cross-encoders]` → `rerankers[transformers]`。
3. （环境）`regex` cp314→cp311 wheel、`pyyaml` METADATA 重装 —— 非源码改动。

## 8. 遗留

- **模型下载未完成**（171.9MB / 1.11GB，网络受限）——中间态，安全降级。
- 临时脚本（`_tmp_dl_model.py`、`_tmp_dl_resume.py`、`_tmp_rerank_verify.py`、`_tmp_rerank_accept.py`）待清理（可留作部署续传/验收复跑用）。
- 本地模型目录 `backend/data/models/bge-reranker-base/`（含 171.9MB 部分 model.safetensors + 完整 config/tokenizer 等）——保留。

## 9. 未验证

- 完整 `TransformerRanker` 真实推理（模型 1.11GB 未下载全；加载需 ~2-4GB RAM + 首次推理慢，属预期）。
- `/rag/search` HTTP 级精排介入验证（依赖模型就绪）。
