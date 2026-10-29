# Step2：reranker 模型下载报告（bge-reranker-base）

- 执行日期：2026-10-29
- 执行角色：RMFOODFP 后端集成测试专家（e2e-rag-verify；只读测试/不重启进程，仅补全模型文件）
- 目标：续传 `BAAI/bge-reranker-base`（1.11GB float32）至完整，并验证可用性
- **结果：模型已完整下载并验证可用（`rank()` 排序正确）。** 阻塞（hf-mirror 限速/并行分片 0 字节）已通过「huggingface.co 直连 + Range 单文件续传」解除。

---

## 一、初始部分文件状态（续传前）

目录：`backend/data/models/bge-reranker-base.broken/`（上一轮被标记 broken，后端期望路径为 `bge-reranker-base`）

| 文件 | 大小 |
|:-----|-----:|
| `model.safetensors` | **180,247,782 B (171.9 MB)** ← 唯一部分文件 |
| `tokenizer.json` | 17,098,107 B |
| `sentencepiece.bpe.model` | 5,069,051 B |
| `config.json` | 799 B |
| `tokenizer_config.json` | 443 B |
| `special_tokens_map.json` | 279 B |
| `_download_status.json` | 记录 done 列表（model.safetensors 部分） |

目标总大小（HEAD 探测）：**model.safetensors = 1,112,206,140 B（1060.7 MB）**；剩余 **931,958,358 B（888.7 MB）**。config = `xlm-roberta-base`（12 层、hidden 768、float32、vocab 250002，`XLMRobertaForSequenceClassification`）。

## 二、续传策略与结果

### 2.1 源选择（HEAD + Range 探测）
| 镜像 | HEAD | Range GET 1KB | 结论 |
|:-----|:----:|:----:|:-----|
| `hf-mirror.com` | 200 (1,112,206,140) | 206 / 1024 B | ~5MB/min 限速 → **弃用** |
| `huggingface.co` 直连 | 200 (1,112,206,140) | 206 / 1024 B | **可达且快**（此前 WinError 10060，现可连）→ 选用 |
| `cdn-lfs.hf-mirror.com` | 403 | — | 不可用 |

### 2.2 续传方式
- **urllib Range 单文件从当前字节续**（非 8 并行分片——mirror 对并行 Range 返回 0 字节）。
- 每 150s 一轮自动断点续传（`_reranker_resume.py` / `_reranker_loop.py`），追加写入，轮间自动重连。

### 2.3 吞吐与进度
| 阶段 | 起始字节 | 结束字节 | 备注 |
|:-----|--------:|--------:|:-----|
| 手动续传（huggingface.co） | 180,247,782 | 989,748,454 | ~37MB/min（峰值 54-71MB/min，偶发 3-8MB/min）；~30min（MAXWALL 1800s） |
| 手动续传（续） | 989,748,454 | **1,112,206,140** | ~25MB/min；完成 `complete=True`（in `.broken`） |
| **后端自行下载（覆盖）** | 0 | 764,227,584 | 运行中的 :8000 后端检测到模型缺失，自行 `snapshot_download` 到 `bge-reranker-base/`（**重新从 0 下载**，截断了我已完成文件），~50MB/min |
| **后端下载停滞** | 764,227,584 | 764,227,584 | 11:27:55 起 6+ 分钟无增长（后端进程 PID 12524 于 ~11:27 死亡） |
| 我接管续传（staging） | 764,227,584 | **1,112,206,140** | ~35MB/min（513s）；`complete=True`；safetensors 头校验通过（203 张量，data_bytes 一致） |

> **关键转折**：手动下载到 89% 时，运行中的旧后端（PID 12524）自行触发了一次全新下载（检测到本地模型缺失 → `snapshot_download` 重下），截断了我已完成文件并重下至 68.7%（764MB）；旧后端进程随后死亡，新后端（PID 3156）接管 :8000，但新后端的 reranker 初始化随之中断/降级。我随后从 764MB 续传接管，补全至 1,112,206,140 B。**该次重复下载是主要传输浪费来源，但最终状态正确。**

### 2.4 文件补全与就位
- 补全后 staging 校验：`model.safetensors` = 1,112,206,140 B（精确），safetensors 头 = 24,352 B JSON，**203 个张量**（`__metadata__={format:pt}`），`data_bytes(1,112,181,780) == sz-8-header_len`（**一致**）。
- 小文件（config.json/tokenizer.json/tokenizer_config.json/special_tokens_map.json/sentencepiece.bpe.model）重新下载（尺寸与原值一致：799/17,098,107/443/279/5,069,051 B）。
- 最终就位于 **`backend/data/models/bge-reranker-base/`**（后端 `_default_model()` 期望路径）：6 文件齐备，`model.safetensors` = 1,112,206,140 B。

## 三、可用性验证（真实 reranker.py 路径）

命令：`Reranker().rerank("增强免疫 补气", docs, top_n=4)`（`app/services/ai/rag/reranker.py`，离线 `HF_HUB_OFFLINE=1`）

- `_default_model()` → `D:\RMFOODFP\backend\data\models\bge-reranker-base`（本地路径解析正确）
- 模型加载：`rerankers.Reranker(model_name=本地路径)` → **`TransformerRanker`**（cross-encoder，cpu，float32），201 权重加载完成，`model_loaded=True`
- `rank()` 输出（按分降序）：
  ```
  [(0, 1.7173) 黄芪(增强免疫补气), (1, -0.8079) 枸杞子(抗氧化增强免疫),
   (2, -3.8234) 当归(补血), (3, -3.9501) 板蓝根(清热解毒)]
  ```
  → **语义排序正确**（增强免疫/补气相关药材分数显著高于无关药材），`scores_desc=True`
- 首载+首次 rank：46.45s（含 ~45s 磁盘加载；后续推理 ~100ms/次）
- **判定：PASS**（模型可加载、`rank()` 排序有效）

## 四、结论

- **`BAAI/bge-reranker-base` 已完整下载**：`backend/data/models/bge-reranker-base/model.safetensors` = 1,112,206,140 B + 5 个支撑文件，与 HF 官方尺寸一致，safetensors 结构校验通过。
- **可用性验证通过**：经真实 `reranker.py` 路径加载（`TransformerRanker`）并 `rank()` 正确排序。
- **网络阻塞已解除**：huggingface.co 直连现可达（~30-40MB/min，峰值 70MB/min）；hf-mirror ~5MB/min 限速与 8 并行分片 0 字节问题均绕过（单文件 Range 续传）。

## 五、遗留 / 说明（不影响模型可用）

1. **运行中后端（PID 3156）**：其 reranker 实例在下载中断期间可能已缓存「加载失败→None」降级，当前进程需重启才会重新加载完整模型（任务约定不重启进程，故未重启；**仅补全了模型文件**）。新进程/重启后 `_default_model()` 将命中完整本地模型并成功加载。
2. **重复下载**：旧后端（PID 12524）的自行 `snapshot_download` 截断了手动已完成文件，导致部分字节重复传输；最终文件正确，无数据损坏。
3. **`RAG_RERANKER_MODEL`**：未设置时 `_default_model()` 走本地 `bge-reranker-base`（现完整）；如需显式覆盖可设该环境变量。
4. **临时脚本**：`reports/_reranker_*.py`（resume/loop/finish/small_files/loadtest/head_probe/range_test），可复用。
