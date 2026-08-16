# Minlish Backend — Docker Guide

> **Người viết:** Minlish Team  
> **Ngày:** 15/08/2026  
> **Phiên bản:** 1.1.0
---

## 1. Docker 

Docker đóng gói toàn bộ môi trường chạy của Minlish Backend thành các container độc lập:

| Service | Image | Port | Vai trò |
|---------|-------|------|---------|
| **app** | Node.js 20 Alpine (build từ `Dockerfile`) | 3000 | Express API + Socket.IO + BullMQ workers |
| **redis** | redis:7-alpine | 6379 | Cache + queue cho BullMQ workers + token blacklist |
| **mongo** *(optional, profile `local`)* | mongo:7.0 | 27017 | Database local khi không có Atlas |
| **mongo-express** *(optional, profile `admin`)* | mongo-express:latest | 8081 | UI quản lý MongoDB |

**Mặc định:** App + Redis chạy, MongoDB dùng Atlas (cloud). Chỉ khi cần mới bật thêm MongoDB local.

---

## 2. Chạy chương trình

### 2.1 Lần đầu tiên (setup từ đầu)

```bash
# 1. Copy file env
cp .env.example .env

# 2. Mở .env, kiểm tra các biến bắt buộc (xem ARCHITECTURE.md phần 10.1)

# 3. Build image
docker-compose build

# 4. Khởi động
docker-compose up -d

# 5. Xem logs để xác nhận chạy OK
docker-compose logs -f app
# → Đợi thấy: "✅ Server running at http://localhost:3000"

# 6. Seed data test (tùy chọn)
docker-compose exec app npm run seed

# 7. Mở Swagger: http://localhost:3000/api-docs
```

### 2.2 Các lần sau (dev hàng ngày)

```bash
# Khởi động (dùng cache, hot reload qua volume mount ./src:/app/src:ro)
docker-compose up -d

# Xem logs
docker-compose logs -f app

# Dừng cuối ngày
docker-compose down
```

> Sửa code trong `src/` → ts-node-dev tự reload, **không cần rebuild**.

### 2.3 Khi nào cần rebuild?

| Thay đổi | Cần làm gì |
|----------|------------|
| Sửa code `.ts` trong `src/` | Không cần rebuild (hot reload) |
| Thêm/sửa dependency trong `package.json` | `docker-compose build` → `docker-compose up -d` |
| Sửa `Dockerfile` | `docker-compose build` → `docker-compose up -d` |
| Sửa `.env` | `docker-compose down` → `docker-compose up -d` |

### 2.4 Chạy kèm MongoDB local (không có internet)

```bash
docker-compose --profile local up -d
```

### 2.5 Chạy kèm MongoDB Express UI

```bash
docker-compose --profile admin up -d
# Mở: http://localhost:8081
```

### 2.6 Lệnh hữu ích khác

```bash
# Chạy lệnh trong container
docker-compose exec app npm run seed
docker-compose exec app npm run lint
docker-compose exec app sh

# Xem trạng thái containers
docker-compose ps

# Restart 1 service
docker-compose restart app

# Dừng + xóa volumes (reset sạch data Redis/Mongo local)
docker-compose down -v

# Build lại từ đầu (xóa cache)
docker-compose build --no-cache app
```

### 2.7 Makefile (shortcut)

```bash
make help       # Xem tất cả lệnh
make up         # Khởi động full stack
make down       # Dừng
make dev        # Chỉ app (dev mode)
make logs-app   # Logs app
make clean      # Dừng + xóa volumes + prune
make rebuild    # Build lại không cache
make admin      # Kèm MongoDB Express
make mongo      # Vào MongoDB shell
```

---

## 3. Xử lý các case thường gặp

| Tình huống | Cách xử lý |
|------------|------------|
| **Port 3000 bị chiếm** | `docker-compose down` → kill process đang dùng port 3000 → `docker-compose up -d` |
| **MongoDB Atlas connection failed** | Kiểm tra `.env`: `MONGO_URI_ATLAS` đúng không, IP đã whitelist trên Atlas chưa |
| **Redis connection failed** | `docker-compose logs redis` → `docker-compose restart redis` |
| **Container app exited / crash loop** | `docker-compose logs app` → đọc error → fix code → `docker-compose up -d` |
| **Code không reload khi sửa** | Kiểm tra volume mount trong `docker-compose.yml`: `./src:/app/src:ro` |
| **Build lỗi** | `docker-compose build --no-cache app` → `docker-compose up -d` |
| **Muốn reset DB hoàn toàn** | `docker-compose down -v` → `docker-compose up -d` → `docker-compose exec app npm run seed` |
| **Thiếu biến .env → app không start** | `docker-compose logs app` sẽ hiện lỗi Zod validation → thêm biến thiếu vào `.env` |
| **Volume mount không hoạt động (Windows)** | Docker Desktop → Settings → Resources → File Sharing → thêm đường dẫn project |
| **Muốn xem resource usage** | `docker stats` |
| **Dọn dẹp Docker toàn cục** | `docker system prune -a` (xóa images/volumes không dùng) |

---

## 4. Production (Docker)

```bash
# Build production image
docker-compose -f docker-compose.yml --target production up --build -d
```

Dockerfile có multi-stage build: `development` (ts-node-dev) và `production` (compiled JS, non-root user, healthcheck).

---

**Maintained by Minlish Team**