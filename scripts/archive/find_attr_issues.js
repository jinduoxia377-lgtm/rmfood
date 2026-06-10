const fs = require('fs');
const src = fs.readFileSync('d:/RMFOOD配方平台/frontend/src/pages/user/UserManagementPage.tsx', 'utf8');
const lines = src.split('\n');

let issues = [];
lines.forEach((line, i) => {
  if (/="[^"]*?>/.test(line) && !/={\{/i.test(line) && !line.includes('=>')) {
    if (!line.trim().startsWith('//')) {
      issues.push(`L${i+1}: ${line.trim().slice(0,140)}`);
    }
  }
  if (/'[^']*?>/.test(line)) {
    if (!line.trim().startsWith('//') && !line.includes('=>')) {
      issues.push(`L${i+1} [single]: ${line.trim().slice(0,140)}`);
    }
  }
});
console.log(`Found ${issues.length} attribute/quote issues:`);
issues.forEach(l => console.log(l));
