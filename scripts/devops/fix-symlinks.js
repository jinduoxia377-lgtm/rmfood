const fs = require('fs');
const path = require('path');

console.log('=== Frontend Fix Script ===\n');

// Step 1: Remove broken symlinks and directories
const packages = [
  'rolldown',
  'tailwind-merge',
  '@tailwindcss/vite',
  'vite',
  'react',
  'react-dom',
  '@vitejs/plugin-react',
  'antd',
  'axios',
  'zustand'
];

console.log('Step 1: Removing broken symlinks...');
packages.forEach(pkg => {
  const dest = path.join('.', pkg);
  try {
    const stat = fs.lstatSync(dest);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(dest);
      console.log('  Removed symlink:', pkg);
    } else if (stat.isDirectory()) {
      console.log('  Skipping directory:', pkg);
    }
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.log('  Error removing', pkg, ':', e.message);
    }
  }
});

// Step 2: Create symlinks from pnpm store
console.log('\nStep 2: Creating symlinks from pnpm store...');
const pnpmStore = 'node_modules/.pnpm';

const linkMap = [
  { from: 'rolldown@1.2.4/node_modules/rolldown', to: 'rolldown' },
  { from: 'tailwind-merge@3.6.0/node_modules/tailwind-merge', to: 'tailwind-merge' },
  { from: '@tailwindcss+vite@4.3.3_vit_85d599d7738e862daeb7281263dee3dd/node_modules/@tailwindcss/vite', to: '@tailwindcss/vite' },
  { from: '@vitejs+plugin-react@6.0.1_react@19.2.8/node_modules/@vitejs/plugin-react', to: '@vitejs/plugin-react' },
  { from: '@ant-design+icons@6.3.2_react@19.2.8/node_modules/@ant-design/icons', to: '@ant-design/icons' },
];

linkMap.forEach(({ from, to }) => {
  const src = path.join(pnpmStore, from);
  const dest = path.join('.', to);
  try {
    if (fs.existsSync(src)) {
      // Remove existing if any
      try { fs.unlinkSync(dest); } catch (e) {}
      // Create symlink
      const relPath = path.relative(path.dirname(dest), src);
      fs.symlinkSync(relPath, dest);
      console.log('  Created symlink:', to, '->', relPath);
    } else {
      console.log('  Source not found:', from);
    }
  } catch (e) {
    console.log('  Error creating', to, ':', e.message);
  }
});

// Step 3: Also handle nested packages
console.log('\nStep 3: Checking antd and other packages...');
const antdStore = 'node_modules/.pnpm/antd@6.6.1_react@19.2.8_react-dom@19.2.8__react@19.2.8/node_modules/antd';
if (fs.existsSync(antdStore)) {
  try {
    const dest = path.join('.', 'antd');
    fs.unlinkSync(dest);
    const relPath = path.relative('.', antdStore);
    fs.symlinkSync(relPath, dest);
    console.log('  Created symlink: antd');
  } catch (e) {
    console.log('  Error with antd:', e.message);
  }
}

console.log('\n=== Fix Complete ===');
console.log('Run "npm install" or "pnpm install" to finalize.');
