# Build Notes — UC-13 Voice AI (Model Registry Backend)

**Ngày build:** 2026-08-30 (cập nhật 2026-09-01: thêm files[] per component + link Mega thật)
**Spec nguồn:** `docs/backend/uc-13-voice-ai/` (branch `feature/speaking_communication` của `minlish-ba`) — SPEC.md v1.2.0, api-spec.md v1.2.0, architecture.md v1.2.0, data-model.md v1.1.0
**Branch code:** `feature/speaking_communication` (minlish-backend)

---

## 0. Cập nhật 2026-09-01 — Mở rộng files[] per component

**Bối cảnh:** BA gửi link weights Mega thật. STT/TTS dạng ONNX tách **encoder + decoder = 2 file** (BA confirm), trong khi schema cũ chỉ có 1 `megaFileId`/component.

**Thay đổi:**
- `Model.ts`: thêm `components.*.files: [{role, fileName, megaFileId, sizeMB}]` — `role ∈ {model, encoder, decoder, config, tokenizer}`. Giữ field `megaFileId` cũ làm file chính (back-compat). Pre-save hook tính `totalSizeMB` = sum files (nếu có) hoặc sizeMB legacy.
- `voice-ai.service.ts`: `getTierDownload` trả thêm `files[]` per component (`url` build qua `buildMegaLink`, passthrough full URL Mega có `#key`). Field `url` cũ giữ làm legacy (file đầu).
- `seed-models.ts`: ghi link Mega thật — **Light/High đầy đủ**, Ultra TTS + Extreme LLM có link; Medium giữ placeholder (BA chốt để trống); Ultra LLM/STT + Extreme STT/TTS giữ placeholder chờ gửi lại (link trùng key — xem cuối seed file).
- FE đồng bộ: `types.ts` thêm `files[]`, `weightsCache.ts` stream từng file vào Cache Storage theo `fileName`, progress tính gộp per component.
- `mega.util.ts` + env: `VOICE_AI_CDN_URL` base + passthrough full URL — link thật lưu full URL trong DB.

> ⚠️ **Lưu ý spec:** mở rộng `files[]` là **phát sinh từ thực tế weights** (ONNX 2 file) — BA đã xác nhận qua hỏi đáp, chưa cập nhật ngược vào api-spec.md v1.2.0. Cần BA sync contract mới này vào minlish-ba docs.

**Link chờ BA gửi lại (trùng key — không ghi vào DB):**
1. Ultra LLM — link trùng TTS#2 của High (`i943XYyC#MYf5ofh9...`)
2. Ultra STT encoder + decoder — cùng 1 link lặp 2 lần (`yhABHZKS#Zh1ez4Jm...`)
3. Extreme STT — key trùng key Ultra TTS (`WoogQDaQ#mEMit0qq...`)
4. Extreme TTS file chính — key trùng key Ultra STT (`OthVzApJ#Zh1ez4Jm...`)

**→ RESOLVED 2026-09-01 (lần 2):** BA gửi lại link + confirm **model reuse là cố ý** ("mấy con model bị trùng lại" — Mega import giữ nguyên key mã hóa nên link khác fileId nhưng cùng key = cùng file):
- Ultra LLM = link mới `r84xzQaS#vWU2BNiPs9...` ✅
- Ultra STT = `yhABHZKS#Zh1ez4Jm...` (encoder) + `2k5SWZgA#KTZPBOW0...` (decoder) ✅
- Extreme STT = `OthVzApJ#Zh1ez4Jm...` (encoder) + `isoxWRhL#KTZPBOW0...` (decoder) ✅ — cùng weights whisper với Ultra (reuse)
- Extreme TTS = `WoogQDaQ#mEMit0qq...` ✅ — cùng weights piper với Ultra (reuse)
- Ultra vs Extreme giờ **chỉ khác LLM** (8b vs 14b); STT + TTS dùng chung weights theo chủ ý BA.

**Còn placeholder (tính đến 2026-09-01 lần 2):**
- Medium: toàn bộ 3 components (BA chốt để trống)
- Ultra TTS config + Extreme TTS config (file `.onnx.json`) — tạm dùng link khác; có link config thật thì replace `CHANGE_ME_TTS_*_CFG`

---

## 1. Tóm tắt đã làm

Implement **BE = Model Registry** cho UC-13 Voice AI (FR-100..FR-102): catalog tier + link tải weights. Toàn bộ pipeline STT→LLM→TTS + chấm điểm rule-based chạy **on-device** (C-2) — BE KHÔNG xử lý audio, KHÔNG chấm điểm, KHÔNG lưu session.

3 endpoint read được build theo api-spec v1.2.0, namespace `/api/v1/voice-ai/*` (remount từ `/api/v1/models` — C-5):

