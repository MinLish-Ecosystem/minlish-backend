# Implementation Plan — Phân công 2 Người (Fullstack)

## Trạng thái Shared Foundation
Đã hoàn thành, không ai cần đụng vào:
- Models (VocabularySet, Word) đã có đầy đủ fields
- Routes, Controllers, Validators, Types đã wired hoàn chỉnh
- Redux vocabSlice đã có đủ thunks
- Pages ExploreAll, ExploreSetDetail đã có UI hoàn chỉnh (đang dùng mock)

---

## Phân tích chức năng Vocabulary có thể kết nối ngay

### Đang dùng mock data — cần kết nối thực:
| Trang / Component | Mock ở đâu | Cần làm |
|---|---|---|
| `Dashboard.tsx` | `sets` từ Redux nhưng API chưa có → fallback mock | Kết nối `GET /vocab/sets` |
| `VocabularySets.tsx` | `displaySets` fallback mock | Kết nối `GET /vocab/sets` + filter |
| `VocabSetDetail.tsx` | `mockWords` hardcode | Kết nối `GET /vocab/sets/:id/words` |
| `ExploreAll.tsx` | `MOCK_PUBLIC_SETS` | Kết nối `GET /vocab/sets/public` |
| `ExploreSetDetail.tsx` | `MOCK_PUBLIC_SET + MOCK_WORDS` | Kết nối `GET /vocab/sets/:id` + words |

### Chức năng nút bấm chưa có logic:
| Nút | Ở đâu | Cần làm |
|---|---|---|
| "Create New Set" | VocabularySets, CreateSetCard | `POST /vocab/sets` |
| "Add Word" | VocabSetDetail | `POST /vocab/sets/:id/words` |
| "Edit Set" | VocabSetDetail | `PUT /vocab/sets/:id` |
| "Add to My Library" (+) | ExploreSetDetail, TrendingSetCard | `POST /vocab/sets/:id/clone` |
| Filter pills (IELTS, Business...) | VocabularySets | dispatch fetchVocabSets với category |
| Search input | VocabularySets | dispatch fetchVocabSets với q |

---

## NGƯỜI A — Luồng "My Library" (Fullstack)

> Phụ trách toàn bộ vòng đời bộ từ của user: tạo, sửa, xem, thêm từ, xóa

### Backend: `src/services/vocab.service.ts`

Implement 7 functions (đã có skeleton + hint):

#### 1. getUserSets
```typescript
const match = buildSetFilter(filters, { userId: new Types.ObjectId(userId) });
const sort  = buildSortOrder(filters.sortBy);
const skip  = (filters.page! - 1) * filters.limit!;

const [rawSets, total] = await Promise.all([
  VocabularySet.find(match).sort(sort).skip(skip).limit(filters.limit!).lean(),
  VocabularySet.countDocuments(match),
]);

return {
  data: rawSets.map(mapSetToResponse),
  pagination: { page: filters.page!, limit: filters.limit!, total, totalPages: Math.ceil(total / filters.limit!) },
};
```

#### 2. createSet
```typescript
const set = await new VocabularySet({ userId: new Types.ObjectId(userId), ...data }).save();
return mapSetToResponse(set.toObject());
```

#### 3. updateSet
```typescript
const set = await VocabularySet.findOneAndUpdate(
  { _id: setId, userId: new Types.ObjectId(userId) },
  { $set: data },
  { new: true }
).lean();
if (!set) throw new AppError("Set not found or unauthorized", 404);
return mapSetToResponse(set);
```

#### 4. deleteSet (cascade)
```typescript
const set = await VocabularySet.findOne({ _id: setId, userId });
if (!set) throw new AppError("Not found", 404);
await Promise.all([
  VocabularySet.deleteOne({ _id: setId }),
  Word.deleteMany({ setId }),
  LearningProgress.deleteMany({ setId }),
]);
```

