# Material Design 3 主题系统实现文档

## 1. 系统概述

基于 Material Design 3 设计理念，本主题系统提供了一套完整、可扩展的主题模式系统，支持明暗两种模式的无缝切换，包含色彩系统、排版系统、组件样式、间距系统、阴影层级和圆角规则等核心设计元素。

## 2. 核心功能

### 2.1 主题模式切换
- **手动切换**：用户可以在设置页面中手动选择浅色/深色模式
- **自动模式**：系统会根据操作系统的主题设置自动切换
- **平滑过渡**：主题切换时提供 0.25 秒的平滑过渡动画

### 2.2 颜色系统
- **主色调 (Primary)**：品牌主色，用于关键操作和高亮元素
- **辅助色调 (Secondary)**：用于次要操作和辅助元素
- **第三色调 (Tertiary)**：用于强调和特殊元素
- **中性色 (Neutral)**：用于背景、表面和文本
- **功能性颜色**：用于成功、警告、错误和信息状态

### 2.3 排版系统
- **字体家族**：支持多种字体，包括 Inter、Noto Sans SC、Roboto 等
- **字重系统**：300 (light)、400 (normal)、500 (medium)、600 (semibold)、700 (bold)
- **字号系统**：从 12px 到 36px 的响应式字号
- **行高规则**：1.2 (tight)、1.5 (normal)、1.6 (relaxed)

### 2.4 间距系统
- **基础单位**：基于 8px 的倍数
- **间距等级**：4px (xs)、8px (sm)、16px (md)、24px (lg)、32px (xl)、48px (2xl)

### 2.5 阴影层级
- **5 个层级**：从细微阴影到突出阴影
- **阴影强度**：可调节的阴影强度 (0-4)

### 2.6 圆角规则
- **4 个等级**：小半径 (4-8px)、中等半径 (8-12px)、大半径 (12-16px)、超大半径 (16-24px)

## 3. 主题变量定义

### 3.1 颜色变量

#### 主色调
- `--color-primary`：主色
- `--color-primary-hover`：主色悬停
- `--color-primary-container`：主色容器
- `--color-on-primary`：主色上的文本
- `--color-on-primary-container`：主色容器上的文本
- `--color-primary-50` 到 `--color-primary-900`：主色变体（10个层级）

#### 辅助色调
- `--color-secondary`：辅助色
- `--color-secondary-hover`：辅助色悬停
- `--color-secondary-container`：辅助色容器
- `--color-on-secondary`：辅助色上的文本
- `--color-on-secondary-container`：辅助色容器上的文本

#### 第三色调
- `--color-tertiary`：第三色
- `--color-tertiary-hover`：第三色悬停
- `--color-tertiary-container`：第三色容器
- `--color-on-tertiary`：第三色上的文本
- `--color-on-tertiary-container`：第三色容器上的文本

#### 基础色
- `--bg-primary`：主背景色
- `--bg-surface`：表面色
- `--bg-surface-variant`：表面变体色
- `--color-on-background`：背景上的文本
- `--color-on-surface`：表面上的文本
- `--color-on-surface-variant`：表面变体上的文本

#### 边缘和轮廓
- `--color-outline`：轮廓色
- `--color-outline-variant`：轮廓变体色

#### 功能性颜色
- `--color-error`：错误色
- `--color-error-container`：错误容器色
- `--color-on-error`：错误上的文本
- `--color-on-error-container`：错误容器上的文本
- `--color-success`：成功色
- `--color-warning`：警告色
- `--color-info`：信息色

#### 文本颜色
- `--text-primary`：主要文本色
- `--text-secondary`：次要文本色
- `--text-muted`：静音文本色

#### 边框
- `--border-color`：边框色

#### 背景变体
- `--color-inverse-surface`：反表面色
- `--color-inverse-on-surface`：反表面上的文本
- `--color-inverse-primary`：反主色

### 3.2 字体变量
- `--font-family-sans`：无衬线字体
- `--font-size-base`：基础字号
- `--font-size-sm`：小号字号
- `--font-size-lg`：大号字号
- `--font-size-xl`：超大号字号
- `--font-size-2xl`：2倍大号字号
- `--font-size-3xl`：3倍大号字号
- `--font-weight-light`：轻字重 (300)
- `--font-weight-normal`：正常字重 (400)
- `--font-weight-medium`：中等字重 (500)
- `--font-weight-semibold`：半粗字重 (600)
- `--font-weight-bold`：粗字重 (700)
- `--line-height-tight`：紧凑行高 (1.2)
- `--line-height-normal`：正常行高 (1.5)
- `--line-height-relaxed`：宽松行高 (1.6)

### 3.3 间距变量
- `--spacing-xs`：4px
- `--spacing-sm`：8px
- `--spacing-md`：16px
- `--spacing-lg`：24px
- `--spacing-xl`：32px
- `--spacing-2xl`：48px

### 3.4 阴影变量
- `--shadow-sm`：细微阴影
- `--shadow-md`：中等阴影
- `--shadow-lg`：大阴影
- `--shadow-xl`：超大阴影
- `--shadow-2xl`：2倍超大阴影

### 3.5 圆角变量
- `--radius-none`：0px
- `--radius-sm`：小半径
- `--radius-md`：中等半径
- `--radius-lg`：大半径
- `--radius-xl`：超大半径
- `--radius-2xl`：2倍超大半径
- `--radius-3xl`：3倍超大半径
- `--radius-full`：完全圆角

## 4. 组件使用示例

### 4.1 按钮组件

```tsx
// 主要按钮
<button className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition-colors">
  主要按钮
</button>

// 次要按钮
<button className="bg-secondary text-on-secondary px-4 py-2 rounded-lg font-medium hover:bg-secondary-hover transition-colors">
  次要按钮
</button>

// 文本按钮
<button className="text-primary px-4 py-2 font-medium hover:bg-primary-100 transition-colors">
  文本按钮
</button>

// 危险按钮
<button className="bg-error text-on-error px-4 py-2 rounded-lg font-medium hover:bg-error/90 transition-colors">
  危险按钮
</button>
```

### 4.2 表单元素

```tsx
// 输入框
<input
  className="w-full px-4 py-2 bg-surface border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
  placeholder="请输入内容"
/>

// 选择器
<select
  className="w-full px-4 py-2 bg-surface border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
>
  <option value="1">选项 1</option>
  <option value="2">选项 2</option>
</select>

// 复选框
<label className="flex items-center gap-2 cursor-pointer">
  <input type="checkbox" className="w-4 h-4 rounded border-outline text-primary focus:ring-primary/20" />
  <span>同意条款</span>
</label>

// 单选按钮
<label className="flex items-center gap-2 cursor-pointer">
  <input type="radio" name="option" value="1" className="w-4 h-4 text-primary focus:ring-primary/20" />
  <span>选项 1</span>
</label>
```

### 4.3 卡片组件

```tsx
// 基础卡片
<div className="bg-surface rounded-lg p-6 shadow-md">
  <h3 className="text-lg font-semibold text-on-surface mb-2">卡片标题</h3>
  <p className="text-on-surface-variant">卡片内容</p>
</div>

// 提升卡片
<div className="bg-surface rounded-lg p-6 shadow-lg">
  <h3 className="text-lg font-semibold text-on-surface mb-2">提升卡片</h3>
  <p className="text-on-surface-variant">有更强的阴影效果</p>
</div>

// 填充卡片
<div className="bg-primary-container rounded-lg p-6">
  <h3 className="text-lg font-semibold text-on-primary-container mb-2">填充卡片</h3>
  <p className="text-on-primary-container/80">使用主色容器背景</p>
</div>
```

### 4.4 导航组件

```tsx
// 顶部导航栏
<header className="bg-surface border-b border-outline px-6 py-4 shadow-sm">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-4">
      <button className="p-2 rounded-full hover:bg-hover-bg transition-colors">
        <MenuIcon className="h-6 w-6 text-on-surface" />
      </button>
      <h1 className="text-xl font-bold text-on-surface">应用名称</h1>
    </div>
    <div className="flex items-center gap-4">
      <button className="p-2 rounded-full hover:bg-hover-bg transition-colors">
        <BellIcon className="h-6 w-6 text-on-surface" />
      </button>
      <button className="p-2 rounded-full hover:bg-hover-bg transition-colors">
        <UserIcon className="h-6 w-6 text-on-surface" />
      </button>
    </div>
  </div>
</header>

// 侧边导航
<nav className="w-64 bg-surface border-r border-outline p-4">
  <ul className="space-y-2">
    <li>
      <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/10 text-primary font-medium">
        <HomeIcon className="h-5 w-5" />
        <span>仪表盘</span>
      </a>
    </li>
    <li>
      <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface hover:bg-hover-bg transition-colors">
        <FileTextIcon className="h-5 w-5" />
        <span>文档</span>
      </a>
    </li>
  </ul>
</nav>
```

