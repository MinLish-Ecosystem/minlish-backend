import { Types } from "mongoose";
import { VocabularySet } from "../models/VocabularySet";
import { Word } from "../models/Word";
import { LearningProgress } from "../models/LearningProgress";
import { AppError } from "../utils/AppError";
import { HttpStatus } from "../constants/httpStatus";
import { ErrorCodes } from "../constants/errorCodes";
import { uploadImage, updateImage, deleteImage, getPublicIdFromUrl } from "./cloudinary.service";
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

  // Tìm kiếm thông minh dựa trên tên, mô tả và nhãn (hỗ trợ substring regex khớp từng phần)
  if (filters.q) {
    const cleanQ = filters.q.trim();
    if (cleanQ) {
      match.$or = [
        { name: { $regex: cleanQ, $options: "i" } },
        { description: { $regex: cleanQ, $options: "i" } },
        { tags: { $in: [new RegExp(cleanQ, "i")] } }
      ];
    }
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
    userId: s.userId ? s.userId.toString() : undefined,
    name: s.name,
    description: s.description,
    coverUrl: s.coverUrl ?? "",
    category: s.category,
    level: s.level,
    colorTheme: s.colorTheme,
    tags: s.tags ?? [],
    isPublic: Boolean(s.isPublic),
    moderationStatus: s.moderationStatus || 'approved',
    moderationReason: s.moderationReason || '',
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
  const match = buildSetFilter(filters, { isPublic: true, moderationStatus: 'approved', isDeleted: { $ne: true } });
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
  isAdmin: boolean = false,
): Promise<VocabSetResponse> {
  if (!Types.ObjectId.isValid(setId)) {
    throw new AppError("Set not found", HttpStatus.NOT_FOUND, ErrorCodes.VALIDATION_FAILED);
  }

  const set = await VocabularySet.findOne({ _id: setId, isDeleted: { $ne: true } }).lean();

  if (!set) {
    throw new AppError("Set not found", HttpStatus.NOT_FOUND, ErrorCodes.VALIDATION_FAILED);
  }

  const isOwner = Boolean(userId) && set.userId.toString() === userId;
  const isApproved = set.moderationStatus === "approved";
  const isAccessible = set.isPublic && isApproved;

  if (!isAccessible && !isOwner && !isAdmin) {
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
  isAdmin: boolean = false,
): Promise<VocabSetResponse> {
  // Check if a set with the same name already exists for this user
  const existingSet = await VocabularySet.findOne({
    userId: new Types.ObjectId(userId),
    name: { $regex: new RegExp(`^${data.name.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
    isDeleted: { $ne: true }
  });
  if (existingSet) {
    throw new AppError("Bạn đã có một bộ từ vựng trùng tên này trong thư viện cá nhân", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
  }

  let finalCoverUrl = data.coverUrl;
  if (data.coverUrl && (data.coverUrl.startsWith('data:image/') || data.coverUrl.includes('base64,'))) {
    const uploadRes = await uploadImage(data.coverUrl, 'minlish_covers');
    finalCoverUrl = uploadRes.secure_url;
  }

  const isPublic = Boolean(data.isPublic);
  const set = await new VocabularySet({
    userId: new Types.ObjectId(userId),
    ...data,
    coverUrl: finalCoverUrl,
    moderationStatus: isPublic ? (isAdmin ? 'approved' : 'pending') : 'approved',
    moderationReason: '',
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
  isAdmin: boolean = false,
): Promise<VocabSetResponse> {
  const existingSet = await VocabularySet.findOne({
    _id: setId,
    userId: new Types.ObjectId(userId),
    isDeleted: { $ne: true }
  });

  if (!existingSet) {
    throw new AppError("Set not found or unauthorized", HttpStatus.NOT_FOUND, ErrorCodes.FORBIDDEN);
  }

  // Non-admin: block content edits on sets that are pending moderation.
  // Only allow setting isPublic=false (cancel pending) — handled by cancelPendingApproval.
  if (!isAdmin && existingSet.isPublic && existingSet.moderationStatus === 'pending') {
    // Allow ONLY pulling back to private (isPublic: false with no other fields)
    const onlySettingPrivate = data.isPublic === false && Object.keys(data).length === 1;
    if (!onlySettingPrivate) {
      throw new AppError(
        "Bộ từ đang chờ duyệt. Bạn không thể chỉnh sửa nội dung lúc này. Hãy kéo về Riêng tư để chỉnh sửa.",
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_FAILED
      );
    }
  }

  // Check if renaming to a name that already exists in user's sets
  if (data.name && data.name.trim().toLowerCase() !== existingSet.name.toLowerCase()) {
    const duplicateName = await VocabularySet.findOne({
      userId: new Types.ObjectId(userId),
      name: { $regex: new RegExp(`^${data.name.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
      _id: { $ne: new Types.ObjectId(setId) },
      isDeleted: { $ne: true }
    });
    if (duplicateName) {
      throw new AppError("Bạn đã có một bộ từ vựng trùng tên này trong thư viện cá nhân", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
    }
  }

  let finalCoverUrl = data.coverUrl;
  if (data.coverUrl !== undefined) {
    if (data.coverUrl && (data.coverUrl.startsWith('data:image/') || data.coverUrl.includes('base64,'))) {
      const uploadRes = await updateImage(existingSet.coverUrl, data.coverUrl, 'minlish_covers');
      finalCoverUrl = uploadRes.secure_url;
    }
  }

  const willBePublic = data.isPublic !== undefined ? data.isPublic : existingSet.isPublic;
  // Reset moderationStatus to pending if set is public or becomes public on update, EXCEPT if updated by Admin
  const resetModeration = willBePublic && !isAdmin;

  const set = await VocabularySet.findOneAndUpdate(
    { _id: setId, userId: new Types.ObjectId(userId), isDeleted: { $ne: true } },
    { 
      $set: {
        ...data,
        ...(data.coverUrl !== undefined ? { coverUrl: finalCoverUrl } : {}),
        ...(resetModeration ? { moderationStatus: 'pending', moderationReason: '' } : {}),
        // If setting private, also reset moderation to approved (private sets don't need approval)
        ...(data.isPublic === false ? { moderationStatus: 'approved', moderationReason: '' } : {})
      } 
    },
    { new: true },
  ).lean();

  return mapSetToResponse(set);
}

/**
 * Xóa bộ từ và toàn bộ dữ liệu liên quan (cascade).
 * Xóa: VocabularySet + tất cả Word + tất cả LearningProgress thuộc set này.
 *
 * TODO (Người 1): Implement body của function này
 */
export async function deleteSet(setId: string, userId: string, isAdmin: boolean = false): Promise<void> {
  const query = isAdmin
    ? { _id: setId, isDeleted: { $ne: true } }
    : { _id: setId, userId: new Types.ObjectId(userId), isDeleted: { $ne: true } };
  const set = await VocabularySet.findOne(query).lean();

  if (!set) {
    throw new AppError("Set not found or unauthorized", HttpStatus.NOT_FOUND, ErrorCodes.FORBIDDEN);
  }

  // Non-admin cannot delete a set that is pending moderation review.
  // This prevents race conditions where a set is approved/rejected by admin
  // while the user deletes it simultaneously.
  if (!isAdmin && set.isPublic && set.moderationStatus === 'pending') {
    throw new AppError(
      "Không thể xóa bộ từ đang chờ duyệt. Hãy kéo về trạng thái Riêng tư trước.",
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  if (set.coverUrl) {
    const publicId = getPublicIdFromUrl(set.coverUrl);
    if (publicId) {
      try {
        await deleteImage(publicId);
      } catch (err) {
        console.error("[Cloudinary] Failed to delete cover image on set deletion:", err);
      }
    }
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

  if (!sourceSet || !sourceSet.isPublic || sourceSet.moderationStatus !== "approved") {
    throw new AppError("Public set not found", HttpStatus.NOT_FOUND, ErrorCodes.VALIDATION_FAILED);
  }

  if (sourceSet.userId.toString() === userId) {
    throw new AppError("Bạn không thể thêm bộ từ vựng do chính mình tạo ra vào thư viện cá nhân", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
  }

  // Check if already cloned
  const existingClone = await VocabularySet.findOne({
    userId: new Types.ObjectId(userId),
    clonedFrom: new Types.ObjectId(sourceSetId),
    isDeleted: { $ne: true }
  }).lean();

  if (existingClone) {
    throw new AppError("You have already added this set to your library", HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
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

/**
 * Cancel a pending moderation review by atomically setting the set to private.
 * Uses a conditional update to prevent race condition with admin approval:
 * if admin already approved/rejected before this runs, the condition fails and
 * we simply fetch the current state and return it unchanged.
 */
export async function cancelPendingApproval(
  setId: string,
  userId: string,
): Promise<VocabSetResponse> {
  if (!Types.ObjectId.isValid(setId)) {
    throw new AppError("Set not found", HttpStatus.NOT_FOUND, ErrorCodes.VALIDATION_FAILED);
  }

  // Atomically: only update if STILL pending (guard against race with admin action)
  const updated = await VocabularySet.findOneAndUpdate(
    {
      _id: setId,
      userId: new Types.ObjectId(userId),
      moderationStatus: 'pending',
      isDeleted: { $ne: true },
    },
    {
      $set: {
        isPublic: false,
        moderationStatus: 'approved', // private sets are effectively 'approved' (no review needed)
        moderationReason: '',
      },
    },
    { new: true },
  ).lean();

  if (updated) {
    return mapSetToResponse(updated);
  }

  // If no document matched, it means admin already processed it — return current state
  const current = await VocabularySet.findOne({
    _id: setId,
    userId: new Types.ObjectId(userId),
    isDeleted: { $ne: true },
  }).lean();

  if (!current) {
    throw new AppError("Set not found or unauthorized", HttpStatus.NOT_FOUND, ErrorCodes.FORBIDDEN);
  }

  // Return the current state with a message so frontend can handle it gracefully
  return mapSetToResponse(current);
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
  isAdmin: boolean = false,
): Promise<WordResponse[]> {
  if (!Types.ObjectId.isValid(setId)) {
    throw new AppError("Set not found", HttpStatus.NOT_FOUND, ErrorCodes.VALIDATION_FAILED);
  }

  const set = await VocabularySet.findOne({ _id: setId, isDeleted: { $ne: true } }).lean();

  if (!set) {
    throw new AppError("Set not found", HttpStatus.NOT_FOUND, ErrorCodes.VALIDATION_FAILED);
  }

  const isOwner = Boolean(userId) && set.userId.toString() === userId;
  const isApproved = set.moderationStatus === "approved";
  const isAccessible = set.isPublic && isApproved;

  if (!isAccessible && !isOwner && !isAdmin) {
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
  const set = await ensureOwnedSet(setId, userId);

  let finalImageUrl = data.imageUrl;
  if (data.imageUrl && (data.imageUrl.startsWith('data:image/') || data.imageUrl.includes('base64,'))) {
    const uploadRes = await uploadImage(data.imageUrl, 'minlish_words');
    finalImageUrl = uploadRes.secure_url;
  }

  const existingWord = await Word.findOne({
    setId: new Types.ObjectId(setId),
    word: data.word.trim(),
    isDeleted: { $ne: true }
  });
  if (existingWord) {
    throw new AppError(`Word "${data.word.trim()}" already exists in this vocabulary set`, HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
  }

  const word = await new Word({
    setId: new Types.ObjectId(setId),
    ...data,
    imageUrl: finalImageUrl,
  }).save();

  const setUpdate: any = { $inc: { totalWords: 1 } };
  if (set.isPublic) {
    setUpdate.$set = { moderationStatus: 'pending', moderationReason: '' };
  }
  await VocabularySet.findByIdAndUpdate(setId, setUpdate);

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
  const set = await ensureOwnedSet(setId, userId);

  const existingWord = await Word.findOne({
    _id: wordId,
    setId: new Types.ObjectId(setId),
    isDeleted: { $ne: true }
  });

  if (!existingWord) {
    throw new AppError("Word not found", HttpStatus.NOT_FOUND, ErrorCodes.VALIDATION_FAILED);
  }

  if (data.word) {
    const existingDuplicate = await Word.findOne({
      setId: new Types.ObjectId(setId),
      word: data.word.trim(),
      _id: { $ne: new Types.ObjectId(wordId) },
      isDeleted: { $ne: true }
    });
    if (existingDuplicate) {
      throw new AppError(`Word "${data.word.trim()}" already exists in this vocabulary set`, HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
    }
  }

  let finalImageUrl = data.imageUrl;
  if (data.imageUrl !== undefined) {
    if (data.imageUrl && (data.imageUrl.startsWith('data:image/') || data.imageUrl.includes('base64,'))) {
      const uploadRes = await updateImage(existingWord.imageUrl, data.imageUrl, 'minlish_words');
      finalImageUrl = uploadRes.secure_url;
    }
  }

  const word = await Word.findOneAndUpdate(
    { _id: wordId, setId: new Types.ObjectId(setId), isDeleted: { $ne: true } },
    { 
      $set: {
        ...data,
        ...(data.imageUrl !== undefined ? { imageUrl: finalImageUrl } : {})
      } 
    },
    { new: true },
  ).lean();

  if (set.isPublic) {
    await VocabularySet.findByIdAndUpdate(setId, {
      $set: { moderationStatus: 'pending', moderationReason: '' }
    });
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
  const set = await ensureOwnedSet(setId, userId);

  const result = await Word.updateOne(
    { _id: wordId, setId: new Types.ObjectId(setId), isDeleted: { $ne: true } },
    { $set: { isDeleted: true, deletedAt: new Date() } }
  );
  if (result.modifiedCount === 0) {
    throw new AppError("Word not found", HttpStatus.NOT_FOUND, ErrorCodes.VALIDATION_FAILED);
  }

  const setUpdate: any = { $inc: { totalWords: -1 } };
  if (set.isPublic) {
    setUpdate.$set = { moderationStatus: 'pending', moderationReason: '' };
  }

  await Promise.all([
    LearningProgress.deleteMany({ wordId: new Types.ObjectId(wordId) }),
    VocabularySet.findByIdAndUpdate(setId, setUpdate),
  ]);
}
