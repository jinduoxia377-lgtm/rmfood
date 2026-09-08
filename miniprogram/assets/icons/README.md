# RMFOOD 小程序 TabBar图标说明

## 图标文件列表

已创建以下SVG图标文件：

| 文件名 | 用途 | 颜色 | 尺寸 |
|--------|------|------|------|
| home.svg | 首页（未选中） | #999999 | 54x54 |
| home-active.svg | 首页（选中） | #2D5A3D | 54x54 |
| chat.svg | AI对话（未选中） | #999999 | 54x54 |
| chat-active.svg | AI对话（选中） | #1565C0 | 54x54 |
| search.svg | 搜索（未选中） | #999999 | 54x54 |
| search-active.svg | 搜索（选中） | #F57C00 | 54x54 |
| user.svg | 我的（未选中） | #999999 | 54x54 |
| user-active.svg | 我的（选中） | #2D5A3D | 54x54 |

## 转换步骤

### 方法1：在线转换（推荐）

1. 打开 https://convertio.co/svg-png/
2. 上传SVG文件
3. 设置尺寸为54x54像素
4. 下载PNG文件
5. 重命名为对应名称（去掉-active后缀为灰色版）

需要转换的文件：
```
home.svg -> home.png
home-active.svg -> home-active.png
chat.svg -> chat.png
chat-active.svg -> chat-active.png
search.svg -> search.png
search-active.svg -> search-active.png
user.svg -> user.png
user-active.svg -> user-active.png
```

### 方法2：使用Python脚本

```bash
# 安装依赖
pip install Pillow cairosvg

# 运行转换脚本
python convert.py
```

### 方法3：使用Inkscape（命令行）

```bash
# 批量转换
for f in *.svg; do
  inkscape "$f" --export-filename="${f%.svg}.png" --export-width=54 --export-height=54
done
```

## 微信小程序要求

- ✅ 图标尺寸：54x54 像素
- ✅ 图标格式：PNG
- ✅ 图标大小：单文件 < 4KB
- ✅ 总大小：主包内所有资源 < 2MB

## 颜色规范

| 状态 | 颜色值 | 说明 |
|------|--------|------|
| 未选中 | #999999 | 灰色 |
| 首页选中 | #2D5A3D | 品牌绿 |
| AI对话选中 | #1565C0 | 科技蓝 |
| 搜索选中 | #F57C00 | 活力橙 |
| 我的选中 | #2D5A3D | 品牌绿 |
