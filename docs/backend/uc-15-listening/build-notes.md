# Build Notes — UC-15 Listening Practice (BE)

**Ngày build:** 2026-09-11
**Spec nguồn:** `minlish-ba/docs/backend/uc-15-listening/` — SPEC.md, api-spec.md, architecture.md, data-model.md, sequence-diagram.md; UC `docs/ba/uc-15-listening.md`; SRS FR-111
**Branch code:** `feature/listening` (minlish-backend)

---

## 0. Lần rà soát compliance (2026-09-11 lần 2)

Sau lượt kiểm tra đối chiếu `coding-rules.md` + `naming-convention.md` + `ARCHITECTURE-SPINE.md`, sửa 2 khuyếm khuyết:

| # | Vấn đề | Fix | Áp dụng rule |
|---|--------|-----|--------------|
| R1 | Admin CRUD trả raw Mongoose doc (`_id`, `__v`) — lệch contract `ListeningQuestionFull` trong api-spec và vi phạm "không lộ field nội bộ (`__v`)" | Thêm `toAdminQuestionDto` map `_id→id`, `.select('-__v')` ở list; create/update trả DTO đã map | AD-8, api-spec §ListeningQuestionFull, coding §3.4 |
| R2 | `adminUpdateQuestion` chỉ `$set` dto: ① Zod partial không nhìn thấy field cũ trong DB → có thể đổi sang type thiếu dữ liệu bắt buộc; ② đổi `type` để thừa field của type cũ (vd mcq→transcription còn sót `options`) | Service giờ đọc doc hiện tại, enforce field bắt buộc theo type MỚI (gộp dto + existing) và `$unset` field thừa khi đổi type | BR-03, admin CRUD consistency |
| R3 | Controller cast `req.query as any` / `level?: any` | Cast về DTO type của service (`GetSessionQuery`, `AdminListQuery`, `SubmitSessionDto`) | coding-rules §1.6 (TypeScript nghiêm), §9.4 |

Verify tổng sau R1–R3: `tsc --noEmit` sạch, `npm run build` exit 0, `verify-listening.ts` **ALL PASS (45 checks)**.

**Lưu ý môi trường:** container Docker `minlish-app` hiện không lên được do **lỗi baseline có sẵn** — `Cannot find module 'megajs'` ở `voice-ai/mega.service.ts` (không liên quan UC-15, đã có từ trước). Smoke-test runtime cần cài `megajs` hoặc chạy `npm run dev` trên host nơi đã `npm install` đầy đủ. Lệnh verify runtime đã kèm ở §5.2.

---

## 1. Tóm tắt đã làm

Implement BE cho UC-15 Listening Practice theo SPEC + docs BE đã chốt:

| Endpoint | Auth | Đối ứng |
|----------|------|---------|
| `GET /api/v1/skills/listening/session?count=&level=` | `verifyToken` + gate verified/active | CAP-1, API-01, AC-01/AC-14 |
| `POST /api/v1/skills/listening/audio` | `verifyToken` + gate verified/active | CAP-2, API-02, AC-02/AC-08 |
| `POST /api/v1/skills/listening/submit` | `verifyToken` + gate verified/active | CAP-5, API-03, AC-07/AC-11 |
| `GET/POST /api/v1/admin/skills/listening/questions` | `verifyToken` + `requireAdmin` | CAP-6, API-04 |
| `PUT/DELETE /api/v1/admin/skills/listening/questions/:questionId` | `verifyToken` + `requireAdmin` | CAP-6, API-04 (soft delete) |

