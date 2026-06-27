import { Request, Response } from "express";
import * as vocabService from "../services/vocab.service";
import { VocabSetFilters } from "../types/vocab.types";
import { sendSuccess } from "../utils/response.util";
import { catchAsync } from "../utils/catchAsync";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Parse comma-separated tags query param → string[] */
function parseTags(raw?: string): string[] | undefined {
  if (!raw) return undefined;
  return raw.split(",").map((t) => t.trim()).filter(Boolean);
}

// ─── Vocabulary Set Controllers ──────────────────────────────────────────────

/**
 * GET /api/v1/vocab/sets
 * My Library — Danh sách bộ từ của user hiện tại (với search/filter/pagination)
 */
export const getUserSetsController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const filters: VocabSetFilters = {
    q: req.query.q as string | undefined,
    category: req.query.category as any,
    level: req.query.level as any,
    sortBy: req.query.sortBy as any,
    tags: parseTags(req.query.tags as string),
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    includeProgress: req.query.includeProgress as boolean | undefined,
  };
  
  const result = await vocabService.getUserSets(userId, filters);
  return sendSuccess(res, "Sets fetched successfully", result.data, 200, result.pagination);
});

export const getPublicSetsController = catchAsync(async (req: Request, res: Response) => {
  const filters: VocabSetFilters = {
    q: req.query.q as string | undefined,
    category: req.query.category as any,
    level: req.query.level as any,
    sortBy: req.query.sortBy as any,
    tags: parseTags(req.query.tags as string),
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    includeProgress: req.query.includeProgress as boolean | undefined,
  };

  const result = await vocabService.getPublicSets(filters);
  return sendSuccess(res, "Public sets fetched successfully", result.data, 200, result.pagination);
});

export const getSetDetailController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const set = await vocabService.getSetById(id, userId, req.user?.role === 'admin');
  return sendSuccess(res, "Set details fetched successfully", set);
});

export const createSetController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const set = await vocabService.createSet(userId, req.body);
  return sendSuccess(res, "Vocabulary set created successfully", set, 201);
});

export const updateSetController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const set = await vocabService.updateSet(id, userId, req.body);
  return sendSuccess(res, "Vocabulary set updated successfully", set);
});

export const deleteSetController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  await vocabService.deleteSet(id, userId);
  return sendSuccess(res, "Vocabulary set deleted successfully");
});

export const clonePublicSetController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const set = await vocabService.clonePublicSet(id, userId);
  return sendSuccess(res, "Set cloned to library successfully", set, 201);
});

export const getWordsController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const q = req.query.q as string | undefined;
  const words = await vocabService.getWords(id, userId, q, req.user?.role === 'admin');
  return sendSuccess(res, "Words fetched successfully", words);
});

export const addWordController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const word = await vocabService.addWord(id, userId, req.body);
  return sendSuccess(res, "Word added successfully", word, 201);
});

export const updateWordController = catchAsync(async (req: Request, res: Response) => {
  const { id, wordId } = req.params;
  const userId = req.user!.id;
  const word = await vocabService.updateWord(wordId, id, userId, req.body);
  return sendSuccess(res, "Word updated successfully", word);
});

export const deleteWordController = catchAsync(async (req: Request, res: Response) => {
  const { id, wordId } = req.params;
  const userId = req.user!.id;
  await vocabService.deleteWord(wordId, id, userId);
  return sendSuccess(res, "Word deleted successfully");
});
