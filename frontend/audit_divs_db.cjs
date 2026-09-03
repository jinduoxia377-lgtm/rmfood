const fs = require('fs');
const c = fs.readFileSync('D:\\RMFOODFP\\frontend\\src\\pages\\database\\DatabasePage.tsx', 'utf8');
const lines = c.split('\n');

function countDivs(text) {
  let cleaned = text.replace(/"[^"]*"/g,'""').replace(/'[^']*'/g,"''").replace(/`[^`]*`/g,'``');
  let depth = 0, i = 0;
  while (i < cleaned.length) {
    if (cleaned.substring(i, i + 4) === '<div') {
      let j = i + 4;
      while (j < cleaned.length && cleaned[j] !== '>') j++;
      if (j >= cleaned.length) { i++; continue; }
      if (cleaned[j - 1] === '/') { i = j + 1; }
      else { depth++; i = j + 1; }
    } else if (cleaned.substring(i, i + 6) === '</div>') {
      depth--; i += 6;
    } else { i++; }
  }
  return depth;
}

let depth = 0;
for (let i = 0; i < lines.length; i++) {
  const d = countDivs(lines[i]);
  depth += d;
  if (d !== 0 || i >= lines.length - 10) {
    console.log((i+1) + ': net=' + d + ' depth=' + depth + ' | ' + lines[i].trim().substring(0, 80));
  }
}
console.log('FINAL depth:', depth, depth === 0 ? 'BALANCED' : 'UNBALANCED');
