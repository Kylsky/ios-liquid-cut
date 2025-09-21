const path = require('path');
const fs = require('fs');
const express = require('express');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const publicDir = path.join(__dirname, 'public');

// 管理员配置的默认音乐下载地址
const MUSIC_DOWNLOAD_URL = process.env.MUSIC_DOWNLOAD_URL || 'https://www.mp3juices.cc/';

app.disable('x-powered-by');
app.use(compression());

const ONE_HOUR = 60 * 60;
const ONE_YEAR = ONE_HOUR * 24 * 365;

// 处理首页请求，注入配置
app.get('/', (_req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  fs.readFile(indexPath, 'utf-8', (err, html) => {
    if (err) {
      return res.status(500).send('Server Error');
    }
    
    // 注入服务器端配置
    const configScript = `
    <script>
      // 服务器端配置（管理员设置）
      window.__LIQUID_CUT_SERVER_CONFIG__ = {
        musicDownloadUrl: '${MUSIC_DOWNLOAD_URL}'
      };
      
      // 合并用户配置和服务器配置
      window.__LIQUID_CUT_CONFIG__ = window.__LIQUID_CUT_CONFIG__ || {};
      if (!window.__LIQUID_CUT_CONFIG__.musicDownloadUrl) {
        window.__LIQUID_CUT_CONFIG__.musicDownloadUrl = window.__LIQUID_CUT_SERVER_CONFIG__.musicDownloadUrl;
      }
    </script>`;
    
    // 在 app.js 之前注入配置
    html = html.replace('<script src="app.js"></script>', `${configScript}\n    <script src="app.js"></script>`);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(html);
  });
});

app.use(
  express.static(publicDir, {
    extensions: ['html'],
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.includes(`${path.sep}vendor${path.sep}`)) {
        res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR}, immutable`);
      } else {
        res.setHeader('Cache-Control', `public, max-age=${ONE_HOUR}`);
      }

      if (filePath.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      }
    },
  })
);

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Liquid Cut server listening on http://${HOST}:${PORT}`);
  console.log(`Music download URL: ${MUSIC_DOWNLOAD_URL}`);
});
