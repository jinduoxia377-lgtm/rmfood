
const ts = require('typescript');
const fs = require('fs');
const content = fs.readFileSync('src/utils/performance.ts', 'utf-8');
const lines = content.split('
');

// Test: remove just the import line
const withoutImport = lines.filter((_, i) => i !== 21).join('
');
const sf = ts.createSourceFile('test.ts', withoutImport, ts.ScriptTarget.Latest, true);
const diags = [];
function visit(node) {
  if (node.parseDiagnostics && node.parseDiagnostics.length > 0) {
    for (const d of node.parseDiagnostics) {
      const li = node.getSourceFile().getLineAndCharacterOfPosition(d.start);
      diags.push('Line ' + (li.line+1) + ': ' + ts.flattenDiagnosticMessageText(d.messageText, '
'));
    }
  }
  ts.forEachChild(node, visit);
}
visit(sf);
console.log('Without import: ' + (diags.length === 0 ? 'OK' : diags.join(', ')));

// Test: remove the 🔒 emoji comment lines
const withoutEmoji = lines.filter(l => !l.includes('ð')).join('
');
const sf2 = ts.createSourceFile('test2.ts', withoutEmoji, ts.ScriptTarget.Latest, true);
const diags2 = [];
function visit2(node) {
  if (node.parseDiagnostics && node.parseDiagnostics.length > 0) {
    for (const d of node.parseDiagnostics) {
      const li = node.getSourceFile().getLineAndCharacterOfPosition(d.start);
      diags2.push('Line ' + (li.line+1) + ': ' + ts.flattenDiagnosticMessageText(d.messageText, '
'));
    }
  }
  ts.forEachChild(node, visit2);
}
visit2(sf2);
console.log('Without emoji: ' + (diags2.length === 0 ? 'OK' : diags2.join(', ')));

// Test: with CRLF line endings
const withCRLF = content.replace(/
/g, '
');
const sf3 = ts.createSourceFile('test3.ts', withCRLF, ts.ScriptTarget.Latest, true);
const diags3 = [];
function visit3(node) {
  if (node.parseDiagnostics && node.parseDiagnostics.length > 0) {
    for (const d of node.parseDiagnostics) {
      const li = node.getSourceFile().getLineAndCharacterOfPosition(d.start);
      diags3.push('Line ' + (li.line+1) + ': ' + ts.flattenDiagnosticMessageText(d.messageText, '
'));
    }
  }
  ts.forEachChild(node, visit3);
}
visit3(sf3);
console.log('With CRLF: ' + (diags3.length === 0 ? 'OK' : diags3.join(', ')));