| Endpoint | Auth | Rate limit | Đối ứng |
|----------|------|-----------|---------|
| `GET /api/v1/voice-ai/models` | Public (đã đăng nhập) | — | CAP-01, AC-01 |
| `GET /api/v1/voice-ai/models/:id` | Public | — | CAP-01 |
| `GET /api/v1/voice-ai/model/download?tier={id}` | `verifyToken` + `downloadLimiter` | **3 req/h/user** (C-15) | CAP-04, AC-03/09/11 |

Catalog response include `systemPrompt` (OQ-11 resolved 2026-08-29) đọc từ `SystemConfig.voiceAiSystemPrompt` (BR-02) — FE dùng mồi cho LLM on-device.

---

## 2. File đụng

### File mới (tạo)

| File | Mục đích |
|------|----------|
| `src/constants/voiceAi.ts` | Hằng `TIER_ORDER` (F9) + `DEFAULT_VOICE_AI_SYSTEM_PROMPT` fallback; type `DifficultyLevel` derive từ đây — một nguồn sự thật duy nhất |
| `src/validators/voice-ai.schema.ts` | Zod: `listTiersQuerySchema`, `getTierParamsSchema`, `downloadQuerySchema` |
| `src/services/voice-ai.service.ts` | `listTiers` (+systemPrompt), `getTier`, `getTierDownload`; sort theo `TIER_ORDER`; `buildMegaLink()` |
| `src/controllers/voice-ai.controller.ts` | 3 controller mỏng wrap `catchAsync` (AD-1) |
| `src/routes/voice-ai.routes.ts` | 3 route + middleware chain (rename từ `models.routes.ts` — F1, F5) |

### File sửa (existing)

| File | Thay đổi |
|------|----------|
| `src/models/Model.ts` | M1: enum `hard`→`high` (type + schema enum, nguồn từ `TIER_ORDER`); M2: interface `megaField`→`megaFileId`; M3: `minRamGb`→`minRamGB`; M4: xóa field `downloadCount`; M5: thêm `format: 'gguf'\|'onnx'` per component (required). Sub-schema dùng factory function tránh Mongoose mutate shared object. Giữ nguyên pre-save auto-sum `totalSizeMB` + 3 indexes |
| `src/models/SystemConfig.ts` | Thêm `voiceAiSystemPrompt: string` (BR-02, OQ-11) với default prompt giáo viên giao tiếp. Admin sửa qua `PUT /api/v1/admin/config` hiện có (UC-11) — KHÔNG tạo endpoint riêng (tránh tách ownership SystemConfig khỏi UC-11) |
| `src/constants/errorCodes.ts` | Thêm `MODEL_NOT_FOUND` (`ERR_MODEL_NOT_FOUND`), `MODEL_UNAVAILABLE` (`ERR_MODEL_UNAVAILABLE`), `DOWNLOAD_RATE_LIMITED` (`ERR_DOWNLOAD_RATE_LIMITED`) |
| `src/middlewares/rateLimiter.ts` | Thêm `downloadLimiter` — 3 req/h, `keyGenerator: req.user?.id` (scope theo user, không IP — user có thể dùng chung NAT) |
| `src/routes/index.ts` | Mount `router.use('/voice-ai', voiceAiRoutes)` |
| `src/scripts/seed-models.ts` | F4: viết lại hoàn toàn — 5 tier × 3 components (stt/llm/tts với `name`, `megaFileId`, `sizeMB`, `format`), requirements tăng dần light→extreme, insert theo `TIER_ORDER`, dùng `create()` (không phải `insertMany`) để pre-save hook tự tính `totalSizeMB` chạy đúng |

### File xóa

| File | Lý do |
|------|-------|
| `src/routes/models.routes.ts` | F1: orphan route (import controller không tồn tại, chưa mount) — đã rename sang `voice-ai.routes.ts` theo namespace C-5 |

> **Lưu ý migration (M1 breaking change):** nếu DB đã seed với `difficultyLevel: 'hard'` thì chạy script một lần update bản ghi cũ `hard` → `high` trước khi deploy. Repo hiện chưa có môi trường seed production nên không kèm migration script — dùng lệnh Mongo shell: `db.voiceaitiers.updateMany({difficultyLevel: 'hard'}, {$set: {difficultyLevel: 'high'}})`.

---

## 3. Áp dụng theo docs BE đã chốt

| Finding/Constraint | Cách áp dụng |
|--------------------|--------------|
| F1 (orphan route) | Rename `models.routes.ts` → `voice-ai.routes.ts`, tạo controller mới, mount `/voice-ai` |
| F2/M1 (enum hard→high) | Type + schema enum lấy từ `TIER_ORDER` trong `src/constants/voiceAi.ts` |
| F3/M2 (megaField typo) | Interface sửa `megaFileId` khớp schema |
| F4 (seed sai schema) | Viết lại seed đúng `VoiceAITier` shape 5×3 |
| F5 (path param → query) | `GET /model/download?tier=` thay `/download/:id` |
| F6/M4 (downloadCount) | Xóa field khỏi interface + schema |
| F7/M5 (format field) | Thêm per component, `enum: ['gguf', 'onnx']`, required |
| F8/M3 (minRamGB casing) | Interface sửa `minRamGB` |
| F9 (sort enum alphabet) | Sort bằng `TIER_ORDER.indexOf()` trong service; KHÔNG dùng `.sort({difficultyLevel: 1})` |
| OQ-11 (systemPrompt) | Include `systemPrompt` trong response `GET /voice-ai/models` |
| C-15 (rate limit) | `downloadLimiter` 3/h/user, key theo `req.user.id` |
| C-2 (registry only) | KHÔNG endpoint evaluate (API-04 đã loại); service chỉ build link từ `megaFileId` |

