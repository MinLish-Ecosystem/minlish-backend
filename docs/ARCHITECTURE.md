# Minlish API — Architecture Documentation

> **Người viết:** Winston (System Architect) & Mary (Business Analyst)  
> **Ngày:** 2025  
> **Phiên bản:** 1.0.0

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
├── _bmad/                     # BMAD workflow system
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
```env
# Database
MONGO_URI_ATLAS=      # MongoDB Atlas connection string
MONGO_URI_LOCAL=      # Local MongoDB fallback

# Auth
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=

# External Services
CLOUDINARY_URL=
FCM_PROJECT_ID=

# Server
PORT=3000
NODE_ENV=production|development

# Frontend
FRONTEND_URL=         # Comma-separated allowed origins
```

### 10.2 Deployment Platforms
- **Primary:** Render (render.yaml configured)
- **Alternative:** Vercel, Railway, Fly.io

---

## 11. Development Workflow

### 11.1 Scripts
```bash
npm run dev          # Development (ts-node-dev)
npm run build        # Production build
npm start            # Start production
npm run seed         # Seed database with test data
npm run lint         # ESLint
npm run lint:fix     # ESLint auto-fix
```

### 11.2 Test Accounts (Dev Only)
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@minlish.com | Admin@123 |
| User | user@minlish.com | User@123 |

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

## 13. Git Flow & Branching Strategy

> **Nguyên tắc vàng:** 🚫 TUYỆT ĐỐI KHÔNG push trực tiếp lên branch `main`!

### 13.1 Branch Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                         main                                │
│                    (PRODUCTION)                              │
│              Chỉ merge khi release ổn định                 │
│                    🚫 KHÔNG push trực tiếp                  │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │  PR từ develop (release ready)
                              │
