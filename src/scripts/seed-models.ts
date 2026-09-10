/**
 * ─── Voice AI Tier Seed Script (UC-13) ────────────────────────────────────────
 * Seed 5 model tier (light → extreme), mỗi tier 3 components (stt/llm/tts).
 *
 * Chạy: npx ts-node --transpile-only src/scripts/seed-models.ts
 *
 * Cấu trúc files[] per component (ONNX tách encoder/decoder = 2 file, GGUF = 1 file):
 *   - megaFileId lưu FULL URL Mega (passthrough qua buildMegaLink) hoặc file ID
 *   - role: 'model' (GGUF/file chính) | 'encoder' | 'decoder' (ONNX) | 'config' | 'tokenizer'
 *
 * SIZE CHUẨN (BA confirm 2026-09-01): tổng weights per tier = RAM requirement
 *   light 250MB · medium 500MB · high 1024MB (1GB) · ultra 2048MB (2GB) · extreme 4096MB (4GB)
 *   → totalSizeMB auto-sum từ files[] (pre-validate hook)
 *
 * MODEL REUSE (BA confirm 2026-09-01 — "mấy con model bị trùng lại"):
 *   Mega import giữ nguyên key mã hóa → link khác fileId nhưng CÙNG KEY = cùng 1 file.
 *   - Ultra STT encoder (yhABHZKS#Zh1ez4Jm) ≡ Extreme STT encoder (OthVzApJ#Zh1ez4Jm)
 *   - Ultra STT decoder (2k5SWZgA#KTZPBOW0) ≡ Extreme STT decoder (isoxWRhL#KTZPBOW0)
 *   - Ultra TTS (vlJTjLrb#mEMit0qq) ≡ Extreme TTS (WoogQDaQ#mEMit0qq)
 *   → Ultra và Extreme chỉ khác LLM; STT + TTS dùng chung weights (cố ý, không phải copy nhầm).
 *
 * PLACEHOLDER còn lại:
 *   📝 Medium: toàn bộ (BA chốt để trống)
 *   📝 Ultra/Extreme TTS config (.onnx.json): tạm dùng link khác — có link thật thì replace
 *
 * ⚠️ LƯU Ý: `name` của component (whisper-tiny-en, qwen2-0.5b-q4...) vẫn là ĐỀ XUẤT —
 * BA chưa confirm tên model thật. Chỉ ảnh hưởng hiển thị + runtime adapter chọn backend,
 * không ảnh hưởng link tải.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

import { VoiceAITier } from '../models/Model';
import { TIER_ORDER, DifficultyLevel } from '../constants/voiceAi';

const MONGO_URI = process.env.MONGO_URI_ATLAS || process.env.MONGO_URI_LOCAL || '';

if (!MONGO_URI) {
  console.error('❌ Không tìm thấy MONGO_URI trong .env');
  process.exit(1);
}

type ComponentFileSeed = {
  role: 'model' | 'encoder' | 'decoder' | 'config' | 'tokenizer';
  fileName: string;
  megaFileId: string; // full URL Mega (passthrough) hoặc file ID
  sizeMB: number;
};

type ComponentSeed = {
  name: string;
  megaFileId: string; // file chính — back-compat
  sizeMB: number;     // tổng component = sum(files)
  format: 'gguf' | 'onnx';
  files: ComponentFileSeed[];
};

type TierSeed = {
  name: string;
  difficultyLevel: DifficultyLevel;
  requirements: { minRamGB: number; minCpuCores: number; gpuRequired: boolean };
  components: { stt: ComponentSeed; llm: ComponentSeed; tts: ComponentSeed };
  status: 'available' | 'deprecated' | 'updating';
};

// 5 tier theo TIER_ORDER — size chuẩn BA: 250MB → 500MB → 1GB → 2GB → 4GB
const TIERS_DATA: TierSeed[] = [
  {
    name: 'MinLish Voice Light',
    difficultyLevel: 'light',
    requirements: { minRamGB: 0.25, minCpuCores: 2, gpuRequired: false },
    components: {
      stt: {
        name: 'whisper-tiny-en',
        megaFileId: 'https://mega.nz/file/C9pATIqA#z0SDh-NifG0GxsAWAWPeG9pY_0HcPkAyqCnEMMrvC-4',
        sizeMB: 40,
        format: 'onnx',
        files: [
          { role: 'encoder', fileName: 'encoder.onnx', megaFileId: 'https://mega.nz/file/C9pATIqA#z0SDh-NifG0GxsAWAWPeG9pY_0HcPkAyqCnEMMrvC-4', sizeMB: 28 },
          { role: 'decoder', fileName: 'decoder.onnx', megaFileId: 'https://mega.nz/file/64ARCSoY#U0k6uTEG2QrczDmf-NUv7I2pJZpnXLEE-VzlMsHPOMA', sizeMB: 12 },
        ],
      },
      llm: {
        name: 'qwen2-0.5b-q4',
        megaFileId: 'https://mega.nz/file/C1QFzBrR#XjLHbibREd5KZXKxnIvU0iivmtfE3tHAtAzApZ31bPA',
        sizeMB: 160,
        format: 'gguf',
        files: [
          { role: 'model', fileName: 'model.gguf', megaFileId: 'https://mega.nz/file/C1QFzBrR#XjLHbibREd5KZXKxnIvU0iivmtfE3tHAtAzApZ31bPA', sizeMB: 160 },
        ],
      },
      tts: {
        name: 'piper-light-en',
        megaFileId: 'https://mega.nz/file/7tBjDZ7b#PQ9i-1-Ptr1whZE7DK1F8UeMB1HqXsdD9nUrW0Ph0J8',
        sizeMB: 50,
        format: 'onnx',
        files: [
          { role: 'model', fileName: 'piper-light.onnx', megaFileId: 'https://mega.nz/file/7tBjDZ7b#PQ9i-1-Ptr1whZE7DK1F8UeMB1HqXsdD9nUrW0Ph0J8', sizeMB: 48 },
          { role: 'config', fileName: 'piper-light.onnx.json', megaFileId: 'https://mega.nz/file/2ogQ1ZST#M-ERExZvGpr6u7AS8OSNosNAp2DQC2bvp6IeAK98_d8', sizeMB: 2 },
        ],
      },
    },
    status: 'available',
  },
  {
    name: 'MinLish Voice Medium',
    difficultyLevel: 'medium',
    requirements: { minRamGB: 0.5, minCpuCores: 2, gpuRequired: false },
    components: {
      stt: {
        name: 'whisper-base-en',
        megaFileId: 'CHANGE_ME_STT_MEDIUM',
        sizeMB: 75,
        format: 'onnx',
        files: [
          { role: 'encoder', fileName: 'encoder.onnx', megaFileId: 'CHANGE_ME_STT_MEDIUM_ENC', sizeMB: 50 },
          { role: 'decoder', fileName: 'decoder.onnx', megaFileId: 'CHANGE_ME_STT_MEDIUM_DEC', sizeMB: 25 },
        ],
      },
      llm: {
        name: 'llama-3-1b-q4',
        megaFileId: 'CHANGE_ME_LLM_MEDIUM',
        sizeMB: 355,
        format: 'gguf',
        files: [
          { role: 'model', fileName: 'model.gguf', megaFileId: 'CHANGE_ME_LLM_MEDIUM', sizeMB: 355 },
        ],
      },
      tts: {
        name: 'piper-medium-en',
        megaFileId: 'CHANGE_ME_TTS_MEDIUM',
        sizeMB: 70,
        format: 'onnx',
        files: [
          { role: 'model', fileName: 'piper-medium.onnx', megaFileId: 'CHANGE_ME_TTS_MEDIUM', sizeMB: 68 },
          { role: 'config', fileName: 'piper-medium.onnx.json', megaFileId: 'CHANGE_ME_TTS_MEDIUM_CFG', sizeMB: 2 },
        ],
      },
    },
    status: 'available', // BA chốt giữ placeholder — chưa có link thật
  },
  {
    name: 'MinLish Voice High', // M1: tier thứ 3 tên 'high' (BE đổi enum hard → high)
    difficultyLevel: 'high',
    requirements: { minRamGB: 1, minCpuCores: 2, gpuRequired: false },
    components: {
      stt: {
        name: 'whisper-small-en',
        megaFileId: 'https://mega.nz/file/akwA2LSY#HQHDtP4CLsP5me1-yJmdIbD_puK7mY8NOzKd3aaxync',
        sizeMB: 150,
        format: 'onnx',
        files: [
          { role: 'encoder', fileName: 'encoder.onnx', megaFileId: 'https://mega.nz/file/akwA2LSY#HQHDtP4CLsP5me1-yJmdIbD_puK7mY8NOzKd3aaxync', sizeMB: 100 },
          { role: 'decoder', fileName: 'decoder.onnx', megaFileId: 'https://mega.nz/file/KhonXLTR#CueYXIQ44ypMeJP82NbwlQhFyG5PQ7tK4dxDuHhDPMY', sizeMB: 50 },
        ],
      },
      llm: {
        name: 'llama-3-3b-q4',
        megaFileId: 'https://mega.nz/file/e4QmUbwY#xSTC7LK_rH9OMAGbDCFp7ovN2XU1MQSOpCyDLe8Qd54',
        sizeMB: 760,
        format: 'gguf',
        files: [
          { role: 'model', fileName: 'model.gguf', megaFileId: 'https://mega.nz/file/e4QmUbwY#xSTC7LK_rH9OMAGbDCFp7ovN2XU1MQSOpCyDLe8Qd54', sizeMB: 760 },
        ],
      },
      tts: {
        name: 'piper-high-en',
        megaFileId: 'https://mega.nz/file/Wp4kgYgI#8wNdajIxZCATVfwUulMUwd6K2GGNHxQdtzzlPbZUfXc',
        sizeMB: 114,
        format: 'onnx',
        files: [
          { role: 'model', fileName: 'piper-high.onnx', megaFileId: 'https://mega.nz/file/Wp4kgYgI#8wNdajIxZCATVfwUulMUwd6K2GGNHxQdtzzlPbZUfXc', sizeMB: 112 },
          { role: 'config', fileName: 'piper-high.onnx.json', megaFileId: 'https://mega.nz/file/i943XYyC#MYf5ofh9irRnJ65zxPf4GRwrblH3P5V7dXn-BFN7u9Y', sizeMB: 2 },
        ],
      },
    },
    status: 'available',
  },
  {
    name: 'MinLish Voice Ultra',
    difficultyLevel: 'ultra',
    requirements: { minRamGB: 2, minCpuCores: 2, gpuRequired: false },
    components: {
      stt: {
        name: 'whisper-medium-en',
        megaFileId: 'https://mega.nz/file/yhABHZKS#Zh1ez4JmBnL9BTVe8q_sYX1ymkrzDErJLJEg04eS5YA',
        sizeMB: 250,
        format: 'onnx',
        files: [
          { role: 'encoder', fileName: 'encoder.onnx', megaFileId: 'https://mega.nz/file/yhABHZKS#Zh1ez4JmBnL9BTVe8q_sYX1ymkrzDErJLJEg04eS5YA', sizeMB: 165 },
          { role: 'decoder', fileName: 'decoder.onnx', megaFileId: 'https://mega.nz/file/2k5SWZgA#KTZPBOW0tPPELO-LSc1_SHUl5p8GRClHm446GmeIT1U', sizeMB: 85 },
        ],
      },
      llm: {
        name: 'llama-3-8b-q4',
        megaFileId: 'https://mega.nz/file/r84xzQaS#vWU2BNiPs9f3Bp_yR8QRWYE16i1eNZYsIkiC1ZevMqk',
        sizeMB: 1600,
        format: 'gguf',
        files: [
          { role: 'model', fileName: 'model.gguf', megaFileId: 'https://mega.nz/file/r84xzQaS#vWU2BNiPs9f3Bp_yR8QRWYE16i1eNZYsIkiC1ZevMqk', sizeMB: 1600 },
        ],
      },
      tts: {
        name: 'piper-ultra-en',
        megaFileId: 'https://mega.nz/file/vlJTjLrb#mEMit0qqRRHecZ-iXjZ-ZDTf4Lc3qtjBPDSUkrxIQnA',
        sizeMB: 198,
        format: 'onnx',
        files: [
          { role: 'model', fileName: 'piper-ultra.onnx', megaFileId: 'https://mega.nz/file/vlJTjLrb#mEMit0qqRRHecZ-iXjZ-ZDTf4Lc3qtjBPDSUkrxIQnA', sizeMB: 196 },
          { role: 'config', fileName: 'piper-ultra.onnx.json', megaFileId: 'CHANGE_ME_TTS_ULTRA_CFG', sizeMB: 2 },
        ],
      },
    },
    status: 'available',
  },
  {
    name: 'MinLish Voice Extreme',
    difficultyLevel: 'extreme',
    requirements: { minRamGB: 4, minCpuCores: 2, gpuRequired: false },
    components: {
      stt: {
        name: 'whisper-large-v3-en',
        megaFileId: 'https://mega.nz/file/OthVzApJ#Zh1ez4JmBnL9BTVe8q_sYX1ymkrzDErJLJEg04eS5YA',
        sizeMB: 400,
        format: 'onnx',
        files: [
          // Model reuse: cùng weights whisper-medium-en của Ultra (BA confirm — key trùng do import Mega)
          { role: 'encoder', fileName: 'encoder.onnx', megaFileId: 'https://mega.nz/file/OthVzApJ#Zh1ez4JmBnL9BTVe8q_sYX1ymkrzDErJLJEg04eS5YA', sizeMB: 260 },
          { role: 'decoder', fileName: 'decoder.onnx', megaFileId: 'https://mega.nz/file/isoxWRhL#KTZPBOW0tPPELO-LSc1_SHUl5p8GRClHm446GmeIT1U', sizeMB: 140 },
        ],
      },
      llm: {
        name: 'qwen2.5-14b-q4',
        megaFileId: 'https://mega.nz/file/XxRwVS7Y#dCvZpJ55Ng8PWO2GTh2Q0np0QIbhQIUM_AjbsiNsjgc',
        sizeMB: 3400,
        format: 'gguf',
        files: [
          { role: 'model', fileName: 'model.gguf', megaFileId: 'https://mega.nz/file/XxRwVS7Y#dCvZpJ55Ng8PWO2GTh2Q0np0QIbhQIUM_AjbsiNsjgc', sizeMB: 3400 },
        ],
      },
      tts: {
        name: 'piper-extreme-en',
        megaFileId: 'https://mega.nz/file/WoogQDaQ#mEMit0qqRRHecZ-iXjZ-ZDTf4Lc3qtjBPDSUkrxIQnA',
        sizeMB: 296,
        format: 'onnx',
        files: [
          // Model reuse: cùng weights piper của Ultra (BA confirm — key trùng do import Mega)
          { role: 'model', fileName: 'piper-extreme.onnx', megaFileId: 'https://mega.nz/file/WoogQDaQ#mEMit0qqRRHecZ-iXjZ-ZDTf4Lc3qtjBPDSUkrxIQnA', sizeMB: 294 },
          { role: 'config', fileName: 'piper-extreme.onnx.json', megaFileId: 'https://mega.nz/file/isoxWRhL#KTZPBOW0tPPELO-LSc1_SHUl5p8GRClHm446GmeIT1U', sizeMB: 2 },
        ],
      },
    },
    status: 'available',
  },
];

async function seedTiers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected\n');

    console.log('🧹 Clearing old voice AI tiers...');
    await VoiceAITier.deleteMany({});

    console.log('📦 Creating 5 tiers (light → extreme)...');
    // Insert theo TIER_ORDER để thứ tự _id khớp thứ tự hiển thị (F9)
    const orderedSeeds = [...TIERS_DATA].sort(
      (a, b) => TIER_ORDER.indexOf(a.difficultyLevel) - TIER_ORDER.indexOf(b.difficultyLevel),
    );
    // Dùng create() thay insertMany() để pre-validate hook tự tính totalSizeMB chạy đúng
    const created = await VoiceAITier.create(orderedSeeds);

    console.log('\n✅ Done! (size chuẩn: 250MB → 500MB → 1GB → 2GB → 4GB)');
    for (const t of created) {
      console.log(`  • ${t.name} (${t.difficultyLevel}) — ${t.totalSizeMB}MB total`);
    }
    console.log('\n⚠️  Các megaFileId còn CHANGE_ME_* cần thay bằng link thật (xem comment đầu file).');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

seedTiers();
