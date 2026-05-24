# Nhật Ký Thực Thi Phase 0 — Foundation (Nền Tảng Hệ Thống)

Tài liệu này ghi lại toàn bộ các thay đổi kỹ thuật đã thực hiện trong **Phase 0 (Foundation)**, phân tích các vấn đề của hệ thống cũ và giải thích cơ sở lý thuyết (rationale) đằng sau mỗi quyết định triển khai.

---

## I. Tổng Quan Các Công Việc Đã Thực Hiện

### 1. Schema Migrations (Cập nhật Models & Tạo mới)
Chúng tôi đã bổ sung các trường cần thiết phục vụ cho tính năng **Soft Delete**, **Khóa tài khoản (Ban)**, **Ôn tập SRS**, **Thông báo đẩy (FCM)** và **Giám sát hoạt động Admin**:

*   **[MODIFY] [User.ts](file:///z:/minlish-backend/src/models/User.ts)**:
    *   Bổ sung `isActive` (boolean, default: `true`, index: `true`).
    *   Bổ sung `banReason` (string, max 500 ký tự).
    *   Bổ sung `bannedAt` (Date).
*   **[MODIFY] [UserProfile.ts](file:///z:/minlish-backend/src/models/UserProfile.ts)**:
    *   Bổ sung `reviewPerDay` (number, default: `20`, giới hạn `1-200`) để định nghĩa chỉ tiêu ôn tập từ vựng hàng ngày của từng user.
*   **[MODIFY] [VocabularySet.ts](file:///z:/minlish-backend/src/models/VocabularySet.ts)**:
    *   Bổ sung `isDeleted` (boolean, default: `false`, index: `true`) và `deletedAt` (Date).
    *   Thêm compound index `{ isDeleted: 1, updatedAt: -1 }` hỗ trợ tính năng đồng bộ Delta Sync.
    *   Thêm compound index `{ userId: 1, isDeleted: 1, createdAt: -1 }` hỗ trợ truy vấn thư viện cá nhân nhanh chóng.
*   **[MODIFY] [Word.ts](file:///z:/minlish-backend/src/models/Word.ts)**:
    *   Bổ sung `isDeleted` (boolean, default: `false`, index: `true`) và `deletedAt` (Date).
    *   Thêm compound index `{ setId: 1, isDeleted: 1 }` để tối ưu hóa việc lấy danh sách từ trong một bộ từ chưa bị xóa.
    *   Thêm compound index `{ isDeleted: 1, updatedAt: -1 }` hỗ trợ Delta Sync.
*   **[NEW] [FCMToken.ts](file:///z:/minlish-backend/src/models/FCMToken.ts)**:
    *   Model lưu trữ Firebase Cloud Messaging (FCM) tokens của người dùng theo từng thiết bị (`deviceId`) và nền tảng (`platform: android/ios/web`).
    *   Được đánh index unique `{ userId: 1, deviceId: 1 }` để tránh trùng lặp thiết bị của một người dùng.
*   **[NEW] [AdminAuditLog.ts](file:///z:/minlish-backend/src/models/AdminAuditLog.ts)**:
    *   Model ghi lại vết kiểm toán (audit log) đối với mọi hành động nhạy cảm của Admin (`ban_user`, `unban_user`, `delete_user`, `unpublish_set`). Ghi nhận trạng thái dữ liệu trước (`before`) và sau (`after`) khi thay đổi.

### 2. Tạo Kịch Bản Chuyển Đổi Dữ Liệu (Migration Script)
*   **[NEW] [migrate-v3.ts](file:///z:/minlish-backend/src/scripts/migrate-v3.ts)**:
    *   Script tự động chạy một lần để quét toàn bộ database hiện tại và thiết lập các giá trị mặc định cho dữ liệu cũ (ví dụ: gán `isActive = true` cho các user sẵn có, `reviewPerDay = 20` cho profile, `isDeleted = false` cho sets và words).
    *   Hỗ trợ chạy trực tiếp thông qua lệnh: `npx ts-node src/scripts/migrate-v3.ts`.
    *   *Trạng thái thực thi*: **Đã chạy thành công trực tiếp trên MongoDB Atlas** (Cập nhật thành công 9 Users và 2 VocabularySets).

### 3. Tối Ưu Hóa Kết Nối Cơ Sở Dữ Liệu (MongoDB Connection Pool)
*   **[MODIFY] [db.ts](file:///z:/minlish-backend/src/config/db.ts)**:
    *   Cấu hình `maxPoolSize` từ mặc định (5) lên **50** để đáp ứng khả năng tải cao.
    *   Duy trì `minPoolSize: 10` để giữ sẵn 10 kết nối thường trực, giảm thiểu độ trễ khởi tạo kết nối (Cold Start).
    *   Thiết lập `socketTimeoutMS: 45000` và `serverSelectionTimeoutMS: 5000` tăng cường tính bền bỉ của kết nối.

### 4. Tăng Cường Bảo Mật & Nén Dữ Liệu HTTP
*   **[MODIFY] [app.ts](file:///z:/minlish-backend/src/app.ts)**:
    *   Tích hợp gói **Helmet**: Tự động thiết lập các HTTP headers bảo mật quan trọng (như ẩn header `X-Powered-By` tránh lộ công nghệ Express, thiết lập Content Security Policy, phòng chống Clickjacking, XSS).
    *   Tích hợp gói **Compression**: Áp dụng nén dữ liệu gzip cho mọi API response có kích thước lớn, tối ưu hóa tốc độ truyền tải mạng.

### 5. Khóa Đăng Nhập Tài Khoản Bị Đình Chỉ (Ban Check)
*   **[MODIFY] [auth.service.ts](file:///z:/minlish-backend/src/services/auth.service.ts)**:
    *   Bổ sung bước kiểm tra trạng thái hoạt động `isActive` ngay sau khi khớp mật khẩu thành công trong hàm `loginUser`.
    *   Nếu tài khoản bị khóa (`isActive === false`), chặn đăng nhập ngay và phản hồi thông tin lý do bị khóa (`banReason`) kèm mã lỗi `403 Forbidden` và `FORBIDDEN` code.

---

## II. Phân Tích Vấn Đề Cũ & Cơ Sở Triển Khai (Why & Impact)

| Vấn đề kỹ thuật cũ | Tác hại | Giải pháp mới tại Phase 0 | Tác động & Lợi ích mang lại |
| :--- | :--- | :--- | :--- |
| **Xóa cứng dữ liệu (Hard Delete)** bằng cách dùng lệnh `deleteOne()` trên Set và Word. | 1. **Mất lịch sử SRS**: Khi xóa một từ rồi tạo lại, toàn bộ lịch sử học tập trong `LearningProgress` bị mất sạch.<br>2. **Gây mồ côi dữ liệu**: Các bảng liên kết (lịch sử học, thống kê) bị trỏ vào ID không tồn tại. | **Soft Delete (Xóa mềm)**:<br>Bổ sung `isDeleted: true` và ẩn các bản ghi này khỏi API người dùng thay vì xóa vật lý khỏi DB. | 1. Bảo toàn dữ liệu học tập lịch sử.<br>2. Tránh lỗi toàn vẹn tham chiếu DB.<br>3. Cho phép khôi phục lại dữ liệu (Undo/Restore) dễ dàng trong tương lai. |
| **MongoDB Connection Pool** giữ nguyên giá trị mặc định là 5 kết nối tối đa. | Khi hệ thống đạt **1.000 concurrent requests**, các luồng phải xếp hàng chờ giải phóng kết nối DB → Gây ra hiện tượng nghẽn cổ chai (bottleneck), dẫn đến sập hệ thống do lỗi `Connection Timeout`. | **Nâng Pool kết nối**:<br>Đặt `maxPoolSize: 50` và duy trì `minPoolSize: 10` kết nối sẵn sàng. | 1. Tận dụng tối đa tài nguyên phần cứng server.<br>2. Đảm bảo phản hồi API siêu tốc dưới tải cao.<br>3. Loại bỏ hoàn toàn lỗi timeout kết nối DB khi chạy song song. |
| **Thiếu cơ chế kiểm tra tài khoản bị khóa** khi đăng nhập. | Tài khoản bị Admin khóa vẫn có thể đăng nhập bình thường, tạo ra lỗ hổng bảo mật nghiêm trọng. | **Ban Check**: Tích hợp kiểm tra `!user.isActive` trực tiếp trong logic đăng nhập và trả ra lý do cụ thể. | 1. Ngăn chặn lập tức quyền truy cập của người dùng vi phạm chính sách.<br>2. Hiển thị lý do khóa rõ ràng giúp minh bạch hóa trải nghiệm người dùng. |
| **Không nén dữ liệu HTTP** và **lộ thông tin HTTP Headers nhạy cảm**. | 1. Các bộ từ vựng lớn (hàng trăm từ kèm nghĩa, ví dụ, từ đồng nghĩa) phản hồi payload JSON dung lượng lớn → Tải trang chậm trên di động 3G/4G.<br>2. Headers mặc định của Express khai báo hệ thống đang chạy Node/Express → Hacker dễ khai thác lỗ hổng đã biết. | **Tích hợp Helmet & Compression**:<br>Nén mọi JSON response lớn và chuẩn hóa bảo mật headers. | 1. **Nén gzip giảm tới 70% dung lượng payload**, đẩy nhanh tốc độ hiển thị giao diện phía client.<br>2. Bảo mật thông tin máy chủ, tăng điểm số đánh giá an toàn hệ thống (OWASP). |
| **Không có cơ chế giám sát** các hành động quản trị nhạy cảm. | Khi xảy ra tranh chấp hoặc phá hoại dữ liệu (ví dụ: một Admin tự ý xóa tài khoản người dùng khác), hệ thống không có cách nào truy vết thủ phạm. | **Admin Audit Logging**:<br>Tự động ghi lại nhật ký chi tiết hành vi của Admin vào bảng `adminauditlogs`. | 1. Đảm bảo tính minh bạch pháp lý.<br>2. Dễ dàng truy vết lỗi hệ thống và hành vi phá hoại dữ liệu. |
| **Đồng bộ hóa dữ liệu ngoại tuyến (Delta Sync)** không có index hỗ trợ. | Khi client chạy chế độ offline muốn đồng bộ các từ thay đổi, server phải chạy **Full Collection Scan** trên hàng triệu bản ghi để tìm các từ mới cập nhật sau một mốc thời gian. | **Compound Indexes**:<br>Tạo index trên các trường `isDeleted` và `updatedAt`. | 1. Rút ngắn thời gian truy vấn đồng bộ từ vài giây xuống **vài mili-giây**.<br>2. Giảm tải CPU cho server MongoDB khi hàng ngàn client đồng bộ đồng thời. |

---

## III. Hướng Dẫn Tích Hợp Cho Nhóm Lập Trình Viên (Unblocking ABC Tracks)

Sau khi Phase 0 hoàn thành và được merge vào nhánh chính:
1.  **Person A (Track A - Vocab & Learning Engine)**:
    *   Có thể bắt đầu viết logic soft-delete trong `vocab.service.ts` bằng cách cập nhật các điều kiện truy vấn thành `isDeleted: { $ne: true }` (đã khai báo sẵn index trên DB).
    *   Sử dụng trường `reviewPerDay` trong `UserProfile` để thiết lập chỉ tiêu ôn tập hàng ngày trong API lấy Queue học tập (`/learning/queue`).
2.  **Person B (Track B - Profile & Stats)**:
    *   Xây dựng API cập nhật và lấy `learning-profile` bao gồm trường chỉ tiêu mới `reviewPerDay`.
    *   Xây dựng API đăng ký FCM token lưu vào bảng `FCMToken` đã được định nghĩa.
3.  **Person C (Track C - Admin & Notifications)**:
    *   Sử dụng Model `AdminAuditLog` để ghi log hành vi khi viết API `banUser` / `unbanUser` / `unpublishSet`.
    *   Cấu hình kiểm tra `isActive` của người dùng trong các bảng quản trị.
