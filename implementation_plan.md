# Kế Hoạch Implement MinLish Backend — API Design v3 Final

Dựa trên phân tích **MinLish_API_Design_v3_Final.docx** và codebase hiện tại.

> **Tổng quan**: 63 endpoints · ✅ EXISTS: 12 · ⚠️ PARTIAL: 11 · 🆕 NEW: 3 · 🔴 TODO: 37 . Luu y moi endpoint khi cai dat deu viet day du swagger UI

> [!IMPORTANT]
> **Phát hiện thực tế**: `vocab.service.ts` đã implement đầy đủ 11 service functions (không còn `throw new Error`). Vấn đề thực sự là thiếu fields v3 mới (`isDeleted`, `includeProgress`), thiếu module mới (learning, stats, notifications, admin).

---

## ✅ Quyết định đã chốt

| #   | Vấn đề                | Quyết định                                                              |
| --- | --------------------- | ----------------------------------------------------------------------- |
| Q1  | Response format vocab | **Đổi sang `sendSuccess()`** — làm cùng lúc backend + update vocabSlice |
| Q2  | includeProgress query | **Dùng `$lookup` aggregation** — tránh N+1, 1 pipeline duy nhất         |
| Q3  | DELETE response code  | **Đổi sang 200 OK** với body `{success,message,data:null}`              |

---

## 🚀 Phase 0 — Foundation (Bạn làm ngay, một mình)

> [!CAUTION]
> Tất cả 3 người còn lại phải chờ Phase 0 xong mới bắt đầu. Ước tính 2-4 giờ.

### 0.A — Schema Migrations (Models)

#### [MODIFY] [User.ts](file:///z:/minlish-backend/src/models/User.ts) — M-01

```typescript
// Thêm vào UserSchema
isActive:   { type: Boolean, default: true, index: true },
banReason:  { type: String, maxlength: 500 },
bannedAt:   { type: Date },
```

#### [MODIFY] [UserProfile.ts](file:///z:/minlish-backend/src/models/UserProfile.ts) — M-02

```typescript
// Thêm vào UserProfileSchema
reviewPerDay: { type: Number, default: 20, min: 1, max: 200 },
```

#### [MODIFY] [VocabularySet.ts](file:///z:/minlish-backend/src/models/VocabularySet.ts) — M-03 + Performance Index

```typescript
// Thêm fields
isDeleted: { type: Boolean, default: false, index: true },
deletedAt: { type: Date },

// Thêm compound index cho delta sync và query performance
VocabularySetSchema.index({ isDeleted: 1, updatedAt: -1 });  // sync query
VocabularySetSchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });  // my library
```

#### [MODIFY] [Word.ts](file:///z:/minlish-backend/src/models/Word.ts) — M-04 + Performance Index

```typescript
// Thêm fields
isDeleted: { type: Boolean, default: false, index: true },
deletedAt: { type: Date },

// Thêm compound index
WordSchema.index({ setId: 1, isDeleted: 1 });  // query words trong set
WordSchema.index({ isDeleted: 1, updatedAt: -1 });  // sync query
```

#### [NEW] [FCMToken.ts](file:///z:/minlish-backend/src/models/FCMToken.ts) — M-05

```typescript
import mongoose, { Document, Schema, Types } from "mongoose";

export interface IFCMToken extends Document {
  userId: Types.ObjectId;
  token: string;
  deviceId: string;
  platform: "android" | "ios" | "web";
  lastUsedAt: Date;
}

const FCMTokenSchema = new Schema<IFCMToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true },
    deviceId: { type: String, required: true },
    platform: { type: String, enum: ["android", "ios", "web"], required: true },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

FCMTokenSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
FCMTokenSchema.index({ token: 1 });

export const FCMToken = mongoose.model<IFCMToken>("FCMToken", FCMTokenSchema);
```

#### [NEW] [AdminAuditLog.ts](file:///z:/minlish-backend/src/models/AdminAuditLog.ts) — M-06

```typescript
import mongoose, { Document, Schema, Types } from "mongoose";

export interface IAdminAuditLog extends Document {
  adminId: Types.ObjectId;
  action: "ban_user" | "unban_user" | "delete_user" | "unpublish_set";
  targetId: Types.ObjectId;
  targetType: "user" | "set" | "word";
  reason?: string;
  before?: object;
  after?: object;
  createdAt: Date;
}

const AdminAuditLogSchema = new Schema<IAdminAuditLog>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    targetType: { type: String, required: true },
    reason: { type: String },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

AdminAuditLogSchema.index({ adminId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ targetId: 1, targetType: 1 });

export const AdminAuditLog = mongoose.model<IAdminAuditLog>(
  "AdminAuditLog",
  AdminAuditLogSchema,
);
```

### 0.B — Migration Scripts (Chạy 1 lần trên DB)

```javascript
// Chạy trong mongosh hoặc script
db.users.updateMany(
  { isActive: { $exists: false } },
  { $set: { isActive: true } },
);
db.userprofiles.updateMany(
  { reviewPerDay: { $exists: false } },
  { $set: { reviewPerDay: 20 } },
);
db.vocabularysets.updateMany(
  { isDeleted: { $exists: false } },
  { $set: { isDeleted: false } },
);
db.words.updateMany(
  { isDeleted: { $exists: false } },
  { $set: { isDeleted: false } },
);
```

### 0.C — Performance: MongoDB Connection Pool

#### [MODIFY] [db.ts](file:///z:/minlish-backend/src/config/db.ts)

```typescript
// Thay dòng mongoose.connect(mongoUri) thành:
await mongoose.connect(mongoUri, {
  maxPoolSize: 50, // Default là 5 — với 1000 concurrent, 5 là bottleneck chết người
  minPoolSize: 10, // Giữ sẵn 10 connection để tránh cold start
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
});
```

### 0.D — Performance + Security: Helmet & Gzip

#### [MODIFY] [app.ts](file:///z:/minlish-backend/src/app.ts) — C-04

```typescript
import helmet from "helmet";
import compression from "compression";

// Thêm TRƯỚC cors và routes:
app.use(helmet());
app.use(compression());
// npm install helmet compression && npm install -D @types/compression
```

### 0.E — Security Fix: isActive ban check

#### [MODIFY] [auth.service.ts](file:///z:/minlish-backend/src/services/auth.service.ts) — C-01

