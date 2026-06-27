import { Types } from 'mongoose';
import { VocabularySet } from '../models/VocabularySet';
import { Word } from '../models/Word';
import { User } from '../models/User';
import { ModerationLog, IModerationResult } from '../models/ModerationLog';
import { getOrCreateSystemConfig } from '../models/SystemConfig';
import { AdminAuditLog } from '../models/AdminAuditLog';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ─── Local Blacklist & Regex Filters ──────────────────────────────────────────
// Biểu thức kiểm tra từ tục tĩu phổ biến (tiếng Anh & tiếng Việt)
const vulgarRegex = /\b(fuck|shit|bitch|cunt|asshole|porn|xxx|địt|đm|dcm|vcl|lồn|buồi|cặc|dkm|chịch|phịch|đéo|đel)\b/i;

// Phát hiện gõ phím vô nghĩa (gibberish/keyboard mash)
const gibberishRegex = /(asdf|qwer|zxcv|ghjk|tyui|bnm|hjkl|jkl;|dfgh|zxcv|xcvb|yuiop|mnbvc|123456)/i;
const repeatCharRegex = /(.)\1{5,}/; // một ký tự lặp lại liên tục từ 6 lần trở lên (vd: aaaaaa)

function isTextOffensiveOrSpam(text: string): boolean {
  if (!text) return false;
  return vulgarRegex.test(text) || gibberishRegex.test(text) || repeatCharRegex.test(text);
}

/**
 * Lọc thô cục bộ các bộ từ vựng.
 * Nếu bộ từ vi phạm rõ ràng, tự động reject ngay mà không cần gọi Gemini API.
 */
export function checkLocalRules(
  setName: string,
  description: string,
  words: string[]
): { isViolating: boolean; reason: string } {
  if (isTextOffensiveOrSpam(setName)) {
    return { isViolating: true, reason: 'Tên bộ từ chứa từ ngữ thô tục hoặc ký tự vô nghĩa (bộ lọc cục bộ).' };
  }
  if (isTextOffensiveOrSpam(description)) {
    return { isViolating: true, reason: 'Mô tả bộ từ chứa từ ngữ thô tục hoặc ký tự vô nghĩa (bộ lọc cục bộ).' };
  }
  for (const word of words) {
    if (isTextOffensiveOrSpam(word)) {
      return { isViolating: true, reason: `Từ vựng "${word}" chứa nội dung thô tục hoặc spam (bộ lọc cục bộ).` };
    }
  }
  return { isViolating: false, reason: '' };
}

// ─── Gemini AI Batch Moderation ───────────────────────────────────────────────
interface IPendingSetData {
  setId: string;
  setName: string;
  description: string;
  creatorName: string;
  creatorEmail: string;
  words: string[];
}

/**
 * Thực thi đợt chạy kiểm duyệt tự động cho tất cả bộ từ đang chờ duyệt.
 * Phối hợp Bộ lọc Cục bộ và Gemini AI Batch.
 */
