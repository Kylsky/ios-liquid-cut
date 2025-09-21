# Liquid Cut - 音频剪辑工具

一个优雅的在线音频剪辑工具，支持 FLAC 和 MP3 格式，最长可剪辑 29 秒的音频片段，特别适合制作手机铃声。

## 🚀 快速部署

### Cloudflare Pages 部署（推荐）

[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Kylsky/ios-liquid-cut)


## 功能特性

- 🎵 支持 FLAC 和 MP3 格式
- ✂️ 精确选择剪辑区间（最长 29 秒）
- 📱 iOS 兼容（避免 30 秒限制）
- 🎨 优雅的玻璃态界面设计
- 🚀 纯前端处理，无需上传到服务器
- 🔗 可配置的音乐下载链接

## 部署方式对比

| 部署方式 | 优势 | 适用场景 |
|---------|------|----------|
| **Cloudflare Pages** 🌟 | 免费、CDN加速、零配置 | 个人使用、快速部署 |
| **Docker** | 自主可控、支持自定义 | 私有部署、企业使用 |
| **Node.js** | 开发调试、完全控制 | 开发环境、定制需求 |

## 快速开始

### 使用 Docker

#### 方式 1：使用 Docker Compose

```bash
# 克隆项目
git clone https://github.com/yourusername/audio-clipper.git
cd audio-clipper

# 使用 docker-compose 启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

#### 方式 2：使用 Docker 命令

```bash
# 构建镜像
docker build -t liquid-cut .

# 运行容器
docker run -d \
  --name liquid-cut \
  -p 3000:3000 \
  -e MUSIC_DOWNLOAD_URL="https://www.mp3juices.cc/" \
  --restart unless-stopped \
  liquid-cut

# 查看日志
docker logs -f liquid-cut

# 停止容器
docker stop liquid-cut
docker rm liquid-cut
```

#### 方式 3：使用预构建镜像

```bash
docker run -d \
  --name liquid-cut \
  -p 3000:3000 \
  -e MUSIC_DOWNLOAD_URL="https://your-music-site.com/" \
  kylsky/liquid-cut:latest
```

### 使用 Node.js

#### 环境要求

- Node.js >= 18.0.0
- npm 或 pnpm

#### 安装步骤

```bash
# 克隆项目
git clone https://github.com/Kylsky/ios-liquid-cut.git
cd ios-liquid-cut

# 安装依赖
npm install
# 或使用 pnpm
pnpm install

# 启动服务
npm start
# 或自定义端口和音乐下载链接
PORT=8080 MUSIC_DOWNLOAD_URL="https://your-music-site.com/" npm start
```

访问 http://localhost:3000 即可使用。

## 环境变量配置

创建 `.env` 文件（可参考 `.env.example`）：

```bash
# 服务器配置
PORT=3000
HOST=0.0.0.0

# 音乐下载链接（管理员设置）
MUSIC_DOWNLOAD_URL=https://www.mp3juices.cc/
```

## Docker 部署配置

### 修改 docker-compose.yml

编辑 `docker-compose.yml` 文件中的环境变量：

```yaml
environment:
  - PORT=3000
  - HOST=0.0.0.0
  - MUSIC_DOWNLOAD_URL=https://your-preferred-music-site.com/
```

### 使用反向代理（Nginx 示例）

```nginx
server {
    listen 80;
    server_name audio.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 使用 Traefik 自动 SSL

在 `docker-compose.yml` 中添加标签：

```yaml
services:
  liquid-cut:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.liquid-cut.rule=Host(`audio.yourdomain.com`)"
      - "traefik.http.routers.liquid-cut.entrypoints=websecure"
      - "traefik.http.routers.liquid-cut.tls.certresolver=letsencrypt"
      - "traefik.http.services.liquid-cut.loadbalancer.server.port=3000"
```

## 生产环境部署建议

### 1. 资源限制

在 `docker-compose.yml` 中已配置资源限制：
- CPU: 最大 1 核，保留 0.5 核
- 内存: 最大 512MB，保留 256MB

根据实际需求调整这些值。

### 2. 数据持久化

如需持久化日志，添加卷挂载：

```yaml
volumes:
  - ./logs:/app/logs
```

### 3. 监控和日志

使用 Docker 的日志驱动或集成到您的日志系统：

```bash
# 查看实时日志
docker-compose logs -f

# 查看最近 100 行日志
docker-compose logs --tail=100
```

### 4. 自动重启

`docker-compose.yml` 已配置 `restart: unless-stopped`，确保容器在崩溃后自动重启。

### 5. 健康检查

容器内置健康检查，可通过以下命令查看状态：

```bash
docker ps
docker inspect liquid-cut --format='{{.State.Health.Status}}'
```

## 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 故障排除

### 端口占用

如果 3000 端口被占用，修改 `docker-compose.yml`：

```yaml
ports:
  - "8080:3000"  # 改为其他端口
```

### 容器无法启动

查看详细日志：

```bash
docker-compose logs liquid-cut
```

### FFmpeg 资源加载失败

确保 `public/vendor` 目录存在且包含必要文件：
- ffmpeg.js
- ffmpeg-core.js
- ffmpeg-core.wasm
- 814.ffmpeg.js

## 技术栈

- 前端：原生 JavaScript + FFmpeg.wasm
- 后端：Node.js + Express
- 容器化：Docker + Docker Compose
- 音频处理：FFmpeg WebAssembly

## 配置说明

详见 [CONFIG.md](CONFIG.md)

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

## 支持作者

如果这个项目对你有帮助，欢迎请作者喝杯咖啡 ☕

<div align="center">
  <img src="./wechat-donation.jpg" alt="微信赞赏码" width="200">
  <p><strong>感谢您的支持！</strong></p>
</div>
