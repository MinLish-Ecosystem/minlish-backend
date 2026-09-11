# Build Notes — UC-14 Reading Practice (Backend)

**Ngày build:** 2026-09-10
**Spec nguồn (branch `feature/reading` của `minlish-ba`, đọc qua `git show` — không checkout):**
`docs/backend/uc-14-reading/{SPEC.md, api-spec.md, architecture.md, data-model.md, sequence-diagram.md}` · `docs/ba/uc-14-reading.md` · `docs/ba/minlish-srs.md` (rev 2.7, FR-110..FR-114)
**Branch code:** `feature/reading` (minlish-backend) — nơi docs UC-14 đã được prepare sẵn
**Stack/area:** Express + MongoDB/Mongoose + Redis — module `reading` (flat layout AD-2)

---

## 1. Tóm tắt đã làm

Implement trọn CAP-1..CAP-6 backend UC-14:

| Capability | Endpoint | Trạng thái |
|---|---|---|
| CAP-1 Lấy phiên | `GET /api/v1/skills/reading/session?level=` | ✅ Random tối đa 15 câu, `isDeleted:false`, filter `level`, pool rỗng → 404 `ERR_NO_QUESTIONS_AVAILABLE` |
| CAP-2/3/4 Ba dạng + chấm + điều hướng | client-side | ✅ Server trả đủ `correctAnswer`/`correctMapping`/`explanation` cho FE feedback |
| CAP-5 Finish + ghi lô | `POST /api/v1/skills/reading/submit` | ✅ Server chấm lại theo DB, 1 `PracticeSessionResult` + N `PracticeAttempt` cùng `groupId`, idempotent theo `groupId` + fingerprint |
| CAP-6 Admin CRUD | `/api/v1/admin/skills/reading/questions[...]` | ✅ GET list (page/limit/type/level), POST create, PUT update (type immutable, merge-then-validate), DELETE soft delete; audit bắt buộc |

**Điểm vào đã có sẵn trong repo (scaffolding untracked) và được tái sử dụng:** `ReadingQuestion`, `PracticeAttempt`, `PracticeSessionResult` models + `reading.schema.ts` + error codes UC-14 + `verifyLearner` middleware. Build này hoàn thiện phần còn thiếu: services, controllers, routes, batch writer, audit hook.

---

## 2. File đụng

### File mới (tạo)

| File | Mục đích |
|---|---|
| `src/services/practice-skill.service.ts` | **Owner B′** — `recordBatch()` ghi 1 result + N attempt, `inspectBatch()` đọc trạng thái batch (dedupe/replay), `cleanupGroup()` cleanup đúng group khi fail |
| `src/services/reading.service.ts` | Toàn bộ business rule UC-14: `getSession`, `submitSession` (keep-last, fingerprint, Redis lock, server grading, replay), `adminListQuestions`, `adminCreateQuestion`, `adminUpdateQuestion`, `adminSoftDeleteQuestion` |
| `src/controllers/reading.controller.ts` | 2 controller Learner (thin, `catchAsync` + `sendSuccess`) |
| `src/controllers/reading.admin.controller.ts` | 4 controller Admin CRUD |
| `src/routes/skills-reading.routes.ts` | `GET /session`, `POST /submit` — `verifyToken → verifyLearner → generalLimiter → validateZod(400)` |
| `src/routes/admin-skills-reading.routes.ts` | 4 route CRUD — `verifyToken → requireAdmin → generalLimiter → validateZod(400)` |

### File sửa (existing)

| File | Thay đổi |
|---|---|
| `src/routes/index.ts` | Mount `/admin/skills/reading` **trước** `/admin` (tránh chạy guard admin.routes 2 lần) + mount `/skills/reading` |
| `src/services/admin.service.ts` | Thêm `logAction()` — API ghi `AdminAuditLog` cho module khác (AD-3: owner aggregate là admin.service); import `IAdminAuditLog` |
| `src/validators/reading.schema.ts` | Export DTO types suy từ Zod (`ReadingSubmitDto`, `ReadingSubmitResultDto`, `AdminReadingListQueryDto`) |
| `src/constants/errorCodes.ts` | Thêm `INTERNAL: 'ERR_INTERNAL'` — mã lỗi hệ thống đúng api-spec UC-14 (khác alias `ERR_INTERNAL_ERROR` của handler chung) |
| `src/middlewares/validate.middleware.ts` | `validateZod(schema, statusCode = 422)` — UC-14 truyền 400 để khớp api-spec; giữ 422 mặc định cho các module cũ |

### File xóa
Không.

---