```typescript
// Trong loginUser(), sau khi verify password (dòng 51), thêm:
if (!user.isActive) {
  throw new AppError(
    user.banReason || "Account has been suspended",
    HttpStatus.FORBIDDEN,
    ErrorCodes.FORBIDDEN,
  );
}
```

### 0.F — Chốt Q1: Response Format Vocab (Chuẩn bị cho Person A)

> [!NOTE]
> Không cần code gì thêm trong Phase 0. Chỉ cần thông báo Person A biết:
>
> - Vocab controller phải dùng `sendSuccess()` từ `response.util.ts`
> - vocabSlice.ts cần update cách đọc response (xem Phase 1-A)

### 0.G — Verify Phase 0 hoàn thành

```bash
npm run build   # phải pass, không có TypeScript error

# Verify DB migration
mongosh --eval "db.users.findOne({},{isActive:1,isVerified:1})"
mongosh --eval "db.vocabularysets.findOne({},{isDeleted:1,name:1})"

# Verify pool config: server start → không còn connection timeout dưới load
```

---

## 👥 Chia 3 Track Song Song (Sau khi Phase 0 xong)

```
Phase 0 ──────────────────────────────────────────────────┐
                                                           ↓ (unblock)
           ┌─── Person A ────────────────────────────────────┐
           │  Phase 1-A: Vocab fixes (1-1.5 ngày)             │
           │  Phase 3-A: Learning Engine (3-4 ngày) ← CORE    │
           │  Phase 6-A: Delta Sync (2 ngày, low priority)     │
           └─────────────────────────────────────────────────┘
           ┌─── Person B ────────────────────────────────────┐
           │  Phase 2-B: User Learning Profile (0.5 ngày)     │
           │  Phase 5-B: FCM Token (0.5 ngày, sau 2-B)        │
           │  Phase 4-B: Stats/Analytics (2 ngày)              │
           └─────────────────────────────────────────────────┘
           ┌─── Person C ────────────────────────────────────┐
           │  Phase 7-C: Admin Module (2 ngày)                 │
           │  Phase 5-C: Notifications CRUD (1 ngày)           │
           └─────────────────────────────────────────────────┘

File conflict: routes/index.ts → 3 người đều cần thêm vào
→ Giải pháp: Mỗi người thêm riêng route của mình, dùng git merge thường xuyên
```

---

## 🔵 Person A — Phase 1: Vocab Module Hoàn Thiện

> **Files chạm tới**: `vocab.types.ts`, `vocab.service.ts`, `vocab.validator.ts`, `vocab.controller.ts`, `vocabSlice.ts` (frontend)
> **Conflict risk**: Thấp (không đụng file của B hoặc C)

### 1-A.1 Cập nhật `vocab.types.ts`

```typescript
// Thêm includeProgress vào VocabSetFilters (Q2 đã chốt)
export interface VocabSetFilters {
  q?: string;
  category?: VocabCategory;
  level?: VocabLevel;
  tags?: string[];
  sortBy?: SortBy;
  page?: number;
  limit?: number;
  includeProgress?: boolean; // NEW — v3
}

// Thêm type progress info
export interface SetProgressInfo {
  masteredCount: number;
  masteredPct: number;
  learningCount: number;
  newCount: number;
  dueToday: number;
  lastStudied?: string;
}

// Thêm progress field vào VocabSetResponse
export interface VocabSetResponse {
  id: string;
  name: string;
  description?: string;
  category: VocabCategory;
  level: VocabLevel;
  colorTheme: ColorTheme;
  tags: string[];
  isPublic: boolean;
  totalWords: number;
  learnerCount: number;
  clonedFrom?: string;
  createdAt: string;
  updatedAt: string;
  progress?: SetProgressInfo; // NEW — only when includeProgress=true
}
```

### 1-A.2 Cập nhật `vocab.validator.ts`

```typescript
// Thêm vào searchQueryValidator array:
query("includeProgress")
  .optional()
  .isBoolean().withMessage("includeProgress must be boolean")
  .toBoolean(),
```

### 1-A.3 Cập nhật `vocab.service.ts` — Toàn bộ thay đổi

**Bảng thay đổi cần làm cho từng function:**

| Function           | Thay đổi                                                                      |
| ------------------ | ----------------------------------------------------------------------------- |
| `getUserSets()`    | isDeleted filter + includeProgress aggregation (xem code bên dưới)            |
| `getPublicSets()`  | Thêm `isDeleted:{$ne:true}` vào match                                         |
| `getSetById()`     | Thêm `isDeleted:{$ne:true}` vào findById condition                            |
| `createSet()`      | Không đổi                                                                     |
| `updateSet()`      | Thêm `isDeleted:{$ne:true}` vào findOneAndUpdate condition                    |
| `deleteSet()`      | **Soft Delete**: `updateOne` thay `deleteOne`; Word cascade dùng `updateMany` |
| `clonePublicSet()` | Thêm `isDeleted:{$ne:true}` check trên sourceSet                              |
| `getWords()`       | Thêm `isDeleted:{$ne:true}` vào Word.find query                               |
| `addWord()`        | Không đổi                                                                     |
| `updateWord()`     | Thêm `isDeleted:{$ne:true}` vào Word.findOneAndUpdate                         |
| `deleteWord()`     | **Soft Delete**: `updateOne` thay `deleteOne`                                 |

**`getUserSets()` với `$lookup` aggregation (Q2 chốt):**

