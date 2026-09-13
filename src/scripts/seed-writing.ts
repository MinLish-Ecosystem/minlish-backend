/**
 * ─── Writing Question Seed Script (UC-17) ─────────────────────────────────────
 * Seed 6 đề/examType (TOEIC + IELTS) — taskType đa dạng email/letter/essay/report.
 * SPEC OQ-01: nội dung seed chờ BA chốt — đây là placeholder hợp lệ schema để
 * test W1/W2; BA thay nội dung thật bằng admin CRUD (W5) hoặc sửa script này.
 *
 * Chạy: npx ts-node --transpile-only src/scripts/seed-writing.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

import { WritingQuestion } from '../models/WritingQuestion';
import { getOrCreateSystemConfig } from '../models/SystemConfig';

const MONGO_URI = process.env.MONGO_URI_ATLAS || process.env.MONGO_URI_LOCAL || '';

if (!MONGO_URI) {
  console.error('❌ Không tìm thấy MONGO_URI trong .env');
  process.exit(1);
}

type QuestionSeed = {
  examType: 'toeic' | 'ielts';
  taskType: 'email' | 'letter' | 'essay' | 'report';
  title: string;
  prompt: string;
  instructions: string;
  wordLimit: number;
  suggestedVocab?: string[];
};

const QUESTIONS: QuestionSeed[] = [
  // ─── TOEIC (thang 0–5) ───
  {
    examType: 'toeic',
    taskType: 'email',
    title: 'Email Response - Work Scenario',
    prompt:
      'Your colleague has sent you an email asking for help with a project deadline. They need your support to finish a report before Friday.',
    instructions: 'Write a response email (40-50 words). Accept the request, confirm what you can do, and suggest a time to meet.',
    wordLimit: 50,
    suggestedVocab: ['deadline', 'assistance', 'support', 'priority', 'schedule'],
  },
  {
    examType: 'toeic',
    taskType: 'email',
    title: 'Email Response - Hotel Inquiry',
    prompt:
      'You booked a hotel room for a business trip, but the hotel has changed your reservation dates without notice. Write to the hotel manager.',
    instructions: 'Write a complaint email (40-50 words). State the problem, request a solution, and mention your booking reference.',
    wordLimit: 50,
    suggestedVocab: ['reservation', 'inconvenience', 'compensation', 'confirm', 'arrangement'],
  },
  {
    examType: 'toeic',
    taskType: 'letter',
    title: 'Letter of Application',
    prompt:
      'You saw a job advertisement for a part-time office assistant position at a local company. You want to apply for this job.',
    instructions:
      'Write a formal application letter (60-80 words). Introduce yourself, explain why you are suitable, and request an interview.',
    wordLimit: 80,
    suggestedVocab: ['position', 'qualification', 'experience', 'enthusiasm', 'interview'],
  },
  {
    examType: 'toeic',
    taskType: 'essay',
    title: 'Opinion Essay - Remote Work',
    prompt:
      'Some companies now allow employees to work from home permanently. Do you think this is a positive development for workers?',
    instructions:
      'Write a short opinion essay (150-200 words). State your opinion, give at least two reasons with examples, and conclude.',
    wordLimit: 200,
    suggestedVocab: ['flexibility', 'productivity', 'commute', 'work-life balance', 'collaboration'],
  },
  {
    examType: 'toeic',
    taskType: 'report',
    title: 'Work Report - Team Performance',
    prompt:
      'You are a team leader. Your manager asked you to summarize your team\'s performance in the last quarter, including one achievement and one challenge.',
    instructions:
      'Write a short report (120-150 words). Use headings, describe the achievement and the challenge, and end with a recommendation.',
    wordLimit: 150,
    suggestedVocab: ['achievement', 'challenge', 'revenue', 'improvement', 'recommendation'],
  },
  {
    examType: 'toeic',
    taskType: 'letter',
    title: 'Thank You Letter - Customer Service',
    prompt:
      'You recently received excellent customer service from an electronics store when your laptop had problems. Write to the store to thank the staff.',
    instructions:
      'Write a thank you letter (60-80 words). Describe what happened, thank the specific staff member, and say you will return.',
    wordLimit: 80,
    suggestedVocab: ['appreciate', 'repair', 'warranty', 'professional', 'recommend'],
  },

  // ─── IELTS (band 0–9) ───
  {
    examType: 'ielts',
    taskType: 'essay',
    title: 'IELTS Task 2 - Technology and Education',
    prompt:
      'Some people believe that technology has made education more accessible, while others argue it has reduced the quality of learning. Discuss both views and give your opinion.',
    instructions:
      'Write an essay (250-280 words). Include an introduction, both views with examples, your opinion, and a conclusion.',
    wordLimit: 280,
    suggestedVocab: ['accessible', 'e-learning', 'engagement', 'drawback', 'ultimately'],
  },
  {
    examType: 'ielts',
    taskType: 'essay',
    title: 'IELTS Task 2 - Environment',
    prompt:
      'Many countries are banning single-use plastics. To what extent do you agree or disagree with this policy?',
    instructions:
      'Write an essay (250-280 words). State your position clearly, support it with two or three arguments, and address one counter-argument.',
    wordLimit: 280,
    suggestedVocab: ['single-use', 'prohibit', 'sustainable', 'alternative', 'conservation'],
  },
  {
    examType: 'ielts',
    taskType: 'letter',
    title: 'IELTS Task 1 GT - Formal Complaint',
    prompt:
      'You recently bought a piece of furniture online, but when it arrived, it was damaged. The company has not responded to your first email.',
    instructions:
      'Write a formal complaint letter (150-170 words). Describe the damage, mention your previous contact, and state what you want the company to do.',
    wordLimit: 170,
    suggestedVocab: ['damaged', 'purchase order', 'refund', 'replacement', 'resolve'],
  },
  {
    examType: 'ielts',
    taskType: 'letter',
    title: 'IELTS Task 1 GT - Informal Invitation',
    prompt:
      'A friend from another country is planning to visit your city next month. Write to invite them to stay at your home for a few days.',
    instructions:
      'Write a friendly letter (150-170 words). Invite them, describe what you can show them in your city, and ask about their travel dates.',
    wordLimit: 170,
    suggestedVocab: ['visit', 'landmark', 'cuisine', 'itinerary', 'look forward'],
  },
  {
    examType: 'ielts',
    taskType: 'report',
    title: 'IELTS Task 1 Academic - Describe a Process',
    prompt:
      'The diagram below shows the process of recycling plastic bottles, from collection to producing new products. (Summarize the stages in your own words.)',
    instructions:
      'Write a report (150-170 words) describing the main stages of the process. Do NOT give opinions; use passive voice where appropriate.',
    wordLimit: 170,
    suggestedVocab: ['collection', 'sort', 'crush', 'manufacture', 'distribution'],
  },
  {
    examType: 'ielts',
    taskType: 'essay',
    title: 'IELTS Task 2 - Work-Life Balance',
    prompt:
      'In many countries, people are working longer hours than in the past. What are the causes of this trend, and what effects does it have on individuals and society?',
    instructions:
      'Write an essay (250-280 words). Cover both causes and effects, using specific examples, with a clear conclusion.',
    wordLimit: 280,
    suggestedVocab: ['overtime', 'burnout', 'competitiveness', 'welfare', 'long-term'],
  },
];

/**
 * Rubric mặc định cho SystemConfig.writingRubrics (CON-09) — admin sửa được sau.
 * SPEC OQ-02: dùng rubric mô tả public (TOEIC Writing 0–5 / IELTS Writing band 0–9),
 * BA có thể thay bằng rubric riêng qua admin config mà không cần deploy.
 */