#### 5. addWord
```typescript
const set = await VocabularySet.findOne({ _id: setId, userId });
if (!set) throw new AppError("Unauthorized", 403);
const word = await new Word({ setId: new Types.ObjectId(setId), ...data }).save();
await VocabularySet.findByIdAndUpdate(setId, { $inc: { totalWords: 1 } });
return mapWordToResponse(word.toObject());
```

#### 6. updateWord
```typescript
const set = await VocabularySet.findOne({ _id: setId, userId });
if (!set) throw new AppError("Unauthorized", 403);
const word = await Word.findOneAndUpdate({ _id: wordId, setId }, { $set: data }, { new: true }).lean();
if (!word) throw new AppError("Word not found", 404);
return mapWordToResponse(word);
```

#### 7. deleteWord
```typescript
const set = await VocabularySet.findOne({ _id: setId, userId });
if (!set) throw new AppError("Unauthorized", 403);
await Promise.all([
  Word.deleteOne({ _id: wordId, setId }),
  LearningProgress.deleteMany({ wordId }),
  VocabularySet.findByIdAndUpdate(setId, { $inc: { totalWords: -1 } }),
]);
```

> Gợi ý: Thêm helper `mapSetToResponse` và `mapWordToResponse` ở đầu file để tái sử dụng.

---

### Frontend: Kết nối My Library

#### VocabularySets.tsx — Kết nối filter thực + search
```tsx
const [q, setQ]               = useState('');
const [activeCategory, setCategory] = useState('');
const { sets, setsLoading }   = useSelector(s => s.vocab);

// Debounce fetch khi filter thay đổi
useEffect(() => {
  dispatch(fetchVocabSets({ q, category: activeCategory || undefined }));
}, [q, activeCategory, dispatch]);

// Render: bỏ displaySets mock fallback, dùng sets trực tiếp
// Thêm empty state khi sets.length === 0
```

Filter pills: Bấm "IELTS" → `setCategory('IELTS')`, bấm "All Sets" → `setCategory('')`

#### VocabSetDetail.tsx — Hiển thị từ thực từ Redux
```tsx
const { setId } = useParams();
const { currentSet, currentSetWords, currentSetLoading } = useSelector(s => s.vocab);

useEffect(() => {
  if (setId) dispatch(fetchSetDetail(setId));
  return () => dispatch(clearCurrentSet()); // Cleanup
}, [setId, dispatch]);

// Thay hardcode "Business English" bằng currentSet?.name
// Thay mockWords bằng currentSetWords
// Map: word.word → term, word.meaning → definition, word.pronunciation → pronunciation
// Map: word.status → WordStatus (capitalize: 'new' → 'New')
```

#### Dashboard.tsx — "View All" và sets hiển thị đúng
- `sets` từ Redux đã kết nối, chỉ cần đảm bảo `fetchVocabSets({})` trả đúng field
- Map `set.totalWords` thay vì `set.words`
- Link "View All" → `navigate('/vocabulary')`

#### Chức năng tạo Set (nút "Create New Set")
Tạo modal đơn giản hoặc dùng inline form:
```tsx
// State
const [showCreate, setShowCreate] = useState(false);
const [form, setForm] = useState({ name: '', category: 'General', level: 'Intermediate' });

// Submit
const handleCreate = async () => {
  await dispatch(createSet(form)).unwrap();
  toast.success('Set created!');
  setShowCreate(false);
};
```

---

## NGƯỜI B — Luồng "Explore & Public" (Fullstack)

> Phụ trách khám phá bộ từ cộng đồng: xem, tìm kiếm, lọc, clone về library

### Backend: `src/services/vocab.service.ts`

Implement 4 functions:

#### 1. getPublicSets
```typescript
const match = buildSetFilter(filters, { isPublic: true });
const sort  = buildSortOrder(filters.sortBy);
const skip  = (filters.page! - 1) * filters.limit!;

const [rawSets, total] = await Promise.all([
  VocabularySet.find(match).sort(sort).skip(skip).limit(filters.limit!).lean(),
  VocabularySet.countDocuments(match),
]);

return {
  data: rawSets.map(mapSetToResponse),
  pagination: { page: filters.page!, limit: filters.limit!, total, totalPages: Math.ceil(total / filters.limit!) },
};
```

