import { Types } from "mongoose";
import { VocabularySet } from "../models/VocabularySet";
import { Word } from "../models/Word";
import { LearningProgress } from "../models/LearningProgress";
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
  const { page = 1, limit = 12 } = filters;
  const skip = (page - 1) * limit;
  const match = buildSetFilter(filters, { userId: new Types.ObjectId(userId) });
  const sort  = buildSortOrder(filters.sortBy);

  // TODO: Query VocabularySet với match + sort + skip + limit
  // TODO: Count tổng để tính totalPages
  // TODO: Populate thêm mastery % từ LearningProgress nếu cần
  // Hint:
  //   const [sets, total] = await Promise.all([
  //     VocabularySet.find(match).sort(sort).skip(skip).limit(limit).lean(),
  //     VocabularySet.countDocuments(match),
  //   ]);

  throw new Error("Not implemented");
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
  const match = buildSetFilter(filters, { isPublic: true });
  const sort  = buildSortOrder(filters.sortBy);

  // TODO: Query VocabularySet public với match + sort + skip + limit
  throw new Error("Not implemented");
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
  // TODO: VocabularySet.findById(setId)
  // TODO: Nếu set không isPublic, kiểm tra set.userId === userId
  // TODO: Nếu không hợp lệ → throw AppError 403
  throw new Error("Not implemented");
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
  // TODO: new VocabularySet({ userId, ...data }).save()
  // TODO: Map sang VocabSetResponse và return
  throw new Error("Not implemented");
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
  // TODO: VocabularySet.findOneAndUpdate({ _id: setId, userId }, data, { new: true })
  // TODO: Nếu không tìm thấy → throw AppError 404
  throw new Error("Not implemented");
}

/**
 * Xóa bộ từ và toàn bộ dữ liệu liên quan (cascade).
 * Xóa: VocabularySet + tất cả Word + tất cả LearningProgress thuộc set này.
 *
 * TODO (Người 1): Implement body của function này
 */
export async function deleteSet(setId: string, userId: string): Promise<void> {
  // TODO: Tìm set, kiểm tra ownership
  // TODO: Dùng Promise.all để xóa song song:
  //   await Promise.all([
  //     VocabularySet.deleteOne({ _id: setId, userId }),
  //     Word.deleteMany({ setId }),
  //     LearningProgress.deleteMany({ setId }),
  //   ]);
  throw new Error("Not implemented");
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
  // TODO: Lấy sourceSet, kiểm tra isPublic
  // TODO: Tạo set mới: { ...sourceSet fields, userId, clonedFrom: sourceSetId, isPublic: false }
  // TODO: Lấy tất cả Words của sourceSet
  // TODO: Tạo bản copy Words với setId mới
  // TODO: Tăng learnerCount: VocabularySet.findByIdAndUpdate(sourceSetId, { $inc: { learnerCount: 1 } })
  // TODO: Dùng session/transaction nếu cần atomicity
  throw new Error("Not implemented");
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
  // TODO: Kiểm tra quyền truy cập set
  // TODO: Word.find({ setId, ...(q ? { $text: { $search: q } } : {}) }).lean()
  // TODO: Nếu có userId, join LearningProgress để lấy status cho mỗi từ
  // Hint: dùng aggregate hoặc lookup riêng
  throw new Error("Not implemented");
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
  // TODO: Kiểm tra set thuộc về userId
  // TODO: new Word({ setId, ...data }).save()
  // TODO: VocabularySet.findByIdAndUpdate(setId, { $inc: { totalWords: 1 } })
  throw new Error("Not implemented");
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
  // TODO: Kiểm tra set thuộc về userId
  // TODO: Word.findOneAndUpdate({ _id: wordId, setId }, data, { new: true })
  throw new Error("Not implemented");
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
  // TODO: Kiểm tra set thuộc về userId
  // TODO: Promise.all([
  //   Word.deleteOne({ _id: wordId, setId }),
  //   LearningProgress.deleteMany({ wordId }),
  //   VocabularySet.findByIdAndUpdate(setId, { $inc: { totalWords: -1 } }),
  // ]);
  throw new Error("Not implemented");
}
