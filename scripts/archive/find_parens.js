const fs = require('fs');
const src = fs.readFileSync('d:/RMFOOD配方平台/frontend/src/pages/user/UserManagementPage.tsx', 'utf8');
const lines = src.split('\n');
let bal = 0;
const issues = [];
lines.forEach((line, i) => {
  let lb = 0, rb = 0;
  for (const ch of line) {
    if (ch === '(') lb++;
    if (ch === ')') rb++;
  }
  const delta = lb - rb;
  const oldBal = bal;
  bal += delta;
  if (delta !== 0) {
    issues.push(`L${i + 1}: delta=${delta} bal=${bal} | ${line.trim().slice(0, 120)}`);
  }
});
console.log(`Final balance: ${bal}`);
console.log(`All lines with parenthesis changes (${issues.length}):`);
issues.forEach(l => console.log(l));
