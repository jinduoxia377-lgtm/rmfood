const fs = require('fs');
const path = require('path');
const dir = 'D:/RMFOODFP/frontend/node_modules/.pnpm/';
const files = fs.readdirSync(dir).filter(f => f.startsWith('rimraf@2.'));

files.forEach(f => {
  const js = path.join(dir, f, 'node_modules', 'rimraf', 'rimraf.js');
  try {
    let c = fs.readFileSync(js, 'utf8');
    // Fix double 0o prefix first
    c = c.replace(/0o0o/g, '0o');
    // Then fix remaining bare octals (0xxx preceded by operator/space)
    c = c.replace(/(=|\s|&|\|)(0)([0-7]{2,})(?![0-9])/g, '$10o$3');
    fs.writeFileSync(js, c, 'utf8');
    console.log(f + ': fixed');
  } catch (e) {
    console.log(f + ': error - ' + e.message);
  }
});