const DEFAULT_RUBRICS = {
  TOEIC: `Grade the response on a 0–5 scale (TOEIC Writing Task 1/2 style):
5 — Fully accomplishes the task; well-organized; virtually no errors; appropriate tone and vocabulary.
4 — Accomplishes the task well; mostly organized; minor grammar/word-choice errors; appropriate tone.
3 — Mostly accomplishes the task; adequately organized; noticeable errors that do not obscure meaning.
2 — Partially accomplishes the task; loosely organized; frequent errors; inconsistent tone.
1 — Barely addresses the task; disorganized; errors often obscure meaning; limited vocabulary.
0 — Off-topic, copied from the prompt, or unintelligible.`,
  IELTS: `Grade the writing on the IELTS Writing band 0–9 scale:
9 — Fully addresses the task; skillful paragraphing; wide range of vocabulary and grammar; rare errors.
8 — Addresses all parts well; sequences ideas logically; wide range with only occasional errors.
7 — Addresses the task well; clear progression; sufficient range; frequent errors are minor.
6 — Addresses the task adequately; coherent but not always cohesive; adequate range; some errors remain.
5 — Partially addresses the task; some progression; limited range; noticeable errors.
4 — Attempts the task but parts are unclear; limited cohesion; frequent errors.
3 — Does not adequately address the task; little organization; very limited language.
2 — Barely responds; errors dominate; meaning often fails.
1–0 — Off-topic, copied, or unintelligible.`,
};

async function seed(): Promise<void> {
  console.log('🚀 Seeding Writing questions...');

  // 1. Seed rubric mặc định nếu SystemConfig chưa có (không ghi đè admin đã sửa)
  const config = await getOrCreateSystemConfig();
  if (!config.writingRubrics?.TOEIC || !config.writingRubrics?.IELTS) {
    config.writingRubrics = DEFAULT_RUBRICS;
    await config.save();
    console.log('✓ Đã ghi default writingRubrics vào SystemConfig (admin sửa được qua /admin/config)');
  } else {
    console.log('ℹ SystemConfig.writingRubrics đã có — giữ nguyên rubric hiện tại');
  }

  // 2. Seed đề — bỏ qua nếu title + examType đã tồn tại (idempotent)
  let inserted = 0;
  for (const q of QUESTIONS) {
    const exists = await WritingQuestion.findOne({ title: q.title, examType: q.examType });
    if (exists) {
      console.log(`  ↷ Bỏ qua (đã có): [${q.examType}] ${q.title}`);
      continue;
    }
    await WritingQuestion.create(q);
    inserted++;
    console.log(`  ✓ Thêm: [${q.examType}] ${q.title}`);
  }

  console.log(`\n✅ Hoàn tất: ${inserted} đề mới, tổng ${QUESTIONS.length} đề trong seed list.`);
}

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log(`✓ Connected to MongoDB — db: ${mongoose.connection.name}`);
    await seed();
  })
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });
