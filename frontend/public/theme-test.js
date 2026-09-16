// 主题切换诊断脚本 - 在浏览器控制台执行
(function() {
  const results = [];
  
  // 1. 检查根元素状态
  const root = document.documentElement;
  results.push({
    timestamp: new Date().toISOString(),
    rootClassList: root.classList.toString(),
    rootDataTheme: root.getAttribute('data-theme'),
    rootDataMode: root.getAttribute('data-mode'),
    rootColorScheme: root.style.colorScheme,
    rootInlineStyle: root.style.cssText.substring(0, 300)
  });
  
  // 2. 检查关键 CSS 变量
  const style = getComputedStyle(root);
  const keyVars = ['--foreground', '--background', '--card', '--border', '--primary'];
  const vars = {};
  keyVars.forEach(v => {
    vars[v] = style.getPropertyValue(v).trim();
  });
  results.push({ type: 'variables', values: vars });
  
  // 3. 检查 .dark 类是否存在
  results.push({ type: 'darkClass', has: root.classList.contains('dark') });
  
  // 4. 检查背景色实际值
  const bgColor = window.getComputedStyle(document.body).backgroundColor;
  results.push({ type: 'bodyBackgroundColor', value: bgColor });
  
  // 5. 检查所有内联样式
  const inlineStyles = root.style;
  const inlineProps = [];
  for (let i = 0; i < inlineStyles.length; i++) {
    inlineProps.push(inlineStyles[i]);
  }
  results.push({ type: 'inlineProperties', count: inlineProps.length, props: inlineProps });
  
  console.log('=== 主题切换诊断 ===');
  results.forEach(r => console.log(JSON.stringify(r, null, 2)));
  
  return results;
})();