```typescript
export async function getUserSets(userId: string, filters: VocabSetFilters) {
  const { page = 1, limit = 12, includeProgress = false } = filters;
  const skip = (page - 1) * limit;

  const match = buildSetFilter(filters, {
    userId: new Types.ObjectId(userId),
    isDeleted: { $ne: true }, // ← THÊM
  });
  const sort = buildSortOrder(filters.sortBy);

  if (!includeProgress) {
    // Path cũ: nhanh, không JOIN
    const [rawSets, total] = await Promise.all([
      VocabularySet.find(match).sort(sort).skip(skip).limit(limit).lean(),
      VocabularySet.countDocuments(match),
    ]);
    return {
      data: rawSets.map(mapSetToResponse),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Path mới: $lookup aggregation (Q2 — tránh N+1)
  const now = new Date();
  const [setsWithProgress, [countResult]] = await Promise.all([
    VocabularySet.aggregate([
      { $match: match },
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "learningprogresses",
          let: { setId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$setId", "$$setId"] },
                    { $eq: ["$userId", new Types.ObjectId(userId)] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
                dueToday: {
                  $sum: { $cond: [{ $lte: ["$nextReviewDate", now] }, 1, 0] },
                },
                lastStudied: { $max: "$lastReviewDate" },
              },
            },
          ],
          as: "progressRaw",
        },
      },
    ]),
    VocabularySet.aggregate([{ $match: match }, { $count: "total" }]),
  ]);

  const total = countResult?.total ?? 0;

  const data = setsWithProgress.map((set) => {
    const mapped = mapSetToResponse(set);
    const progressByStatus = new Map(
      set.progressRaw.map((p: any) => [p._id, p]),
    );

    const masteredCount = (progressByStatus.get("mastered") as any)?.count ?? 0;
    const learningCount = (progressByStatus.get("learning") as any)?.count ?? 0;
    const reviewCount = (progressByStatus.get("review") as any)?.count ?? 0;
    const newCount =
      set.totalWords - masteredCount - learningCount - reviewCount;
    const dueToday = set.progressRaw.reduce(
      (s: number, p: any) => s + p.dueToday,
      0,
    );
    const lastStudied = set.progressRaw.reduce(
      (latest: Date | null, p: any) =>
        p.lastStudied && (!latest || p.lastStudied > latest)
          ? p.lastStudied
          : latest,
      null,
    );

    mapped.progress = {
      masteredCount,
      masteredPct:
        set.totalWords > 0
          ? Math.round((masteredCount / set.totalWords) * 100)
          : 0,
      learningCount,
      newCount: Math.max(0, newCount),
      dueToday,
      lastStudied: lastStudied?.toISOString(),
    };
    return mapped;
  });

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
```

**`deleteSet()` — Soft Delete:**

```typescript
export async function deleteSet(setId: string, userId: string): Promise<void> {
  const set = await VocabularySet.findOne({
    _id: setId,
    userId: new Types.ObjectId(userId),
    isDeleted: { $ne: true },
  });
  if (!set)
    throw new AppError(
      "Not found",
      HttpStatus.NOT_FOUND,
      ErrorCodes.VALIDATION_FAILED,
    );

  const now = new Date();
  await Promise.all([
    VocabularySet.updateOne(
      { _id: setId },
      { $set: { isDeleted: true, deletedAt: now } },
    ),
    Word.updateMany(
      { setId: new Types.ObjectId(setId) },
      { $set: { isDeleted: true, deletedAt: now } },
    ),
    LearningProgress.deleteMany({ setId: new Types.ObjectId(setId) }),
  ]);
}
```

**`deleteWord()` — Soft Delete:**

```typescript
export async function deleteWord(
  wordId: string,
  setId: string,
  userId: string,
): Promise<void> {
  await ensureOwnedSet(setId, userId);

  const result = await Word.updateOne(
    { _id: wordId, setId: new Types.ObjectId(setId), isDeleted: { $ne: true } },
    { $set: { isDeleted: true, deletedAt: new Date() } },
  );
  if (result.modifiedCount === 0) {
    throw new AppError(
      "Word not found",
      HttpStatus.NOT_FOUND,
      ErrorCodes.VALIDATION_FAILED,
    );
  }

  await Promise.all([
    LearningProgress.deleteMany({ wordId: new Types.ObjectId(wordId) }),
    VocabularySet.findByIdAndUpdate(setId, { $inc: { totalWords: -1 } }),
  ]);
}
```

### 1-A.4 Cập nhật `vocab.controller.ts` — Q1 + Q3

**Q1 — Đổi tất cả response sang `sendSuccess()`:**

```typescript
import { sendSuccess } from "../utils/response.util";

// getUserSetsController:
const result = await vocabService.getUserSets(userId, filters);
return sendSuccess(res, "Sets fetched", result);
// THAY VÌ: res.status(200).json({ status: 'success', ...result })

// getPublicSetsController:
return sendSuccess(res, "Public sets fetched", result);

// getSetDetailController:
return sendSuccess(res, "Set detail", set);

// createSetController:
return sendSuccess(res, "Set created", set, 201);

// updateSetController:
return sendSuccess(res, "Set updated", set);

// clonePublicSetController:
return sendSuccess(res, "Set added to your library", set, 201);

// getWordsController:
return sendSuccess(res, "Words fetched", words);

// addWordController:
return sendSuccess(res, "Word added", word, 201);

// updateWordController:
return sendSuccess(res, "Word updated", word);
```

**Q3 — DELETE controllers trả 200 OK:**

```typescript
// deleteSetController: thay res.status(204).send()
await vocabService.deleteSet(id, userId);
return sendSuccess(res, "Set deleted", null);

// deleteWordController: thay res.status(204).send()
await vocabService.deleteWord(wordId, id, userId);
return sendSuccess(res, "Word deleted", null);
```

### 1-A.5 Update Frontend — `vocabSlice.ts`

> [!IMPORTANT]
> Phải làm cùng lúc với backend. Nếu backend đổi format mà frontend chưa update → app bị trắng.

```typescript
// fetchVocabSets thunk (dòng 126-128 hiện tại):
// TRƯỚC: return response.data  (lấy {data:[], pagination:{}})
// SAU:   return response.data.data  (vì sendSuccess wrap thêm một lớp)

const response = await api.get(`/api/v1/vocab/sets?${params}`);
return response.data.data; // ← thêm .data thứ 2

// fetchPublicSets thunk (dòng 144-146): tương tự
const response = await api.get(`/api/v1/vocab/sets/public?${params}`);
return response.data.data;

// Reducer extraReducers KHÔNG cần đổi vì payload vẫn là {data:[], pagination:{}}
// state.sets = action.payload.data ?? [];  ← vẫn đúng
// state.setsPagination = action.payload.pagination ?? null;  ← vẫn đúng

// fetchSetDetail (dòng 153-158): đã đọc .data.data đúng rồi, KHÔNG ĐỔI
// createSet/clonePublicSet: đọc response.data.data → ĐỔI thành response.data.data (thực ra vẫn như cũ)
// deleteSet: không đọc response body → KHÔNG ĐỔI
```

**Thêm `includeProgress` vào VocabFilters type trong vocabSlice.ts:**

