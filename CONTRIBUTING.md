# Hướng dẫn tham gia phát triển dự án Minlish Backend (Contributing Guidelines)

Chào mừng các bạn (Nhàn, Minh) tham gia vào dự án Minlish Backend. Để bạn có thể nắm bắt dự án trong 5 phút và bắt tay vào code ngay, hãy đọc kỹ tài liệu này.

---

## 1. Tổng quan Kiến trúc (Architecture Overview)

Dự án sử dụng kiến trúc **3-tier (3 lớp)** chuẩn mực:
`Routes` -> `Controllers` -> `Services` -> `Database (MongoDB)`

### Luồng hoạt động của một Request:
1. **Client** gửi request lên Server (ví dụ: `POST /api/v1/auth/login`).
2. **Rate Limiter**: Chặn nếu request gửi quá nhanh (chống spam).
3. **Validator**: Kiểm tra dữ liệu đầu vào (VD: email có đúng định dạng không, password có đủ dài không). Nếu sai, trả về lỗi `422` ngay lập tức thông qua middleware `validate`.
4. **Auth Middleware** (Tùy chọn): Nếu là Private Route, middleware `verifyToken` sẽ kiểm tra JWT Access Token ở Header.
5. **Controller**: Nhận request, lấy data từ `req.body` hoặc `req.user`, sau đó gọi xuống tầng Service. Controller **KHÔNG** chứa logic nghiệp vụ (không chọc thẳng vào DB).
6. **Service**: Xử lý logic nghiệp vụ (kiểm tra DB, hash password, sinh mã OTP). Trả kết quả về cho Controller. Nếu có lỗi, quăng `AppError`.
7. **Controller (Response)**: Nhận kết quả từ Service, dùng hàm `sendSuccess` để trả về JSON cho Client. 
8. **Error Handler**: Nếu ở bất kỳ bước nào phía trên xảy ra lỗi, middleware `errorHandler` (nằm ở cuối cùng) sẽ tự động chộp lấy và format thành JSON báo lỗi chuẩn mực.

---

## 2. Cấu trúc Thư mục (Directory Structure)

Dự án được cấu trúc theo tính năng/module để dễ dàng quản lý:

```text
src/
├── app.ts                  # File khởi tạo Express, gắn global middlewares
├── server.ts               # Điểm bắt đầu (Entry point), kết nối DB và chạy server
├── config/                 # Các cài đặt cốt lõi (Database, Môi trường, Mailer, Swagger)
├── constants/              # Biến hằng số (HTTP Status Codes, Error Codes)
├── controllers/            # Nhận request và trả response (Auth, User, Password)
├── middlewares/            # Các chốt chặn (Auth, Validate, Rate Limit, Error Handler)
├── models/                 # Mongoose Schemas (User, OTP)
├── routes/                 # Định nghĩa các đường dẫn API (/api/v1/...)
├── services/               # Nơi chứa logic nghiệp vụ (DB Query, Business rules)
├── utils/                  # Hàm tiện ích dùng chung (JWT, AppError, Response Formatter)
└── validators/             # Các bộ quy tắc kiểm tra dữ liệu đầu vào (Zod/Express-Validator)
```

---

## 3. Các cấu hình đang có (Configurations)

- **Biến môi trường (`.env`)**: Được quản lý và kiểm tra chặt chẽ bởi Zod trong file `src/config/env.ts`. Nếu thiếu biến nào trong `.env`, server sẽ báo lỗi và từ chối khởi động. Đừng quên copy file `.env.example` thành `.env` ở máy bạn.
- **Cơ sở dữ liệu (MongoDB)**: File kết nối nằm ở `src/config/db.ts`. Hỗ trợ tự động fallback giữa MongoDB Atlas (Cloud) và MongoDB Local. Bảng `OTP` có gắn TTL Index tự động dọn rác (xóa OTP sau 10 phút) do MongoDB tự quản lý.
- **Authentication**: JWT với Access Token (ngắn hạn) và Refresh Token (dài hạn). Token vô hiệu hóa khi đăng xuất được lưu vào RAM thông qua `src/utils/tokenBlacklist.ts`.
- **Gửi Email**: NodeMailer cấu hình tại `src/config/mailer.ts`. Các mẫu email (HTML templates) nằm trong `src/services/mail.service.ts`.
- **Swagger API Docs**: Giao diện tài liệu API chạy tại `http://localhost:3000/api-docs`.

---

## 4. Nguyên tắc quản lý công việc (Task Management)

- **KHÔNG dùng comment làm TODO**: Tuyệt đối không để lại các comment như `// TODO (Minh): Xử lý phần này` trong source code. Mọi công việc chưa hoàn thành, tính năng cần thêm, hoặc bug cần fix đều phải được tạo thành Issue/Task trên Trello/Jira/Notion của team.
- **Nguyên tắc "Code tự giải thích"**: Chỉ viết comment để giải thích **TẠI SAO (WHY)** bạn lại viết đoạn code đó. KHÔNG giải thích code làm gì (WHAT) nếu tên hàm đã tự nói lên điều đó.
  - ❌ **Không tốt**: `// Lấy user từ database` (Tên hàm `getUserById` đã tự giải thích rồi).
  - ✅ **Tốt**: `// Trả về password vì hàm so sánh bcrypt cần dùng, bình thường password bị ẩn đi`.

---

## 5. Tiêu chuẩn viết Code (Coding Standards)

### 5.1. TypeScript Strict Mode
Dự án đang bật chế độ `"strict": true` trong `tsconfig.json`. Mọi người cần tuân thủ:
- **Không dùng `any`**: Mọi biến, tham số, giá trị trả về đều phải có Interface/Type rõ ràng.
- **Kiểm tra Null/Undefined**: Phải kiểm tra kỹ xem biến có bị undefined hay không trước khi gọi property (ví dụ: dùng `req.user?._id` thay vì `req.user._id` nếu `user` có thể null).

### 5.2. Xử lý Lỗi (Error Handling)
- **Không dùng `try/catch` bừa bãi** trong Controller. Hãy dùng wrapper `catchAsync` bọc ngoài hàm Controller.
- **Khi có lỗi nghiệp vụ**: Quăng lỗi bằng class `AppError` kèm HTTP Status và Error Code rõ ràng.
  ```typescript
  if (!user) {
    throw new AppError('User không tồn tại', HttpStatus.NOT_FOUND, ErrorCodes.USER_NOT_FOUND);
  }
  ```

### 5.3. Trả về kết quả (Response Format)
Luôn dùng hàm `sendSuccess` để trả về JSON cho client một cách thống nhất.
```typescript
import { sendSuccess } from '../utils/response.util';

// Trả về 200 OK kèm data
sendSuccess(res, 'Cập nhật thành công', { data: 123 });
```

### 5.4. API Documentation (Swagger)
- Bất kỳ API Route mới nào cũng **BẮT BUỘC** phải có khối comment `/** @swagger ... */` ở ngay phía trên hàm Controller tương ứng. Frontend sẽ phụ thuộc hoàn toàn vào cấu trúc này để làm việc.