Nghiệp vụ chính đã cover:
- **Session (CAP-1):** random `$sample` trong pool filter `level`, bỏ `isDeleted`; 10–20 câu (mặc định 10); projection loại `transcript`/`correctAnswer`/`correctOrder`/`explanation` (AC-14); pool rỗng → `404 ERR_NO_QUESTIONS_AVAILABLE` (AF-02).
- **Audio (CAP-2):** trả `transcript` của câu qua kênh riêng để **client tự TTS on-device** (weights UC-13 FR-100/104); câu không tồn tại/soft-deleted → `404 ERR_QUESTION_NOT_FOUND`. Không trả transcript trong session payload.
- **Chấm rule-based (CAP-3):** `scoreByRule` theo BR-04 — `transcription` chuẩn hóa (bỏ hoa/thường, dấu câu, whitespace thừa); `word-order` so mảng đúng thứ tự; `mcq` so optionId. Server luôn chấm lại theo DB khi Finish, không tin client.
- **Submit (CAP-5):** chấm lại theo DB → batch write 1 `PracticeSessionResult` (`COMPLETED`) + N `PracticeAttempt` (`skillType='LISTENING'`, `groupId = PracticeSessionResult._id`); batch fail → **rollback phần ghi dở**; thành công → upsert `DailyStats` (+`listeningSessions` cho streak).
- **Admin CRUD (CAP-6):** list phân trang + filter `type`/`level`; create/update validate field bắt buộc theo type (Zod superRefine + pre-validate hook model); delete là soft delete (`isDeleted=true` + `deletedAt`).

---

## 2. File đụng

### File mới (tạo)

| File | Mục đích |
|------|----------|
| `src/constants/listening.ts` | Hằng số dùng chung: enum 3 dạng câu, CEFR A1–C2, min/max câu phiên (10–20), `LISTENING_SKILL_TYPE`, page defaults |
| `src/models/ListeningQuestion.ts` | Ngân hàng câu hỏi (collection `listeningquestions`); pre-validate hook enforce field bắt buộc theo `type`; index `{type,level,isDeleted}` + `{isDeleted}` |
| `src/models/PracticeSessionResult.ts` | Model dùng chung tổng kết phiên (B′); index `{userId, createdAt:-1}` |
| `src/models/PracticeAttempt.ts` | Model dùng chung attempt; unique `{userId,skillType,refId}` (dedupe AF-07), index `{groupId}`, `{userId,submittedAt:-1}` |
| `src/validators/listening.schema.ts` | Zod: session query, audio body, submit body (chặn questionId trùng), admin list/create/update/param |
| `src/services/listening.service.ts` | Toàn bộ business rule: getSession, getAudio, scoreByRule, submitSession, admin CRUD |
| `src/controllers/listening.controller.ts` | Controller mỏng wrap `catchAsync` + `sendSuccess` (AD-1) |
| `src/routes/listening.routes.ts` | Learner router (default) + `listeningAdminRouter` (named export) |
| `src/scripts/verify-listening.ts` | Script verify schema/index/scoring/Zod in-memory (pattern như `check-db.ts`), không ghi DB |

### File sửa (existing)

| File | Thay đổi |
|------|----------|
| `src/constants/errorCodes.ts` | Thêm `USER_BANNED`, `NO_QUESTIONS_AVAILABLE`, `QUESTION_NOT_FOUND`, `TTS_UNAVAILABLE` |
| `src/middlewares/auth.middleware.ts` | Thêm `requireActiveVerified` — gate `isVerified=false → 403 ERR_EMAIL_NOT_VERIFIED`, `isActive=false → 403 ERR_USER_BANNED` (đọc tươi từ DB mỗi request vì JWT không mang 2 flag này) |
| `src/routes/index.ts` | Mount `/skills/listening` (learner) + `/admin/skills/listening` (admin, mount TRƯỚC `/admin` để không chạy đúp verifyToken+requireAdmin) |
| `src/models/DailyStats.ts` | Thêm field `listeningSessions` (đánh dấu ngày active cho streak) |
| `src/services/stats.service.ts` | `calcStreak.isActiveDay` thêm điều kiện `listeningSessions > 0` |

---

## 3. Quyết định đã chốt với user trong lúc build

1. **TTS (CAP-2/API-02):** user xác nhận *"UC-13 có models rồi, phía client để bên họ gánh"* → synth audio chạy **on-device phía client** (client tải weights qua UC-13 model registry). Do đó:
   - `POST /skills/listening/audio` trả **`{text}` = transcript** của câu (kênh riêng, không nằm trong session payload) để client synth.
   - BE không cài hạ tầng TTS inference nào; không thêm dependency mới.
2. **OQ-1 (groupId/idempotency):** user chọn **"Server sinh groupId"** — `groupId = PracticeSessionResult._id` do server tạo; dedupe retry bằng unique `{userId, skillType, refId}` như data-model/sequence-diagram; không thêm field vào request body.