## 3. Áp dụng theo docs BE đã chốt (traceability)

| Nguồn | Cách áp dụng trong code |
|---|---|
| CAP-1 / FR-110 / AC-01,15 | `reading.service.getSession` dùng `$sample` size 15, `$match {isDeleted:false, level?}`, projection bỏ `isDeleted/deletedAt/__v/createdAt/updatedAt` |
| OQ-1 (bỏ topic) | Không có field `topic`/`topicId` ở model, filter, validator |
| OQ-2 (namespace) | `/api/v1/skills/reading/*` + `/api/v1/admin/skills/reading/questions` |
| OQ-3 (không nhận `isCorrect`) | `readingResultSchema` là `.strict()` → client gửi `isCorrect` bị 400; server chấm lại bằng `gradeAnswer()` |
| CAP-3 / BR-03 | MCQ so `correctAnswer`; word-bank: đúng đủ key + mọi value khớp `correctMapping`, sai/thiếu/thừa 1 blank = 0 điểm; `null`/rỗng = sai |
| CAP-5 / BR-05 / AF-04 | Câu chưa làm gửi `selectedAnswer=null, timeSpent=0` → `gradeAnswer` trả 0, `durationMs=0` |
| BR-08 / R7 (idempotent) | Fast-path replay theo `{_id: groupId, userId, fingerprint}` + đủ attempts; Redis `SET NX EX 60` lock; conditional `DEL` bằng Lua script theo `lockToken`; done-marker TTL 24h |
| data-model §Batch Integrity | `getBatchState()` phân loại `absent/complete/incomplete/conflict`; cleanup **chỉ trong lock**; `recordBatch` cleanup khi tạo result xong nhưng attempts fail/thiếu dòng |
| data-model §Redis | Key `minlish:reading:submit:{userId}:{groupId}` (+`:done`) |
| CAP-6 / OQ-5 | `reading.schema.ts` giữ nguyên validation BA đã duyệt (discriminated union, marker `___blank___`/`{{blank_N}}`, options 2..6, word bank = blanks + 2..6 distractors, mapping đủ key…) |
| API-03 (type immutable) | `adminUpdateQuestion` chặn `dto.type !== current.type` → 400; merge partial rồi validate toàn bộ bằng `readingAdminQuestionUnionSchema`; `null` xóa field optional qua `$unset` |
| NFR-019 / audit | Mọi mutation gọi `admin.service.logAction()`; create fail → `findByIdAndDelete` rollback; update/delete fail → restore document cũ |
| NFR-037 soft delete | DELETE chỉ set `isDeleted=true, deletedAt=now`; pool Learner filter `isDeleted:false`; `PracticeAttempt.refId` giữ nguyên (không cascade) |
| AD-4 gating | `verifyLearner` tra DB chặn `isVerified=false` → 403 `ERR_EMAIL_NOT_VERIFIED`, `isActive=false` → 403 `ERR_USER_BANNED`; admin dùng `requireAdmin` |

---

## 4. Cách verify

### 4.1 Đã chạy (kết quả pass)

```powershell
# Typecheck toàn project — PASS (0 lỗi)
npx tsc --noEmit

# Build production — exit 0
npm run build
```

**Verification chức năng (chạy bằng ts-node với model stub — không cần MongoDB/Redis, file tạm đã xóa sau khi chạy):**

1. **Zod contracts (31 check):** happy path + rejection cho cả 3 type câu hỏi theo đúng OQ-5 (sentence 10..500 đúng 1 marker, passage 100..2000, options 2..6, correctAnswer thuộc options, blank liên tiếp 2..6, wordOptions = blanks + 2..6 distractors không trùng, mapping đủ key/value thuộc bank, value lặp hợp lệ, field lạ strict-reject, `explanation ≤ 1000`); submit schema chặn `isCorrect`, `startedAt > completedAt`, ObjectId sai, `timeSpent` âm, > 15 results; update schema giữ `null`.
2. **submitSession (server chấm + idempotent):** keep-last theo `questionId` giữ bản cuối; MCQ so đáp án; word-bank sai 1 blank → cả câu 0 điểm; câu soft-delete vẫn chấm được (bảo toàn lịch sử R8); `averageTimeMs = totalTimeMs/totalQuestions`; retry cùng fingerprint → replay `replayed=true` không ghi thêm attempt; cùng `groupId` khác body → `ERR_GROUP_ID_CONFLICT`; question không tồn tại → `ERR_VALIDATION_FAILED`.
3. **adminUpdateQuestion:** merge giữ field cũ, `$unset` field optional khi `null`, strict reject field không thuộc type, `type` immutable → 400, merge-invalid → 400, audit fail → restore document cũ + `ERR_INTERNAL`, câu không tồn tại → `ERR_QUESTION_NOT_FOUND`.
4. **HTTP integration (22 check, app thật + model stub):** middleware chain thật chạy qua Express — không token → 401 `ERR_TOKEN_MISSING`; `GET session` → 200 envelope `{success,message,data.questions}` đúng shape và không lộ `isDeleted/deletedAt/__v`; `level` sai → **400**; pool rỗng → 404 `ERR_NO_QUESTIONS_AVAILABLE`; submit lần đầu → **201** với `correctCount/incorrectCount/totalQuestions/accuracy/totalTimeMs/averageTimeMs`; retry → **200**; conflict → **409**; learner gọi admin → **403 `ERR_FORBIDDEN`**; admin list/create OK + `limit>50` → 400; audit ghi trước khi trả success.