```typescript
export interface VocabFilters {
  // ... hiện tại ...
  includeProgress?: boolean; // NEW
}
```

---

## 🟢 Person B — Phase 2 + 5-FCM + 4: User Profile, Stats

> **Files chạm tới**: `user.service.ts`, `user.controller.ts`, `user.routes.ts`, `user.validator.ts` → sau đó NEW stats files
> **Conflict risk**: Thấp. Chỉ conflict nếu Person A cũng sửa user files (không, Person A chỉ sửa vocab)

### 2-B — User Learning Profile

#### [MODIFY] [user.service.ts](file:///z:/minlish-backend/src/services/user.service.ts)

Thêm 2 functions mới vào cuối file:

```typescript
import { UserProfile } from "../models/UserProfile";

export const getLearningProfile = async (userId: string) => {
  const profile = await UserProfile.findOne({ userId });
  if (!profile) {
    throw new AppError(
      "Learning profile not found",
      HttpStatus.NOT_FOUND,
      ErrorCodes.USER_NOT_FOUND,
    );
  }
  return {
    learningGoal: profile.learningGoal,
    targetLevel: profile.targetLevel,
    currentLevel: profile.currentLevel,
    dailyGoal: profile.dailyGoal,
    reviewPerDay: (profile as any).reviewPerDay ?? 20, // M-02 field
    reminderTime: profile.reminderTime,
    timezone: profile.timezone,
    preferences: {
      pushNotification: profile.preferences.pushNotification,
      soundEffect: profile.preferences.soundEffect,
    },
  };
};

export const updateLearningProfile = async (
  userId: string,
  data: Partial<{
    learningGoal: string;
    targetLevel: string;
    dailyGoal: number;
    reviewPerDay: number;
    reminderTime: string;
    timezone: string;
    preferences: { pushNotification?: boolean; soundEffect?: boolean };
  }>,
) => {
  const profile = await UserProfile.findOneAndUpdate(
    { userId },
    { $set: data },
    { new: true, upsert: true, runValidators: true },
  );
  return {
    learningGoal: profile!.learningGoal,
    targetLevel: profile!.targetLevel,
    dailyGoal: profile!.dailyGoal,
    reviewPerDay: (profile as any).reviewPerDay ?? 20,
    reminderTime: profile!.reminderTime,
    timezone: profile!.timezone,
    preferences: profile!.preferences,
  };
};
```

#### [MODIFY] [user.controller.ts](file:///z:/minlish-backend/src/controllers/user.controller.ts)

Thêm 2 handlers:

```typescript
import {
  getLearningProfile,
  updateLearningProfile,
} from "../services/user.service";

export const getLearningProfileController = catchAsync(
  async (req: Request, res: Response) => {
    const userId = (req.user?._id as string)?.toString();
    if (!userId)
      throw new AppError(
        "Unauthorized",
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
      );
    const profile = await getLearningProfile(userId);
    sendSuccess(res, "Learning profile fetched", profile);
  },
);

export const updateLearningProfileController = catchAsync(
  async (req: Request, res: Response) => {
    const userId = (req.user?._id as string)?.toString();
    if (!userId)
      throw new AppError(
        "Unauthorized",
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
      );
    const profile = await updateLearningProfile(userId, req.body);
    sendSuccess(res, "Learning profile updated", profile);
  },
);
```

#### [MODIFY] [user.validator.ts](file:///z:/minlish-backend/src/validators/user.validator.ts)

```typescript
import { body } from "express-validator";

export const learningProfileValidator = [
  body("learningGoal")
    .optional()
    .isIn(["ielts", "toeic", "business", "travel", "general", "other"])
    .withMessage("Invalid learning goal"),
  body("targetLevel")
    .optional()
    .isIn(["A1", "A2", "B1", "B2", "C1", "C2"])
    .withMessage("Invalid target level"),
  body("dailyGoal")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("dailyGoal must be 1-100"),
  body("reviewPerDay")
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage("reviewPerDay must be 1-200"),
  body("reminderTime")
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage("reminderTime must be HH:mm"),
  body("timezone").optional().isString(),
  body("preferences.pushNotification").optional().isBoolean(),
  body("preferences.soundEffect").optional().isBoolean(),
];
```

#### [MODIFY] [user.routes.ts](file:///z:/minlish-backend/src/routes/user.routes.ts)

```typescript
import {
  getLearningProfileController,
  updateLearningProfileController,
} from "../controllers/user.controller";
import { learningProfileValidator } from "../validators/user.validator";

router.get("/learning-profile", verifyToken, getLearningProfileController);
router.put(
  "/learning-profile",
  verifyToken,
  learningProfileValidator,
  validate,
  updateLearningProfileController,
);
```

### 5-B — FCM Token (làm sau Phase 2-B)

> **Note**: Tiếp tục sửa các file user đã mở, không cần merge lại

#### [MODIFY] [user.service.ts](file:///z:/minlish-backend/src/services/user.service.ts)

```typescript
import { FCMToken } from "../models/FCMToken";

export const registerFCMToken = async (
  userId: string,
  data: {
    token: string;
    deviceId: string;
    platform: "android" | "ios" | "web";
  },
) => {
  await FCMToken.findOneAndUpdate(
    { userId, deviceId: data.deviceId },
    {
      $set: {
        token: data.token,
        platform: data.platform,
        lastUsedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );
};

export const deleteFCMToken = async (userId: string, deviceId: string) => {
  await FCMToken.deleteOne({ userId, deviceId });
};
```

#### [MODIFY] [user.controller.ts](file:///z:/minlish-backend/src/controllers/user.controller.ts)

```typescript
export const registerFCMTokenController = catchAsync(
  async (req: Request, res: Response) => {
    const userId = (req.user?._id as string)?.toString()!;
    const { token, deviceId, platform } = req.body;
    await registerFCMToken(userId, { token, deviceId, platform });
    sendSuccess(res, "Device registered", null);
  },
);

export const deleteFCMTokenController = catchAsync(
  async (req: Request, res: Response) => {
    const userId = (req.user?._id as string)?.toString()!;
    const { deviceId } = req.body;
    await deleteFCMToken(userId, deviceId);
    sendSuccess(res, "Device unregistered", null);
  },
);
```

#### [MODIFY] [user.routes.ts](file:///z:/minlish-backend/src/routes/user.routes.ts)

