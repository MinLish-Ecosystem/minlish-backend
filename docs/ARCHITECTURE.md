# Minlish API — Architecture Documentation

> **Người viết:** Minlish Team  
> **Ngày:** 15/08/2026  
> **Phiên bản:** 1.1.0

---

## 1. Tổng Quan Hệ Thống

Minlish là một RESTful API backend hỗ trợ ứng dụng học tiếng Anh, cung cấp:


- **Quản lý người dùng** (auth, profiles, OTP)
- **Học từ vựng** (flashcards, spaced repetition SM-2)
- **Bài tập luyện tập** (daily practice, challenges)
- **Mạng xã hội học tập** (posts, comments, reports)
- **Thông báo** (push notifications qua FCM)
- **Real-time** (Socket.IO cho live updates)
- **Dictionary** (tích hợp external providers)
- **Moderation** (tự động kiểm duyệt nội dung)

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js |
| **Framework** | Express.js |
| **Language** | TypeScript |
| **Database** | MongoDB + Mongoose ODM |
| **Real-time** | Socket.IO |
| **Auth** | JWT |
| **File Upload** | Cloudinary |
| **Email** | Nodemailer |
| **API Docs** | Swagger (OpenAPI 3.0) |
| **Validation** | Zod-like schemas |

---

## 3. Cấu Trúc Thư Mục

```
├── src/
│   ├── app.ts                 # Express app setup (middleware, CORS, routes)
│   ├── server.ts              # Entry point (DB connect, workers, Socket.IO)
│   │
│   ├── config/                # Cấu hình hệ thống
│   │   ├── db.ts              # MongoDB connection
│   │   ├── env.ts             # Environment validation
│   │   ├── swagger.ts         # Swagger setup
│   │   ├── socket.ts          # Socket.IO initialization
│   │   ├── mailer.ts          # Email service config
│   │   └── cloudinary.ts     # Cloudinary config
│   │
│   ├── routes/                # API Route definitions
│   │   ├── index.ts           # Root router (mount all sub-routers)
│   │   ├── auth.routes.ts     # /api/v1/auth/*
│   │   ├── user.routes.ts     # /api/v1/user/*
│   │   ├── admin.routes.ts    # /api/v1/admin/*
│   │   ├── vocab.routes.ts    # /api/v1/vocab/*
│   │   ├── learning.routes.ts  # /api/v1/learning/*
│   │   ├── notification.routes.ts
│   │   ├── stats.routes.ts
│   │   ├── practice.routes.ts
│   │   ├── post.routes.ts     # /api/v1/posts/*
│   │   ├── report.routes.ts
│   │   ├── sync.routes.ts
│   │   └── dictionary.routes.ts
│   │
│   ├── controllers/           # Request handlers
│   │
│   ├── services/              # Business logic layer
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── admin.service.ts
│   │   ├── vocab.service.ts
│   │   ├── learning.service.ts
│   │   ├── notification.service.ts
│   │   ├── stats.service.ts
│   │   ├── sync.service.ts
│   │   ├── mail.service.ts
│   │   ├── otp.service.ts
│   │   ├── cloudinary.service.ts
│   │   ├── moderation.service.ts
│   │   ├── dictionary/        # External dictionary providers
│   │   │   ├── dictionary.service.ts
│   │   │   └── providers/
│   │   │       ├── freeDictionary.provider.ts
│   │   │       └── vocabularyCom.provider.ts
│   │   └── *.worker.ts        # Background job workers
│   │
│   ├── models/                # Mongoose schemas
│   │   ├── User.ts
│   │   ├── UserProfile.ts
│   │   ├── VocabularySet.ts
│   │   ├── Word.ts
│   │   ├── LearningProgress.ts
│   │   ├── DailyChallenge.ts
│   │   ├── DailyPracticeResult.ts
│   │   ├── DailyStats.ts
│   │   ├── Post.ts
│   │   ├── Comment.ts
│   │   ├── Nofitication.ts
│   │   ├── FCMToken.ts
│   │   ├── OTP.ts
│   │   ├── SystemConfig.ts
│   │   ├── AdminAuditLog.ts
│   │   ├── ModerationLog.ts
│   │   └── UserReport.ts
│   │
│   ├── middlewares/           # Express middlewares
│   │   ├── auth.middleware.ts
│   │   ├── admin.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── maintenance.middleware.ts
│   │   └── ...
│   │
│   ├── validators/            # Request validation schemas (Zod-like)
│   │   ├── auth.schema.ts
│   │   ├── user.schema.ts
│   │   ├── vocab.schema.ts
│   │   ├── learning.schema.ts
│   │   └── ...
│   │
│   ├── utils/                 # Utility functions
│   │   ├── AppError.ts        # Custom error class
│   │   ├── catchAsync.ts      # Async wrapper
│   │   ├── jwt.util.ts        # JWT helpers
│   │   ├── otp.util.ts        # OTP generation
│   │   ├── response.util.ts   # Response formatters
│   │   ├── sm2.ts             # SM-2 spaced repetition algorithm
│   │   └── tokenBlacklist.ts  # JWT blacklist management
│   │
│   ├── types/                 # TypeScript type definitions
│   │   ├── express.d.ts       # Express augmentations
│   │   ├── dictionary.types.ts
│   │   ├── vocab.types.ts
│   │   └── learning.types.ts
│   │
│   └── scripts/                # Standalone scripts (seed, etc.)
│
│
├── docs/                      # Documentation
├── design-artifacts/           # UI/UX design files
├── uml/                        # UML diagrams
└── *.json                      # Config files (package, tsconfig, etc.)
```