---

## 4. Deviations so với SPEC/coding-rules (có lý do)

| # | Deviation | Lý do |
|---|-----------|-------|
| D-1 | API-02 trả `{text}` thay vì `{audioStream}` | Theo quyết định user (client TTS on-device). BE không thể tự sinh audio (không có TTS runtime); trả text là cách duy nhất để client synth mà không lộ transcript trong session payload (AC-14 vẫn thỏa). Cần BA cập nhật api-spec.md. |
| D-2 | `ERR_TTS_UNAVAILABLE` chưa bao giờ được trả từ BE | Không có server TTS nên không có lỗi TTS server-side; lỗi phát/replay audio do client tự xử lý (AF-03/AC-08 thuộc FE). errorCode vẫn giữ trong constants để dùng khi có TTS backend. |
| D-3 | Zod validation trả **422** thay vì **400** `ERR_VALIDATION_FAILED` | `validate.middleware.ts` baseline của repo hard-code 422 (UC-13 build note cũng ghi 422). Đổi thành 400 sẽ phá contract của toàn bộ UC hiện có — ngoài scope UC-15. Cần lead chốt đổi global nếu muốn chuẩn 400. |
| D-4 | `ERR_INTERNAL` của repo là `ERR_INTERNAL_ERROR` | Bám errorCodes hiện có của repo; error table UC-15 ghi `ERR_INTERNAL`. FE/test nên bám errorCode repo. |
| D-5 | Thêm `listeningSessions` vào `DailyStats` + mở rộng `calcStreak` | UC-15 post-conditions bắt buộc attempt Listening tính vào **streak**, nhưng data-model UC-15 chỉ `$inc totalAnswers/correctAnswers/timeSpent` — `calcStreak` hiện không đọc các field này nên ngày chỉ-listen không đếm. Làm theo đúng pattern `voiceSessions`/`voiceUtterances` của UC-13. |
| D-6 | Unique `{userId, skillType, refId}` giữ theo data-model | Dedupe AF-07 đúng contract, nhưng hệ quả: 1 câu chỉ được attempt 1 lần/user → **Try Again trùng câu sẽ bị dedupe về kết quả cũ** thay vì ghi phiên mới (xem Open Questions). |

---

## 5. Cách verify

### 5.1 Đã chạy (pass)

```powershell
npx tsc --noEmit                                  # PASS (0 lỗi)
npm run build                                     # PASS (exit 0)
npx ts-node --transpile-only src/scripts/verify-listening.ts
# → ALL PASS (40 checks):
#   - normalizeTranscript (4 case)
#   - scoreByRule 3 dạng (7 case: đúng/sai/sai thứ tự/độ dài lệch)
#   - Index unique {userId,skillType,refId}, index {type,level,isDeleted}
#   - Model pre-validate: mcq/word-order thiếu field bị reject; transcription minimal ok
#   - DailyStats.listeningSessions tồn tại
#   - Zod session query (5 case: count 10..20, level enum, optional)
#   - Zod submit (6 case: hợp lệ, rỗng, questionId trùng, ISO sai, durationMs âm, mảng word-order)
#   - Zod admin create/update (11 case: field bắt buộc theo type, correctAnswer ∈ options, transcript ≤2000, partial update)
```

### 5.2 Verify runtime (cần MongoDB + user/admin token)

