import { Types } from "mongoose";
import { VocabularySet } from "../models/VocabularySet";
import { Word } from "../models/Word";
import { AppError } from "../utils/AppError";
import { HttpStatus } from "../constants/httpStatus";

export interface DeltaChangesResponse {
  lastSyncAt: string;
  changes: {
    sets: any[];
    words: any[];
  };
}

/**
 * Lấy danh sách các bộ từ và từ vựng thay đổi kể từ thời điểm đồng bộ gần nhất (lastSyncAt)
 * Bao gồm cả các bản ghi đã bị xóa mềm (isDeleted: true) để Client xóa local tương ứng.
 */
export async function getDeltaChanges(
  userId: string,
  lastSyncAtRaw?: string
): Promise<DeltaChangesResponse> {
  const userObjectId = new Types.ObjectId(userId);
  const currentSyncTime = new Date();

  // Mặc định nếu không truyền lastSyncAt thì đồng bộ toàn bộ (lấy mốc thời gian epoch)
  const lastSyncDate = lastSyncAtRaw ? new Date(lastSyncAtRaw) : new Date(0);

  if (isNaN(lastSyncDate.getTime())) {
    throw new AppError("Invalid lastSyncAt date format", HttpStatus.BAD_REQUEST, "ERR_INVALID_DATE");
  }

  // 1. Tìm toàn bộ VocabularySet thay đổi (của user hiện tại)
  const changedSets = await VocabularySet.find({
    userId: userObjectId,
    updatedAt: { $gt: lastSyncDate }
  }).lean();

  // 2. Tìm toàn bộ Word thay đổi thuộc các bộ từ trong thư viện cá nhân
  const userSetIds = await VocabularySet.find({
    userId: userObjectId
  }).distinct("_id");

  const changedWords = await Word.find({
    setId: { $in: userSetIds },
    updatedAt: { $gt: lastSyncDate }
  }).lean();

  // Map cấu trúc dữ liệu gửi về
  const sets = changedSets.map((s) => ({
    id: s._id.toString(),
    name: s.name,
    description: s.description,
    category: s.category,
    level: s.level,
    colorTheme: s.colorTheme,
    tags: s.tags ?? [],
    isPublic: s.isPublic,
    totalWords: s.totalWords,
    learnerCount: s.learnerCount,
    clonedFrom: s.clonedFrom?.toString(),
    isDeleted: s.isDeleted ?? false,
    deletedAt: s.deletedAt?.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    createdAt: s.createdAt.toISOString()
  }));

  const words = changedWords.map((w) => ({
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
    isDeleted: w.isDeleted ?? false,
    deletedAt: w.deletedAt?.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
    createdAt: w.createdAt.toISOString()
  }));

  return {
    lastSyncAt: currentSyncTime.toISOString(),
    changes: {
      sets,
      words
    }
  };
}
