import { z } from 'zod';

const objectIdSchema = (fieldName: string) =>
  z.string().regex(/^[0-9a-fA-F]{24}$/, { message: `Invalid ${fieldName}` });

// ─── Shared ──────────────────────────────────────────────────────────────────

export const cefrLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

export const optionSchema = z.object({
  id: z.string().trim().min(1).max(50),
  text: z.string().trim().min(1).max(200),
});

const readingQuestionTypeSchema = z.enum(['short-sentence-mcq', 'main-idea-mcq', 'word-bank-fill']);

// api-spec §2: `results` phải 1..15 SAU keep-last. Raw array có thể nhiều hơn nếu client
// gửi trùng questionId (AF-06) → route chỉ chặn trần phòng thủ, service mới validate sau dedupe.
const MAX_RAW_SUBMIT_RESULTS = 100;

// ─── Learner session (UC-14 GET /skills/reading/session) ─────────────────────

export const readingSessionQuerySchema = z.object({
  query: z.object({
    level: cefrLevelSchema.optional(),
  }),
});

// ─── Learner submit (UC-14 POST /skills/reading/submit) ──────────────────────

const readingResultSchema = z
  .object({
    questionId: objectIdSchema('questionId'),
    selectedAnswer: z.union([
      z.string().max(50),
      z.record(z.string(), z.string().min(1).max(30)),
      z.null(),
    ]),
    timeSpent: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  })
  // Client không được tự khai isCorrect — server mới chấm điểm (chống gian lận)
  .strict();

export const readingSubmitSchema = z.object({
  body: z
    .object({
      groupId: objectIdSchema('groupId'),
      // Trần phòng thủ; ràng buộc nghiệp vụ 1..15 được service check SAU keep-last (api-spec §2)
      results: z.array(readingResultSchema).min(1).max(MAX_RAW_SUBMIT_RESULTS),
      // Chấp nhận cả UTC (`Z`) lẫn offset ISO 8601 — fingerprint chuẩn hóa về epoch ms
      // nên retry gửi format khác vẫn cùng fingerprint, không báo conflict sai.
      startedAt: z.string().datetime({ offset: true, message: 'startedAt must be a valid ISO datetime' }),
      completedAt: z.string().datetime({ offset: true, message: 'completedAt must be a valid ISO datetime' }),
    })
    .refine((b) => new Date(b.startedAt) <= new Date(b.completedAt), {
      message: 'startedAt must be <= completedAt',
      path: ['startedAt'],
    }),
});

// ─── Admin list query ────────────────────────────────────────────────────────

export const adminReadingListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    type: readingQuestionTypeSchema.optional(),
    level: cefrLevelSchema.optional(),
  }),
});

// ─── Admin question create (discriminated union theo type) ───────────────────

type McqValue = { options: { id: string; text: string }[]; correctAnswer: string };

// WHY: 2 check MCQ dùng chung cho 2 nhánh, gắn ở mức object vì cần so chéo options/correctAnswer
const withMcqRefinements = <T extends z.ZodType<McqValue>>(schema: T): T =>
  schema
    .refine((q) => new Set(q.options.map((o) => o.id)).size === q.options.length, {
      message: 'option ids must be unique',
    })
    .refine((q) => q.options.some((o) => o.id === q.correctAnswer), {
      message: 'correctAnswer must be one of options ids',
    });

const shortSentenceSchema = withMcqRefinements(
  z
    .object({
      type: z.literal('short-sentence-mcq'),
      level: cefrLevelSchema,
      explanation: z.string().trim().max(1000).optional(),
      sentence: z
        .string()
        .trim()
        .min(10)
        .max(500)
        .refine((s) => (s.match(/___blank___/g) ?? []).length === 1, {
          message: 'sentence must contain exactly one ___blank___ marker',
        }),
      options: z.array(optionSchema).min(2).max(6),
      correctAnswer: z.string().trim().min(1),
    })
    .strict()
);

