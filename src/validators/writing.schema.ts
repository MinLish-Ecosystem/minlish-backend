import { z } from 'zod';

/**
 * UC-17 Writing Practice — Zod validation schemas (AD-7: validate tại route layer).
 * Mọi schema bọc {body|query|params} để khớp validateZod middleware hiện có.
 * W3 chỉ validate shape aiResult — KHÔNG gọi lại Gemini (SPEC CON-08).
 */

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

// ─── W1: GET /skills/writing/questions ───────────────────────────────────────

export const writingQuestionsQuerySchema = z.object({
  query: z.object({
    examType: z.enum(['ielts', 'toeic']),
    taskType: z.enum(['email', 'letter', 'essay', 'report', 'picture', 'sentence']).optional(),
    limit: z.coerce.number().int().min(1).max(20).default(5),
  }),
});

// ─── W2: POST /skills/writing/grade ───────────────────────────────────────────

export const writingGradeBodySchema = z.object({
  body: z
    .object({
      questionId: z.string().regex(OBJECT_ID_RE, 'Invalid questionId'),
      userText: z.string().min(1, 'userText is required').max(10000),
    })
    .strict(),
});

// ─── Shape aiResult dùng chung W2 (output Gemini) + W3 (submit body) ─────────

export const aiResultSchema = z
  .object({
    bandScale: z.enum(['TOEIC_0_5', 'IELTS_0_9']),
    bandScore: z.number().finite(),
    feedback: z.string().max(2000),
    strengths: z.array(z.string()).max(10).optional(),
    improvements: z.array(z.string()).max(10).optional(),
    correctedText: z.string().max(10000),
  })
  .strict()
  .superRefine((v, ctx) => {
    // Miền điểm theo bandScale: TOEIC 0..5, IELTS 0..9 (data-model.md §3 payload)
    const max = v.bandScale === 'TOEIC_0_5' ? 5 : 9;
    if (v.bandScore < 0 || v.bandScore > max || Number.isNaN(v.bandScore)) {
      ctx.addIssue({
        code: 'custom',
        message: `bandScore phải trong 0..${max} theo ${v.bandScale}`,
      });
    }
  });

// ─── W3: POST /skills/writing/submit ─────────────────────────────────────────

export const writingSubmitBodySchema = z
  .object({
    body: z
      .object({
        // groupId FE-gen 1 lần/sitting, giữ nguyên khi retry (CON-11)
        groupId: z.string().regex(OBJECT_ID_RE, 'Invalid groupId'),
        results: z
          .array(
            z
              .object({
                questionId: z.string().regex(OBJECT_ID_RE, 'Invalid questionId'),
                userText: z.string().min(1).max(10000),
                aiResult: aiResultSchema,
                durationMs: z.number().int().positive().max(86400000),
              })
              .strict(),
          )
          .min(1, 'results must have at least 1 item'),
      })
      .strict()
      .superRefine((v, ctx) => {
        // Intra-batch trùng questionId → 400 (api-spec W3)
        const ids = v.results.map((r) => r.questionId);
        if (new Set(ids).size !== ids.length) {
          ctx.addIssue({
            code: 'custom',
            message: 'results[] chứa questionId trùng trong cùng lô',
          });
        }
      }),
  });

// ─── W4: GET /skills/writing/results/:resultId ───────────────────────────────

export const writingResultParamSchema = z.object({
  params: z.object({
    resultId: z.string().regex(OBJECT_ID_RE, 'Invalid resultId'),
  }),
});

// ─── W5: Admin CRUD /admin/skills/writing/questions ───────────────────────────

export const writingAdminQuestionSchema = z.object({
  body: z
    .object({
      examType: z.enum(['ielts', 'toeic']),
      taskType: z.enum(['email', 'letter', 'essay', 'report', 'picture', 'sentence']),
      title: z.string().trim().min(1, 'title is required').max(150),
      prompt: z.string().trim().min(10, 'prompt must be 10..2000 chars').max(2000),
      instructions: z.string().trim().min(10, 'instructions must be 10..500 chars').max(500),
      wordLimit: z.number().int().min(20).max(500),
      suggestedVocab: z.array(z.string().trim().min(1)).max(15).optional(),
    })
    .strict(),
});

export const writingAdminListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    examType: z.enum(['ielts', 'toeic']).optional(),
    taskType: z.enum(['email', 'letter', 'essay', 'report', 'picture', 'sentence']).optional(),
  }),
});

export const writingAdminIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(OBJECT_ID_RE, 'Invalid id'),
  }),
});

export type WritingGradeBody = z.infer<typeof writingGradeBodySchema>['body'];
export type WritingSubmitBody = z.infer<typeof writingSubmitBodySchema>['body'];
export type WritingAdminQuestionInput = z.infer<typeof writingAdminQuestionSchema>['body'];
