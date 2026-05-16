import { Request, Response, NextFunction } from "express";
import * as vocabService from "../services/vocab.service";
import { VocabSetFilters } from "../types/vocab.types";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Parse comma-separated tags query param → string[] */
function parseTags(raw?: string): string[] | undefined {
  if (!raw) return undefined;
  return raw.split(",").map((t) => t.trim()).filter(Boolean);
}

/** Extract common filter params từ request.query */
function parseFilters(query: Request["query"]): VocabSetFilters {
  return {
    q:        query.q        as string | undefined,
    category: query.category as any,
    level:    query.level    as any,
    sortBy:   query.sortBy   as any,
    tags:     parseTags(query.tags as string),
    page:     query.page  ? Number(query.page)  : 1,
    limit:    query.limit ? Number(query.limit) : 12,
  };
}

// ─── Vocabulary Set Controllers ──────────────────────────────────────────────

/**
 * GET /api/v1/vocab/sets
 * My Library — Danh sách bộ từ của user hiện tại (với search/filter/pagination)
 *
 * TODO (Người 1): Gọi vocabService.getUserSets và trả về response
 */
export async function getUserSetsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId  = req.user!.id;
    const filters = parseFilters(req.query);
    const result  = await vocabService.getUserSets(userId, filters);
    res.status(200).json({ status: "success", ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/vocab/sets/public
 * Explore — Public sets với search/filter/pagination
 *
 * TODO (Người 1): Gọi vocabService.getPublicSets và trả về response
 */
export async function getPublicSetsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const filters = parseFilters(req.query);
    const result  = await vocabService.getPublicSets(filters);
    res.status(200).json({ status: "success", ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/vocab/sets/:id
 * Chi tiết một bộ từ (my set hoặc public set)
 *
 * TODO (Người 1): Implement
 */
export async function getSetDetailController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id }  = req.params;
    const userId  = req.user?.id;
    const set     = await vocabService.getSetById(id, userId);
    res.status(200).json({ status: "success", data: set });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/vocab/sets
 * Tạo bộ từ mới
 *
 * TODO (Người 1): Implement
 */
export async function createSetController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const set    = await vocabService.createSet(userId, req.body);
    res.status(201).json({ status: "success", data: set });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/vocab/sets/:id
 * Cập nhật bộ từ
 *
 * TODO (Người 1): Implement
 */
export async function updateSetController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const set    = await vocabService.updateSet(id, userId, req.body);
    res.status(200).json({ status: "success", data: set });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/vocab/sets/:id
 * Xóa bộ từ (cascade)
 *
 * TODO (Người 1): Implement
 */
export async function deleteSetController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    await vocabService.deleteSet(id, userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/vocab/sets/:id/clone
 * Clone public set về My Library
 *
 * TODO (Người 1): Implement
 */
export async function clonePublicSetController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const set    = await vocabService.clonePublicSet(id, userId);
    res.status(201).json({ status: "success", data: set, message: "Set added to your library" });
  } catch (err) {
    next(err);
  }
}

// ─── Word Controllers ────────────────────────────────────────────────────────

/**
 * GET /api/v1/vocab/sets/:id/words
 * Danh sách từ trong set (có text search ?q=)
 *
 * TODO (Người 1): Implement
 */
export async function getWordsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id }  = req.params;
    const userId  = req.user?.id;
    const q       = req.query.q as string | undefined;
    const words   = await vocabService.getWords(id, userId, q);
    res.status(200).json({ status: "success", data: words });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/vocab/sets/:id/words
 * Thêm từ mới vào set
 *
 * TODO (Người 1): Implement
 */
export async function addWordController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const word   = await vocabService.addWord(id, userId, req.body);
    res.status(201).json({ status: "success", data: word });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/vocab/sets/:id/words/:wordId
 * Sửa từ
 *
 * TODO (Người 1): Implement
 */
export async function updateWordController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id, wordId } = req.params;
    const userId         = req.user!.id;
    const word           = await vocabService.updateWord(wordId, id, userId, req.body);
    res.status(200).json({ status: "success", data: word });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/vocab/sets/:id/words/:wordId
 * Xóa từ
 *
 * TODO (Người 1): Implement
 */
export async function deleteWordController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id, wordId } = req.params;
    const userId         = req.user!.id;
    await vocabService.deleteWord(wordId, id, userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
