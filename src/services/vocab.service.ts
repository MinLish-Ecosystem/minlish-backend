import { Types } from "mongoose";
import { VocabularySet } from "../models/VocabularySet";
import { Word } from "../models/Word";
import { LearningProgress } from "../models/LearningProgress";
import { AppError } from "../utils/AppError";
import { HttpStatus } from "../constants/httpStatus";
import { ErrorCodes } from "../constants/errorCodes";
import {
  VocabSetFilters,
  CreateSetDTO,
  AddWordDTO,
  VocabSetResponse,
  WordResponse,
  PaginatedResponse,
} from "../types/vocab.types";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Xây dựng MongoDB filter object từ query params đầu vào.
 * Hỗ trợ full-text search ($text) + multi-condition filter.
 */
function buildSetFilter(filters: VocabSetFilters, extraMatch: Record<string, unknown> = {}) {
  const match: Record<string, unknown> = { ...extraMatch };

  // Full-text search trên name, description, tags (dùng text index)
  if (filters.q) {
    match.$text = { $search: filters.q };
  }

  if (filters.category) match.category = filters.category;
  if (filters.level)    match.level    = filters.level;

  // Tags: lọc set có chứa ÍT NHẤT 1 trong các tags được yêu cầu
  if (filters.tags && filters.tags.length > 0) {
    match.tags = { $in: filters.tags };
  }

  return match;
}

/**
 * Xây dựng sort object từ sortBy param.
 */
function buildSortOrder(sortBy?: string): Record<string, 1 | -1> {
  switch (sortBy) {
    case "popular":      return { learnerCount: -1 };
    case "alphabetical": return { name: 1 };
    case "oldest":       return { createdAt: 1 };
    case "newest":
    default:             return { createdAt: -1 };
  }
}

function mapSetToResponse(s: any): VocabSetResponse {
  return {
    id: s._id.toString(),
    name: s.name,
    description: s.description,
    category: s.category,
    level: s.level,
    colorTheme: s.colorTheme,
    tags: s.tags ?? [],
    isPublic: Boolean(s.isPublic),
    totalWords: s.totalWords ?? 0,
    learnerCount: s.learnerCount ?? 0,
    clonedFrom: s.clonedFrom ? s.clonedFrom.toString() : undefined,
    createdAt: new Date(s.createdAt).toISOString(),
    updatedAt: new Date(s.updatedAt).toISOString(),
  };
}

function mapWordToResponse(w: any): WordResponse {
  return {
    id: w._id.toString(),
    setId: w.setId.toString(),
    word: w.word,
    pronunciation: w.pronunciation,
    partOfSpeech: w.partOfSpeech,
    meaning: w.meaning,
    descriptionEN: w.descriptionEN,
    examples: w.examples ?? [],
    synonyms: w.synonyms ?? [],
    antonyms: w.antonyms ?? [],
    collocations: w.collocations ?? [],
    note: w.note,
    imageUrl: w.imageUrl,
    audioUrl: w.audioUrl,
  };
}

function calcMasteryPct(progress?: { status: string; totalReviews: number; correctReviews: number }) {
  if (!progress) return undefined;

  if (progress.totalReviews > 0) {
    return Math.max(0, Math.min(100, Math.round((progress.correctReviews / progress.totalReviews) * 100)));
  }

  switch (progress.status) {
    case "learning":
      return 25;
    case "review":
      return 75;
    case "mastered":
      return 100;
    case "new":
    default:
      return 0;
  }
}

async function ensureOwnedSet(setId: string, userId: string) {
  const set = await VocabularySet.findOne({
    _id: setId,
    userId: new Types.ObjectId(userId),
    isDeleted: { $ne: true },
  });
  if (!set) {
    throw new AppError("Set not found or unauthorized", HttpStatus.NOT_FOUND, ErrorCodes.FORBIDDEN);
  }

  return set;
}

// ─── Vocabulary Set Services ─────────────────────────────────────────────────

