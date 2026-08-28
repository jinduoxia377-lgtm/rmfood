const fs = require('fs');
const pnpmDir = 'D:/RMFOODFP/frontend/node_modules/.pnpm/';
const files = fs.readdirSync(pnpmDir).filter(f => f.includes('rimraf') && f.startsWith('rimraf@2.'));
files.forEach(f => {
  const js = pnpmDir + f + '/node_modules/rimraf/rimraf.js';
  try {
    let c = fs.readFileSync(js, 'utf8');
    // Fix single-quoted octal: '077' -> '0o77'
    c = c.replace(/'0[0-7]{2,}/g, m => "'0o" + m.slice(1));
    // Fix double-quoted octal: "077" -> "0o77"
    c = c.replace(/"0[0-7]{2,}/g, m => '"0o' + m.slice(1));
    // Fix unquoted octal: 077 -> 0o77
    c = c.replace(/(?<![\'\"\w])0[0-7]{2,}(?![\'\"\w])/g, '0o$&');
    fs.writeFileSync(js, c, 'utf8');
    console.log(f + ': patched');
  } catch (e) {
    console.log(f + ': error - ' + e.message);
  }
});