---

## 4. API Structure

### Base URL
```
Production: https://api.minlish.com
Development: http://localhost:3000
```

### Versioning
```
/api/v1/{resource}
```

### Server
```
https://minlish-frontend.vercel.app/login
```

### Endpoints Map

| Module | Base Path | Description |
|--------|-----------|-------------|
| **Auth** | `/api/v1/auth` | Login, register, OTP, password reset |
| **User** | `/api/v1/user` | Profile management |
| **Admin** | `/api/v1/admin` | Admin operations, audit logs |
| **Vocabulary** | `/api/v1/vocab` | Word sets, words CRUD |
| **Learning** | `/api/v1/learning` | Learning progress, SM-2 algorithm |
| **Notifications** | `/api/v1/notifications` | Push notifications |
| **Stats** | `/api/v1/stats` | User statistics |
| **Practice** | `/api/v1/practice` | Daily practice, challenges |
| **Posts** | `/api/v1/posts` | Social posts, comments |
| **Reports** | `/api/v1/reports` | User reports |
| **Sync** | `/api/v1/sync` | Data synchronization |
| **Dictionary** | `/api/v1/dictionary` | External dictionary lookup |
| **Models** | `/api/v1/models` | System model info (admin) |

---

## 5. Data Models Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    User     │────<│ UserProfile │     │  FCMToken   │
└──────┬──────┘     └─────────────┘     └─────────────┘
       │
       │ 1:N
       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│VocabularySet│────<│    Word     │     │   Post       │
└─────────────┘     └─────────────┘     └──────┬──────┘
       │                                        │
       │ 1:N                                    │ 1:N
       ▼                                        ▼
┌─────────────┐                           ┌─────────────┐
│LearningProg │                           │  Comment    │
└─────────────┘                           └─────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│DailyChallenge│    │DailyPractice│     │ DailyStats  │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## 6. Background Workers

### 6.1 Reminder Worker (`reminder.worker.ts`)
- **Trigger:** Scheduled (cron-like)
- **Chức năng:** Gửi notification nhắc nhở học tập hàng ngày
- **Logic:** Check user streak, gửi FCM notification

### 6.2 Daily Practice Worker (`practice.worker.ts`)
- **Trigger:** Scheduled (hàng ngày)
- **Chức năng:** Sinh đề luyện tập tự động cho users
- **Logic:** Randomize vocabulary sets, create daily challenges

### 6.3 Moderation Worker (`moderation.worker.ts`)
- **Trigger:** Scheduled (periodic)
- **Chức năng:** Tự động kiểm duyệt bộ từ vựng công khai
- **Logic:** Check content policy, flag/report violations

---

## 7. Security Architecture

