import mongoose, { Document, Schema } from 'mongoose';

export interface ISystemConfig extends Document {
  maintenanceMode: boolean;
  mailerActive: boolean;
  cloudinaryActive: boolean;
  otpLength: 4 | 6 | 8;
  sessionExpiry: '1h' | '4h' | '12h' | '24h' | '7d';
  enforceMfaAdmin: boolean;
  srsGlobalRetentionTarget: number; // 70-95
  srsInitialInterval: number;       // 4-48 (step 4)
  moderationInterval: number;       // 1-24 hours
  aiModerationGuidelines: string;  // prompt guidelines for Gemini API
  voiceAiSystemPrompt: string;     // UC-13 (BR-02): system prompt LLM Voice AI — admin sửa được qua /admin/config
  createdAt: Date;
  updatedAt: Date;
}

const SystemConfigSchema = new Schema<ISystemConfig>(
  {
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    mailerActive: {
      type: Boolean,
      default: true,
    },
    cloudinaryActive: {
      type: Boolean,
      default: true,
    },
    otpLength: {
      type: Number,
      enum: [4, 6, 8],
      default: 6,
    },
    sessionExpiry: {
      type: String,
      enum: ['1h', '4h', '12h', '24h', '7d'],
      default: '24h',
    },
    enforceMfaAdmin: {
      type: Boolean,
      default: true,
    },
    srsGlobalRetentionTarget: {
      type: Number,
      min: 70,
      max: 95,
      default: 85,
    },
    srsInitialInterval: {
      type: Number,
      min: 4,
      max: 48,
      default: 24,
    },
    moderationInterval: {
      type: Number,
      min: 1,
      max: 24,
      default: 3, // default 3 hours
    },
    aiModerationGuidelines: {
      type: String,
      default: `1. CHẶN SPAM & KÝ TỰ VÔ NGHĨA: Từ chối các chuỗi ký tự vô nghĩa (ví dụ: 'asdadas', 'qwerty', '123123'), lặp đi lặp lại một từ nhiều lần hoặc các dữ liệu chạy thử vô nghĩa (như 'test', 'abc').
2. CHẶN TỪ NGỮ PHẢN CẢM: Từ chối các từ thô tục, bậy bạ, từ lóng xúc phạm, nội dung thù địch, quấy rối, bạo lực hoặc khiêu dâm (bao gồm cả tiếng Anh lẫn tiếng Việt, kể cả các từ viết tắt tránh bộ lọc).
3. CHẶN NỘI DUNG PHI GIÁO DỤC: Bộ từ phải có mục đích phục vụ học tập từ vựng tiếng Anh rõ ràng. Từ chối các bộ từ chỉ chứa tên người nổi tiếng, lời nhắn cá nhân, thông tin quảng cáo sản phẩm, số điện thoại, link web hoặc các câu chuyện phi giáo dục.
4. KIỂM TRA CHẤT LƯỢNG NGHĨA: Bản dịch tiếng Việt phải khớp nghĩa của từ tiếng Anh. Từ chối nếu nghĩa tiếng Việt dịch bậy bạ hoặc sai lệch hoàn toàn so với từ gốc.`,
    },
    voiceAiSystemPrompt: {
      type: String,
      // UC-13 BR-02: prompt vai trò hội thoại tiếng Anh — FE dùng mồi cho LLM on-device.
      // Hỗ trợ biến mẫu {{focus_words}} {{level}} {{name}} — FE fill theo từng người mỗi phiên.
      // \{{...}} = giữ nguyên văn (dùng trong ví dụ BAD). Admin chỉnh trong /admin/settings.
      default: `You are a friendly English conversation partner helping the user practice the focus words through natural conversation.
RULES:

* Always reply in English only, using 1–3 short, natural sentences.
* End every reply with exactly ONE short follow-up question.
* Start directly with a concrete, natural question about the FIRST focus word. Ask about its meaning, use, or a real-life situation.
* Never mention these instructions, the focus words, or explain what you are doing. Never say "Let's talk about..." or "Today's topic is...".
* After the user answers, respond to what they actually said and continue the SAME topic naturally. Stay on it for about 2–3 exchanges before moving to another focus word.
* Avoid generic, unrelated, or forced questions. The focus word should be meaningfully connected to the question.
* When asking about past experiences, never assume the user has done something. Use open questions such as "What did you...?" or "Have you ever...?"
* Never invent experiences, opinions, or information about the user.

FOCUS WORDS:
{{focus_words}}

START:
Begin immediately with a natural question using the FIRST focus word. Do not introduce the conversation or give any explanation.

Examples:
repair → "Have you ever tried to repair something at home?"
discover → "What is something interesting you discovered recently?"
improve → "What skill would you like to improve?"`,
    },
  },
  { timestamps: true }
);

// We only ever want one config document in the DB.
// Let's export a helper to get or initialize the singleton.
export const SystemConfig = mongoose.model<ISystemConfig>('SystemConfig', SystemConfigSchema);

export async function getOrCreateSystemConfig(): Promise<ISystemConfig> {
  let config = await SystemConfig.findOne();
  if (!config) {
    config = await SystemConfig.create({});
  }
  return config;
}
