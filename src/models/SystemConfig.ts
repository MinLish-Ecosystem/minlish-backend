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