---

## 4. Cách verify

### 4.1 Đã chạy (kết quả pass)

```powershell
# Typecheck toàn bộ project (fix cả 2 lỗi baseline F1/F4)
npx tsc --noEmit          # → PASS (0 lỗi)

# Build production
npm run build             # → exit 0

# Schema verification (8/8 pass — chạy bằng mongoose in-memory)
#  • M1: enum 'high' hợp lệ; enum 'hard' bị reject
#  • M5: format sai ('pt') bị reject
#  • M4: downloadCount đã xóa khỏi schema paths
#  • M2: components.stt.megaFileId tồn tại
#  • M3: requirements.minRamGB tồn tại
#  • Pre-save hook: totalSizeMB auto-sum đúng (100+400+50=550)
#  • F9: sort TIER_ORDER cho ra light→extreme (không alphabet)
```

### 4.2 Cách verify runtime (cần MongoDB + seed)

```powershell
# 1. Start MongoDB local + set MONGO_URI_LOCAL trong .env

# 2. Seed 5 tiers (nhớ thay megaFileId placeholder trước production!)
npx ts-node --transpile-only src/scripts/seed-models.ts

# 3. Start server
npm run dev

# 4. Test catalog (AC-01 — trả 5 tier sorted light→extreme + systemPrompt)
curl http://localhost:5000/api/v1/voice-ai/models

# 5. Test download (cần Bearer token; test 4 lần liên tiếp → lần 4 nhận 429)
curl -H "Authorization: Bearer <access_token>" "http://localhost:5000/api/v1/voice-ai/model/download?tier=<tierId>"

# 6. Test tier không tồn tại (→ 404 ERR_MODEL_NOT_FOUND)
curl http://localhost:5000/api/v1/voice-ai/models/000000000000000000000000

# 7. Test validation sai format id (→ 422 ERR_VALIDATION_FAILED)
curl "http://localhost:5000/api/v1/voice-ai/models/abc"
```

### 4.3 AC mapping (BE scope)

| AC | Verify |
|----|--------|
| AC-01 | GET /models → 200, 5 tiers sorted `light→extreme`, mỗi tier 3 components + size + format + status; `systemPrompt` có trong response |
| AC-03/AC-09 | GET /model/download?tier= → 200, `downloads.{stt,llm,tts}.{url,format}` + `totalSizeMB` |
| Rate limit | GET /model/download 4 lần/giờ → 429 `ERR_DOWNLOAD_RATE_LIMITED` |
| AF-08 | Seed tier với `status: 'deprecated'` → GET download → 409 `ERR_MODEL_UNAVAILABLE` |

---

## 5. Open questions / out of scope

1. **OQ-12 (OPEN — không build theo lệnh "gap → hỏi, không tự mở rộng"):** Admin PATCH `/voice-ai/models/:id` (đổi `status`, up-version `megaFileId`/`sizeMB`/`format`) đã được api-spec §2.5 + data-model §4.1 đề xuất nhưng **chờ BA chốt ownership UC-13 vs UC-11**. Hiện admin chưa có cách vận hành catalog ngoài chạy lại seed — cần BA quyết trước khi build.
2. **megaFileId placeholder:** Seed dùng `CHANGE_ME_*` placeholder — cần thay bằng Mega file ID thật (nội dung weights không thuộc scope BE).
3. **`voiceAiSystemPrompt` chưa expose qua admin schema validation:** `PUT /admin/config` hiện dùng `config.set(req.body)` không có Zod whitelist — field mới tự được chấp nhận nhưng **không có validation giới hạn length**. Nếu cần chặt, thêm vào `admin.schema.ts` (thuộc UC-11 scope).
4. **Test tự động (Jest/Vitest):** Repo chưa có test framework + test script trong package.json — schema verification ở trên chạy bằng script in-memory. Nếu thêm framework test thì tạo `voice-ai.controller.spec.ts` theo architecture §11.

---

## 6. Deviations so với coding rules

- **Không có deviation.** Tuân thủ flat layout (AD-2), layered MVC 4 tầng (AD-3 ownership: chỉ `voice-ai.service` đọc `VoiceAITier`), Zod validation tại route (AD-7), response envelope `{success, message, data, errorCode}` (AD-8), camelCase JSON, kebab-case file names. Comment tiếng Việt theo style hiện có của repo.
