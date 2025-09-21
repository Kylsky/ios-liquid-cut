#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NODE_MODULES = path.join(ROOT, 'node_modules');
const vendorDir = path.join(ROOT, 'public', 'vendor');

const sources = [
  {
    rel: '@ffmpeg/ffmpeg/dist/umd/ffmpeg.js',
    target: 'ffmpeg.js',
  },
  {
    rel: '@ffmpeg/ffmpeg/dist/umd/814.ffmpeg.js',
    target: '814.ffmpeg.js',
  },
  {
    rel: '@ffmpeg/core/dist/umd/ffmpeg-core.js',
    target: 'ffmpeg-core.js',
  },
  {
    rel: '@ffmpeg/core/dist/umd/ffmpeg-core.wasm',
    target: 'ffmpeg-core.wasm',
  },
];

async function ensureVendorDir() {
  await fs.promises.mkdir(vendorDir, { recursive: true });
}

async function copyAssets() {
  const ffmpegModulePath = path.join(NODE_MODULES, '@ffmpeg');
  if (!fs.existsSync(ffmpegModulePath)) {
    console.warn('[prepare-ffmpeg] 未找到 node_modules/@ffmpeg，跳过复制。请先运行 npm install。');
    return;
  }

  await ensureVendorDir();
  const missing = [];
  for (const { rel, target } of sources) {
    const sourcePath = path.join(NODE_MODULES, rel);
    if (!fs.existsSync(sourcePath)) {
      missing.push(rel);
      continue;
    }
    const destPath = path.join(vendorDir, target);
    await fs.promises.copyFile(sourcePath, destPath);
  }

  if (missing.length) {
    const msg = missing.map((item) => ` - ${item}`).join('\n');
    throw new Error(`prepare-ffmpeg: 缺少以下文件，无法完成复制:\n${msg}`);
  }

  console.log('[prepare-ffmpeg] FFmpeg UMD 资源已复制到 public/vendor');
}

copyAssets().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