#### 2. getSetById
```typescript
const set = await VocabularySet.findById(setId).lean();
if (!set) throw new AppError("Set not found", 404);
if (!set.isPublic && set.userId.toString() !== userId) {
  throw new AppError("Access denied", 403);
}
return mapSetToResponse(set);
```

#### 3. getWords
```typescript
const set = await VocabularySet.findById(setId).lean();
if (!set) throw new AppError("Not found", 404);
if (!set.isPublic && set.userId.toString() !== userId) throw new AppError("Forbidden", 403);

const wordQuery: Record<string, unknown> = { setId: new Types.ObjectId(setId) };
if (q) wordQuery.$text = { $search: q };

const words = await Word.find(wordQuery).lean();

// Join LearningProgress nếu có userId (user đã clone set này)
if (userId) {
  const progress = await LearningProgress.find({
    userId: new Types.ObjectId(userId),
    setId: new Types.ObjectId(setId),
  }).lean();
  const progressMap = Object.fromEntries(progress.map(p => [p.wordId.toString(), p]));
  return words.map(w => ({ ...mapWordToResponse(w), status: progressMap[w._id.toString()]?.status }));
}

return words.map(mapWordToResponse);
```

#### 4. clonePublicSet
```typescript
const sourceSet = await VocabularySet.findById(sourceSetId).lean();
if (!sourceSet || !sourceSet.isPublic) throw new AppError("Public set not found", 404);

// Tạo set mới cho user
const newSet = await new VocabularySet({
  userId: new Types.ObjectId(userId),
  name: sourceSet.name,
  description: sourceSet.description,
  category: sourceSet.category,
  level: sourceSet.level,
  colorTheme: sourceSet.colorTheme,
  tags: sourceSet.tags,
  isPublic: false,
  clonedFrom: sourceSet._id,
}).save();

// Copy toàn bộ Words
const sourceWords = await Word.find({ setId: sourceSet._id }).lean();
if (sourceWords.length > 0) {
  await Word.insertMany(
    sourceWords.map(w => ({ ...w, _id: undefined, setId: newSet._id }))
  );
  await VocabularySet.findByIdAndUpdate(newSet._id, { totalWords: sourceWords.length });
}

// Tăng learnerCount trên source set
await VocabularySet.findByIdAndUpdate(sourceSetId, { $inc: { learnerCount: 1 } });

return mapSetToResponse(newSet.toObject());
```

---

### Frontend: Kết nối Explore

#### ExploreAll.tsx — Thay client-filter bằng Redux
```tsx
const { publicSets, publicSetsLoading, publicSetsPagination } = useSelector(s => s.vocab);

// Dispatch khi filter thay đổi (debounce 300ms với q)
useEffect(() => {
  dispatch(fetchPublicSets({ q, category: category || undefined, level: level || undefined, sortBy }));
}, [q, category, level, sortBy, dispatch]);

// Bỏ MOCK_PUBLIC_SETS, render publicSets
// Thêm Pagination UI dựa vào publicSetsPagination
```

#### ExploreSetDetail.tsx — Kết nối Redux
```tsx
const { currentSet, currentSetWords, currentSetLoading } = useSelector(s => s.vocab);

useEffect(() => {
  if (setId) dispatch(fetchSetDetail(setId));
  return () => dispatch(clearCurrentSet());
}, [setId, dispatch]);

// Nút "Add to Library" thực sự:
const handleClone = async () => {
  setCloning(true);
  try {
    await dispatch(clonePublicSet(setId!)).unwrap();
    toast.success('Added to your library!');
    setCloned(true);
  } catch {
    toast.error('Failed to add set. Try again.');
  } finally {
    setCloning(false);
  }
};
```