```typescript
const fcmTokenValidator = [
  body("token").notEmpty().withMessage("FCM token required"),
  body("deviceId").notEmpty().withMessage("deviceId required"),
  body("platform")
    .isIn(["android", "ios", "web"])
    .withMessage("Invalid platform"),
];

router.post(
  "/fcm-token",
  verifyToken,
  fcmTokenValidator,
  validate,
  registerFCMTokenController,
);
router.delete("/fcm-token", verifyToken, deleteFCMTokenController);
```

### 4-B — Stats/Analytics Module

#### [NEW] `src/services/stats.service.ts`

#### [NEW] `src/controllers/stats.controller.ts`

#### [NEW] `src/routes/stats.routes.ts`

#### [MODIFY] [index.ts](file:///z:/minlish-backend/src/routes/index.ts)

```typescript
import statsRoutes from "./stats.routes";
router.use("/stats", statsRoutes);
```

**Endpoints theo thứ tự:**

| Priority | Endpoint                          | Logic chính                                           |
| -------- | --------------------------------- | ----------------------------------------------------- |
| 1        | `GET /stats/dashboard`            | Streak + mastered + accuracy + timeSpent + todayStats |
| 2        | `GET /stats/daily?days=30`        | DailyStats per day, fill zeros ngày trống             |
| 3        | `GET /stats/mastery-distribution` | GROUP BY word level                                   |
| 4        | `GET /stats/heatmap`              | 90 ngày wordsReviewed count                           |
| 5        | `GET /stats/retention`            | correctAnswers/totalAnswers per day                   |

**`stats.service.ts` — dashboard logic:**

```typescript
export async function getDashboardStats(userId: string) {
  const userObjectId = new Types.ObjectId(userId);
  const now = new Date();
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);

  const [masteredCount, totals, recentStats, todayStats, dueCount] =
    await Promise.all([
      LearningProgress.countDocuments({
        userId: userObjectId,
        status: "mastered",
      }),
      DailyStats.aggregate([
        { $match: { userId: userObjectId } },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: "$totalAnswers" },
            correctAnswers: { $sum: "$correctAnswers" },
            timeSpent: { $sum: "$timeSpent" },
            totalNew: { $sum: "$newWordsLearned" },
          },
        },
      ]),
      DailyStats.find({ userId: userObjectId })
        .sort({ date: -1 })
        .limit(400)
        .lean(),
      DailyStats.findOne({
        userId: userObjectId,
        date: { $gte: todayMidnight },
      }).lean(),
      LearningProgress.countDocuments({
        userId: userObjectId,
        status: { $ne: "new" },
        nextReviewDate: { $lte: now },
      }),
    ]);

  // Tính streak
  const { current: currentStreak, longest: longestStreak } =
    calcStreak(recentStats);

  const totalReviews = totals[0]?.totalReviews ?? 0;
  const correctAnswers = totals[0]?.correctAnswers ?? 0;
  const timeSpent = totals[0]?.timeSpent ?? 0;
  const accuracy =
    totalReviews > 0 ? Math.round((correctAnswers / totalReviews) * 100) : 0;

  return {
    streak: { current: currentStreak, longest: longestStreak },
    totalWordsLearned: totals[0]?.totalNew ?? 0,
    masteredWords: masteredCount,
    totalReviews,
    overallAccuracy: accuracy,
    timeSpent: { totalHours: Math.round((timeSpent / 3600) * 10) / 10 },
    currentLevel: estimateLevel(masteredCount, accuracy),
    todayStats: {
      newLearned: todayStats?.newWordsLearned ?? 0,
      reviewed: todayStats?.wordsReviewed ?? 0,
      accuracy:
        todayStats && todayStats.totalAnswers > 0
          ? Math.round(
              (todayStats.correctAnswers / todayStats.totalAnswers) * 100,
            )
          : 0,
      dueCount,
    },
  };
}

function calcStreak(stats: IDailyStats[]) {
  let current = 0,
    longest = 0,
    streak = 0;
  const checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);

  for (const stat of stats) {
    const d = new Date(stat.date);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === checkDate.getTime() && stat.wordsReviewed > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
      longest = Math.max(longest, streak);
    } else if (d < checkDate) break;
  }
  return { current: streak, longest };
}

function estimateLevel(mastered: number, accuracy: number) {
  const brackets = [
    { level: "A1", max: 500 },
    { level: "A2", max: 1500 },
    { level: "B1", max: 3000 },
    { level: "B2", max: 5000 },
    { level: "C1", max: 8000 },
    { level: "C2", max: Infinity },
  ];
  const level = brackets.find((b) => mastered < b.max)?.level ?? "C2";
  return { estimated: level, confidence: Math.min(100, Math.round(accuracy)) };
}
```

---

## 🔴 Person C — Phase 7 + 5-Notif: Admin + Notifications

> **Files chạm tới**: `admin.routes.ts` (rỗng, sửa), NEW admin files, NEW notification files
> **Conflict risk**: Thấp nhất trong 3 người

### 7-C — Admin Module

#### [NEW] `src/middlewares/admin.middleware.ts`

```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { HttpStatus } from "../constants/httpStatus";
import { ErrorCodes } from "../constants/errorCodes";

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.user?.role !== "admin") {
    return next(
      new AppError(
        "Admin access required",
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN,
      ),
    );
  }
  next();
};
```

#### [NEW] `src/services/admin.service.ts`

#### [NEW] `src/controllers/admin.controller.ts`

#### [MODIFY] [admin.routes.ts](file:///z:/minlish-backend/src/routes/admin.routes.ts) — hiện đang rỗng

```typescript
import { Router } from "express";
import { verifyToken } from "../middlewares/auth.middleware";
import { requireAdmin } from "../middlewares/admin.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  listUsersController,
  getUserDetailController,
  banUserController,
  unbanUserController,
  deleteUserController,
  getAdminStatsController,
  listPublicSetsController,
  unpublishSetController,
  getAuditLogsController,
} from "../controllers/admin.controller";
import { body } from "express-validator";

const router = Router();
router.use(verifyToken, requireAdmin); // Tất cả admin routes đều yêu cầu auth + admin role

router.get("/users", listUsersController);
router.get("/users/:id", getUserDetailController);
router.put(
  "/users/:id/ban",
  [body("reason").notEmpty()],
  validate,
  banUserController,
);
router.put("/users/:id/unban", unbanUserController);
router.delete("/users/:id", deleteUserController);
router.get("/stats", getAdminStatsController);
router.get("/sets", listPublicSetsController);
router.put("/sets/:id/unpublish", unpublishSetController);
router.get("/audit-logs", getAuditLogsController);

export default router;
```