┌─────────────────────────────────────────────────────────────┐
│                        develop                               │
│                    (INTEGRATION)                             │
│           Tất cả features merge vào đây                    │
│              Test tích hợp trước khi release               │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │  PR từ feature/*
                              │
┌─────────────────────────────────────────────────────────────┐
│                   feature/{tên-tính-năng}                   │
│                    (TÍNH NĂNG MỚI)                          │
│              Code tính năng cụ thể tại đây                 │
│         Tạo branch TỪ develop, code xong PR vào develop   │
└─────────────────────────────────────────────────────────────┘
```

### 13.2 Branch Types & Naming Convention

| Type | Pattern | Example | Mục đích |
|------|---------|---------|----------|
| **Main** | `main` | `main` | Production — chỉ từ release |
| **Develop** | `develop` | `develop` | Integration — tất cả features |
| **Feature** | `feature/{tên}` | `feature/auth`, `feature/vocab-api` | Tính năng mới |
| **Bugfix** | `bugfix/{tên}` | `bugfix/login-error` | Sửa lỗi |
| **Hotfix** | `hotfix/{tên}` | `hotfix/critical-patch` | Sửa lỗi production gấp |
| **Refactor** | `refactor/{tên}` | `refactor/auth-service` | Cải thiện code |

### 13.3 Quy Trình Làm Việc Chi Tiết

#### Bước 1: Bắt Đầu Tính Năng Mới
```bash
# Luôn luôn bắt đầu từ develop mới nhất
git checkout develop
git pull origin develop

# Tạo feature branch
git checkout -b feature/auth-google-login
```

#### Bước 2: Code Tính Năng
```bash
# Code thoải mái, commit thường xuyên
git add .
git commit -m "feat: add Google OAuth integration"

# Push lên remote (để backup & CI chạy)
git push origin feature/auth-google-login
```

#### Bước 3: Tạo Pull Request
```
┌─────────────────────────────────────────────────────────────┐
│  Pull Request: feature/auth-google-login → develop        │
├─────────────────────────────────────────────────────────────┤
│  ✅ CI/CD pass (lint, test, build)                          │
│  ✅ Review code (ít nhất 1 người approve)                   │
│  ✅ Không có conflict với develop                          │
│  ✅ Documentation updated (Swagger, comments)               │
└─────────────────────────────────────────────────────────────┘
```

#### Bước 4: Merge vào Develop
```bash
# Sau khi PR được approve
git checkout develop
git pull origin develop
git merge feature/auth-google-login
git push origin develop

# Xóa feature branch (đã merge xong)
git branch -d feature/auth-google-login
git push origin --delete feature/auth-google-login
```

### 13.4 Workflow cho Feature Phức Tạp (Nhiều Sub-features)

```
develop ────────────────────────────────────────────
   │
   ├── feature/auth ──────────────────────────────
   │      │
   │      ├── feature/auth/google ───────────────
   │      │      └── PR → feature/auth
   │      │
   │      └── feature/auth/apple ────────────────
   │             └── PR → feature/auth
   │
   └── PR (feature/auth) → develop
```

```bash
# 1. Tạo feature parent branch
git checkout develop
git checkout -b feature/auth

# 2. Tạo sub-feature branches từ feature/auth
git checkout feature/auth
git checkout -b feature/auth/google

# Code xong → PR vào feature/auth
# ...

# 3. Khi feature/auth hoàn chỉnh → PR vào develop
```

### 13.5 Hotfix Workflow (Sửa Lỗi Production Gấp)

```bash
# Hotfix luôn bắt đầu từ main
git checkout main
git pull origin main
git checkout -b hotfix/critical-login-bug

# Code fix gấp
git commit -m "hotfix: fix login session timeout"

# PR trực tiếp vào main (vì là hotfix)
# Sau khi merge main → cherry-pick sang develop
git checkout develop
git cherry-pick <hotfix-commit-hash>
git push origin develop
```

### 13.6 Git Commands Cheatsheet

```bash
# === BRANCH MANAGEMENT ===
git branch                        # Xem danh sách branch
git branch -a                     # Xem tất cả branches (local + remote)
git checkout -b feature/name      # Tạo và switch sang branch mới
git checkout develop              # Chuyển sang develop
git branch -d branch-name         # Xóa local branch (đã merge)
git push origin --delete branch   # Xóa remote branch

# === SYNC & UPDATE ===
git fetch origin                   # Cập nhật remote refs
git pull origin develop            # Pull + merge develop
git rebase origin/develop         # Rebase lên develop mới nhất

# === COMMIT & PUSH ===
git add .                          # Stage all changes
git commit -m "type: description"  # Commit với conventional message
git push origin feature/name       # Push branch lên remote

# === MERGE & PR ===
git merge feature/name             # Merge feature vào branch hiện tại
git log --oneline --graph          # Xem lịch sử merge
```

### 13.7 Commit Message Convention

```
<type>: <mô tả ngắn gọn>

[可选] body: mô tả chi tiết hơn
[可选] footer: thông tin issue, PR
```

**Types:**
| Type | Mô tả | Example |
|------|-------|---------|
| `feat` | Tính năng mới | `feat: add Google OAuth login` |
| `fix` | Sửa lỗi | `fix: resolve login timeout issue` |
| `docs` | Documentation | `docs: update API docs` |
| `style` | Format code | `style: format imports` |
| `refactor` | Cải thiện code | `refactor: simplify auth middleware` |
| `test` | Tests | `test: add auth service tests` |
| `chore` | Config, dependencies | `chore: update dependencies` |

### 13.8 Git Hooks (Pre-commit)

```bash
# Pre-commit hooks đã được cấu hình:
✅ ESLint auto-fix (staged files)
✅ Prettier format (staged files)
✅ Commit message validation

# Commit không pass hooks → không cho commit!
```

### 13.9 Lưu Ý Quan Trọng

> ⚠️ **TUYỆT ĐỐI KHÔNG làm những điều sau:**
> 
> 🚫 `git push origin main` trực tiếp
> 🚫 `git commit` trên `main` hoặc `develop` trực tiếp
> 🚫 Force push lên `main` và `develop`
> 🚫 Merge bằng `--no-ff` khi không cần thiết
> 🚫 Để branch cũ (stale branches) tồn tại quá lâu

> ✅ **LUÔN LUÔN làm:**
> 
> ✅ Rebase `develop` vào branch trước khi tạo PR
> ✅ Viết descriptive commit messages
> ✅ Xóa branch sau khi merge
> ✅ Chạy tests trước khi push
> ✅ Review code của người khác (peer review)

---

## 14. Contributing

1. Tạo feature branch từ `develop`
2. Code và commit theo convention
3. Push và tạo Pull Request vào `develop`
4. Đợi CI/CD pass + review approve
5. Merge vào `develop`
6. Release từ `develop` sang `main`

---

*Document maintained by Winston & Mary — BMAD Workflow System*