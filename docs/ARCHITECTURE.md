# Minlish API — Architecture Documentation

> **Người viết:** Minlish Team  
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

## Tài liệu liên quan

Phần quy trình git và hướng dẫn đóng góp đã được tách ra file riêng để tài liệu này chỉ tập trung vào kiến trúc hệ thống:

- 🌿 **Git workflow & branching strategy:** [`./GIT_WORKFLOW.md`](./GIT_WORKFLOW.md)
- 🤝 **Hướng dẫn đóng góp (contributing):** [`../CONTRIBUTING.md`](../CONTRIBUTING.md)

---
Document maintained by **Minlish Team** - **Ho Chi Minh City University of Technology and Engineering Team K23 Information Technology (HCMUTE)**