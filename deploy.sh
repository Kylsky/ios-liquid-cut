#!/bin/bash

# Liquid Cut 快速部署脚本

set -e

echo "🎵 Liquid Cut - 快速部署脚本"
echo "=============================="
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    echo "访问 https://docs.docker.com/get-docker/ 获取安装指南"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "⚠️  Docker Compose 未安装，尝试使用 docker compose 命令..."
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# 询问配置
echo "📝 配置选项："
echo ""

read -p "请输入服务端口 (默认: 3000): " PORT
PORT=${PORT:-3000}

read -p "请输入音乐下载链接 (默认: https://www.mp3juices.cc/): " MUSIC_URL
MUSIC_URL=${MUSIC_URL:-https://www.mp3juices.cc/}

echo ""
echo "📦 开始部署..."
echo ""

# 创建临时 docker-compose 文件
cat > docker-compose.temp.yml <<EOF
version: '3.8'

services:
  liquid-cut:
    build: .
    container_name: liquid-cut
    ports:
      - "${PORT}:3000"
    environment:
      - PORT=3000
      - MUSIC_DOWNLOAD_URL=${MUSIC_URL}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/healthz', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s
EOF

# 停止旧容器（如果存在）
echo "🛑 停止旧容器..."
$COMPOSE_CMD -f docker-compose.temp.yml down 2>/dev/null || true

# 构建镜像
echo "🔨 构建 Docker 镜像..."
$COMPOSE_CMD -f docker-compose.temp.yml build

# 启动容器
echo "🚀 启动容器..."
$COMPOSE_CMD -f docker-compose.temp.yml up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
if curl -f http://localhost:${PORT}/healthz > /dev/null 2>&1; then
    echo ""
    echo "✅ 部署成功！"
    echo ""
    echo "🌐 访问地址: http://localhost:${PORT}"
    echo "📊 查看日志: $COMPOSE_CMD -f docker-compose.temp.yml logs -f"
    echo "🛑 停止服务: $COMPOSE_CMD -f docker-compose.temp.yml down"
    echo ""
    echo "💡 提示："
    echo "   - 音乐下载链接: ${MUSIC_URL}"
    echo "   - 最大剪辑时长: 29秒"
    echo "   - 支持格式: FLAC, MP3"
else
    echo ""
    echo "❌ 部署失败，请查看日志："
    $COMPOSE_CMD -f docker-compose.temp.yml logs
    exit 1
fi