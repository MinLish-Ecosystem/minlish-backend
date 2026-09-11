/**
 * UC-15 Listening Practice — hằng số dùng chung.
 * Một nguồn sự thật duy nhất cho enum dạng câu, level CEFR và số câu mỗi phiên
 * (BR-03, §7.1, data-model).
 */

export const LISTENING_QUESTION_TYPES = ['transcription', 'word-order', 'mcq'] as const;
export type ListeningQuestionType = (typeof LISTENING_QUESTION_TYPES)[number];

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/** Phiên Listening linh hoạt 10–20 câu (BA chốt 2026-09-03). */
export const LISTENING_MIN_QUESTIONS = 10;
export const LISTENING_MAX_QUESTIONS = 20;
export const LISTENING_DEFAULT_QUESTIONS = 10;

/** skillType cố định cho PracticeAttempt của phiên Listening (§7.2). */
export const LISTENING_SKILL_TYPE = 'LISTENING';

export const LISTENING_PAGE_DEFAULT = 1;
export const LISTENING_PAGE_LIMIT_DEFAULT = 20;
export const LISTENING_PAGE_LIMIT_MAX = 100;
