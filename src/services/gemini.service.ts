import { z } from 'zod';
import { aiResultSchema } from '../validators/writing.schema';

/**
 * Gemini service — client gemini-2.5-flash dùng chung toàn hệ (CON-07).
 * UC-17 thêm gradeWriting() sync call (timeout 30s); Daily Challenge + moderation
 * vẫn dùng fetch riêng trong module của chúng (không đổi ngoài scope UC-17).
 * API key chỉ đọc từ process.env — không bao giờ expose xuống FE.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 30000; // CON-07: timeout budget 30s — quá hạn xử lý như AF-03

export interface GradeWritingParams {
  prompt: string;
  instructions: string;
  taskType: string;
  examType: string;
  userText: string;
  rubric: string;
}

/** Output đã validate shape aiResult của W2 (band + feedback + correctedText). */
export type GradedWritingResult = z.infer<typeof aiResultSchema>;

const gradedWritingSchema = aiResultSchema;

/**
 * Chấm 1 bài Writing bằng Gemini theo rubric của đề (UC-17 BR-04, CAP-02).
 *
 * @param params - Đề (prompt/instructions/taskType/examType) + bài viết + rubric từ SystemConfig
 * @returns aiResult đã Zod-validate: bandScale, bandScore, feedback, strengths, improvements, correctedText
 * @throws Error khi thiếu API key, Gemini lỗi/timeout, hoặc output sai shape/miền điểm
 */
export async function gradeWriting(params: GradeWritingParams): Promise<GradedWritingResult> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables');
  }

  const bandScale = params.examType === 'toeic' ? 'TOEIC_0_5' : 'IELTS_0_9';
  const scaleHint =
    params.examType === 'toeic'
      ? 'Score on a 0–5 scale (TOEIC Writing)'
      : 'Score on a 0–9 scale (IELTS Writing band)';
  // Bọc userText trong delimiter để hạn chế prompt-injection (architecture.md §5.2)
  const requestPrompt = `You are an expert English writing examiner. Grade the learner's writing task below.

TASK TYPE: ${params.taskType.toUpperCase()} (${params.examType.toUpperCase()})
PROMPT / SITUATION:
${params.prompt}

INSTRUCTIONS:
${params.instructions}

GRADING RUBRIC:
${params.rubric}

Respond in JSON with these exact fields:
- bandScale: "${bandScale}"
- bandScore: ${scaleHint}. Use a decimal if appropriate (e.g. 4.5).
- feedback: overall feedback in Vietnamese (max 2000 chars), concise and actionable.
- strengths: array of up to 10 specific strengths in Vietnamese.
- improvements: array of up to 10 specific errors/areas to fix in Vietnamese.
- correctedText: a full rewritten version of the learner's text, improved from THEIR OWN writing and matching the prompt above. Write it in English.

LEARNER'S TEXT (between the delimiters, grade only this content):
<<<BEGIN_USER_TEXT>>>
${params.userText.trim()}
<<<END_USER_TEXT>>>`;

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      bandScale: { type: 'STRING', enum: [bandScale] },
      bandScore: { type: 'NUMBER' },
      feedback: { type: 'STRING' },
      strengths: { type: 'ARRAY', items: { type: 'STRING' } },
      improvements: { type: 'ARRAY', items: { type: 'STRING' } },
      correctedText: { type: 'STRING' },
    },
    required: ['bandScale', 'bandScore', 'feedback', 'correctedText'],
  };

  // AbortControllerImplement timeout 30s — quá hạn coi như Gemini fail (AF-03)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: requestPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.2,
          },
        }),
        signal: controller.signal,
      },
    );
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(`Gemini grading timed out after ${GEMINI_TIMEOUT_MS}ms`);
    }
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API returned status ${response.status}: ${errorBody}`);
  }

  const result: any = await response.json();
  const rawText: string | undefined = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Empty response from Gemini API');
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    throw new Error('Gemini returned invalid JSON');
  }

  // Zod-validate output: bandScale đúng, bandScore đúng miền 0..5/0..9, correctedText bắt buộc.
  // Nếu Gemini trả sai scale so với đề (vd IELTS scale cho đề TOEIC) → fail validation → 502
  // (KHÔNG ép buộc lại bandScale vì bandScore có thể sai miền theo scale khác).
  const validated = gradedWritingSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new Error(
      `Gemini output failed validation: ${validated.error.issues.map((i) => i.message).join('; ')}`,
    );
  }

  return validated.data;
}
