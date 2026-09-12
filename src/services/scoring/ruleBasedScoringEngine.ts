import { ScoringError, scoreRuleBased } from '../../utils/speakingScoring.util';

/**
 * IScoringEngine — trừu tượng hóa engine chấm Speaking (UC-16 CAP-7 / BR-04).
 * Mọi đường chấm đi qua interface này; Phase 2 thêm aiScoringEngine (Gemini, FR-105)
 * chỉ bằng cách thêm file engine mới + đổi binding ở service factory —
 * KHÔNG sửa routes/controllers/validators/contract submit (AC-12).
 */

export interface ScoringEngineResult {
  scorePercent: number;
  matchedWords: number;
  totalWords: number;
}

export interface IScoringEngine {
  /** Tên engine lưu vào attempt payload snapshot (R8) */
  readonly name: string;
  /** Chấm transcript so với câu mẫu; engine lỗi tự throw */
  score(transcript: string, referenceText: string): ScoringEngineResult;
}

/**
 * ruleBasedScoringEngine — v1 (BR-01): pure deterministic bag-of-words.
 * Điểm khớp từ, chưa phải điểm phát âm; thứ tự từ/phoneme để Phase 2 AI.
 */
export const ruleBasedScoringEngine: IScoringEngine = {
  name: 'rule-based',
  score(transcript: string, referenceText: string): ScoringEngineResult {
    try {
      return scoreRuleBased(transcript, referenceText);
    } catch (err) {
      // Gói lại để caller chỉ bắt ScoringError từ engine (kể cả lỗi bất ngờ của util)
      if (err instanceof ScoringError) {
        throw err;
      }
      throw new ScoringError('SCORING_FAILED');
    }
  },
};
