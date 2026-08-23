const fs = require('fs');
const dir = 'D:/RMFOODFP/frontend/node_modules/.pnpm/';
['rimraf@2.0.0', 'rimraf@2.7.1'].forEach(f => {
  const js = dir + f + '/node_modules/rimraf/rimraf.js';
  try {
    let c = fs.readFileSync(js, 'utf8');
    // Strategy: replace `0xxx` with `0oxxx` ONLY when preceded by =, space, &, |
    // and NOT already starting with 0o
    c = c.replace(/(= )0([0-7]{2,})(?![0-9])/g, '$10o$2');
    c = c.replace(/( 0)([0-7]{2,})(?![0-7])/g, '$10o$2');
    c = c.replace(/(& 0)([0-7]{2,})(?![0-7])/g, '$10o$2');
    c = c.replace(/(\| 0)([0-7]{2,})(?![0-7])/g, '$10o$2');
    fs.writeFileSync(js, c, 'utf8');
    console.log(f + ': fixed');
  } catch (e) {
    console.log(f + ': skip - ' + e.message);
  }
});