## 5. 明暗模式切换实现

### 5.1 主题模式设置

```tsx
import { useThemeSettings } from '@/hooks/useTheme';

function ThemeModeToggle() {
  const { settings, setMode } = useThemeSettings();

  return (
    <div className="flex items-center gap-4">
      <span className="text-on-surface">主题模式：</span>
      <div className="flex bg-surface-variant p-1 rounded-full">
        <button
          onClick={() => setMode('light')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            settings.mode === 'light' 
              ? 'bg-surface text-primary shadow-sm' 
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          浅色
        </button>
        <button
          onClick={() => setMode('dark')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            settings.mode === 'dark' 
              ? 'bg-surface text-primary shadow-sm' 
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          深色
        </button>
        <button
          onClick={() => setMode('auto')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            settings.mode === 'auto' 
              ? 'bg-surface text-primary shadow-sm' 
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          自动
        </button>
      </div>
    </div>
  );
}
```

### 5.2 主题预设切换

```tsx
import { useThemeSettings, COMPLETE_THEME_PRESETS } from '@/hooks/useTheme';

function ThemePresetSelector() {
  const { applyPreset } = useThemeSettings();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-on-surface">主题预设</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COMPLETE_THEME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset.id)}
            className="p-4 bg-surface border border-outline rounded-lg text-left hover:border-primary hover:shadow-sm transition-all"
          >
            <h4 className="font-medium text-on-surface mb-1">{preset.name}</h4>
            <p className="text-sm text-on-surface-variant">{preset.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
```

## 6. 与现有项目集成

### 6.1 主题提供者

在应用的根组件中添加 `ThemeProvider`：

```tsx
import { ThemeProvider } from '@/hooks/useTheme';

function App() {
  return (
    <ThemeProvider>
      {/* 应用内容 */}
    </ThemeProvider>
  );
}
```

### 6.2 使用主题设置

在组件中使用 `useThemeSettings` 钩子：

```tsx
import { useThemeSettings } from '@/hooks/useTheme';

function SettingsPage() {
  const { 
    settings, 
    setMode, 
    setFontSize, 
    setDensity, 
    setBorderRadius, 
    setShadowIntensity,
    applyPreset
  } = useThemeSettings();

  // 使用主题设置...
}
```

### 6.3 组件样式集成

将现有的组件样式更新为使用新的CSS变量：

```css
/* 旧样式 */
.button {
  background: #059669;
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
}

/* 新样式 */
.button {
  background: var(--color-primary);
  color: var(--color-on-primary);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  transition: background-color 0.2s ease;
}

.button:hover {
  background: var(--color-primary-hover);
}
```

## 7. 扩展性设计

### 7.1 添加新主题预设

在 `COMPLETE_THEME_PRESETS` 数组中添加新的主题预设：

```tsx
export const COMPLETE_THEME_PRESETS: CompleteThemePreset[] = [
  // 现有预设...
  {
    id: 'new-theme',
    name: '新主题',
    description: '新主题描述',
    lightColors: {
      primary: '#FF5722',
      primaryHover: '#E64A19',
      primaryContainer: '#FFE0D5',
      onPrimary: '#FFFFFF',
      onPrimaryContainer: '#BF360C',
      // 其他颜色...
    },
    darkColors: {
      primary: '#FF8A65',
      primaryHover: '#FFAB91',
      primaryContainer: '#BF360C',
      onPrimary: '#FFFFFF',
      onPrimaryContainer: '#FFE0D5',
      // 其他颜色...
    },
    borderRadius: 12,
    shadowIntensity: 2,
    density: 'comfortable',
    fontSize: 16,
    fontFamily: FONT_OPTIONS[0].family,
  },
];
```

### 7.2 自定义颜色

使用 `setCustomColors` 方法自定义颜色：

