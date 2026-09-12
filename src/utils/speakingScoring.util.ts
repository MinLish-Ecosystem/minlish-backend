/**
 * Scoring thuần rule-based cho Speaking (UC-16 / FR-115, BR-01/02/03).
 * Pure function — không đụng DB/req/res, deterministic, latency ~0 (C-5: KHÔNG gọi AI ở v1).
 *
 * Công thức chốt [CLOSED 2026-09-04 — OQ-5]:
 *   normalize(s)  = lowercase, bỏ dấu câu, collapse khoảng trắng, trim
 *   matchedWords  = |refTokens ∩ userTokens| (bag-of-words, không xét thứ tự)
 *   scorePercent  = round(100 × matchedWords / totalWords)
 * Ngưỡng TOO_SHORT: transcript < 50% số từ mẫu sau normalize (C-8, TBD-8).
 */

/** Ngưỡng transcript tối thiểu so với số từ mẫu (C-8 — TBD-8 đã chốt 50%) */
export const MIN_TRANSCRIPT_RATIO = 0.5;

/** Chuẩn hóa trước khi so khớp: lowercase → bỏ dấu câu → collapse space → trim (BR-02) */
export function normalizeTranscript(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tách token từ chuỗi đã normalize; chuỗi rỗng → mảng rỗng */
export function tokenize(input: string): string[] {
  const normalized = normalizeTranscript(input);
  if (normalized === '') {
    return [];
  }
  return normalized.split(' ');
}

export interface RuleBasedScoreResult {
  scorePercent: number;
  matchedWords: number;
  totalWords: number;
}

/**
 * Chấm rule-based bag-of-words: số từ khớp = giao 2 tập token (không trùng lặp).
 *
 * @param transcript     Transcript learner đọc (thô, sẽ tự normalize)
 * @param referenceText  Câu mẫu gốc
 * @returns {scorePercent = round(100 × matchedWords / totalWords), matchedWords, totalWords}
 * @throws TRANSCRIPT_EMPTY    khi transcript rỗng sau normalize (AF-03)
 * @throws TRANSCRIPT_TOO_SHORT khi < 50% số từ mẫu (AF-04, C-8)
 */
export function scoreRuleBased(transcript: string, referenceText: string): RuleBasedScoreResult {
  const userTokens = tokenize(transcript);
  const refTokens = tokenize(referenceText);

  // Rỗng sau normalize → learner chưa nói gì (BR chấm rỗng)
  if (userTokens.length === 0) {
    throw new ScoringError('TRANSCRIPT_EMPTY');
  }

  // Mẫu rỗng là dữ liệu prompt hỏng — coi như engine lỗi để all-or-nothing chặn
  if (refTokens.length === 0) {
    throw new ScoringError('SCORING_FAILED');
  }

  // Ngưỡng TOO_SHORT: nói dưới 50% số từ mẫu (C-8)
  if (userTokens.length < Math.ceil(refTokens.length * MIN_TRANSCRIPT_RATIO)) {
    throw new ScoringError('TRANSCRIPT_TOO_SHORT');
  }

  // Bag-of-words: giao tập hợp — từ khớp không tính lặp (BR-03)
  const userSet = new Set(userTokens);
  const refSet = new Set(refTokens);
  let matchedWords = 0;
  for (const token of refSet) {
    if (userSet.has(token)) {
      matchedWords += 1;
    }
  }

  const totalWords = refTokens.length;
  const scorePercent = Math.round((100 * matchedWords) / totalWords);

  return { scorePercent, matchedWords, totalWords };
}

/** Lỗi nghiệp vụ của engine — service map sang AppError + errorCode tương ứng */
export type ScoringErrorCode = 'TRANSCRIPT_EMPTY' | 'TRANSCRIPT_TOO_SHORT' | 'SCORING_FAILED';

export class ScoringError extends Error {
  public readonly scoringCode: ScoringErrorCode;

  constructor(scoringCode: ScoringErrorCode) {
    super(`Scoring error: ${scoringCode}`);
    this.name = 'ScoringError';
    this.scoringCode = scoringCode;
  }
}
