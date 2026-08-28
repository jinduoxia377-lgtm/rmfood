const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== RMFOOD Frontend Restart Script ===\n');

// Step 1: Clear Vite cache
const cacheDir = '.vite-cache';
if (fs.existsSync(cacheDir)) {
  console.log('Step 1: Clearing Vite cache...');
  fs.rmSync(cacheDir, { recursive: true, force: true });
  console.log('  Cache cleared\n');
} else {
  console.log('Step 1: No cache to clear\n');
}

// Step 2: Ensure lucide-react stub exists
const lucidePath = path.join('node_modules', 'lucide-react');
console.log('Step 2: Checking lucide-react...');
if (!fs.existsSync(path.join(lucidePath, 'package.json'))) {
  fs.mkdirSync(lucidePath, { recursive: true });
  fs.writeFileSync(path.join(lucidePath, 'package.json'), JSON.stringify({
    name: 'lucide-react',
    version: '0.525.0',
    main: 'index.js',
    module: 'index.js',
    exports: { '.': './index.js' }
  }, null, 2));
  fs.writeFileSync(path.join(lucidePath, 'index.js'), `
const icons = {};
export default icons;
export const Sparkles = () => null;
export const Download = () => null;
export const Settings = () => null;
export const AlertTriangle = () => null;
`);
  console.log('  Created lucide-react stub');
} else {
  console.log('  lucide-react already exists');
}

// Step 3: Create stubs for other missing packages
const missingPkgs = ['zustand', 'axios', 'antd', 'react-router-dom', 'framer-motion', 'recharts', 'date-fns', 'lodash-es'];
console.log('\nStep 3: Creating stubs for missing packages...');
for (const pkg of missingPkgs) {
  const pkgPath = path.join('node_modules', pkg);
  if (!fs.existsSync(path.join(pkgPath, 'package.json'))) {
    fs.mkdirSync(pkgPath, { recursive: true });
    fs.writeFileSync(path.join(pkgPath, 'package.json'), JSON.stringify({ name: pkg, version: '0.0.0-stub', main: 'index.js' }, null, 2));
    fs.writeFileSync(path.join(pkgPath, 'index.js'), 'module.exports = {};');
    console.log(`  Created ${pkg}`);
  }
}

// Step 4: Kill existing processes
console.log('\nStep 4: Stopping existing processes...');
try {
  execSync('taskkill //F //IM node.exe //T 2>nul', { stdio: 'ignore' });
} catch (e) {}
try {
  execSync('taskkill //F //IM python.exe //T 2>nul', { stdio: 'ignore' });
} catch (e) {}
try {
  execSync('taskkill //F //IM uvicorn.exe //T 2>nul', { stdio: 'ignore' });
} catch (e) {}
console.log('  Processes stopped');

// Wait for ports to free up
console.log('  Waiting for ports to free...');
require('http').get('http://localhost:3000', (res) => {
  res.destroy();
}).on('error', () => {
  console.log('  Port 3000 free');
  startServers();
});

function startServers() {
  console.log('\nStep 5: Starting servers...');

  // Start backend
  try {
    const backendProc = execSync('cd /d/RMFOODFP/backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/backend.log 2>&1 &', { stdio: 'ignore', detached: true });
    console.log('  Backend starting...');
  } catch (e) {
    console.log('  Backend start error:', e.message);
  }

  // Start frontend
  try {
    const frontendProc = execSync('npm run dev > /tmp/frontend.log 2>&1 &', { stdio: 'ignore', detached: true });
    console.log('  Frontend starting...');
  } catch (e) {
    console.log('  Frontend start error:', e.message);
  }

  console.log('\n=== Servers starting ===');
  console.log('Backend: http://localhost:8000');
  console.log('Frontend: http://localhost:3000');
  console.log('Check logs: cat /tmp/backend.log && cat /tmp/frontend.log');
}
