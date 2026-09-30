const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const nodeModulesDir = path.join(baseDir, '..', 'node_modules');
const npmDir = path.join(baseDir, '..', 'miniprogram_npm');

// 确保目标目录存在
if (!fs.existsSync(npmDir)) {
    fs.mkdirSync(npmDir, { recursive: true });
}

// 复制 weui-wxss
const weuiSrc = path.join(nodeModulesDir, 'weui-wxss');
const weuiDest = path.join(npmDir, 'weui-wxss');

if (fs.existsSync(weuiSrc)) {
    if (fs.existsSync(weuiDest)) {
        fs.rmSync(weuiDest, { recursive: true });
    }
    fs.cpSync(weuiSrc, weuiDest, { recursive: true });
} else {
}