```powershell
# 1. Start server
npm run dev

# 2. Tạo câu hỏi (Admin CRUD — CAP-6)
curl -X POST http://localhost:3000/api/v1/admin/skills/listening/questions `
  -H "Authorization: Bearer <admin_token>" -H "Content-Type: application/json" `
  -d '{ "type":"mcq","level":"A1","transcript":"Where is the bus stop?","options":[{"id":"A","text":"At the corner"},{"id":"B","text":"At the bank"}],"correctAnswer":"A","explanation":"Nghe từ bus stop" }'

# 3. Lấy phiên đề (AC-01/AC-14 — response KHÔNG có transcript/correctAnswer/correctOrder/explanation)
curl -H "Authorization: Bearer <user_token>" "http://localhost:3000/api/v1/skills/listening/session?count=10&level=A1"

# 4. Lấy text nguồn cho client TTS (kênh riêng)
curl -X POST http://localhost:3000/api/v1/skills/listening/audio `
  -H "Authorization: Bearer <user_token>" -H "Content-Type: application/json" `
  -d '{ "questionId":"<id từ bước 3>" }'

# 5. Submit phiên (AC-11 — chấm lại theo DB, ghi lô)
curl -X POST http://localhost:3000/api/v1/skills/listening/submit `
  -H "Authorization: Bearer <user_token>" -H "Content-Type: application/json" `
  -d '{ "results":[{"questionId":"<id>","selectedAnswer":"A","durationMs":5300}],"startedAt":"2026-09-11T02:00:00Z","completedAt":"2026-09-11T02:05:00Z" }'
# → 201 { groupId, correctCount, totalQuestions, accuracy }

# 6. Gọi lại submit y hệt (AF-07) → trả lại tổng kết cũ, KHÔNG tạo bản ghi trùng

# 7. AC-13: không token → 401 ERR_TOKEN_MISSING; user chưa verify → 403 ERR_EMAIL_NOT_VERIFIED; user bị ban → 403 ERR_USER_BANNED
# 8. AC-10: DB rỗng câu hỏi → GET session → 404 ERR_NO_QUESTIONS_AVAILABLE
# 9. AC-06/AF-04/AF-05 là hành vi FE (next-lock, fill câu chưa làm, thoát không gửi) — BE chỉ nhận payload tổng hợp
```

---

## 6. Open questions / rủi ro

1. **Unique `{userId, skillType, refId}` vs Try Again (D-6):** contract data-model chốt unique index cho dedupe, nhưng điều đó có nghĩa một câu chỉ được attempt đúng 1 lần cho toàn bộ vòng đời user. Khi user "Try Again" mà `$sample` rơi lại câu cũ, submit sẽ bị dedupe về kết quả phiên cũ thay vì ghi phiên mới. Cần BA chốt lại OQ-1: nếu muốn cho luyện lại, unique index nên đổi thành `{groupId, refId}` + thêm idempotency key từ client, hoặc thêm điều kiện thời gian vào dedupe.
2. **Race window nhỏ trên dedupe:** double-tap gần như đồng thời có thể lọt qua pre-check và dính E11000 → 409. Xác suất thấp; nếu BA muốn tuyệt đối 100% idempotent thì cần client gửi idempotency key (phụ thuộc OQ-1).
3. **count > pool khả dụng:** memlog BA để ngỏ. Hiện chọn: trả số câu có được (≥1), chỉ 404 khi pool rỗng (AF-02). Nếu BA muốn bắt buộc đủ 10 câu thì cần trả lỗi riêng.
4. **Default count khi không truyền:** SPEC không chốt giá trị mặc định (chỉ chốt biên 10–20). Đang dùng 10 (`LISTENING_DEFAULT_QUESTIONS`).
5. **D-1/D-2 cần BA sync api-spec.md** (response `{text}`, bỏ/ghi chú ERR_TTS_UNAVAILABLE) theo quyết định TTS client-side.
6. **D-3 (422 vs 400)** cần lead duyệt nếu muốn chuẩn hóa global.

---

## 7. Traceability nhanh

| AC | Nơi xử lý |
|----|-----------|
| AC-01, AC-14 | `listening.service.getSession` (projection an toàn) |
| AC-02, AC-08 | `getAudio` (kênh riêng) + FE tự TTS/retry (D-1/D-2) |
| AC-03..AC-05 | `scoreByRule` (BR-04) + FE feedback local trước Finish |
| AC-06, AC-07, AC-12 | FE-local; BE chỉ nhận payload tổng hợp khi Finish |
| AC-11 | `submitSession` (chấm lại + batch + rollback + DailyStats) |
| AC-13 | `verifyToken` + `requireActiveVerified` |
| AF-01/AF-02 | error handler + `ERR_NO_QUESTIONS_AVAILABLE` |
| AF-04 | FE điền câu chưa làm `durationMs=0`; BE chấm → sai |
| AF-07 | pre-check attempts + unique `{userId,skillType,refId}` |