### 7.1 Authentication Flow
```
┌─────────┐     ┌──────────┐     ┌─────────────┐
│  User   │────>│  /auth   │────>│ JWT Token   │
│         │<────│  login   │<────│ (access +   │
└─────────┘     └──────────┘     │  refresh)   │
                                 └─────────────┘
```

### 7.2 Authorization Roles
| Role | Permissions |
|------|-------------|
| **User** | CRUD own data, learn vocab, post |
| **Admin** | All user permissions + admin panel |

### 7.3 Security Layers
- ✅ Helmet.js (HTTP headers)
- ✅ CORS whitelist
- ✅ JWT with blacklist
- ✅ Rate limiting
- ✅ Input validation (schemas)
- ✅ SQL injection prevention (Mongoose)
- ✅ XSS protection

---

## 8. Real-time Architecture (Socket.IO)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Client     │────>│  Socket.IO   │────>│  Namespace   │
│  (Mobile)    │<────│   Server     │<────│  /notifs     │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Events
- `notification:new` - New notification received
- `notification:read` - Mark notification as read
- `learning:progress` - Learning progress update
- `sync:required` - Data sync required

---

## 9. External Integrations

| Service | Provider | Purpose |
|---------|----------|---------|
| **Dictionary** | FreeDictionary API | Word definitions |
| **Dictionary** | Vocabulary.com | Pronunciation, examples |
| **Storage** | Cloudinary | Image/video upload |
| **Email** | SMTP/Nodemailer | Transactional emails |
| **Push** | Firebase Cloud Messaging | Mobile notifications |
| **Database** | MongoDB Atlas | Primary database |

---

## 10. Deployment

### 10.1 Environment Variables

Toàn bộ biến môi trường được định nghĩa trong `.env.example` (copy thành `.env` khi setup). Các biến đánh dấu **bắt buộc** được validate bởi `src/config/env.ts` — thiếu hoặc sai định dạng thì app không khởi động.

| Nhóm | Biến | Bắt buộc | Giá trị ví dụ | Mô tả |
|------|------|:--------:|---------------|-------|
| **SERVER** | `PORT` | | `3001` | Port server lắng nghe |
| | `NODE_ENV` | | `development` | `development` \| `production` \| `test` |
| **MONGODB** | `MONGO_URI_LOCAL` | ✅ (1 trong 2) | `mongodb://localhost:27017/minlish` | Dùng khi dev offline |
| | `MONGO_URI_ATLAS` | ✅ (1 trong 2) | `mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/?appName=Cluster0` | Dùng khi deploy / kết nối cloud |
| | `MONGO_URI` | | `${MONGO_URI_ATLAS}` | Biến chính dùng trong code, trỏ về Atlas hoặc Local tùy môi trường |
| **JWT** | `JWT_ACCESS_SECRET` | ✅ | `your_super_secret_access_key_here` | Secret ký access token — đổi chuỗi random dài khi lên production |
| | `JWT_REFRESH_SECRET` | ✅ | `your_super_secret_refresh_key_here` | Secret ký refresh token |
| | `JWT_ACCESS_EXPIRES_IN` | | `1h` | Thời gian sống access token |
| | `JWT_REFRESH_EXPIRES_IN` | | `7d` | Thời gian sống refresh token |
| **GMAIL SMTP** | `MAIL_USER` | ✅ | `your_email@gmail.com` | Gmail gửi mail (phải là email hợp lệ) |
| | `MAIL_PASS` | ✅ | `your_app_password` | Gmail App Password (16 ký tự, không khoảng trắng) |
| **CLOUDINARY** | `CLOUDINARY_CLOUD_NAME` | | `dzi6e60ci` | Cloud name |
| | `CLOUDINARY_API_KEY` | | `<api_key>` | API key |
| | `CLOUDINARY_API_SECRET` | | `<api_secret>` | API secret |
| **REDIS (Upstash)** | `REDIS_URL` | | `rediss://default:<token>@<host>.upstash.io:6379` | Redis cloud — BullMQ workers + token blacklist |
| **GEMINI API** | `GEMINI_API_KEY` | | `<gemini_api_key>` | Google Gemini API key |
| **FRONTEND & CORS** | `FRONTEND_URL` | | `http://localhost:5173,http://localhost:3000` | Comma-separated allowed origins |
| **ADMIN TOOLS** | `MONGO_EXPRESS_PORT` | | `8081` | Port MongoDB Express UI |
| **VOICE AI** | `VOICE_AI_CDN_URL` | | `https://cdn.example.com/models` | CDN URL cho Voice AI models |

