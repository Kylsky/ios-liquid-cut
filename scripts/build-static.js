#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration for static build
const config = {
  musicDownloadUrl: process.env.MUSIC_DOWNLOAD_URL || 'https://www.mp3juices.cc/'
};

// Create dist directory
const distDir = path.join(__dirname, '..', 'dist');
const publicDir = path.join(__dirname, '..', 'public');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy all files from public to dist
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const files = fs.readdirSync(src);
  
  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy public directory to dist
copyDir(publicDir, distDir);

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

// Insert before app.js
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
const redirectsContent = `/*    /index.html   200`;
fs.writeFileSync(path.join(distDir, '_redirects'), redirectsContent);

console.log('✅ Static build completed successfully!');
console.log(`📁 Build output: ${distDir}`);
console.log(`🎵 Music download URL: ${config.musicDownloadUrl}`);