```tsx
import { useThemeSettings } from '@/hooks/useTheme';

function CustomColorSettings() {
  const { setCustomColors } = useThemeSettings();

  const updateColors = () => {
    setCustomColors('light', {
      primary: '#9C27B0',
      primaryHover: '#7B1FA2',
      primaryContainer: '#F3E5F5',
      onPrimary: '#FFFFFF',
      onPrimaryContainer: '#4A148C',
    });

    setCustomColors('dark', {
      primary: '#BA68C8',
      primaryHover: '#CE93D8',
      primaryContainer: '#4A148C',
      onPrimary: '#FFFFFF',
      onPrimaryContainer: '#F3E5F5',
    });
  };

  return (
    <button onClick={updateColors} className="bg-primary text-on-primary px-4 py-2 rounded-lg">
      更新颜色
    </button>
  );
}
```

### 7.3 主题导出与导入

可以扩展主题系统以支持导出和导入主题配置：

```tsx
// 导出主题
const exportTheme = () => {
  const settings = getStoredSettings();
  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'theme-config.json';
  a.click();
  URL.revokeObjectURL(url);
};

// 导入主题
const importTheme = (file) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const settings = JSON.parse(e.target.result);
      // 验证设置
      setSettings(mergeWithDefaults(settings));
    } catch (error) {
      console.error('Failed to import theme:', error);
    }
  };
  reader.readAsText(file);
};
```

## 8. 性能优化

### 8.1 主题切换性能
- **CSS变量**：使用CSS变量实现主题切换，避免重新渲染组件
- **平滑过渡**：使用CSS transition实现主题切换动画
- **本地存储**：主题设置持久化到localStorage，避免重复计算

### 8.2 响应式设计
- **媒体查询**：使用Tailwind CSS的响应式类
- **动态间距**：基于密度设置调整间距
- **字体大小**：基于基础字号的响应式字体系统

### 8.3 可访问性
- **色彩对比度**：所有颜色组合符合WCAG 2.1 AA级标准
- **键盘导航**：所有交互元素可通过键盘访问
- **屏幕阅读器**：语义化HTML和ARIA属性
- **减少动效**：支持 `prefers-reduced-motion` 媒体查询

## 9. 测试与验证

### 9.1 色彩对比度测试
使用 `checkContrast` 和 `meetsWCAGAA` 方法测试颜色对比度：

```tsx
import { useTheme } from '@/hooks/useTheme';

function ContrastTester() {
  const { checkContrast, meetsWCAGAA } = useTheme();
  const bgColor = '#ffffff';
  const textColor = '#333333';
  
  const ratio = checkContrast(bgColor, textColor);
  const isCompliant = meetsWCAGAA(bgColor, textColor);

  return (
    <div>
      <div className="mb-4" style={{ backgroundColor: bgColor, color: textColor, padding: '20px', borderRadius: '8px' }}>
        <p>测试文本：这是一段测试文本</p>
      </div>
      <div>
        <p>对比度：{ratio.toFixed(2)}:1</p>
        <p>是否符合WCAG AA标准：{isCompliant ? '是' : '否'}</p>
      </div>
    </div>
  );
}
```

### 9.2 跨浏览器测试
- **Chrome**：最新版本
- **Firefox**：最新版本
- **Safari**：最新版本
- **Edge**：最新版本

### 9.3 响应式测试
- **桌面端**：1920x1080px
- **平板端**：768x1024px
- **移动端**：375x667px

## 10. 结论

本主题系统基于 Material Design 3 设计理念，提供了一套完整、可扩展的主题模式系统，支持明暗两种模式的无缝切换，包含色彩系统、排版系统、组件样式、间距系统、阴影层级和圆角规则等核心设计元素。

系统具有以下特点：
- **完整的设计系统**：覆盖了Material Design 3的所有核心设计元素
- **高度可定制**：支持自定义颜色、字体、间距等
- **响应式设计**：适配不同屏幕尺寸
- **可访问性**：符合WCAG 2.1 AA级标准
- **性能优化**：使用CSS变量和本地存储提高性能
- **易于集成**：与现有项目无缝集成

通过这套主题系统，可以确保应用在不同设备和光线条件下保持一致的视觉体验，同时为用户提供个性化的主题选择。