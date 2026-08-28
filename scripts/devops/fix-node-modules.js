const fs = require('fs');
const path = require('path');

console.log('=== Fixing node_modules ===\n');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.log('Source not found:', src);
    return false;
  }

  // Remove existing
  if (fs.existsSync(dest)) {
    const stat = fs.lstatSync(dest);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(dest);
    } else {
      fs.rmSync(dest, { recursive: true });
    }
  }

  // Create directory
  fs.mkdirSync(dest, { recursive: true });

  // Copy files
  const entries = fs.readdirSync(src, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }

  console.log(`Copied ${count} files to ${dest}`);
  return true;
}

// Copy packages from pnpm store
const packages = [
  ['rolldown@1.2.4/node_modules/rolldown', 'rolldown'],
  ['tailwind-merge@3.6.0/node_modules/tailwind-merge', 'tailwind-merge'],
  ['@tailwindcss+vite@4.3.3_vit_85d599d7738e862daeb7281263dee3dd/node_modules/@tailwindcss/vite', '@tailwindcss/vite'],
  ['@vitejs+plugin-react@6.0.1_react@19.2.8/node_modules/@vitejs/plugin-react', '@vitejs/plugin-react'],
  ['@ant-design+icons@6.3.2_react@19.2.8/node_modules/@ant-design/icons', '@ant-design/icons'],
  ['vite@5.4.21/node_modules/vite', 'vite'],
];

packages.forEach(([storePath, name]) => {
  const src = path.join('node_modules/.pnpm', storePath);
  const dest = path.join('node_modules', name);
  copyDir(src, dest);
});

console.log('\n=== Done ===');
console.log('Packages in node_modules:', fs.readdirSync('node_modules').filter(f => !f.startsWith('.')).length);
