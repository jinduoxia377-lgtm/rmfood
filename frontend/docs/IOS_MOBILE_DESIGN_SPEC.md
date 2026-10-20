# iOS 移动端设计规范（RMFOOD H5）

> 适用范围：frontend 全部页面在 ≤767px 移动视口（iPhone / Android H5）。
> 所有取值与设计令牌对齐（`tokens/base.css`、`tokens/typography.css`），禁止硬编码。

## 一、字体阶（iOS Dynamic Type 参考）

| 层级 | 字号 | 对应令牌 |
| --- | --- | --- |
| 页标题 | 18–20px | 移动端自 `--text-h2/h3`（28/24px）降档 |
| 卡片标题 | 16–17px | `--text-body-apple`（17px）/ `--text-h5`（18px） |
| 正文 | ≥15px | `--text-body`（15px） |
| 辅助文本 | ≥14px | `--text-body-sm` |
| 标签/徽章 | 最小 12px | `--text-caption` / `--text-overline` |

- **最小字号 12px**：禁止 <12px 的移动端文本；8–10px 微标签需在移动端提升或标注为桌面专用（`hidden sm:inline`）。
- 输入框 16px：防 iOS Safari 聚焦自动缩放。

## 二、页面尺寸

- 内容左右边距 **16px**（页面根 `px-4` 或等效）；卡片内边距 **16px**。
- 页面宽度自适应视口，禁止固定宽度元素撑破屏幕。

## 三、触控目标

- 可点击元素 **≥44×44pt**（导航项、按钮、行内操作），相邻目标间距 ≥8px。
- 密集表格行内操作为例外：保证 ≥32px 且不易误触，不强制拉伸紧凑布局。

## 四、安全区

- `viewport-fit=cover` 已启用；顶部避让 `env(safe-area-inset-top)`，底部固定栏/全屏弹层避让 `env(safe-area-inset-bottom)`。
- 全屏容器高度用 `100dvh`（保留 `100vh` 回退），避免 Safari 地址栏裁切底部。

## 五、间距节奏

- 页面 `space-y-4 / space-y-6`（16/24px），卡片内 `space-y-3`（12px），避免大块留白造成的低信息密度。