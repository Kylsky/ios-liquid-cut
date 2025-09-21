#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ALLOWED_MODES = new Set(['cdn', 'local']);
const resolvedMode = process.env.BUILD_MODE || 'cdn';
const buildMode = ALLOWED_MODES.has(resolvedMode) ? resolvedMode : 'cdn';

if (!ALLOWED_MODES.has(resolvedMode)) {
  console.warn(`⚠️  Unknown BUILD_MODE="${resolvedMode}" received. Falling back to "cdn".`);
}

// Configuration for static build
const config = {
  musicDownloadUrl: process.env.MUSIC_DOWNLOAD_URL || 'https://www.mp3juices.cc/'
};

console.log(`🚀 Building in ${buildMode} mode...`);

// Create dist directory
const distDir = path.join(__dirname, '..', 'dist');
const publicDir = path.join(__dirname, '..', 'public');

// Ensure we always start from a clean dist directory to avoid leftover assets
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Copy all files from public to dist
function copyDir(src, dest, skipVendor = false) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const files = fs.readdirSync(src);
  
  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    
    // Skip vendor directory in CDN mode
    if (skipVendor && file === 'vendor') {
      console.log('📦 Skipping vendor directory (using CDN mode)');
      continue;
    }
    
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath, skipVendor);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy public directory to dist (skip vendor in CDN mode)
copyDir(publicDir, distDir, buildMode === 'cdn');

// Remove vendor directory explicitly in CDN mode to keep bundle size within CF limits
if (buildMode === 'cdn') {
  const distVendorDir = path.join(distDir, 'vendor');
  if (fs.existsSync(distVendorDir)) {
    fs.rmSync(distVendorDir, { recursive: true, force: true });
  }
}

// Read and modify index.html to inject configuration
const indexPath = path.join(distDir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf-8');

// Inject configuration script
const configScript = `
<script>
  // Static build configuration
  window.__LIQUID_CUT_SERVER_CONFIG__ = {
    musicDownloadUrl: '${config.musicDownloadUrl}'
  };
  
  // Merge user config and server config
  window.__LIQUID_CUT_CONFIG__ = window.__LIQUID_CUT_CONFIG__ || {};
  if (!window.__LIQUID_CUT_CONFIG__.musicDownloadUrl) {
    window.__LIQUID_CUT_CONFIG__.musicDownloadUrl = window.__LIQUID_CUT_SERVER_CONFIG__.musicDownloadUrl;
  }
</script>`;

// Configure FFmpeg bundles based on build mode
let ffmpegScript = '';
if (buildMode === 'cdn') {
  ffmpegScript = `
<script>
  // CDN mode - use external FFmpeg resources
  window.__LIQUID_CUT_FFMPEG__ = {
    bundles: [
      {
        name: 'jsdelivr-npm',
        script: 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/umd/ffmpeg.js',
        corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js'
      }
    ]
  };
</script>`;
} else {
  ffmpegScript = `
<script>
  // Local mode - use bundled FFmpeg resources
  const liquidConfig = window.__LIQUID_CUT_FFMPEG__ || {};
  const localBundle = {
    name: 'local',
    script: '/vendor/ffmpeg.js',
    corePath: '/vendor/ffmpeg-core.js',
  };
  const userBundles = Array.isArray(liquidConfig.bundles) ? [...liquidConfig.bundles] : [];
  const hasLocal = userBundles.some((bundle) => bundle && bundle.script === localBundle.script);
  if (!hasLocal) {
    userBundles.unshift(localBundle);
  }
  window.__LIQUID_CUT_FFMPEG__ = { ...liquidConfig, bundles: userBundles };
</script>`;
}

// Remove existing FFmpeg script and insert new configuration
html = html.replace(/<script>\s*const liquidConfig[\s\S]*?<\/script>/m, ffmpegScript);

// Insert config before app.js
html = html.replace('<script src="app.js"></script>', `${configScript}\n    <script src="app.js"></script>`);

// Write modified index.html
fs.writeFileSync(indexPath, html);

// Create _headers file for Cloudflare Pages
const headersContent = `/*
  Cache-Control: public, max-age=3600

/vendor/*
  Cache-Control: public, max-age=31536000, immutable

/*.wasm
  Content-Type: application/wasm
  Cross-Origin-Resource-Policy: same-origin

/*.html
  Cache-Control: no-cache`;

fs.writeFileSync(path.join(distDir, '_headers'), headersContent);

// Create _redirects file for SPA routing
const redirectsContent = `/index.html    /index.html   200\n/*    /index.html   200`;
fs.writeFileSync(path.join(distDir, '_redirects'), redirectsContent);

console.log('✅ Static build completed successfully!');
console.log(`📁 Build output: ${distDir}`);
console.log(`🎵 Music download URL: ${config.musicDownloadUrl}`);
console.log(`📦 FFmpeg mode: ${buildMode === 'cdn' ? 'CDN (jsDelivr)' : 'Local bundled'}`);

if (buildMode === 'cdn') {
  console.log('🌐 Using CDN FFmpeg - suitable for one-click deployment');
} else {
  console.log('📦 Using local FFmpeg - better performance but larger build');
}
