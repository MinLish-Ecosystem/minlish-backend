# Minlish Backend

**English Learning Platform API** — Node.js · TypeScript · Express · MongoDB

---

## 📝 Giới thiệu

Minlish Backend là hệ thống API phục vụ nền tảng học tiếng Anh Minlish, cung cấp các tính năng quản lý tài khoản, bộ từ vựng, engine ôn tập SRS (SM-2), thống kê học tập, thông báo, quản trị... Dự án hướng tới chuẩn production, bảo mật, mở rộng, dễ bảo trì, tài liệu hóa đầy đủ cho cộng đồng.

**Triết lý:**
- API chuẩn RESTful, response thống nhất, dễ tích hợp đa nền tảng (Web, Mobile)
- Bảo mật JWT, soft delete, audit log, rate limit, helmet, gzip, .env kiểm soát chặt
- Mở rộng module dễ dàng, codebase tách lớp rõ ràng (Routes → Controllers → Services → Models)
- Tài liệu hóa kỹ lưỡng (Swagger, Implementation Plan, Contributing)

---

## 📚 Mục lục

- [Kiến trúc & Công nghệ](#kiến-trúc--công-nghệ)
- [Cài đặt & Cấu hình](#cài-đặt--cấu-hình)
- [Chạy & Phát triển](#chạy--phát-triển)
- [Chuẩn API & Response](#chuẩn-api--response)
- [Các module chính](#các-module-chính)
- [Bảo mật & Production](#bảo-mật--production)
- [Đóng góp & Phát triển](#đóng-góp--phát-triển)
- [Tài liệu & Tham khảo](#tài-liệu--tham-khảo)

---

## 🏗️ Kiến trúc & Công nghệ

- Ngôn ngữ: TypeScript 5, Node.js 20+
- Framework: Express.js
- Database: MongoDB (Atlas/Local), Mongoose ODM
- Auth: JWT (access/refresh), token blacklist, soft ban
- Docs: Swagger (OpenAPI 3.0), markdown, UML
- Khác: Helmet, Compression, Rate Limit, Nodemailer, Cloudinary, Zod, Express-Validator

**Cấu trúc thư mục:**

```text
src/
  app.ts, server.ts         # Khởi tạo app, entrypoint
  config/                   # Kết nối DB, env, mail, swagger
  constants/                # HTTP status, error codes
  controllers/              # Xử lý request, gọi service
  middlewares/              # Auth, validate, error, rate limit
  models/                   # Mongoose schemas (User, Vocab, ...)
  routes/                   # Định nghĩa API endpoint
  services/                 # Logic nghiệp vụ, DB query
  utils/                    # Hàm tiện ích, response, error
  validators/               # Kiểm tra dữ liệu đầu vào
```

---

## ⚙️ Cài đặt & Cấu hình

1. **Clone repo:**
   ```bash
   git clone https://github.com/your-org/minlish-backend.git
   cd minlish-backend
   ```
2. **Cài dependencies:**
   ```bash
   npm install
   ```
3. **Tạo file `.env` từ mẫu:**
   ```bash
   cp .env.example .env
   # Điền các biến: MongoDB, JWT, Mail...
   ```
4. **Cấu hình MongoDB:**
   - Hỗ trợ cả Local (`MONGO_URI_LOCAL`) và Atlas Cloud (`MONGO_URI_ATLAS`)
   - Xem file `.env.example` để biết chi tiết

5. **Kiểm tra cấu hình:**
   - Server sẽ validate biến môi trường khi khởi động (Zod schema)
   - Thiếu biến sẽ báo lỗi rõ ràng

---

## 🚀 Chạy & Phát triển

**Chạy dev:**
```bash
npm run dev
# Mặc định port 3000 (hoặc PORT trong .env)
```

**Build & chạy production:**
```bash
npm run build
npm start
```

**Seed dữ liệu mẫu:**
```bash
npm run seed
```

**Migration dữ liệu cũ:**
```bash
npx ts-node src/scripts/migrate-v3.ts
```

**Kiểm tra API docs:**
- Swagger UI: http://localhost:3000/api-docs
- Raw OpenAPI JSON: http://localhost:3000/api-docs.json

---

## 📦 Chuẩn API & Response

- Base URL: `/api/v1`
- Format thành công:
  ```json
  {
    "success": true,
    "message": "...",
    "data": { "...": "..." }
  }
  ```
- Format lỗi:
  ```json
  {
    "success": false,
    "message": "...",
    "errorCode": "ERR_...",
    "errors": [ ]
  }
  ```
- Pagination:
  ```json
  {
    "success": true,
    "data": {
      "data": [ ],
      "pagination": { "page": 1, "limit": 12, "total": 100, "totalPages": 9 }
    }
  }
  ```
- Error codes: Xem `src/constants/errorCodes.ts`
- Swagger: Mọi endpoint đều có mô tả, ví dụ, response mẫu, security, error

---

## 🧩 Các module chính

### 1. Auth & User
- Đăng ký, đăng nhập, xác thực email, refresh token, logout
- Ban user, soft delete, audit log, đổi email, đổi mật khẩu, profile

### 2. Vocabulary & Learning
- CRUD bộ từ, từ vựng, soft delete, clone, tag, search, filter, public/private
- Engine ôn tập SRS (SM-2), queue học, review, progress, streak, thống kê

### 3. Stats & Analytics
- Dashboard tổng hợp, daily stats, heatmap, mastery distribution, retention

### 4. Notifications
- CRUD thông báo, đánh dấu đã đọc, unread count, FCM token

### 5. Admin
- Quản lý user, ban/unban, xóa, thống kê, audit log, unpublish set

### 6. Sync & Delta
- Đồng bộ dữ liệu offline, chỉ lấy bản ghi mới/đổi (index tối ưu)

---

## 🔒 Bảo mật & Production

- JWT Auth: Access/Refresh token, blacklist, kiểm tra ban, soft delete
- Helmet: Thiết lập HTTP headers bảo mật
- Compression: Nén gzip mọi response lớn
- Rate Limit: Chặn spam, brute-force
- Validation: Kiểm tra dữ liệu đầu vào (Zod, Express-Validator)
- Audit Log: Ghi lại mọi hành động admin nhạy cảm
- .env kiểm soát: Validate chặt, không chạy nếu thiếu biến quan trọng
- Production:
  - Pool kết nối MongoDB tối ưu (maxPoolSize: 50)
  - Có thể chạy cluster mode (PM2), Redis token blacklist (xem implementation_plan.md)
  - Đầy đủ migration, seed, health check, log

---

## 🤝 Đóng góp & Phát triển

**Quy tắc:**
- Đọc kỹ [CONTRIBUTING.md](CONTRIBUTING.md) trước khi commit/push
- Mọi thay đổi lớn phải có issue/task rõ ràng, không để TODO comment trong code
- Code phải tự giải thích, ưu tiên giải thích WHY thay vì WHAT
- Mọi API mới phải có block Swagger JSDoc
- Test kỹ, chạy `npm run build` pass trước khi PR

**Cộng đồng:**
- Chào mừng mọi đóng góp, issue, PR từ cộng đồng!
- Đội ngũ core sẽ review kỹ, ưu tiên chất lượng, bảo mật, maintainability

---

## 📖 Tài liệu & Tham khảo

- [API Design Doc (v3 Final)](MinLish_API_Design_v3_Final.txt)
- [Implementation Plan](implementation_plan.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [Phase0.md (phân tích nền tảng)](Phase0.md)
- [Swagger UI](http://localhost:3000/api-docs)
- [UML Use Case Diagram](uml/UseCaseDiagram.puml)

---

## 🛠️ Vận hành Production

- Build: `npm run build` → output ở `dist/`
- Start: `npm start` (hoặc dùng PM2 cluster)
- Seed: `npm run seed` (tạo tài khoản mẫu, dữ liệu mẫu)
- Migration: `npx ts-node src/scripts/migrate-v3.ts` (chuyển đổi dữ liệu cũ)
- Health check: `GET /` trả về JSON trạng thái
- Log: Ghi log lỗi, audit, truy vết đầy đủ

**Khuyến nghị:**
- Đọc kỹ [implementation_plan.md](implementation_plan.md) để hiểu roadmap, checklist, best practices
- Trước khi deploy production: bật Redis token blacklist, kiểm tra pool DB, test API, seed dữ liệu, kiểm tra log

---

**Minlish Backend — English Learning Platform API**

*Made with ❤️ by Minlish Team & Community*