**`admin.service.ts` — Ban user logic (quan trọng nhất):**

```typescript
export async function banUser(
  adminId: string,
  targetUserId: string,
  reason: string,
) {
  const target = await User.findById(targetUserId);
  if (!target) throw new AppError("User not found", 404, ErrorCodes.NOT_FOUND);
  if (!target.isActive)
    throw new AppError("User already banned", 409, "ERR_ALREADY_BANNED");
  if (target.role === "admin")
    throw new AppError("Cannot ban admin", 403, ErrorCodes.FORBIDDEN);

  await User.findByIdAndUpdate(targetUserId, {
    $set: {
      isActive: false,
      banReason: reason,
      bannedAt: new Date(),
      refreshToken: null,
    },
  });

  await AdminAuditLog.create({
    adminId,
    action: "ban_user",
    targetId: targetUserId,
    targetType: "user",
    reason,
    after: { isActive: false },
  });
}
```

#### [MODIFY] [routes/index.ts](file:///z:/minlish-backend/src/routes/index.ts)

```typescript
// (đã có) import adminRoutes
// admin routes đã mount ở router.use('/admin', adminRoutes) — không cần thêm
```

### 5-C — Notifications CRUD

#### [NEW] `src/routes/notification.routes.ts`

#### [NEW] `src/controllers/notification.controller.ts`

#### [NEW] `src/services/notification.service.ts`

#### [MODIFY] [routes/index.ts](file:///z:/minlish-backend/src/routes/index.ts)

```typescript
import notificationRoutes from "./notification.routes";
router.use("/notifications", notificationRoutes);
```

**Endpoints:**

```typescript
// notification.routes.ts
router.get("/", verifyToken, getNotificationsController); // paginated
router.get("/unread-count", verifyToken, getUnreadCountController);
router.put("/:id/read", verifyToken, markReadController);
router.put("/read-all", verifyToken, markAllReadController);
router.delete("/:id", verifyToken, deleteNotificationController);
```

**`notification.service.ts` — key functions:**

```typescript
export async function getNotifications(
  userId: string,
  filters: {
    page?: number;
    limit?: number;
    type?: string;
  },
) {
  const { page = 1, limit = 20, type } = filters;
  const query: any = { userId, isDeleted: { $ne: true } };
  if (type) query.type = type;

  const [data, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ ...query, isRead: false }),
  ]);

  return {
    data: data.map(mapNotif),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    unreadCount,
  };
}
```

---

## 🔵 Person A — Phase 3: Learning Engine (sau Phase 1-A)

> [!IMPORTANT]
> Module quan trọng nhất. `LearningProgress` model đã có đủ SM-2 fields. Cần tạo mới hoàn toàn.

### Files cần tạo

#### [NEW] [sm2.ts](file:///z:/minlish-backend/src/utils/sm2.ts) — Viết trước tiên

```typescript
export interface SM2Input {
  easeFactor: number;
  interval: number;
  repetitions: number;
}
export interface SM2Result {
  easeFactor: number;
  interval: number;
  repetitions: number;
  status: "learning" | "review" | "mastered";
  nextReviewDate: Date;
}

export function applyReview(
  progress: SM2Input,
  rating: "again" | "hard" | "good" | "easy",
): SM2Result {
  const q = { again: 0, hard: 2, good: 3, easy: 5 }[rating];

  // 1. Tính EF mới
  let ef = progress.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  ef = Math.max(1.3, ef);

  // 2. Tính interval
  let { repetitions } = progress;
  let interval: number;
  if (q < 3) {
    repetitions = 0;
    interval = 1; // Reset
  } else {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.round(progress.interval * ef);
    interval = Math.min(365, interval);
  }

  // 3. Tính status
  let status: "learning" | "review" | "mastered";
  if (q < 3) status = "learning";
  else if (q === 5 && repetitions >= 5) status = "mastered";
  else if (repetitions >= 3) status = "review";
  else status = "learning";

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  return { easeFactor: ef, interval, repetitions, status, nextReviewDate };
}
```

#### [NEW] `src/types/learning.types.ts`

#### [NEW] `src/services/learning.service.ts`

#### [NEW] `src/controllers/learning.controller.ts`

#### [NEW] `src/routes/learning.routes.ts`

#### [MODIFY] [routes/index.ts](file:///z:/minlish-backend/src/routes/index.ts)

```typescript
import learningRoutes from "./learning.routes";
router.use("/learning", learningRoutes);
```

### Endpoints theo thứ tự implement

| Priority | Endpoint                                   | Method | Mô tả                                   |
| -------- | ------------------------------------------ | ------ | --------------------------------------- |
| 1        | `/learning/due-summary`                    | GET    | Badge count — nhẹ nhất, implement trước |
| 2        | `/learning/queue`                          | GET    | Global queue + previewOnly              |
| 3        | `/learning/words/:wordId/review`           | POST   | SM-2 submit — quan trọng nhất           |
| 4        | `/learning/sets/:id/queue`                 | GET    | Per-set queue                           |
| 5        | `/learning/sets/:id/progress`              | GET    | Progress summary của 1 set              |
| 6        | `/learning/words/:wId/progress`            | GET    | SRS chi tiết 1 từ                       |
| 7        | `/learning/sessions` + `/sessions/:id/end` | POST   | Session tracking (optional)             |
| 8        | `/learning/sync`                           | POST   | Batch offline sync (low priority)       |

### GET /learning/queue — Optimized aggregation (NO $nin)

> [!IMPORTANT]
> **Không dùng `$nin` với array lớn** — sẽ gây full collection scan khi user có >1000 từ đã học.