> ⚠️ **Lưu ý bảo mật:** `.env.example` hiện đang chứa credentials thật (Atlas, Cloudinary, Upstash, Gemini). Chỉ giữ placeholder trong file mẫu commit lên repo; giá trị thật để trong `.env` (đã có trong `.gitignore`).

### 10.2 Deployment Platforms

#### Primary: Render (`render.yaml`)

| Thuộc tính | Giá trị |
|------------|---------|
| **Service name** | `minlish-api` |
| **Region** | Singapore (gần VN nhất) |
| **Plan** | Free |
| **Build** | `npm install --include=dev && npm run build` |
| **Start** | `npm start` |
| **Health check** | `GET /` |

**Biến cần điền thủ công trên Render Dashboard → Environment:**
`MONGO_URI_ATLAS`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MAIL_USER`, `MAIL_PASS`, `FRONTEND_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

#### Alternative
- Vercel, Railway, Fly.io

---

## 11. Development Workflow

### 11.1 Scripts

**Local Development (Node.js trực tiếp):**
```bash
npm run dev          # Development (ts-node-dev with hot reload)
npm run build        # Production build (TypeScript → dist/)
npm start            # Start production server (node dist/server.js)
npm run seed         # Seed database with test data
npm run seed:posts   # Seed community posts only
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
```

**Docker Development (Khuyến nghị) — Hướng dẫn từ A-Z:**

---

#### 🚀 **Lần đầu tiên setup (chỉ chạy 1 lần hoặc khi đổi Dockerfile/package.json)**

```bash
# 1. Clone repo & vào thư mục
git clone <repo-url>
cd minlish-backend

# 2. Tạo file .env từ template (xem phần 10.1 để biết các biến cần thiết)
cp .env.example .env 2>/dev/null || echo "Tạo .env thủ công - xem phần 10.1"

# 3. Build image (download base, install deps, compile TS)
docker-compose build

# 4. Khởi động services (app + redis, MongoDB dùng Atlas)
docker-compose up -d

# 5. Kiểm tra logs để đảm bảo start OK
docker-compose logs -f app
# → Đợi thấy: "✅ Server running at http://localhost:3000" và "🔌 Socket.IO ready"

# 6. Seed data test (tùy chọn)
docker-compose exec app npm run seed

# 7. Mở Swagger UI: http://localhost:3000/api-docs
```

---

#### 🔄 **Workflow hàng ngày (dev loop)**

```bash
# Khởi động nhanh (dùng cache, hot reload qua volume mount)
docker-compose up -d

# Xem logs real-time
docker-compose logs -f app

# Code thay đổi → tự động reload (ts-node-dev watch mode)
# Không cần rebuild trừ khi đổi package.json hoặc Dockerfile

# Chạy lệnh trong container
docker-compose exec app npm run seed        # Seed DB
docker-compose exec app npm run lint        # Check lint
docker-compose exec app npm run seed:posts  # Seed posts only
docker-compose exec app sh                  # Vào shell debug

# Dừng cuối ngày
docker-compose down
```

---

#### 🛠 **Các tình huống thường gặp & cách xử lý**