#### Explore.tsx — TrendingSetCard navigate + fetch trending
```tsx
// Thêm id cho mỗi TrendingSetCard → onClick={() => navigate(`/explore/${id}`)}

// Fetch trending trên component mount:
useEffect(() => {
  dispatch(fetchPublicSets({ sortBy: 'popular', limit: 4 }));
}, [dispatch]);
// Render từ publicSets thay hardcode
```

---

## Điểm tích hợp giữa 2 Người

> Hai người KHÔNG conflict vì làm trên các function và page khác nhau.
> Chỉ 1 điểm dùng chung: helper `mapSetToResponse` và `mapWordToResponse` trong `vocab.service.ts`.

**Thống nhất ngay từ đầu** — thêm 2 helper này vào đầu file `vocab.service.ts`:

```typescript
function mapSetToResponse(s: any): VocabSetResponse {
  return {
    id:           s._id.toString(),
    name:         s.name,
    description:  s.description,
    category:     s.category,
    level:        s.level,
    colorTheme:   s.colorTheme,
    tags:         s.tags,
    isPublic:     s.isPublic,
    totalWords:   s.totalWords,
    learnerCount: s.learnerCount,
    clonedFrom:   s.clonedFrom?.toString(),
    createdAt:    s.createdAt?.toISOString(),
    updatedAt:    s.updatedAt?.toISOString(),
  };
}

function mapWordToResponse(w: any): WordResponse {
  return {
    id:            w._id.toString(),
    setId:         w.setId.toString(),
    word:          w.word,
    pronunciation: w.pronunciation,
    partOfSpeech:  w.partOfSpeech,
    meaning:       w.meaning,
    descriptionEN: w.descriptionEN,
    examples:      w.examples ?? [],
    synonyms:      w.synonyms ?? [],
    antonyms:      w.antonyms ?? [],
    collocations:  w.collocations ?? [],
    note:          w.note,
    imageUrl:      w.imageUrl,
    audioUrl:      w.audioUrl,
  };
}
```

**Người nào xong trước thì thêm 2 helper này vào, người kia dùng luôn.**

---

## Checklist Ghép Code

- [ ] **Người A xong backend:** Test Postman: `GET /api/v1/vocab/sets`, `POST /vocab/sets`, `POST /vocab/sets/:id/words`
- [ ] **Người B xong backend:** Test Postman: `GET /api/v1/vocab/sets/public?q=ielts`, `POST /vocab/sets/:id/clone`
- [ ] **Người A xong frontend:** My Library hiển thị set thực, filter/search hoạt động
- [ ] **Người B xong frontend:** Explore hiển thị public sets thực, clone flow hoạt động
- [ ] **Tích hợp chéo:** Clone set → xuất hiện trong My Library (Người B clone, Người A render)
- [ ] **Full flow:** Dashboard → My Library → Set Detail → Explore → Clone → Quay lại My Library

---

## API Reference — Người A quản lý

| Method | Endpoint | Người A implement |
|---|---|---|
| GET | /api/v1/vocab/sets | getUserSets |
| POST | /api/v1/vocab/sets | createSet |
| PUT | /api/v1/vocab/sets/:id | updateSet |
| DELETE | /api/v1/vocab/sets/:id | deleteSet |
| POST | /api/v1/vocab/sets/:id/words | addWord |
| PUT | /api/v1/vocab/sets/:id/words/:wordId | updateWord |
| DELETE | /api/v1/vocab/sets/:id/words/:wordId | deleteWord |

## API Reference — Người B quản lý

| Method | Endpoint | Người B implement |
|---|---|---|
| GET | /api/v1/vocab/sets/public | getPublicSets |
| GET | /api/v1/vocab/sets/:id | getSetById |
| GET | /api/v1/vocab/sets/:id/words | getWords |
| POST | /api/v1/vocab/sets/:id/clone | clonePublicSet |