const mainIdeaSchema = withMcqRefinements(
  z
    .object({
      type: z.literal('main-idea-mcq'),
      level: cefrLevelSchema,
      explanation: z.string().trim().max(1000).optional(),
      passage: z.string().trim().min(100).max(2000),
      question: z.string().trim().min(1).max(300),
      title: z.string().trim().min(1).max(200).optional(),
      options: z.array(optionSchema).min(2).max(6),
      correctAnswer: z.string().trim().min(1),
    })
    .strict()
);

const wordBankSchema = z
  .object({
    type: z.literal('word-bank-fill'),
    level: cefrLevelSchema,
    explanation: z.string().trim().max(1000).optional(),
    passage: z.string().trim().min(100).max(2000),
    wordOptions: z
      .array(z.string().trim().min(1).max(30))
      .min(1)
      .refine((ws) => new Set(ws).size === ws.length, { message: 'wordOptions must not contain duplicates' }),
    correctMapping: z.record(z.string(), z.string().min(1).max(30)),
  })
  .strict()
  .superRefine((q, ctx) => {
    const blankIds = [...new Set([...q.passage.matchAll(/\{\{blank_([0-9]+)\}\}/g)].map((m) => m[1]))]
      .map(Number)
      .sort((a, b) => a - b)
      .map((n) => `blank_${n}`);
    const blankCount = blankIds.length;

    // Check 1: marker phải 2..6 và đánh số liền từ blank_1
    const expectedIds = Array.from({ length: blankCount }, (_, i) => `blank_${i + 1}`);
    if (blankCount < 2 || blankCount > 6 || blankIds.join('|') !== expectedIds.join('|')) {
      ctx.addIssue({
        code: 'custom',
        message: 'passage must contain 2..6 consecutive {{blank_N}} markers starting from blank_1',
      });
      return;
    }

    // Check 2: bank = blanks + 2..6 distractors
    const distractors = q.wordOptions.length - blankCount;
    if (distractors < 2 || distractors > 6) {
      ctx.addIssue({ code: 'custom', message: 'word bank must contain blanks + 2..6 distractors' });
      return;
    }

    // Check 3: mapping phải phủ đúng toàn bộ blank key
    const mappingKeys = Object.keys(q.correctMapping).sort();
    if (mappingKeys.join('|') !== [...blankIds].sort().join('|')) {
      ctx.addIssue({ code: 'custom', message: 'correctMapping must have exactly all blank keys' });
      return;
    }

    // Check 4: giá trị mapping phải thuộc wordOptions
    const bank = new Set(q.wordOptions);
    if (!Object.values(q.correctMapping).every((v) => bank.has(v))) {
      ctx.addIssue({ code: 'custom', message: 'correctMapping values must belong to wordOptions' });
    }
  });

export const readingAdminQuestionSchema = z.object({
  body: z.discriminatedUnion('type', [shortSentenceSchema, mainIdeaSchema, wordBankSchema]),
});

// Dùng cho service merge-then-validate khi update
export const readingAdminQuestionUnionSchema = z.discriminatedUnion('type', [
  shortSentenceSchema,
  mainIdeaSchema,
  wordBankSchema,
]);

export type ReadingAdminQuestionDto = z.infer<typeof readingAdminQuestionSchema>['body'];

// ─── DTO types cho service (suy từ schema, không khai báo tay) ───────────────

export type ReadingSubmitResultDto = z.infer<typeof readingResultSchema>;
export type ReadingSubmitDto = z.infer<typeof readingSubmitSchema>['body'];
export type AdminReadingListQueryDto = z.infer<typeof adminReadingListQuerySchema>['query'];

// ─── Admin update partial ────────────────────────────────────────────────────

// Route-level chỉ sanity-check shape object; service merge partial với document hiện có
// rồi validate toàn bộ theo type hiện tại bằng readingAdminQuestionUnionSchema
// (partial() của nhánh union làm type thành optional nên không dùng được ở route).
export const readingAdminQuestionUpdateSchema = z.object({
  body: z
    .object({ type: readingQuestionTypeSchema.optional() })
    .and(z.record(z.string(), z.unknown())),
});

// ─── Admin id param ──────────────────────────────────────────────────────────

export const readingQuestionIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema('id'),
  }),
});