| Tình huống | Lệnh / Cách fix |
|------------|-----------------|
| **Đổi `package.json` / `Dockerfile` / config mới** | `docker-compose build` → `docker-compose up -d` |
| **Build bị lỗi cache / muốn build sạch** | `docker-compose build --no-cache app` → `docker-compose up -d` |
| **Container đã chạy nhưng code không reload** | Kiểm tra volume mount trong `docker-compose.yml`: `./src:/app/src:ro` |
| **Port 3000 bị chiếm** | `docker-compose down` → kill process local trên 3000 → `docker-compose up -d` |
| **MongoDB Atlas connection failed** | Kiểm tra `.env`: `MONGO_URI_ATLAS`, IP whitelist Atlas, network |
| **Redis connection failed** | `docker-compose logs redis` → `docker-compose restart redis` |
| **Muốn reset DB hoàn toàn (xóa data Redis + Mongo local)** | `docker-compose down -v` → `docker-compose up -d` → `docker-compose exec app npm run seed` |
| **Container `exited` / crash loop** | `docker-compose logs app` → xem error → fix code → `docker-compose up -d` |
| **Quên password DB / muốn vào Mongo shell** | `docker-compose --profile local up -d` → `docker-compose exec mongo mongosh` |
| **Xem resource usage** | `docker stats` |
| **Dọn dẹp Docker toàn cục (cache, images không dùng)** | `docker system prune -a` |

---

#### 📋 **Cheatsheet lệnh nhanh**

```bash
# ── Khởi động ──────────────────────────────────────────────
docker-compose build              # Build image (lần 1 / đổi config)
docker-compose up -d              # Chạy nền (dev + hot reload)
docker-compose --profile local up -d  # Chạy kèm MongoDB local

# ── Logs & Debug ──────────────────────────────────────────
docker-compose logs -f app        # Logs real-time app
docker-compose logs -f redis      # Logs Redis
docker-compose logs --tail=100 app # 100 dòng cuối
docker-compose exec app sh        # Vào shell container app
docker-compose exec redis redis-cli # Vào Redis CLI

# ── Chạy lệnh trong container ─────────────────────────────
docker-compose exec app npm run seed
docker-compose exec app npm run lint
docker-compose exec app npm run build
docker-compose exec app npm test     # Nếu có test script

# ── Dừng & Dọn dẹp ────────────────────────────────────────
docker-compose down               # Dừng containers (giữ volumes)
docker-compose down -v            # Dừng + xóa volumes (reset DB)
docker-compose down --rmi local   # Dừng + xóa images local

# ── Production ────────────────────────────────────────────
docker-compose --target production up --build -d
```

---

#### ⚠️ **Lưu ý quan trọng**

- **Hot reload** hoạt động nhờ volume mount `./src:/app:ro` trong `docker-compose.yml` — **không cần rebuild** khi sửa code `.ts`
- **`package.json` / `Dockerfile` / `.env`** thay đổi → **bắt buộc `docker-compose build`**
- **MongoDB**: Mặc định dùng **Atlas** (`.env` → `MONGO_URI_ATLAS`). Dùng `--profile local` nếu muốn MongoDB container local
- **Redis**: Luôn chạy trong compose (cần cho BullMQ workers + token blacklist)
- **Healthcheck**: App có healthcheck 30s interval — `docker-compose ps` sẽ hiện `healthy` khi sẵn sàng

---

### 11.2 Test Accounts (Dev Only)

| Role | Email | Password |
|------|-------|----------|
| Admin | herothaibao99@gmail.com | Admin@123 |
| User | user@minlish.com | User@123 |
| User (unverified) | unverified@minlish.com | User@123 |

---

## 12. Future Considerations

### 12.1 Scalability
- [ ] Redis cache layer
- [ ] Load balancing
- [ ] Database sharding (if needed)

### 12.2 Features
- [ ] Social login (Google, Apple)
- [ ] Gamification (achievements, leaderboard)
- [ ] AI-powered recommendations
- [ ] Offline mode sync

### 12.3 Monitoring
- [ ] APM integration (Sentry, DataDog)
- [ ] Logging infrastructure
- [ ] Health check endpoints

---

## Tài liệu liên quan

Phần quy trình git và hướng dẫn đóng góp đã được tách ra file riêng để tài liệu này chỉ tập trung vào kiến trúc hệ thống:

- 🌿 **Git workflow & branching strategy:** [`./GIT_WORKFLOW.md`](./GIT_WORKFLOW.md)
- 🤝 **Hướng dẫn đóng góp (contributing):** [`../CONTRIBUTING.md`](../CONTRIBUTING.md)

---
Document maintained by **Minlish Team** - **Ho Chi Minh City University of Technology and Engineering Team K23 Information Technology (HCMUTE)**