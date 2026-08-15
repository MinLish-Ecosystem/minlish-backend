/**
 * ─── Model Weights Seed Script ────────────────────────────────────────────────
 * Tạo các model weights mẫu trong DB
 *
 * Chạy: npx ts-node --transpile-only src/scripts/seed-models.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

import { Model } from '../models/Model';

const MONGO_URI = process.env.MONGO_URI_ATLAS || process.env.MONGO_URI_LOCAL || '';

if (!MONGO_URI) {
  console.error('❌ Không tìm thấy MONGO_URI trong .env');
  process.exit(1);
}

const MODELS_DATA = [
  {
    name: 'MinLish STT Model',
    description: 'Speech-to-Text model - Chuyển đổi giọng nói sang văn bản tiếng Anh.',
    type: 'stt' as const,
    version: 'v1.0.0',
    sizeMB: 150,
    megaFileId: 'CHANGE_ME_1',
    status: 'available' as const,
    requirements: { minRamGB: 4, minCpuCores: 2, gpuRequired: false },
  },
  {
    name: 'MinLish TTS Model',
    description: 'Text-to-Speech model - Chuyển văn bản thành giọng nói tự nhiên.',
    type: 'tts' as const,
    version: 'v1.0.0',
    sizeMB: 200,
    megaFileId: 'CHANGE_ME_2',
    status: 'available' as const,
    requirements: { minRamGB: 4, minCpuCores: 2, gpuRequired: false },
  },
];

async function seedModels() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected\n');

    console.log('🧹 Clearing old models...');
    await Model.deleteMany({});

    console.log('📦 Creating models...');
    const created = await Model.insertMany(MODELS_DATA);

    console.log('\n✅ Done!');
    for (const m of created) {
      console.log(`  • ${m.name} (${m.type}) - ${m.sizeMB}MB`);
    }
    console.log('\n⚠️  Update megaFileId with real Mega file IDs!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

seedModels();
