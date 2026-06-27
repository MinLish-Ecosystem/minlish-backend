/**
 * Shared TypeScript types for Learning & Spaced Repetition (SRS) features
 */

export interface LearningQueueFilters {
  previewOnly?: boolean;
  timezone?: string;
}

export interface SetContext {
  setId: string;
  setName?: string;
  colorTheme?: string;
}

export interface LearningCard {
  id: string;
  word: string;
  pronunciation?: string;
  partOfSpeech?: string;
  meaning: string;
  examples: string[];
  audioUrl?: string;
  status: 'new' | 'learning' | 'review' | 'mastered';
  easeFactor?: number;
  interval?: number;
  nextReviewDate?: string;
  setContext?: SetContext;
  imageUrl?: string;
  descriptionEN?: string;
  synonyms?: string[];
  antonyms?: string[];
  note?: string;
}

export interface QueueSummary {
  newCount: number;
  reviewCount: number;
  totalToday: number;
  estimatedMinutes: number;
}

export interface LearningQueueResponse {
  newCards: LearningCard[];
  reviewCards: LearningCard[];
  summary: QueueSummary;
}

export interface DueSummaryResponse {
  newWordsCount: number;
  dueReviewsCount: number;
  totalDueCount: number;
  rawNewWordsCount?: number;
  rawDueReviewsCount?: number;
}

export interface SubmitReviewDTO {
  setId: string;
  rating: 'again' | 'hard' | 'good' | 'easy';
  timeSpent?: number; // số giây học từ này
  sessionId?: string;
  reviewedAt?: string; // hỗ trợ bù thời gian khi học offline
}

export interface SubmitReviewResponse {
  wordId: string;
  previousStatus: 'new' | 'learning' | 'review' | 'mastered';
  newStatus: 'new' | 'learning' | 'review' | 'mastered';
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: string;
  totalReviews: number;
  correctReviews: number;
}

export interface SetProgressSummary {
  setId: string;
  totalWords: number;
  masteredCount: number;
  masteredPct: number;
  learningCount: number;
  reviewCount: number;
  newCount: number;
  dueCount: number;
}

export interface WordSRSProgress {
  wordId: string;
  word: string;
  status: 'new' | 'learning' | 'review' | 'mastered';
  easeFactor: number;
  interval: number;
  repetitions: number;
  totalReviews: number;
  correctReviews: number;
  nextReviewDate?: string;
  lastReviewDate?: string;
  lastRating?: string;
}