```typescript
export async function getLearningQueue(
  userId: string,
  opts: {
    timezone?: string;
    previewOnly?: boolean;
  },
) {
  const userObjectId = new Types.ObjectId(userId);
  const now = new Date();
  const profile = await UserProfile.findOne({ userId: userObjectId });
  const dailyGoal = profile?.dailyGoal ?? 10;
  const reviewPerDay = (profile as any)?.reviewPerDay ?? 20;

  // 1. Review cards: có LearningProgress, nextReviewDate <= NOW, status != 'new'
  const reviewProgress = await LearningProgress.find({
    userId: userObjectId,
    status: { $ne: "new" },
    nextReviewDate: { $lte: now },
  })
    .sort({ nextReviewDate: 1 })
    .limit(reviewPerDay)
    .populate<{ wordId: IWord }>("wordId")
    .populate<{ setId: IVocabularySet }>("setId", "name colorTheme")
    .lean();

  // 2. New cards: dùng $lookup thay $nin để tránh full scan
  const userSetIds = await VocabularySet.find({
    userId: userObjectId,
    isDeleted: { $ne: true },
  }).distinct("_id");

  const newWords = await Word.aggregate([
    { $match: { setId: { $in: userSetIds }, isDeleted: { $ne: true } } },
    {
      $lookup: {
        from: "learningprogresses",
        let: { wordId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$wordId", "$$wordId"] },
                  { $eq: ["$userId", userObjectId] },
                ],
              },
            },
          },
        ],
        as: "progress",
      },
    },
    { $match: { progress: { $size: 0 } } }, // Chỉ giữ words chưa có progress
    { $limit: dailyGoal },
  ]);

  if (opts.previewOnly) {
    return {
      newCards: [],
      reviewCards: [],
      summary: {
        newCount: newWords.length,
        reviewCount: reviewProgress.length,
        totalToday: newWords.length + reviewProgress.length,
        estimatedMinutes: Math.ceil(
          newWords.length * 2 + reviewProgress.length * 1.5,
        ),
      },
    };
  }

  // Map set context
  const setMap = new Map(
    (
      await VocabularySet.find({ _id: { $in: userSetIds } })
        .select("name colorTheme")
        .lean()
    ).map((s) => [s._id.toString(), s]),
  );

  const newCards = newWords.map((w) => ({
    id: w._id.toString(),
    word: w.word,
    pronunciation: w.pronunciation,
    partOfSpeech: w.partOfSpeech,
    meaning: w.meaning,
    examples: w.examples ?? [],
    audioUrl: w.audioUrl,
    status: "new",
    setContext: {
      setId: w.setId.toString(),
      setName: setMap.get(w.setId.toString())?.name,
      colorTheme: setMap.get(w.setId.toString())?.colorTheme,
    },
  }));

  const reviewCards = reviewProgress.map((p) => {
    const word = p.wordId as unknown as IWord;
    const set = p.setId as unknown as IVocabularySet;
    return {
      id: word._id.toString(),
      word: word.word,
      meaning: word.meaning,
      status: p.status,
      nextReviewDate: p.nextReviewDate,
      easeFactor: p.easeFactor,
      interval: p.interval,
      setContext: {
        setId: set._id.toString(),
        setName: set.name,
        colorTheme: set.colorTheme,
      },
    };
  });

  return {
    newCards,
    reviewCards,
    summary: {
      newCount: newCards.length,
      reviewCount: reviewCards.length,
      totalToday: newCards.length + reviewCards.length,
      estimatedMinutes: Math.ceil(
        newCards.length * 2 + reviewCards.length * 1.5,
      ),
    },
  };
}
```

### POST /learning/words/:wordId/review

```typescript
export async function submitReview(
  wordId: string,
  userId: string,
  data: {
    setId: string;
    rating: "again" | "hard" | "good" | "easy";
    timeSpent?: number;
    sessionId?: string;
    reviewedAt?: string;
  },
) {
  // 1. Clock skew check
  if (data.reviewedAt) {
    const diff = Math.abs(Date.now() - new Date(data.reviewedAt).getTime());
    if (diff > 30 * 60 * 1000)
      throw new AppError("Clock skew > 30 min", 400, "ERR_CLOCK_SKEW");
  }

  // 2. Verify ownership
  const set = await VocabularySet.findOne({
    _id: data.setId,
    userId,
    isDeleted: { $ne: true },
  });
  if (!set) throw new AppError("Forbidden", 403, ErrorCodes.FORBIDDEN);

  // 3. Upsert LearningProgress
  let progress = await LearningProgress.findOne({ userId, wordId });
  const previousStatus = progress?.status ?? "new";

  const sm2Input = {
    easeFactor: progress?.easeFactor ?? 2.5,
    interval: progress?.interval ?? 0,
    repetitions: progress?.repetitions ?? 0,
  };
  const sm2Result = applyReview(sm2Input, data.rating);
  const isCorrect = ["good", "easy"].includes(data.rating);

  progress = await LearningProgress.findOneAndUpdate(
    { userId, wordId },
    {
      $set: {
        setId: data.setId,
        easeFactor: sm2Result.easeFactor,
        interval: sm2Result.interval,
        repetitions: sm2Result.repetitions,
        status: sm2Result.status,
        nextReviewDate: sm2Result.nextReviewDate,
        lastReviewDate: new Date(),
        lastRating: data.rating,
      },
      $inc: { totalReviews: 1, correctReviews: isCorrect ? 1 : 0 },
    },
    { new: true, upsert: true },
  );

  // 4. Upsert DailyStats
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  await DailyStats.findOneAndUpdate(
    { userId, date: todayMidnight },
    {
      $inc: {
        wordsReviewed: 1,
        correctAnswers: isCorrect ? 1 : 0,
        totalAnswers: 1,
        timeSpent: data.timeSpent ?? 0,
        newWordsLearned: previousStatus === "new" ? 1 : 0,
      },
    },
    { upsert: true },
  );

  return {
    wordId,
    previousStatus,
    newStatus: sm2Result.status,
    easeFactor: sm2Result.easeFactor,
    interval: sm2Result.interval,
    repetitions: sm2Result.repetitions,
    nextReviewDate: sm2Result.nextReviewDate,
    totalReviews: progress!.totalReviews,
    correctReviews: progress!.correctReviews,
  };
}
```

---

## 📦 Phase Extensions — Sau Demo / Trước Production

> [!NOTE]
> Các phần dưới đây KHÔNG cần thiết cho demo. Thực hiện sau khi các tính năng core đã hoạt động.

### EXT-1 — Redis Cache Dashboard Stats (2-3 giờ)

