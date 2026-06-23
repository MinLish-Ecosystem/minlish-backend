import { z } from 'zod';

// ─── Set Schemas ─────────────────────────────────────────────────────────────

export const createSetSchema = z.object({
  body: z.object({
    name: z.string({ message: 'Set name is required' })
      .trim()
      .min(1, 'Set name is required')
      .max(100, 'Name cannot exceed 100 characters'),
    description: z.string()
      .max(500, 'Description cannot exceed 500 characters')
      .optional(),
    coverUrl: z.string()
      .trim()
      .refine(
        (val) => val === '' || val.startsWith('http') || val.startsWith('data:image/'),
        { message: 'Cover image must be a valid URL or Base64 data' }
      )
      .optional()
      .nullable(),
    category: z.enum(
      ['General', 'Business', 'IELTS', 'TOEIC', 'Travel', 'Technology', 'Academic', 'Psychology', 'Science', 'Other'],
      { message: 'Invalid category' }
    ).optional(),
    level: z.enum(
      ['Beginner', 'Intermediate', 'Advanced', 'Academic'],
      { message: 'Invalid level' }
    ).optional(),
    colorTheme: z.enum(
      ['blue', 'emerald', 'amber', 'purple', 'rose', 'cyan'],
      { message: 'Invalid color theme' }
    ).optional(),
    tags: z.array(z.string().max(30, 'Each tag must be under 30 characters'))
      .max(10, 'Cannot have more than 10 tags')
      .optional(),
    isPublic: z.boolean({ message: 'isPublic must be a boolean' }).optional(),
  }),
});

export const updateSetSchema = z.object({
  body: z.object({
    name: z.string()
      .trim()
      .min(1, 'Set name is required')
      .max(100, 'Name cannot exceed 100 characters')
      .optional(),
    description: z.string()
      .max(500, 'Description cannot exceed 500 characters')
      .optional(),
    coverUrl: z.string()
      .trim()
      .refine(
        (val) => val === '' || val.startsWith('http') || val.startsWith('data:image/'),
        { message: 'Cover image must be a valid URL or Base64 data' }
      )
      .optional()
      .nullable(),
    category: z.enum(
      ['General', 'Business', 'IELTS', 'TOEIC', 'Travel', 'Technology', 'Academic', 'Psychology', 'Science', 'Other'],
      { message: 'Invalid category' }
    ).optional(),
    level: z.enum(
      ['Beginner', 'Intermediate', 'Advanced', 'Academic'],
      { message: 'Invalid level' }
    ).optional(),
    colorTheme: z.enum(
      ['blue', 'emerald', 'amber', 'purple', 'rose', 'cyan'],
      { message: 'Invalid color theme' }
    ).optional(),
    tags: z.array(z.string().max(30, 'Each tag must be under 30 characters'))
      .max(10, 'Cannot have more than 10 tags')
      .optional(),
    isPublic: z.boolean({ message: 'isPublic must be a boolean' }).optional(),
  }),
});

// ─── Word Schemas ────────────────────────────────────────────────────────────

export const addWordSchema = z.object({
  body: z.object({
    word: z.string({ message: 'Word is required' })
      .trim()
      .min(1, 'Word is required')
      .max(100, 'Word cannot exceed 100 characters'),
    meaning: z.string({ message: 'Meaning (definition) is required' })
      .trim()
      .min(1, 'Meaning (definition) is required')
      .max(500, 'Meaning cannot exceed 500 characters'),
    pronunciation: z.string().optional(),
    partOfSpeech: z.enum(
      ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'idiom', 'other'],
      { message: 'Invalid part of speech' }
    ).optional(),
    descriptionEN: z.string()
      .max(1000, 'Description cannot exceed 1000 characters')
      .optional(),
    examples: z.array(z.string())
      .max(5, 'Cannot have more than 5 examples')
      .optional(),
    synonyms: z.array(z.string())
      .max(10, 'Cannot have more than 10 synonyms')
      .optional(),
    antonyms: z.array(z.string())
      .max(10, 'Cannot have more than 10 antonyms')
      .optional(),
    note: z.string()
      .max(500, 'Note cannot exceed 500 characters')
      .optional(),
    imageUrl: z.string()
      .trim()
      .refine(
        (val) => val === '' || val.startsWith('http') || val.startsWith('data:image/'),
        { message: 'Image must be a valid URL or Base64 data' }
      )
      .optional()
      .nullable(),
    audioUrl: z.string().trim().optional().nullable(),
  }),
});

export const updateWordSchema = z.object({
  body: z.object({
    word: z.string()
      .trim()
      .min(1, 'Word is required')
      .max(100, 'Word cannot exceed 100 characters')
      .optional(),
    meaning: z.string()
      .trim()
      .min(1, 'Meaning (definition) is required')
      .max(500, 'Meaning cannot exceed 500 characters')
      .optional(),
    pronunciation: z.string().optional(),
    partOfSpeech: z.enum(
      ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'idiom', 'other'],
      { message: 'Invalid part of speech' }
    ).optional(),
    descriptionEN: z.string()
      .max(1000, 'Description cannot exceed 1000 characters')
      .optional(),
    examples: z.array(z.string())
      .max(5, 'Cannot have more than 5 examples')
      .optional(),
    synonyms: z.array(z.string())
      .max(10, 'Cannot have more than 10 synonyms')
      .optional(),
    antonyms: z.array(z.string())
      .max(10, 'Cannot have more than 10 antonyms')
      .optional(),
    note: z.string()
      .max(500, 'Note cannot exceed 500 characters')
      .optional(),
    imageUrl: z.string()
      .trim()
      .refine(
        (val) => val === '' || val.startsWith('http') || val.startsWith('data:image/'),
        { message: 'Image must be a valid URL or Base64 data' }
      )
      .optional()
      .nullable(),
    audioUrl: z.string().trim().optional().nullable(),
  }),
});

// ─── Search Query Schema ──────────────────────────────────────────────────────

export const searchQuerySchema = z.object({
  query: z.object({
    q: z.string()
      .max(100, 'Search query too long')
      .optional(),
    category: z.enum(
      ['General', 'Business', 'IELTS', 'TOEIC', 'Travel', 'Technology', 'Academic', 'Psychology', 'Science', 'Other'],
      { message: 'Invalid category filter' }
    ).optional(),
    level: z.enum(
      ['Beginner', 'Intermediate', 'Advanced', 'Academic'],
      { message: 'Invalid level filter' }
    ).optional(),
    tags: z.string().optional(),
    sortBy: z.enum(
      ['newest', 'oldest', 'popular', 'alphabetical'],
      { message: 'sortBy must be: newest | oldest | popular | alphabetical' }
    ).optional(),
    page: z.coerce.number().int().min(1, 'Page must be >= 1').optional(),
    limit: z.coerce.number().int().min(1).max(50, 'Limit <= 50').optional(),
    includeProgress: z.string().optional().transform(v => v !== undefined ? (v === 'true' || v === '1') : undefined),
  }),
});
