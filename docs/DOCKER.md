# Minlish Backend — Docker Guide

> **Người viết:** Winston (System Architect) & Mary (Business Analyst)
> **Phiên bản:** 1.1.0
> **Cập nhật:** 2025

---

## 🎯 MongoDB Strategy

**Priority: MongoDB Atlas (Online) > MongoDB Local (Fallback)**

| Mode | Primary | Fallback | Use Case |
|------|---------|----------|----------|
| **Default** | Atlas | Local | Development |
| **Production** | Atlas only | - | Production |
| **Offline** | Local | - | No internet |

### Connection Flow

```
1. Check MONGO_URI_ATLAS in .env
2. Try Atlas first
3. If fail → Auto fallback to Local
4. If fail → Exit with error
```

> **Người viết:** Winston (System Architect) & Mary (Business Analyst)
> **Phiên bản:** 1.0.0
> **Cập nhật:** 2025

---

## 📋 Mục lục

- [Giới thiệu](#giới-thiệu)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cấu trúc Docker](#cấu-trúc-docker)
- [(Quick Start)](#-quick-start)
- [Chi tiết từng lệnh](#chi-tiết-từng-lệnh)
- [Development Workflow](#development-workflow)
- [Production Deployment](#production-deployment)
- [Database Management](#database-management)
- [Troubleshooting](#troubleshooting)
- [Security Best Practices](#security-best-practices)
- [Cleanup](#cleanup)

---

## Giới thiệu

Dự án Minlish Backend đi kèm bộ Docker configuration hoàn chỉnh, bao gồm:

| Component | Image | Port |
|-----------|-------|------|
| **App** | Node.js 20 Alpine | 3000 |
| **MongoDB** | MongoDB 7.0 | 27017 |
| **Redis** | Redis 7 Alpine | 6379 |
| **MongoDB Express** | mongo-express (optional) | 8081 |

### Lợi ích của Docker

- ✅ **Consistent Environment** — Không còn "works on my machine"
- ✅ **Easy Setup** — Khởi động trong vài phút thay vì cài đặt từng service
- ✅ **Isolation** — Mỗi service chạy độc lập
- ✅ **Scalability** — Dễ dàng mở rộng khi cần
- ✅ **Production Ready** — Deploy trực tiếp lên cloud

---

## Yêu cầu hệ thống

### Minimum Requirements

| Requirement | Version |
|------------|---------|
| Docker | 20.10+ |
| Docker Compose | 2.0+ |
| RAM | 4GB |
| Disk | 10GB |

### Recommended

| Requirement | Version |
|------------|---------|
| Docker | 24.0+ |
| Docker Compose | 2.20+ |
| RAM | 8GB |
| Disk | 20GB |

### Kiểm tra Docker installation

```bash
docker --version
docker-compose --version
# Hoặc (Docker Compose v2)
docker compose version
```

---

## Cấu trúc Docker

```
minlish-backend/
├── .env.example            # Environment template (Atlas + Local)
├── Dockerfile              # Multi-stage build
├── docker-compose.yml      # App + Redis (MongoDB via Atlas)
├── .dockerignore           # Exclude unnecessary files
├── Makefile                # Convenience commands
│
├── docker/
│   └── mongo/
│       └── init.js        # DB initialization (optional)
│
├── src/
│   └── config/
│       └── db.ts          # MongoDB connection with fallback
│
└── docs/
    └── DOCKER.md           # This file
```

### Docker Profiles

| Command | Services | MongoDB |
|---------|----------|---------|
| `make up` | App + Redis | Atlas (online) |
| `make up --profile local` | App + Redis + MongoDB | Local Docker |
| `make admin` | App + Redis + MongoDB Express | Atlas + Admin UI |

---

## Quick Start

### 1. Clone và setup

```bash
git clone https://github.com/your-org/minlish-backend.git
cd minlish-backend
```

### 2. Copy environment file

```bash
# Tự động tạo .env từ template
make env-copy

# Hoặc thủ công
cp .env.example .env
```

### 3. Edit .env

```bash
# Mở file .env và cập nhật các giá trị:
nano .env
# Hoặc
code .env
```

**Các giá trị quan trọng cần thay đổi:**

```env
# JWT Secrets - BẮT BUỘC thay đổi trong production
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production

# MongoDB Credentials
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=your-strong-password

# Cloudinary (nếu sử dụng)
CLOUDINARY_URL=cloudinary://...

# Email (nếu sử dụng)
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### 4. Khởi động

```bash
# Full stack (App + MongoDB + Redis)
make up

# Hoặc chỉ App (nếu đã có MongoDB)
make dev
```

### 5. Verify

```bash
# Kiểm tra trạng thái
make status

# Xem logs
make logs-app
```

**Truy cập:**
- 🌐 **API:** http://localhost:3000
- 📖 **Swagger Docs:** http://localhost:3000/api-docs
- 🗄️ **MongoDB:** localhost:27017
- 🔗 **Redis:** localhost:6379

---

## Chi tiết từng lệnh

### Makefile Commands

| Command | Mô tả |
|---------|-------|
| `make help` | Hiển thị tất cả commands |
| `make up` | Khởi động full stack |
| `make down` | Dừng tất cả services |
| `make restart` | Restart tất cả services |
| `make dev` | Khởi động chế độ development |
| `make prod` | Khởi động chế độ production |
| `make logs` | Xem tất cả logs |
| `make logs-app` | Xem app logs |
| `make logs-mongo` | Xem MongoDB logs |
| `make status` | Kiểm tra trạng thái containers |
| `make clean` | Dọn dẹp containers và volumes |
| `make admin` | Khởi động với MongoDB Express |
| `make mongo` | Connect trực tiếp vào MongoDB |
| `make shell-app` | Mở shell trong app container |

### Docker Compose Commands

```bash
# Build images
docker-compose build

# Build với target cụ thể (dev/prod)
docker-compose build --build-target development

# Start services
docker-compose up -d

# Start với rebuild
docker-compose up --build -d

# Stop services
docker-compose down

# Stop và xóa volumes
docker-compose down -v

# View logs
docker-compose logs -f
docker-compose logs -f app

# Execute command in container
docker-compose exec app npm run seed

# Connect to MongoDB
docker-compose exec mongo mongosh -u admin -p password

# Open shell in app container
docker-compose exec app sh
```

---

## Development Workflow

### Workflow 1: Full Stack Development

```bash
# 1. Khởi động môi trường
make up

# 2. Check logs
make logs-app

# 3. Code changes sẽ auto-reload (nhờ volume mount)
# Edit files trong src/

# 4. Chạy seed data
make mongo-seed

# 5. Test API
curl http://localhost:3000/api/v1/auth/health
```

### Workflow 2: App Only (đã có MongoDB)

```bash
# Nếu đã có MongoDB chạy local hoặc Atlas
# Chỉ cần start App

# Development
make dev

# Hoặc production
make prod
```

### Workflow 3: Database Management

```bash
# Connect vào MongoDB shell
make mongo

# Trong shell, thực hiện:
# 1. Xem databases
show dbs

# 2. Switch to minlish
use minlish

# 3. Xem collections
show collections

# 4. Xem users
db.users.find().pretty()

# 5. Exit
.exit
```

### Hot Reload với Volume Mount

Trong development mode, `src/` directory được mount vào container:

```yaml
# docker-compose.yml
volumes:
  - ./src:/app/src:ro  # Read-only mount for source
```

**Kết quả:** Mọi thay đổi trong `src/` sẽ trigger ts-node-dev auto-reload.

---

## Production Deployment

### Build Production Image

```bash
# Build production image
make prod-build

# Hoặc
docker-compose build --build-target production
```

### Run Production

```bash
# Set environment variables
export NODE_ENV=production
export BUILD_TARGET=production

# Khởi động
docker-compose up -d

# Verify
curl https://your-domain.com/
```

### Environment Variables quan trọng cho Production

```env
# BẮT BUỘC
NODE_ENV=production
BUILD_TARGET=production

# JWT - Sử dụng secrets mạnh
JWT_SECRET=<64-char-random-string>
JWT_REFRESH_SECRET=<64-char-random-string>

# MongoDB - Production cluster
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/minlish

# HTTPS (nếu không dùng reverse proxy)
# Cài đặt SSL certificates
```

### Production Best Practices

1. **Sử dụng secrets management**
   ```bash
   # Docker Secrets
   echo "your-secret" | docker secret create minlish_jwt_secret -
   
   # Hoặc environment files bên ngoài
   docker-compose -f docker-compose.prod.yml up
   ```

2. **Health checks**
   ```bash
   # Verify container health
   docker inspect minlish-app --format='{{.State.Health.Status}}'
   ```

3. **Logging**
   ```bash
   # View production logs
   docker-compose logs --tail=100 app
   ```

4. **Resource limits**
   ```yaml
   # Thêm vào docker-compose.yml
   deploy:
     resources:
       limits:
         cpus: '1'
         memory: 2G
   ```

---

## Database Management

### MongoDB Express (Admin UI)

```bash
# Khởi động với MongoDB Express
make admin

# Truy cập
open http://localhost:8081
```

**Credentials:**
- Server: `mongo`
- Username: `admin` (hoặc giá trị MONGO_ROOT_USER)
- Password: giá trị MONGO_ROOT_PASSWORD

### Backup Database

```bash
# Create backup directory
mkdir -p backups

# Backup
docker-compose exec mongo mongodump --archive=backups/minlish-$(date +%Y%m%d).archive --db=minlish

# Hoặc backup ra host
docker-compose exec -T mongo mongodump --db=minlish --archive=/dev/stdout > minlish-backup-$(date +%Y%m%d).archive
```

### Restore Database

```bash
# Restore from archive
docker-compose exec -T mongo mongorestore --archive=/dev/stdin < minlish-backup-20250101.archive

# Hoặc restore specific collection
docker-compose exec mongo mongorestore --nsInclude="minlish.users" --archive=/dev/stdin < users-backup.archive
```

### Seed Data

```bash
# Run seed script
docker-compose exec app npm run seed

# Hoặc
make mongo-seed
```

**Test accounts sau seed:**
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@minlish.com | Admin@123 |
| User | user@minlish.com | User@123 |

---

## Troubleshooting

### Container không start

```bash
# 1. Kiểm tra logs
docker-compose logs app

# 2. Kiểm tra port冲突
docker-compose ps
lsof -i :3000

# 3. Kiểm tra environment variables
docker-compose config
```

### MongoDB connection failed

```bash
# 1. Kiểm tra MongoDB health
docker-compose ps mongo

# 2. Xem MongoDB logs
docker-compose logs mongo

# 3. Restart MongoDB
docker-compose restart mongo

# 4. Kiểm tra connection string
# .env phải có: MONGO_URI=mongodb://mongo:27017/minlish
```

### Image build failed

```bash
# 1. Xem build logs
docker-compose build --progress=plain

# 2. Clear cache và rebuild
docker-compose build --no-cache

# 3. Kiểm tra Dockerfile syntax
```

### Permission denied

```bash
# Fix volume permissions
sudo chown -R $USER:$USER .

# Hoặc rebuild image
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Volume mount issues (Windows/Mac)

```bash
# Windows: Kiểm tra Docker Desktop settings
# Settings > Resources > File Sharing

# Mac: Kiểm tra file sharing
# Settings > Resources > File Sharing
```

### Common Issues Quick Fix

```bash
# Full reset
make clean
make rebuild
make up

# Xem all logs
docker-compose logs --tail=50

# Restart specific service
docker-compose restart app

# Recreate containers
docker-compose up -d --force-recreate
```

---

## Security Best Practices

### 1. Never commit .env

```bash
# .gitignore đã có sẵn
cat .gitignore | grep -i env
# Output: .env
```

### 2. Use strong secrets

```bash
# Generate strong JWT secret
openssl rand -hex 64

# Hoặc
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Production Security Checklist

- [ ] ✅ Đổi JWT secrets
- [ ] ✅ Đổi MongoDB credentials
- [ ] ✅ Enable SSL/TLS cho MongoDB Atlas
- [ ] ✅ Sử dụng Docker secrets hoặc secret manager
- [ ] ✅ Enable rate limiting
- [ ] ✅ Configure CORS whitelist đúng
- [ ] ✅ Enable Redis AUTH (optional)
- [ ] ✅ Regular backup schedule

### 4. Network Security

```yaml
# docker-compose.yml - chỉ expose cần thiết
services:
  app:
    ports:
      - "3000:3000"  # Chỉ app port
    # Không expose MongoDB/Redis ra ngoài
```

---

## Cleanup

### Dừng và xóa containers

```bash
make down
```

### Dừng và xóa cả volumes (mất data!)

```bash
make clean
```

### Xóa images

```bash
# Xóa Minlish images
docker rmi minlish-backend-app

# Xóa unused images
docker system prune -a
```

### Full cleanup (remove everything)

```bash
# Stop all containers
docker-compose down -v --remove-orphans

# Remove all images
docker system prune -a -f

# Remove all volumes (DATA WILL BE LOST!)
docker volume prune -f
```

---

## Appendix

### Docker Commands Reference

```bash
# Container Management
docker ps                    # List running containers
docker ps -a                # List all containers
docker stop <container>     # Stop container
docker rm <container>       # Remove container
docker restart <container>   # Restart container

# Image Management
docker images               # List images
docker rmi <image>         # Remove image
docker build -t name:tag .  # Build image

# Volume Management
docker volume ls           # List volumes
docker volume rm <volume>  # Remove volume
docker volume prune        # Remove unused volumes

# System
docker system df           # Show disk usage
docker system prune        # Clean up unused data
```

### Useful Links

| Resource | URL |
|----------|-----|
| Docker Docs | https://docs.docker.com/ |
| Docker Compose | https://docs.docker.com/compose/ |
| MongoDB Docker | https://hub.docker.com/_/mongo |
| Redis Docker | https://hub.docker.com/_/redis |
| Minlish API | http://localhost:3000/api-docs |

---

**Maintained by Winston (System Architect) & Mary (Business Analyst)**

*Questions? Create an issue on GitHub or contact the Minlish Team.*