### 4.2 Cách verify runtime (cần MongoDB + Redis + seed)

```powershell
# 1. Start MongoDB local (đổi MONGO_URI trong .env) + Redis (REDIS_URL)
# 2. Start server
npm run dev

# 3. Seed thủ công vài câu hỏi qua API admin (không seed tự động — data-model §Migration Notes)
#    POST /api/v1/admin/skills/reading/questions với Bearer token admin
#    (có thể dùng body mẫu 3 type — xem §5 test cases)

# 4. Lấy phiên (AC-01/AC-15)
curl -H "Authorization: Bearer <learner_token>" "http://localhost:3001/api/v1/skills/reading/session?level=B1"
#   → 200 { questions: [...≤15], mỗi câu đủ correctAnswer/correctMapping }

# 5. Submit khi Finish (AC-13) — groupId do FE tạo, retry giữ nguyên
curl -X POST -H "Authorization: Bearer <learner_token>" -H "Content-Type: application/json" `
  -d '{"groupId":"<24-hex>","results":[{"questionId":"<id>","selectedAnswer":"a","timeSpent":3000}],
       "startedAt":"2026-09-10T10:00:00.000Z","completedAt":"2026-09-10T10:10:00.000Z"}' `
  http://localhost:3001/api/v1/skills/reading/submit
#   → 201 lần đầu; gọi lại cùng body → 200 (replay); cùng groupId khác body → 409 ERR_GROUP_ID_CONFLICT

