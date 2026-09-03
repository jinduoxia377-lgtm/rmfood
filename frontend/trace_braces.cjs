const fs = require('fs');
const c = fs.readFileSync('D:\\RMFOODFP\\frontend\\src\\pages\\database\\DatabasePage.tsx', 'utf8');
const lines = c.split('\n');

// Trace paren/brace balance from return statement, ignoring string contents
let pd = 0;
for (let i = 714; i < lines.length; i++) {
  const l = lines[i];
  let inStr = false;
  let strCh = '';
  for (let j = 0; j < l.length; j++) {
    const ch = l[j];
    if (inStr) {
      if (ch === '\\') { j++; continue; }
      if (ch === strCh) inStr = false;
    } else {
      if (ch === '`' || ch === '"' || ch === "'") {
        inStr = true;
        strCh = ch;
      } else if (ch === '(' || ch === '{' || ch === '[') {
        pd++;
      } else if (ch === ')' || ch === '}' || ch === ']') {
        pd--;
      }
    }
  }
  if (pd < 0) {
    console.log('NEGATIVE at line ' + (i + 1) + ': pd=' + pd);
    break;
  }
  if (i >= 1375 || (i > 1300 && pd === 0)) {
    console.log((i + 1) + ': pd=' + pd + ' | ' + l.trim().substring(0, 60));
  }
}
console.log('Final depth at line 1375:', pd);

// Also check the whole file
pd = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  let inStr = false;
  let strCh = '';
  for (let j = 0; j < l.length; j++) {
    const ch = l[j];
    if (inStr) {
      if (ch === '\\') { j++; continue; }
      if (ch === strCh) inStr = false;
    } else {
      if (ch === '`' || ch === '"' || ch === "'") {
        inStr = true;
        strCh = ch;
      } else if (ch === '(' || ch === '{' || ch === '[') {
        pd++;
      } else if (ch === ')' || ch === '}' || ch === ']') {
        pd--;
      }
    }
  }
}
console.log('Total file paren/brace depth:', pd);
