const fs = require('fs');
const path = require('path');

console.log('=== Copying packages from pnpm store ===\n');

function copyAll(src, dest) {
  console.log(`Copying ${dest}...`);

  // Remove existing
  if (fs.existsSync(dest)) {
    const stat = fs.lstatSync(dest);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(dest);
    } else if (stat.isDirectory()) {
      const remove = (p) => {
        const items = fs.readdirSync(p);
        for (const item of items) {
          const fullPath = path.join(p, item);
          const s = fs.lstatSync(fullPath);
          if (s.isDirectory()) remove(fullPath);
          else fs.unlinkSync(fullPath);
        }
        fs.rmdirSync(p);
      };
      remove(dest);
    }
  }

  // Create directory
  fs.mkdirSync(dest, { recursive: true });

  // Copy files
  const entries = fs.readdirSync(src, { withFileTypes: true });
  let fileCount = 0;
  let dirCount = 0;

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      dirCount++;
      fileCount += copyAll(srcPath, destPath);
    } else {
      try {
        fs.copyFileSync(srcPath, destPath);
        fileCount++;
        if (fileCount % 100 === 0) process.stdout.write('.');
      } catch (e) {
        console.log(`\nError copying ${entry.name}: ${e.message}`);
      }
    }
  }

  return fileCount;
}

// Copy rolldown
const rolldownSrc = 'node_modules/.pnpm/rolldown@1.2.4/node_modules/rolldown';
const rolldownDest = 'node_modules/rolldown';

if (fs.existsSync(rolldownSrc)) {
  const count = copyAll(rolldownSrc, rolldownDest);
  console.log(`\nRolldown: ${count} files copied`);
  console.log('package.json exists:', fs.existsSync(path.join(rolldownDest, 'package.json')));
} else {
  console.log('ERROR: rolldown source not found');
}

// Copy tailwind-merge
const twSrc = 'node_modules/.pnpm/tailwind-merge@3.6.0/node_modules/tailwind-merge';
const twDest = 'node_modules/tailwind-merge';

if (fs.existsSync(twSrc)) {
  const count = copyAll(twSrc, twDest);
  console.log(`\nTailwind-merge: ${count} files copied`);
  console.log('package.json exists:', fs.existsSync(path.join(twDest, 'package.json')));
} else {
  console.log('ERROR: tailwind-merge source not found');
}

// Copy @tailwindcss/vite
const twviteSrc = 'node_modules/.pnpm/@tailwindcss+vite@4.3.3_vit_85d599d7738e862daeb7281263dee3dd/node_modules/@tailwindcss/vite';
const twviteDest = 'node_modules/@tailwindcss/vite';

if (fs.existsSync(twviteSrc)) {
  const count = copyAll(twviteSrc, twviteDest);
  console.log(`\n@tailwindcss/vite: ${count} files copied`);
  console.log('package.json exists:', fs.existsSync(path.join(twviteDest, 'package.json')));
} else {
  console.log('ERROR: @tailwindcss/vite source not found');
}

console.log('\n=== Done ===');
console.log('Packages in node_modules:', fs.readdirSync('node_modules').filter(f => !f.startsWith('.')).length);