# 6. Admin CRUD
curl -H "Authorization: Bearer <admin_token>" "http://localhost:3001/api/v1/admin/skills/reading/questions?page=1&limit=20&type=word-bank-fill"
```

### 4.3 AC mapping (BE scope)

| AC | Verify |
|---|---|
| AC-01, AC-15 | GET session trả ≤15 câu random đúng filter `level`, shape FE `types.ts`, không lộ field nội bộ |
| AC-02..AC-06 | Server chấm lại đúng 3 dạng; word-bank sai 1 blank = sai cả câu (HTTP smoke test) |
| AC-09 | Câu chưa làm `null/0` → tính sai, `durationMs=0` |
| AC-12 | Pool rỗng → 404 `ERR_NO_QUESTIONS_AVAILABLE` |
| AC-13 | Submit ghi 1 result + N attempts cùng `groupId`; trả `correctCount/accuracy` server tính |
| AC-14 | Không có endpoint nào ghi attempt trước Finish (chỉ POST submit) |
| AC-15 (admin) | POST với `level` → phiên filter nhận đúng câu; soft-deleted không vào pool |

---

## 5. Open questions / ghi chú vận hành

1. **Kết quả verify chạy bằng stub — cần smoke test runtime thật một lần** với MongoDB + Redis khi có môi trường. Đặc biệt 2 hành vi chỉ đúng trên hạ tầng thật: (a) Redis lock `SET NX` chống 2 request song song cùng `groupId`; (b) `$sample` của MongoDB cho đúng random pool > 15 câu.
2. **`ERR_SUBMIT_IN_PROGRESS` chỉ xảy ra khi có Redis.** Không có `REDIS_URL` → lock bị skip (`status:'skipped'`), hệ thống vẫn đúng nhờ dedupe Mongo/fingerprint nhưng mất lớp chống request song song. Hành vi này bám data-model §Redis ("Redis lỗi không rollback; Mongo là nguồn replay chính").
3. **Race khi lock bị skip (Redis down):** nếu 2 request cùng user + cùng fingerprint chạy song song, request thua nhận duplicate-key từ `recordBatch` → service re-check state và replay `200` nếu batch đã đủ, chỉ trả `409 ERR_GROUP_ID_CONFLICT` khi thật sự khác fingerprint (đã verify bằng test interleaving). Trường hợp batch của request thắng còn dở dang → trả `409 ERR_SUBMIT_IN_PROGRESS` để FE retry.
4. **`AdminAuditLog.action` đã mở rộng sẵn** với `'READING_Q_CREATE' | 'READING_Q_UPDATE' | 'READING_Q_DELETE'` và `targetType: 'reading_question'` từ scaffolding — build này chỉ dùng, không sửa model.
5. **Không seed tự động** câu hỏi Reading (đúng data-model §Migration Notes) — Admin nhập thủ công qua API. Môi trường dev cần ít nhất 1 câu/level để test session.
6. **`UC-14` SPEC ghi `POST` submit trả `ReadingSubmitResponse`; UC gốc §8 ghi `201 {groupId, correctCount, totalQuestions, accuracy}`.** Build theo api-spec mới hơn: response đầy đủ 7 field, 201 first-write / 200 replay (FE `useReadingSession` cũng bám contract này).
7. **`getSession` không có param `count`** — FE SPEC D-2 đã chốt server cố định tối đa 15; UC cũ có `count?` nhưng đã bị FE SPEC thay thế. Không thêm để tránh mở scope.

---

## 5b. Audit review 2026-09-10 — các fix sau build đầu

Sau khi đối chiếu lại SPEC/api-spec/data-model/FE contract, đã sửa 6 điểm:

| # | Lệch | Fix |
|---|---|---|
| 1 | Route chặn raw `results > 15` trước keep-last (api-spec: "1..15 **sau** khi xử lý duplicate") | Route nới trần phòng thủ (`MAX_RAW_SUBMIT_RESULTS = 100`); service vẫn enforce 1..15 sau `keepLastResults` |
| 2 | Fingerprint nhạy với key order của `selectedAnswer` và format ISO (retry `Z` vs `+07:00` → cùng thời điểm nhưng khác hash → `409` sai) | `canonicalSelectedAnswer()` sort key; timestamp quy về epoch ms; Zod `.datetime({ offset: true })` |
| 3 | Khi lock bị skip do Redis down, race cùng `groupId` trả `409 ERR_GROUP_ID_CONFLICT` kể cả khi batch của chính mình đã ghi xong | Nhánh catch `GROUP_ID_CONFLICT` re-check `inspectBatch`: `complete` → replay `200`; `incomplete` → `409 ERR_SUBMIT_IN_PROGRESS`; chỉ `conflict` mới giữ `409 ERR_GROUP_ID_CONFLICT` |
| 4 | Lock chưa gia hạn khi thao tác lâu (data-model §Redis ghi "TTL 60 giây, gia hạn khi đang xử lý") | Thêm `renewSubmitLock()` (Lua `EXPIRE` có điều kiện theo token) gọi trước bước ghi lô |
| 5 | `reading.service` tự query `PracticeSessionResult`/`PracticeAttempt` để dedupe — vi phạm AD-3 (service sở hữu aggregate là nơi duy nhất gọi Model) | Chuyển toàn bộ logic vào `practice-skill.service.inspectBatch()`; `reading.service` chỉ orchestrate |
| 6 | Formatting `admin.service.ts` (`getAuditLogs` bị nối dòng) | Sửa lại |

**Re-verify sau fix (24 check — pass 24/24):** validator raw 40/101; fingerprint retry khác key order + offset `+07:00` → `200`; đổi đáp án thật → `409`; raw 40 trùng → dedupe còn 2 + keep-last đúng; true race interleaving (request thắng commit trước, request thua nhận duplicate-key) → `200` replay; race khác fingerprint → `409`; AC-06 thiếu blank → `201` + `correctCount=0`; regression session `401/200/400/404`; ownership: `reading.service` không còn import 2 model kết quả.

---

## 6. Deviations so với coding rules

- **Không có deviation.** Tuân thủ: flat layout AD-2, layered MVC (route → controller → service → model), service ownership AD-3 (`reading.service` không ghi trực tiếp `PracticeAttempt`/`PracticeSessionResult`; `AdminAuditLog` chỉ ghi qua `admin.service.logAction`), Zod validation tại route AD-7, envelope AD-8, JSON camelCase, soft delete NFR-037, comment tiếng Việt theo style repo.
- **1 điểm cần lưu ý (không phải vi phạm):** chữ ký `validateZod(schema, statusCode = 422)` được mở rộng thêm tham số optional — mặc định không đổi hành vi các module cũ; UC-14 truyền 400 theo api-spec riêng. Đã ghi trong comment middleware.