export async function runAutoModerationBatch(adminId?: string): Promise<{ processed: number; approved: number; rejected: number }> {
  // 1. Lấy cấu hình hệ thống hiện tại
  const config = await getOrCreateSystemConfig();
  
  // 2. Tìm các bộ từ công khai đang chờ duyệt
  const pendingSets = await VocabularySet.find({
    isPublic: true,
    moderationStatus: 'pending',
    isDeleted: { $ne: true },
  }).populate('userId', 'name email').lean();

  if (pendingSets.length === 0) {
    console.log('[Auto Moderation] No pending public sets found.');
    return { processed: 0, approved: 0, rejected: 0 };
  }

  console.log(`[Auto Moderation] Found ${pendingSets.length} pending public sets. Constructing payloads...`);

  // 3. Chuẩn bị dữ liệu đầy đủ bao gồm danh sách từ vựng bên trong
  const allSetsData: IPendingSetData[] = [];
  
  for (const set of pendingSets) {
    const words = await Word.find({ setId: set._id, isDeleted: { $ne: true } }).select('word').lean();
    const wordStrings = words.map(w => w.word);
    const userDoc = set.userId as any;
    
    allSetsData.push({
      setId: set._id.toString(),
      setName: set.name,
      description: set.description || '',
      creatorName: userDoc?.name || 'Unknown User',
      creatorEmail: userDoc?.email || 'unknown@minlish.com',
      words: wordStrings,
    });
  }

  const results: IModerationResult[] = [];
  const geminiQueue: IPendingSetData[] = [];

  // 4. Phân loại: Chạy bộ lọc cục bộ trước để loại bớt
  for (const setData of allSetsData) {
    const localCheck = checkLocalRules(setData.setName, setData.description, setData.words);
    if (localCheck.isViolating) {
      console.log(`[Auto Moderation] [Local Reject] Set "${setData.setName}" (${setData.setId})`);
      results.push({
        setId: new Types.ObjectId(setData.setId),
        setName: setData.setName,
        creatorName: setData.creatorName,
        creatorEmail: setData.creatorEmail,
        wordsCount: setData.words.length,
        status: 'rejected',
        reason: localCheck.reason,
      });
    } else {
      geminiQueue.push(setData);
    }
  }

  // 5. Nếu còn bộ từ vượt qua bộ lọc thô, chuyển lên Gemini API kiểm duyệt
  if (geminiQueue.length > 0) {
    if (!GEMINI_API_KEY) {
      console.error('[Auto Moderation] GEMINI_API_KEY is not defined. Skipping AI moderation for remaining sets.');
      // Giữ nguyên trạng thái pending cho các bộ từ này để duyệt lần sau
    } else {
      // Chunk danh sách thành từng nhóm 10 bộ từ để gửi lên Gemini
      const chunkSize = 10;
      for (let i = 0; i < geminiQueue.length; i += chunkSize) {
        const chunk = geminiQueue.slice(i, i + chunkSize);
        console.log(`[Auto Moderation] Processing AI chunk ${Math.floor(i / chunkSize) + 1} with ${chunk.length} sets...`);
        
        try {
          const aiResults = await moderateWithGemini(chunk, config.aiModerationGuidelines);
          
          for (const res of aiResults) {
            const originalData = chunk.find(c => c.setId === res.id);
            if (originalData) {
              results.push({
                setId: new Types.ObjectId(res.id),
                setName: originalData.setName,
                creatorName: originalData.creatorName,
                creatorEmail: originalData.creatorEmail,
                wordsCount: originalData.words.length,
                status: res.status,
                reason: res.reason,
              });
            }
          }
        } catch (error) {
          console.error('[Auto Moderation] Error calling Gemini API for chunk:', error);
          // Gặp lỗi API thì bỏ qua chunk này (giữ pending để đợt sau quét lại)
        }
        
        // Thêm delay 2 giây để tránh bùng nổ rate limit trên free tier
        if (i + chunkSize < geminiQueue.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  }

  // 6. Cập nhật kết quả vào MongoDB cho các bộ từ đã được xử lý (APPROVED hoặc REJECTED)
  let approvedCount = 0;
  let rejectedCount = 0;

  for (const res of results) {
    await VocabularySet.findByIdAndUpdate(res.setId, {
      $set: {
        moderationStatus: res.status,
        moderationReason: res.reason,
      }
    });

    if (res.status === 'approved') {
      approvedCount++;
    } else {
      rejectedCount++;
    }
  }

  // 7. Tạo bản ghi Moderation Log
  if (results.length > 0) {
    await ModerationLog.create({
      runAt: new Date(),
      type: adminId ? 'manual' : 'auto',
      setsCount: results.length,
      results: results,
    });
    console.log(`[Auto Moderation] Finished batch. Processed: ${results.length}. Approved: ${approvedCount}. Rejected: ${rejectedCount}.`);
  }

  return {
    processed: results.length,
    approved: approvedCount,
    rejected: rejectedCount,
  };
}

/**
 * Gọi Gemini API để kiểm duyệt một danh sách các bộ từ công khai.
 */
async function moderateWithGemini(
  sets: IPendingSetData[],
  guidelines: string
): Promise<Array<{ id: string; status: 'approved' | 'rejected'; reason: string }>> {
  
  const prompt = `
You are a content moderation AI assistant for the MinLish English learning platform.
Your task is to moderate the following vocabulary sets submitted by users for publishing.
For each vocabulary set, review its name, description, and list of English words.
Decide if it should be APPROVED or REJECTED.

CRITICAL MODERATION GUIDELINES:
${guidelines}

Respond STRICTLY adhering to the requested JSON Schema.
For each item, output:
- "id": the exact ID of the vocabulary set provided in the input.
- "status": either "approved" or "rejected".
- "reason": A short, clear explanation in Vietnamese (1-2 sentences) of why it was approved or rejected (e.g. "Bộ từ hợp lệ, nội dung sạch và bổ ích.", "Bị từ chối vì chứa từ ngữ tục tĩu: ...", "Bị từ chối vì mô tả là nội dung quảng cáo rác.").

INPUT SETS TO MODERATE:
${JSON.stringify(sets.map(s => ({ id: s.setId, name: s.setName, description: s.description, words: s.words })), null, 2)}
`;

  const responseSchema = {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: {
        id: { type: 'STRING' },
        status: { type: 'STRING', enum: ['approved', 'rejected'] },
        reason: { type: 'STRING' },
      },
      required: ['id', 'status', 'reason'],
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
          temperature: 0.1, // Thấp để tăng tính nhất quán và chính xác
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API returned status ${response.status}: ${errorBody}`);
  }

  const result = await response.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Empty response from Gemini API');
  }

  return JSON.parse(rawText) as Array<{ id: string; status: 'approved' | 'rejected'; reason: string }>;
}

/**
 * Admin duyệt đè hoặc duyệt thủ công trực tiếp một bộ từ.
 */
export async function manualOverrideModeration(
  adminId: string,
  setId: string,
  status: 'approved' | 'rejected',
  reason: string
): Promise<void> {
  const set = await VocabularySet.findOne({ _id: setId, isDeleted: { $ne: true } }).populate('userId', 'name email').lean();
  if (!set) {
    throw new Error('Vocabulary set not found');
  }

  const userDoc = set.userId as any;
  const wordsCount = await Word.countDocuments({ setId, isDeleted: { $ne: true } });

  // 1. Cập nhật trạng thái duyệt của bộ từ
  await VocabularySet.findByIdAndUpdate(setId, {
    $set: {
      moderationStatus: status,
      moderationReason: reason,
    }
  });

  // 2. Lưu log kiểm duyệt
  await ModerationLog.create({
    runAt: new Date(),
    type: 'manual',
    setsCount: 1,
    results: [{
      setId: new Types.ObjectId(setId),
      setName: set.name,
      creatorName: userDoc?.name || 'Unknown User',
      creatorEmail: userDoc?.email || 'unknown@minlish.com',
      wordsCount,
      status,
      reason,
    }],
  });

  // 3. Ghi audit log cho hành động của admin
  await AdminAuditLog.create({
    adminId: new Types.ObjectId(adminId),
    action: status === 'approved' ? 'approve_set' : 'reject_set',
    targetId: new Types.ObjectId(setId),
    targetType: 'set',
    reason,
    before: { moderationStatus: set.moderationStatus, moderationReason: set.moderationReason },
    after: { moderationStatus: status, moderationReason: reason },
  });
}
