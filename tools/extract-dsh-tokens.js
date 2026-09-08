const fs = require('fs');

const jsPath = 'C:/Users/Administrator/AppData/Roaming/npm/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets';
const vendorJs = fs.readFileSync(jsPath + '/vendor-D22_Mp1f.js', 'utf8');
const indexJs = fs.readFileSync(jsPath + '/index-ClqxG24t.js', 'utf8');
const allJs = vendorJs + '\n' + indexJs;

console.log('=== DSH 设计令牌提取 ===\n');
console.log('JS 总字符: ' + allJs.length.toLocaleString());

// 简单搜索方式：用字符串 indexOf 查找
const dswTokens = new Set();
const dshTokens = new Set();
const staticTokens = new Set();
let idx = 0;
let searchStr = allJs;

// 搜索 --dsw- 相关
while ((idx = searchStr.indexOf('--dsw-')) !== -1) {
  const end = searchStr.indexOf(';', idx);
  const slice = searchStr.substring(idx, end > idx ? end : idx + 80);
  if (slice.length > 5 && slice.length < 200) {
    dswTokens.add(slice.trim());
  }
  searchStr = searchStr.substring(idx + 1);
}

// 搜索 --dsh- 相关
searchStr = allJs;
while ((idx = searchStr.indexOf('--dsh-')) !== -1) {
  const end = searchStr.indexOf(';', idx);
  const slice = searchStr.substring(idx, end > idx ? end : idx + 80);
  if (slice.length > 5 && slice.length < 200) {
    dshTokens.add(slice.trim());
  }
  searchStr = searchStr.substring(idx + 1);
}

console.log('【DSW 令牌】');
[...dswTokens].sort().forEach(v => console.log('  ' + v));

console.log('\n【DSH 令牌】');
[...dshTokens].sort().forEach(v => console.log('  ' + v));

// 搜索 hex 颜色（在变量赋值附近）
console.log('\n【关键颜色值】');
const colorSet = new Set();
idx = 0;
searchStr = allJs;
while ((idx = searchStr.indexOf('#')) !== -1) {
  const slice = searchStr.substring(idx, idx + 10);
  if (/^#[0-9a-fA-F]{3,8}/.test(slice)) {
    const hex = slice.match(/^#[0-9a-fA-F]+/)[0];
    if (!['#fff','#000','#ffffff','#000000','#00000000'].includes(hex) && !colorSet.has(hex)) {
      colorSet.add(hex);
      console.log('  ' + hex);
    }
  }
  searchStr = searchStr.substring(idx + 1);
  if (colorSet.size > 50) break;
}

// 搜索圆角和间距值
console.log('\n【常见像素值】');
const pxSet = new Set();
idx = 0;
searchStr = allJs;
while ((idx = searchStr.indexOf('px')) !== -1 && pxSet.size < 30) {
  const before = searchStr.substring(Math.max(0, idx-8), idx);
  const after = searchStr.substring(idx + 2, idx + 6);
  const numMatch = before.match(/(\d+)$/);
  if (numMatch) {
    const px = numMatch[1];
    if (!pxSet.has(px) && ['0','2','4','6','8','10','12','14','16','18','20','24','28','32','40','48','56','64'].includes(px)) {
      pxSet.add(px);
      console.log('  ' + px + 'px');
    }
  }
  searchStr = searchStr.substring(idx + 1);
}
