import { readFileSync } from 'fs';
import { join } from 'path';
import { normalizeTranscript, scoreByRule } from '../services/listening.service';
import { ListeningQuestion } from '../models/ListeningQuestion';
import { PracticeAttempt } from '../models/PracticeAttempt';
import { PracticeSessionResult } from '../models/PracticeSessionResult';
import { DailyStats } from '../models/DailyStats';
import {
  getListeningSessionQuerySchema,
  submitListeningSchema,
  adminCreateQuestionSchema,
  adminUpdateQuestionSchema,
} from '../validators/listening.schema';

function check(name: string, ok: boolean, detail = ''): string {
  return `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`;
}

function zodOk(schema: any, input: unknown): boolean {
  return schema.safeParse(input).success;
}

async function main() {
  const results: string[] = [];

  // 1. normalizeTranscript — bỏ hoa/thường, dấu câu, whitespace thừa
  const normCases: Array<[string, string, boolean]> = [
    ['Hello,  World!', 'hello world', true],
    ['  The   CAT sat. ', 'the cat sat', true],
    ['a   b', 'a b', true],
    ['abc', 'abc', true],
  ];
  for (const [input, expected, ok] of normCases) {
    const got = normalizeTranscript(input);
    results.push(`${got === expected ? 'PASS' : 'FAIL'} normalize("${input}") => "${got}" (expect ${expected})`);
  }

  // 2. scoreByRule — transcription
  const tq = { type: 'transcription', transcript: 'The quick brown fox.', correctAnswer: undefined, correctOrder: undefined } as any;
  results.push(`${scoreByRule(tq, '  the QUICK brown fox! ') === true ? 'PASS' : 'FAIL'} transcription correct`);
  results.push(`${scoreByRule(tq, 'the quick brown') === false ? 'PASS' : 'FAIL'} transcription wrong`);

  // 3. scoreByRule — word-order
  const wq = { type: 'word-order', transcript: '', correctAnswer: undefined, correctOrder: ['I', 'love', 'you'] } as any;
  results.push(`${scoreByRule(wq, ['I', 'love', 'you']) === true ? 'PASS' : 'FAIL'} word-order correct`);
  results.push(`${scoreByRule(wq, ['love', 'I', 'you']) === false ? 'PASS' : 'FAIL'} word-order wrong order`);
  results.push(`${scoreByRule(wq, ['I', 'love'] as any) === false ? 'PASS' : 'FAIL'} word-order length mismatch`);

  // 4. scoreByRule — mcq
  const mq = { type: 'mcq', transcript: '', correctAnswer: 'B', correctOrder: undefined } as any;
  results.push(`${scoreByRule(mq, 'B') === true ? 'PASS' : 'FAIL'} mcq correct`);
  results.push(`${scoreByRule(mq, 'A') === false ? 'PASS' : 'FAIL'} mcq wrong`);

  // 5. Model indexes
  const attIdx = PracticeAttempt.schema.indexes();
  const hasDedupe = attIdx.some(([f, o]: any) => f.userId === 1 && f.skillType === 1 && f.refId === 1 && o.unique);
  results.push(`${hasDedupe ? 'PASS' : 'FAIL'} PracticeAttempt unique {userId,skillType,refId}`);

  const qIdx = ListeningQuestion.schema.indexes();
  const hasFilter = qIdx.some(([f]: any) => f.type === 1 && f.level === 1 && f.isDeleted === 1);
  results.push(`${hasFilter ? 'PASS' : 'FAIL'} ListeningQuestion index {type,level,isDeleted}`);

  const psrIdx = PracticeSessionResult.schema.indexes();
  results.push(`${psrIdx.length > 0 ? 'PASS' : 'FAIL'} PracticeSessionResult has index`);

  // 6. ListeningQuestion required-by-type validation (async validate() để pre-validate hook chạy)
  try {
    await new ListeningQuestion({ type: 'mcq', level: 'A1', transcript: 'hi' }).validate();
    results.push('FAIL mcq missing options/correctAnswer should fail');
  } catch {
    results.push('PASS mcq missing options/correctAnswer rejected');
  }
  try {
    await new ListeningQuestion({ type: 'word-order', level: 'A1', transcript: 'hi' }).validate();
    results.push('FAIL word-order missing wordOptions/correctOrder should fail');
  } catch {
    results.push('PASS word-order missing wordOptions/correctOrder rejected');
  }
  try {
    await new ListeningQuestion({ type: 'transcription', level: 'A1', transcript: 'hi' }).validate();
    results.push('PASS transcription minimal valid');
  } catch (e) {
    results.push(`FAIL transcription minimal should pass: ${(e as Error).message}`);
  }
  try {
    await new ListeningQuestion({ type: 'mcq', level: 'A1', transcript: 'hi', options: [{ id: 'A', text: 'x' }], correctAnswer: 'A' }).validate();
    results.push('PASS mcq complete valid');
  } catch (e) {
    results.push(`FAIL mcq complete should pass: ${(e as Error).message}`);
  }

  // 7. DailyStats có listeningSessions (streak UC-15)
  results.push(
    check(
      'DailyStats.listeningSessions tồn tại',
      !!DailyStats.schema.path('listeningSessions'),
    ),
  );

  // 8. Zod — session query (AD-7)
  results.push(check('session query count=15 ok', zodOk(getListeningSessionQuerySchema, { query: { count: '15' } })));
  results.push(check('session query count=5 bị chặn (min 10)', !zodOk(getListeningSessionQuerySchema, { query: { count: '5' } })));
  results.push(check('session query count=25 bị chặn (max 20)', !zodOk(getListeningSessionQuerySchema, { query: { count: '25' } })));
  results.push(check('session query level sai enum bị chặn', !zodOk(getListeningSessionQuerySchema, { query: { level: 'Z9' } })));
  results.push(check('session query rỗng ok (count/level optional)', zodOk(getListeningSessionQuerySchema, { query: {} })));

  // 9. Zod — submit
  const qid = '507f1f77bcf86cd799439011';
  const qid2 = '507f1f77bcf86cd799439012';
  const validSubmit = {
    body: {
      results: [{ questionId: qid, selectedAnswer: 'hello', durationMs: 1200 }],
      startedAt: '2026-09-11T02:00:00.000Z',
      completedAt: '2026-09-11T02:05:00.000Z',
    },
  };
  results.push(check('submit payload hợp lệ', zodOk(submitListeningSchema, validSubmit)));
  results.push(check('submit results rỗng bị chặn', !zodOk(submitListeningSchema, {
    body: { results: [], startedAt: validSubmit.body.startedAt, completedAt: validSubmit.body.completedAt },
  })));
  results.push(check('submit questionId trùng bị chặn', !zodOk(submitListeningSchema, {
    body: {
      results: [
        { questionId: qid, selectedAnswer: 'a', durationMs: 1 },
        { questionId: qid, selectedAnswer: 'b', durationMs: 2 },
      ],
      startedAt: validSubmit.body.startedAt,
      completedAt: validSubmit.body.completedAt,
    },
  })));
  results.push(check('submit startedAt sai ISO bị chặn', !zodOk(submitListeningSchema, {
    body: { ...validSubmit.body, startedAt: 'not-a-date' },
  })));
  results.push(check('submit durationMs âm bị chặn', !zodOk(submitListeningSchema, {
    body: { ...validSubmit.body, results: [{ questionId: qid, selectedAnswer: '', durationMs: -1 }] },
  })));
  results.push(check('submit word-order mảng selectedAnswer ok', zodOk(submitListeningSchema, {
    body: { ...validSubmit.body, results: [{ questionId: qid2, selectedAnswer: ['I', 'am'], durationMs: 0 }] },
  })));

  // 10. Zod — admin create (ràng buộc theo type)
  const mcqBody = {
    type: 'mcq', level: 'B1', transcript: 'Where is the station?',
    options: [{ id: 'A', text: 'x' }, { id: 'B', text: 'y' }], correctAnswer: 'B',
  };
  const wordOrderBody = { type: 'word-order', level: 'A2', transcript: 'I love you', wordOptions: ['I', 'love', 'you'], correctOrder: ['I', 'love', 'you'] };
  results.push(check('admin create mcq đầy đủ ok', zodOk(adminCreateQuestionSchema, { body: mcqBody })));
  results.push(check('admin create mcq thiếu options bị chặn', !zodOk(adminCreateQuestionSchema, {
    body: { ...mcqBody, options: undefined },
  })));
  results.push(check('admin create mcq correctAnswer ngoài options bị chặn', !zodOk(adminCreateQuestionSchema, {
    body: { ...mcqBody, correctAnswer: 'Z' },
  })));
  results.push(check('admin create word-order đầy đủ ok', zodOk(adminCreateQuestionSchema, { body: wordOrderBody })));
  results.push(check('admin create word-order thiếu correctOrder bị chặn', !zodOk(adminCreateQuestionSchema, {
    body: { ...wordOrderBody, correctOrder: undefined },
  })));
  results.push(check('admin create transcription chỉ cần transcript ok', zodOk(adminCreateQuestionSchema, {
    body: { type: 'transcription', level: 'A1', transcript: 'hello world' },
  })));
  results.push(check('admin create transcript >2000 bị chặn', !zodOk(adminCreateQuestionSchema, {
    body: { type: 'transcription', level: 'A1', transcript: 'a'.repeat(2001) },
  })));

  // 11. Zod — admin update partial
  results.push(check('admin update partial (level) ok', zodOk(adminUpdateQuestionSchema, {
    params: { questionId: qid },
    body: { level: 'B2' },
  })));
  results.push(check('admin update body rỗng bị chặn', !zodOk(adminUpdateQuestionSchema, {
    params: { questionId: qid },
    body: {},
  })));
  results.push(check('admin update đổi sang mcq thiếu options bị chặn', !zodOk(adminUpdateQuestionSchema, {
    params: { questionId: qid },
    body: { type: 'mcq' },
  })));

  // 12. R1/R2 — enforcement + DTO shape (đọc source service để kiểm tra contract)
  const serviceSrc = readFileSync(join(__dirname, '../services/listening.service.ts'), 'utf8');
  results.push(check('R2: service enforce merged fields khi update', serviceSrc.includes('dto.options ?? existing.options')));
  results.push(check('R2: service $unset field thừa khi đổi type', serviceSrc.includes('$unset')));
  results.push(check('R1: admin DTO expose id, loại __v', serviceSrc.includes('String(q._id)') && serviceSrc.includes('.select')));
  results.push(check('admin update body rỗng bị chặn', !zodOk(adminUpdateQuestionSchema, {
    params: { questionId: qid },
    body: {},
  })));
  results.push(check('admin update đổi sang mcq thiếu options bị chặn', !zodOk(adminUpdateQuestionSchema, {
    params: { questionId: qid },
    body: { type: 'mcq' },
  })));

  console.log(results.join('\n'));
  const failed = results.filter((r) => r.startsWith('FAIL'));
  console.log(`\n${failed.length === 0 ? 'ALL PASS' : `${failed.length} FAILED`} (${results.length} checks)`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
