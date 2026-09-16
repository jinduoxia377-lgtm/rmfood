// 主题系统运行时诊断 - 在浏览器控制台执行
(function() {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  
  console.group('🎨 主题系统诊断');
  
  // 1. 根元素状态
  console.log('%c[1] 根元素状态:', 'font-weight:bold');
  console.log('  classList:', root.classList.toString());
  console.log('  data-theme:', root.getAttribute('data-theme'));
  console.log('  data-mode:', root.getAttribute('data-mode'));
  console.log('  color-scheme:', root.style.colorScheme);
  console.log('  inline-style:', root.style.cssText || '(无)');
  
  // 2. CSS 变量值
  console.log('%c[2] 关键 CSS 变量值:', 'font-weight:bold');
  const vars = ['--foreground', '--background', '--card', '--border', '--primary'];
  vars.forEach(v => {
    const val = style.getPropertyValue(v).trim();
    const status = val ? '✅' : '❌';
    console.log(`  ${status} ${v}: ${val || '未定义'}`);
  });
  
  // 3. .dark 类检查
  console.log('%c[3] .dark 类检查:', 'font-weight:bold');
  console.log('  has .dark:', root.classList.contains('dark'));
  console.log('  has .light:', root.classList.contains('light'));
  
  // 4. 背景色检查
  console.log('%c[4] 实际背景色:', 'font-weight:bold');
  const bgColor = window.getComputedStyle(document.body).backgroundColor;
  console.log('  body background-color:', bgColor);
  
  // 5. 内联样式残留
  console.log('%c[5] 内联样式残留:', 'font-weight:bold');
  const inlineProps = [];
  for (let i = 0; i < root.style.length; i++) {
    inlineProps.push(root.style[i]);
  }
  console.log('  内联属性数量:', inlineProps.length);
  if (inlineProps.length > 0) {
    console.log('  属性列表:', inlineProps.join(', '));
  }
  
  console.groupEnd();
  
  return {
    hasDarkClass: root.classList.contains('dark'),
    background: style.getPropertyValue('--background').trim(),
    foreground: style.getPropertyValue('--foreground').trim(),
    inlineStyleCount: root.style.length
  };
})();
