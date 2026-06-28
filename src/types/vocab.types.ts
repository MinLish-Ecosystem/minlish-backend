/**
 * Shared TypeScript types for Vocabulary feature
 * Used by both vocab.service.ts and frontend (vocabSlice.ts)
 */

export type VocabCategory =
  | "General" | "Business" | "IELTS" | "TOEIC"
  | "Travel" | "Technology" | "Academic"
  | "Psychology" | "Science" | "Other";

export type VocabLevel = "Beginner" | "Intermediate" | "Advanced" | "Academic";

export type ColorTheme = "blue" | "emerald" | "amber" | "purple" | "rose" | "cyan";

export type SortBy = "newest" | "oldest" | "popular" | "alphabetical";

export type PartOfSpeech = "noun" | "verb" | "adjective" | "adverb" | "phrase" | "idiom" | "other";

// ─── Request / Filter DTOs ─────────────────────────────────────────

export interface VocabSetFilters {
  q?: string;           // Full-text search
  category?: VocabCategory;
  level?: VocabLevel;
  tags?: string[];      // Filter bởi nhiều tags
  sortBy?: SortBy;
  page?: number;
  limit?: number;
  includeProgress?: boolean;  // NEW — v3
}

export interface CreateSetDTO {
  name: string;
  description?: string;
  coverUrl?: string;
  category?: VocabCategory;
  level?: VocabLevel;
  colorTheme?: ColorTheme;
  tags?: string[];
  isPublic?: boolean;
}

export interface AddWordDTO {
  word: string;
  pronunciation?: string;
  partOfSpeech?: PartOfSpeech;
  meaning: string;
  descriptionEN?: string;
  examples?: string[];
  synonyms?: string[];
  antonyms?: string[];
  collocations?: string[];
  note?: string;
  imageUrl?: string;
  audioUrl?: string;
}

// ─── Response DTOs (what API returns) ─────────────────────────────

export interface SetProgressInfo {
  masteredCount: number;
  masteredPct: number;
  learningCount: number;
  newCount: number;
  dueToday: number;
  lastStudied?: string;
}

export interface VocabSetResponse {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  coverUrl?: string;
  category: VocabCategory;
  level: VocabLevel;
  colorTheme: ColorTheme;
  tags: string[];
  isPublic: boolean;
  moderationStatus?: 'pending' | 'approved' | 'rejected';
  moderationReason?: string;
  totalWords: number;
  learnerCount: number;
  clonedFrom?: string;
  createdAt: string;
  updatedAt: string;
  progress?: SetProgressInfo;  // NEW — only when includeProgress=true
}

export interface WordResponse {
  id: string;
  setId: string;
  word: string;
  pronunciation?: string;
  partOfSpeech?: PartOfSpeech;
  meaning: string;
  descriptionEN?: string;
  examples: string[];
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  note?: string;
  imageUrl?: string;
  audioUrl?: string;
  // From LearningProgress (populated when fetching user's own set)
  status?: "new" | "learning" | "review" | "mastered";
  masteryPct?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
