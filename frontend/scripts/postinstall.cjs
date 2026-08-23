#!/usr/bin/env node
/**
 * Postinstall script: patch deprecated octal literals in rimraf@2.x
 *
 * rimraf@2.0.0 and rimraf@2.7.1 use deprecated 0-prefixed octal literals
 * (e.g., 0777) which esbuild/vite reject as parse errors.
 * This script converts them to modern 0o prefix syntax (0o777).
 *
 * Only affects transitive deps (exceljs → unzipper → fstream → rimraf).
 */
const fs = require('fs');
const path = require('path');

const pnpmDir = path.join(__dirname, '../node_modules/.pnpm/');
const rimrafDirs = fs.readdirSync(pnpmDir)
  .filter(f => f.startsWith('rimraf@2.'))
  .map(f => path.join(pnpmDir, f, 'node_modules', 'rimraf', 'rimraf.js'))
  .filter(f => fs.existsSync(f));

let patched = 0;
rimrafDirs.forEach(jsPath => {
  try {
    let content = fs.readFileSync(jsPath, 'utf8');
    const before = content;
    // First fix any double-converted 0o0o → 0o
    content = content.replace(/0o0o/g, '0o');
    // Fix bare octals: 0777 → 0o777 (when preceded by =, space, &, |)
    content = content.replace(/(=|\s|&|\|)(0)([0-7]{2,})(?![0-9])/g, '$10o$3');
    if (content !== before) {
      fs.writeFileSync(jsPath, content, 'utf8');
      console.log(`  patched: ${path.basename(path.dirname(jsPath))}`);
      patched++;
    }
  } catch (e) {
    console.error(`  skip: ${jsPath} - ${e.message}`);
  }
});

if (patched > 0) {
  console.log(`Rimraf octal fix: ${patched} file(s) patched\n`);
}
