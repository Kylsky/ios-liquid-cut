# Liquid Cut - 音频剪辑工具

一个优雅的在线音频剪辑工具，支持 FLAC 和 MP3 格式，最长可剪辑 29 秒的音频片段，特别适合制作手机铃声。


## 功能特性

- 🎵 支持 FLAC 和 MP3 格式
- ✂️ 精确选择剪辑区间（最长 29 秒）
- 📱 iOS 兼容（避免 30 秒限制）
- 🎨 优雅的玻璃态界面设计
- 🚀 纯前端处理，无需上传到服务器
- 🔗 可配置的音乐下载链接


## 快速开始

### 使用 Docker

#### 方式 1：使用 Docker Compose

```bash
# 克隆项目
git clone https://github.com/Kylsky/ios-liquid-cut
cd ios-liquid-cut

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

## 支持作者

如果这个项目对你有帮助，欢迎请作者喝杯咖啡 ☕

<div align="center">
  <img src="./wechat-donation.jpg" alt="微信赞赏码" width="200">
  <p><strong>感谢您的支持！</strong></p>
</div>
