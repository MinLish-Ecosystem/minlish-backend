import { Request, Response, NextFunction } from "express";
import * as vocabService from "../services/vocab.service";
import { VocabSetFilters } from "../types/vocab.types";
import { sendSuccess } from "../utils/response.util";

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
    includeProgress: query.includeProgress === "true",
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
    sendSuccess(res, "Sets fetched", result);
  } catch (err) {
    next(err);
  }
}

export async function getPublicSetsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const filters = parseFilters(req.query);
    const result  = await vocabService.getPublicSets(filters);
    sendSuccess(res, "Public sets fetched", result);
  } catch (err) {
    next(err);
  }
}

export async function getSetDetailController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id }  = req.params;
    const userId  = req.user?.id;
    const set     = await vocabService.getSetById(id, userId);
    sendSuccess(res, "Set detail", set);
  } catch (err) {
    next(err);
  }
}

export async function createSetController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const set    = await vocabService.createSet(userId, req.body);
    sendSuccess(res, "Set created", set, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateSetController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const set    = await vocabService.updateSet(id, userId, req.body);
    sendSuccess(res, "Set updated", set);
  } catch (err) {
    next(err);
  }
}

export async function deleteSetController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    await vocabService.deleteSet(id, userId);
    sendSuccess(res, "Set deleted", null);
  } catch (err) {
    next(err);
  }
}

export async function clonePublicSetController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const set    = await vocabService.clonePublicSet(id, userId);
    sendSuccess(res, "Set added to your library", set, 201);
  } catch (err) {
    next(err);
  }
}

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
    sendSuccess(res, "Words fetched", words);
  } catch (err) {
    next(err);
  }
}

export async function addWordController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const word   = await vocabService.addWord(id, userId, req.body);
    sendSuccess(res, "Word added", word, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateWordController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id, wordId } = req.params;
    const userId         = req.user!.id;
    const word           = await vocabService.updateWord(wordId, id, userId, req.body);
    sendSuccess(res, "Word updated", word);
  } catch (err) {
    next(err);
  }
}

export async function deleteWordController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id, wordId } = req.params;
    const userId         = req.user!.id;
    await vocabService.deleteWord(wordId, id, userId);
    sendSuccess(res, "Word deleted", null);
  } catch (err) {
    next(err);
  }
}