/**
 * Lấy danh sách bộ từ của user hiện tại (My Library).
 * Hỗ trợ search + filter + sort + pagination.
 *
 * TODO (Người 1): Implement body của function này
 */
export async function getUserSets(
  userId: string,
  filters: VocabSetFilters,
): Promise<PaginatedResponse<VocabSetResponse>> {
  const { page = 1, limit = 12, includeProgress = false } = filters;
  const skip = (page - 1) * limit;
  const match = buildSetFilter(filters, {
    userId: new Types.ObjectId(userId),
    isDeleted: { $ne: true },
  });
  const sort = buildSortOrder(filters.sortBy);

  if (!includeProgress) {
    const [rawSets, total] = await Promise.all([
      VocabularySet.find(match).sort(sort).skip(skip).limit(limit).lean(),
      VocabularySet.countDocuments(match),
    ]);

    return {
      data: rawSets.map(mapSetToResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Tải tiến trình học thông qua $lookup aggregation tối ưu
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
                dueToday: { $sum: { $cond: [{ $lte: ["$nextReviewDate", now] }, 1, 0] } },
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
    const progressByStatus = new Map(set.progressRaw.map((p: any) => [p._id, p]));

    const masteredCount = (progressByStatus.get("mastered") as any)?.count ?? 0;
    const learningCount = (progressByStatus.get("learning") as any)?.count ?? 0;
    const reviewCount = (progressByStatus.get("review") as any)?.count ?? 0;
    const newCount = set.totalWords - masteredCount - learningCount - reviewCount;
    const dueToday = set.progressRaw.reduce((sum: number, p: any) => sum + p.dueToday, 0);

    const lastStudiedDate = set.progressRaw.reduce(
      (latest: Date | null, p: any) =>
        p.lastStudied && (!latest || p.lastStudied > latest) ? p.lastStudied : latest,
      null,
    );

    mapped.progress = {
      masteredCount,
      masteredPct: set.totalWords > 0 ? Math.round((masteredCount / set.totalWords) * 100) : 0,
      learningCount,
      newCount: Math.max(0, newCount),
      dueToday,
      lastStudied: lastStudiedDate ? lastStudiedDate.toISOString() : undefined,
    };

    return mapped;
  });

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Lấy danh sách public sets cho trang Explore.
 * Chỉ trả về sets có isPublic: true.
 *
 * TODO (Người 1): Implement body của function này
 */
export async function getPublicSets(
  filters: VocabSetFilters,
): Promise<PaginatedResponse<VocabSetResponse>> {
  const { page = 1, limit = 12 } = filters;
  const skip = (page - 1) * limit;
  const match = buildSetFilter(filters, { isPublic: true, isDeleted: { $ne: true } });
  const sort  = buildSortOrder(filters.sortBy);

  const [rawSets, total] = await Promise.all([
    VocabularySet.find(match).sort(sort).skip(skip).limit(limit).lean(),
    VocabularySet.countDocuments(match),
  ]);

  return {
    data: rawSets.map(mapSetToResponse),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Lấy chi tiết một bộ từ theo ID.
 * Kiểm tra: set phải là của userId hoặc phải isPublic.
 *
 * TODO (Người 1): Implement body của function này
 */
export async function getSetById(
  setId: string,
  userId?: string,
): Promise<VocabSetResponse> {
  if (!Types.ObjectId.isValid(setId)) {
    throw new AppError("Set not found", HttpStatus.NOT_FOUND, ErrorCodes.VALIDATION_FAILED);
  }

  const set = await VocabularySet.findOne({ _id: setId, isDeleted: { $ne: true } }).lean();

  if (!set) {
    throw new AppError("Set not found", HttpStatus.NOT_FOUND, ErrorCodes.VALIDATION_FAILED);
  }

  const isOwner = Boolean(userId) && set.userId.toString() === userId;
  if (!set.isPublic && !isOwner) {
    throw new AppError("Access denied", HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
  }

  return mapSetToResponse(set);
}

/**
 * Tạo bộ từ vựng mới cho user.
 *
 * TODO (Người 1): Implement body của function này
 */
export async function createSet(
  userId: string,
  data: CreateSetDTO,
): Promise<VocabSetResponse> {
  const set = await new VocabularySet({
    userId: new Types.ObjectId(userId),
    ...data,
  }).save();

  return mapSetToResponse(set.toObject());
}

/**
 * Cập nhật thông tin bộ từ.
 * Chỉ chủ sở hữu mới được sửa.
 *
 * TODO (Người 1): Implement body của function này
 */
export async function updateSet(
  setId: string,
  userId: string,
  data: Partial<CreateSetDTO>,
): Promise<VocabSetResponse> {
  const set = await VocabularySet.findOneAndUpdate(
    { _id: setId, userId: new Types.ObjectId(userId), isDeleted: { $ne: true } },
    { $set: data },
    { new: true },
  ).lean();

  if (!set) {
    throw new AppError("Set not found or unauthorized", HttpStatus.NOT_FOUND, ErrorCodes.FORBIDDEN);
  }

  return mapSetToResponse(set);
}

/**
 * Xóa bộ từ và toàn bộ dữ liệu liên quan (cascade).
 * Xóa: VocabularySet + tất cả Word + tất cả LearningProgress thuộc set này.
 *
 * TODO (Người 1): Implement body của function này
 */
export async function deleteSet(setId: string, userId: string): Promise<void> {
  const set = await VocabularySet.findOne({
    _id: setId,
    userId: new Types.ObjectId(userId),
    isDeleted: { $ne: true },
  }).lean();

  if (!set) {
    throw new AppError("Not found", HttpStatus.NOT_FOUND, ErrorCodes.VALIDATION_FAILED);
  }

  const now = new Date();
  await Promise.all([
    VocabularySet.updateOne({ _id: setId }, { $set: { isDeleted: true, deletedAt: now } }),
    Word.updateMany({ setId: new Types.ObjectId(setId) }, { $set: { isDeleted: true, deletedAt: now } }),
    LearningProgress.deleteMany({ setId: new Types.ObjectId(setId) }),
  ]);
}

/**
 * Clone một public set về My Library của user.
 * Copy toàn bộ Words, tăng learnerCount trên set gốc.
 *
 * TODO (Người 1): Implement body của function này
 */
export async function clonePublicSet(
  sourceSetId: string,
  userId: string,
): Promise<VocabSetResponse> {
  const sourceSet = await VocabularySet.findOne({
    _id: sourceSetId,
    isDeleted: { $ne: true },
  }).lean();

  if (!sourceSet || !sourceSet.isPublic) {
    throw new AppError("Public set not found", HttpStatus.NOT_FOUND, ErrorCodes.VALIDATION_FAILED);
  }

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
    totalWords: 0,
    learnerCount: 0,
  }).save();

  const sourceWords = await Word.find({ setId: sourceSet._id, isDeleted: { $ne: true } }).lean();
  if (sourceWords.length > 0) {
    const clonedWords = sourceWords.map(({ _id, __v, createdAt, updatedAt, setId, ...word }) => ({
      ...word,
      setId: newSet._id,
      isDeleted: false,
    }));

    await Word.insertMany(clonedWords);
    await VocabularySet.findByIdAndUpdate(newSet._id, { $set: { totalWords: sourceWords.length } });
    newSet.totalWords = sourceWords.length;
  }

  await VocabularySet.findByIdAndUpdate(sourceSetId, { $inc: { learnerCount: 1 } });

  return mapSetToResponse(newSet.toObject());
}

// ─── Word Services ───────────────────────────────────────────────────────────

/**
 * Lấy danh sách từ trong một set.
 * Kèm status học (từ LearningProgress) nếu có userId.
 * Hỗ trợ full-text search ?q= bên trong word list.
 *
 * TODO (Người 1): Implement body của function này
 */
export async function getWords(
  setId: string,
  userId?: string,
  q?: string,
): Promise<WordResponse[]> {
  if (!Types.ObjectId.isValid(setId)) {
    throw new AppError("Set not found", HttpStatus.NOT_FOUND, ErrorCodes.VALIDATION_FAILED);
  }

  const set = await VocabularySet.findOne({ _id: setId, isDeleted: { $ne: true } }).lean();

  if (!set) {
    throw new AppError("Set not found", HttpStatus.NOT_FOUND, ErrorCodes.VALIDATION_FAILED);
  }

  const isOwner = Boolean(userId) && set.userId.toString() === userId;
  if (!set.isPublic && !isOwner) {
    throw new AppError("Forbidden", HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
  }

  const query: Record<string, unknown> = {
    setId: new Types.ObjectId(setId),
    isDeleted: { $ne: true },
  };
  if (q) {
    query.$text = { $search: q };
  }

  const words = await Word.find(query).lean();

  if (!userId) {
    return words.map(mapWordToResponse);
  }

  const progress = await LearningProgress.find({
    userId: new Types.ObjectId(userId),
    setId: new Types.ObjectId(setId),
  }).lean();

  const progressMap = new Map(progress.map((item) => [item.wordId.toString(), item]));

  return words.map((word) => {
    const mapped = mapWordToResponse(word);
    const wordProgress = progressMap.get(word._id.toString());

    if (wordProgress) {
      mapped.status = wordProgress.status;
      mapped.masteryPct = calcMasteryPct(wordProgress);
    }

    return mapped;
  });
}

/**
 * Thêm từ mới vào set.
 * Tự động tăng totalWords của set.
 *
 * TODO (Người 1): Implement body của function này
 */
export async function addWord(
  setId: string,
  userId: string,
  data: AddWordDTO,
): Promise<WordResponse> {
  await ensureOwnedSet(setId, userId);

  const word = await new Word({
    setId: new Types.ObjectId(setId),
    ...data,
  }).save();

  await VocabularySet.findByIdAndUpdate(setId, { $inc: { totalWords: 1 } });

  return mapWordToResponse(word.toObject());
}

/**
 * Sửa một từ trong set.
 *
 * TODO (Người 1): Implement body của function này
 */
export async function updateWord(
  wordId: string,
  setId: string,
  userId: string,
  data: Partial<AddWordDTO>,
): Promise<WordResponse> {
  await ensureOwnedSet(setId, userId);

  const word = await Word.findOneAndUpdate(
    { _id: wordId, setId: new Types.ObjectId(setId), isDeleted: { $ne: true } },
    { $set: data },
    { new: true },
  ).lean();

  if (!word) {
    throw new AppError("Word not found", HttpStatus.NOT_FOUND, ErrorCodes.VALIDATION_FAILED);
  }

  return mapWordToResponse(word);
}

/**
 * Xóa một từ trong set.
 * Tự động giảm totalWords và xóa LearningProgress liên quan.
 *
 * TODO (Người 1): Implement body của function này
 */
export async function deleteWord(
  wordId: string,
  setId: string,
  userId: string,
): Promise<void> {
  await ensureOwnedSet(setId, userId);

  const result = await Word.updateOne(
    { _id: wordId, setId: new Types.ObjectId(setId), isDeleted: { $ne: true } },
    { $set: { isDeleted: true, deletedAt: new Date() } }
  );
  if (result.modifiedCount === 0) {
    throw new AppError("Word not found", HttpStatus.NOT_FOUND, ErrorCodes.VALIDATION_FAILED);
  }

  await Promise.all([
    LearningProgress.deleteMany({ wordId: new Types.ObjectId(wordId) }),
    VocabularySet.findByIdAndUpdate(setId, { $inc: { totalWords: -1 } }),
  ]);
}
