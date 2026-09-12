import { z } from 'zod';

/**
 * UC-16 Speaking — Zod validation schemas (AD-7: validate tại route layer).
 * 5 schema: list query, submit body, resultId param, prompt body, prompt query.
 * Lỗi → 400 VALIDATION_FAILED + mảng errors qua validateZod middleware.
 */

const objectId24 = /^[0-9a-fA-F]{24}$/;
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

/** Số câu nộp tối đa sau keep-last (OQ-2: default count=10, max 12) */
export const MAX_SPEAKING_ANSWERS = 12;

/** API-01 — GET /skills/speaking/sessions?level=&type=&page=&limit= */
export const listSpeakingSessionsSchema = z.object({
  query: z.object({
    level: z.enum(CEFR_LEVELS).optional(),
    type: z.enum(['PRACTICE', 'EXAM']).optional(),
    scope: z.enum(['SINGLE', 'MIXED']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

/** API-02 — GET /skills/speaking/sessions/:sessionId */
export const speakingSessionParamsSchema = z.object({
  params: z.object({
    sessionId: z.string().regex(objectId24, 'Invalid sessionId'),
  }),
});

/** API-03 — POST /skills/speaking/sessions/:sessionId/submit */
export const submitSpeakingSessionSchema = z
  .object({
    body: z.object({
      // groupId FE-gen ObjectId — giữ nguyên khi retry (CAP-8)
      groupId: z.string().regex(objectId24, 'Invalid groupId'),
      answers: z
        .array(
          z.object({
            skillType: z.literal('SPEAKING'),
            refId: z.string().regex(objectId24, 'Invalid refId'),
            // Cho phép rỗng ở schema — server normalize rồi判定 EMPTY/TOO_SHORT (CAP-3)
            transcript: z.string(),
            durationMs: z.coerce.number().int().min(0).optional().default(0),
          })
        )
        .min(1, 'answers must have at least 1 item')
        .max(MAX_SPEAKING_ANSWERS, `answers must not exceed ${MAX_SPEAKING_ANSWERS} items`),
      // offset:true chấp nhận cả "Z" và "+07:00" — FE gửi new Date().toISOString() hoặc Date string local
      startedAt: z.string().datetime({ offset: true }),
      completedAt: z.string().datetime({ offset: true }),
    }),
  })
  .refine((data) => new Date(data.body.startedAt) <= new Date(data.body.completedAt), {
    message: 'startedAt must be before or equal to completedAt',
    path: ['body', 'startedAt'],
  });

/** API-04 — GET /skills/speaking/results/:resultId */
export const speakingResultParamsSchema = z.object({
  params: z.object({
    resultId: z.string().regex(objectId24, 'Invalid resultId'),
  }),
});

/** API-05 — GET /admin/skills/speaking/prompts?page=&limit=&level=&search=&hasAudio=&source= */
export const listSpeakingPromptsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    level: z.enum(CEFR_LEVELS).optional(),
    search: z.string().trim().max(200).optional(),
    hasAudio: z.enum(['true', 'false']).optional(),
    source: z.enum(['seed', 'admin', 'ai']).optional(),
  }),
});

/** API-05 — POST /admin/skills/speaking/prompts (body bắt buộc đủ level + referenceText khi tạo) */
export const speakingPromptBodySchema = z.object({
  body: z.object({
    level: z.enum(CEFR_LEVELS),
    referenceText: z.string().trim().min(1, 'Reference text cannot be empty').max(2000),
    audioUrl: z
      .string()
      .regex(/^https?:\/\//, 'audioUrl must be http/https')
      .nullable()
      .optional(),
    source: z.enum(['seed', 'admin', 'ai']).optional(),
    isActive: z.boolean().optional(),
  }),
});

/** PUT dùng partial — cho phép sửa từng field */
export const speakingPromptUpdateSchema = z.object({
  body: speakingPromptBodySchema.shape.body.partial(),
});

/** API-05 — params :id cho PUT/DELETE prompt */
export const speakingPromptParamsSchema = z.object({
  params: z.object({
    id: z.string().regex(objectId24, 'Invalid prompt id'),
  }),
});

// ─── Types inferred cho controller ────────────────────────────────────────────

export type ListSpeakingSessionsQuery = z.infer<typeof listSpeakingSessionsSchema>['query'];
export type SubmitSpeakingSessionBody = z.infer<typeof submitSpeakingSessionSchema>['body'];
export type ListSpeakingPromptsQuery = z.infer<typeof listSpeakingPromptsSchema>['query'];
export type SpeakingPromptBodyParsed = z.infer<typeof speakingPromptBodySchema>['body'];
export type SpeakingPromptUpdateParsed = z.infer<typeof speakingPromptUpdateSchema>['body'];
