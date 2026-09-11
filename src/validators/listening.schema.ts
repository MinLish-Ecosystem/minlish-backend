import { z } from 'zod';
import {
  LISTENING_QUESTION_TYPES,
  CEFR_LEVELS,
  LISTENING_MIN_QUESTIONS,
  LISTENING_MAX_QUESTIONS,
  LISTENING_PAGE_LIMIT_MAX,
} from '../constants/listening';

/**
 * UC-15 Listening Practice — Zod schemas (AD-7: validate tại route layer).
 * validate.middleware parse {body, query, params} và ghi đè req tương ứng.
 */

const objectId24 = /^[0-9a-fA-F]{24}$/;
const objectId = (field: string) => z.string().regex(objectId24, { message: `Invalid ${field}` });
const isoDate = (field: string) =>
  z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: `${field} must be ISO8601` });

const listeningQuestionTypeEnum = z.enum(LISTENING_QUESTION_TYPES);
const cefrLevelEnum = z.enum(CEFR_LEVELS);

/** GET /skills/listening/session?count=&level= */
export const getListeningSessionQuerySchema = z.object({
  query: z.object({
    count: z.coerce
      .number()
      .int()
      .min(LISTENING_MIN_QUESTIONS, `count must be >= ${LISTENING_MIN_QUESTIONS}`)
      .max(LISTENING_MAX_QUESTIONS, `count must be <= ${LISTENING_MAX_QUESTIONS}`)
      .optional(),
    level: cefrLevelEnum.optional(),
  }),
});

/** POST /skills/listening/audio {questionId} */
export const getListeningAudioSchema = z.object({
  body: z.object({
    questionId: objectId('questionId'),
  }),
});

/** POST /skills/listening/submit */
const listeningResultItemSchema = z.object({
  questionId: objectId('questionId'),
  selectedAnswer: z.union([z.string(), z.array(z.string())]),
  durationMs: z.number().int().min(0, 'durationMs must be >= 0'),
});

export const submitListeningSchema = z.object({
  body: z
    .object({
      results: z.array(listeningResultItemSchema).min(1, 'results must not be empty'),
      startedAt: isoDate('startedAt'),
      completedAt: isoDate('completedAt'),
    })
    // Chặn questionId trùng trong cùng phiên: unique {userId,skillType,refId} sẽ
    // làm batch write fail (500) nếu payload có câu lặp.
    .refine((data) => new Set(data.results.map((r) => r.questionId)).size === data.results.length, {
      message: 'results không được chứa questionId trùng',
      path: ['results'],
    }),
});

/** GET /admin/skills/listening/questions */
export const adminListQuestionsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(LISTENING_PAGE_LIMIT_MAX).optional(),
    type: listeningQuestionTypeEnum.optional(),
    level: cefrLevelEnum.optional(),
  }),
});

/** PUT/DELETE /admin/skills/listening/questions/:questionId */
export const adminQuestionIdParamSchema = z.object({
  params: z.object({
    questionId: objectId('questionId'),
  }),
});

const listeningOptionSchema = z.object({
  id: z.string().trim().min(1),
  text: z.string().trim().min(1),
});

/**
 * Base field của ListeningQuestion. Ràng buộc bắt buộc theo `type` (BR-03)
 * được áp bằng superRefine ở create; update dùng .partial() trên cùng base.
 */
const questionBaseShape = {
  type: listeningQuestionTypeEnum,
  level: cefrLevelEnum,
  transcript: z.string().trim().min(1, 'transcript must not be empty').max(2000, 'transcript max 2000 chars'),
  options: z.array(listeningOptionSchema).optional(),
  correctAnswer: z.string().trim().min(1).optional(),
  wordOptions: z.array(z.string().trim().min(1)).optional(),
  correctOrder: z.array(z.string().trim().min(1)).optional(),
  explanation: z.string().trim().max(2000).optional(),
};

/** Enforce field bắt buộc theo type — dùng chung cho create/update. */
function enforceRequiredByType(
  data: Partial<z.infer<z.ZodObject<typeof questionBaseShape>>>,
  ctx: z.RefinementCtx,
) {
  if (data.type === 'mcq') {
    if (!data.options || data.options.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'options là bắt buộc với câu mcq' });
    }
    if (!data.correctAnswer) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['correctAnswer'], message: 'correctAnswer là bắt buộc với câu mcq' });
    }
    // correctAnswer phải khớp id của một option — ngược lại câu hỏi vô nghiệm khi chấm (BR-04).
    if (data.correctAnswer && data.options && data.options.length > 0 && !data.options.some((o) => o.id === data.correctAnswer)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['correctAnswer'],
        message: 'correctAnswer phải là id của một option',
      });
    }
  }
  if (data.type === 'word-order') {
    if (!data.wordOptions || data.wordOptions.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['wordOptions'], message: 'wordOptions là bắt buộc với câu word-order' });
    }
    if (!data.correctOrder || data.correctOrder.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['correctOrder'], message: 'correctOrder là bắt buộc với câu word-order' });
    }
  }
}

/** POST /admin/skills/listening/questions — tạo câu hỏi (đủ field theo type). */
export const adminCreateQuestionSchema = z.object({
  body: z.object(questionBaseShape).superRefine(enforceRequiredByType),
});

/** PUT /admin/skills/listening/questions/:questionId — cập nhật (partial, enforce theo type nếu có). */
export const adminUpdateQuestionSchema = z.object({
  params: z.object({
    questionId: objectId('questionId'),
  }),
  body: z
    .object(questionBaseShape)
    .partial()
    .refine((data) => Object.keys(data).length > 0, { message: 'Body must not be empty' })
    .superRefine(enforceRequiredByType),
});