**Khi nào cần**: Khi `/stats/dashboard` bị gọi nhiều lần/phút dưới load thực.

```typescript
// npm install ioredis
import Redis from "ioredis";
const redis = new Redis(process.env.REDIS_URL!);

// Trong getDashboardStats():
const cacheKey = `dashboard:${userId}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const data = await computeDashboardStats(userId);
await redis.set(cacheKey, JSON.stringify(data), "EX", 300); // 5 phút TTL
return data;

// Invalidate khi có review mới (trong submitReview):
await redis.del(`dashboard:${userId}`);
```

### EXT-2 — Redis Token Blacklist (2-3 giờ)

**Khi nào cần**: Trước production deploy, đặc biệt nếu chạy nhiều instance.

```typescript
// Thay toàn bộ src/utils/tokenBlacklist.ts:
import Redis from "ioredis";
import crypto from "crypto";
const redis = new Redis(process.env.REDIS_URL!);

export const addToBlacklist = async (token: string): Promise<void> => {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  const ttl = decoded?.exp
    ? decoded.exp - Math.floor(Date.now() / 1000)
    : 86400;
  if (ttl > 0) {
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    await redis.set(`blacklist:${hash}`, "1", "EX", ttl);
  }
};

export const isBlacklisted = async (token: string): Promise<boolean> => {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return (await redis.exists(`blacklist:${hash}`)) === 1;
};
```

### EXT-3 — PM2 Cluster Mode (1 giờ)

**Khi nào cần**: Khi deploy lên server có nhiều CPU cores.

```bash
# npm install -g pm2
# ecosystem.config.js:
module.exports = {
  apps: [{
    name: 'minlish-api',
    script: 'dist/server.js',
    instances: 'max',   // Dùng tất cả CPU cores
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
    }
  }]
};
# pm2 start ecosystem.config.js --env production
```

> [!WARNING]
> **Cần EXT-2 (Redis blacklist) trước khi dùng EXT-3 (cluster)**. In-memory blacklist không share giữa các worker process → security hole.

### EXT-4 — Bonus Features (LOW Priority)

| Task                 | Endpoint                      | Dependencies                           |
| -------------------- | ----------------------------- | -------------------------------------- |
| Google OAuth         | `POST /auth/google`           | `npm install google-auth-library`      |
| Import CSV           | `POST /vocab/sets/:id/import` | `npm install multer csv-parse`         |
| Export CSV           | `GET /vocab/sets/:id/export`  | `npm install csv-stringify`            |
| FCM Cron Scheduler   | Backend daily_reminder        | `npm install node-cron firebase-admin` |
| DELETE /user/account | GDPR delete                   | Cascade delete tất cả collections      |
| OTP hash SHA-256     | Security hardening            | `crypto.createHash` trong OTP service  |

---

## 📋 Checklist Tổng Hợp

### Phase 0 (Bạn làm ngay)

- [ ] M-01: isActive, banReason, bannedAt → User.ts
- [ ] M-02: reviewPerDay → UserProfile.ts
- [ ] M-03: isDeleted, deletedAt + compound indexes → VocabularySet.ts
- [ ] M-04: isDeleted, deletedAt + compound indexes → Word.ts
- [ ] M-05: Tạo FCMToken.ts
- [ ] M-06: Tạo AdminAuditLog.ts
- [ ] Migration scripts chạy trên DB
- [ ] MongoDB pool size 50 → db.ts
- [ ] Helmet + Gzip → app.ts
- [ ] isActive ban check → auth.service.ts
- [ ] `npm run build` pass

### Person A (bắt đầu sau Phase 0)

- [ ] vocab.types.ts: includeProgress, SetProgressInfo
- [ ] vocab.validator.ts: includeProgress param
- [ ] vocab.service.ts: isDeleted filters, soft delete, $lookup aggregation
- [ ] vocab.controller.ts: sendSuccess() (Q1), 200 OK delete (Q3)
- [ ] vocabSlice.ts: đổi response.data → response.data.data
- [ ] `npm run build` pass → test Postman
- [ ] sm2.ts: applyReview function
- [ ] learning.service.ts: due-summary, queue (aggregation), review, per-set
- [ ] learning.controller.ts + routes.ts
- [ ] routes/index.ts: thêm /learning

### Person B (bắt đầu sau Phase 0)

- [ ] user.service.ts: getLearningProfile, updateLearningProfile, FCM functions
- [ ] user.controller.ts: 4 handlers mới
- [ ] user.validator.ts: learningProfileValidator, fcmTokenValidator
- [ ] user.routes.ts: 4 routes mới
- [ ] stats.service.ts + controller.ts + routes.ts
- [ ] routes/index.ts: thêm /stats
- [ ] `npm run build` pass → test Postman

### Person C (bắt đầu sau Phase 0)

- [ ] admin.middleware.ts: requireAdmin
- [ ] admin.service.ts: listUsers, ban/unban, adminStats
- [ ] admin.controller.ts + admin.routes.ts (đang rỗng)
- [ ] notification.service.ts + controller.ts + routes.ts
- [ ] routes/index.ts: thêm /notifications
- [ ] `npm run build` pass → test Postman

---

## 🔍 Verification Plan

```bash
# Phase 0 done:
mongosh minlish --eval "db.vocabularysets.findOne({},{isDeleted:1,name:1})"
# → phải có isDeleted: false

# Phase 1-A: Soft delete
# DELETE /api/v1/vocab/sets/:id → 200 OK
# mongosh: db.vocabularysets.findOne({_id:...},{isDeleted:1}) → isDeleted:true, record còn đó

# Phase 1-A: includeProgress
# GET /api/v1/vocab/sets?includeProgress=true
# → mỗi set trong data[] phải có field "progress": {masteredCount,dueToday,...}

# Phase 1-A: Response format
# GET /api/v1/vocab/sets → phải có "success":true thay vì "status":"success"

# Phase 3-A: SM-2
# POST /learning/words/:id/review với {rating:"good"} lần 1 → interval:1
# POST /learning/words/:id/review với {rating:"good"} lần 2 → interval:6
# POST /learning/words/:id/review với {rating:"again"}      → repetitions:0

# Phase 4-B: Streak
# DailyStats 5 ngày liên tiếp → streak.current:5
# Bỏ 1 ngày giữa → streak.current:0 (hoặc phần sau nếu hôm nay chưa học)
```
