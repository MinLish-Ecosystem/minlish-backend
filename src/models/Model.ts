import mongoose, { Document, Schema } from 'mongoose';
import { DifficultyLevel, TIER_ORDER } from '../constants/voiceAi';

export type { DifficultyLevel } from '../constants/voiceAi';
export type ModelStatus = 'available' | 'deprecated' | 'updating';

// Format weights per component (BA 2026-08-29): LLM luôn 'gguf', STT/TTS chấp nhận 'gguf' | 'onnx'
export type ComponentFormat = 'gguf' | 'onnx';

// Vai trò file trong component — ONNX thường tách encoder/decoder, GGUF gộp 1 file
export type ComponentFileRole = 'model' | 'encoder' | 'decoder' | 'config' | 'tokenizer';

export interface IComponentFile {
    role: ComponentFileRole;     // 'model' = file chính (GGUF); 'encoder'/'decoder' = cặp ONNX
    fileName: string;            // tên file runtime FE cần khi load (vd 'model.onnx', 'encoder.onnx')
    megaFileId: string;           // Mega file ID hoặc FULL URL (passthrough qua buildMegaLink)
    sizeMB: number;
}

export interface IComponent {
    name: string;
    megaFileId: string;           // KEEP (M2): link file chính — back-compat với data cũ
    sizeMB: number;               // tổng dung lượng component (sum files)
    format: ComponentFormat;      // (M5): format weights per component
    files: IComponentFile[];      // NEW: mảng file thực tế — ONNX encoder/decoder = 2 file, GGUF = 1
}

export interface IModelRequirements {
    minRamGB: number; // FIX (M3): interface cũ dùng 'minRamGb' — sai casing so với schema
    minCpuCores: number;
    gpuRequired: boolean;
}

export interface IVoiceAITier extends Document {
    name: string;
    difficultyLevel: DifficultyLevel;
    requirements: IModelRequirements;

    components: {
        stt: IComponent;
        llm: IComponent;
        tts: IComponent;
    };

    totalSizeMB: number;
    status: ModelStatus;
    createdAt: Date;
    updatedAt: Date;
}

// Factory function — Mongoose mutate options object khi build sub-schema,
// nên mỗi component cần instance riêng để tránh share state giữa stt/llm/tts
const makeComponentSchema = () => ({
    name: { type: String, required: true },
    megaFileId: { type: String, required: true },
    sizeMB: { type: Number, required: true },
    format: {
        type: String,
        enum: ['gguf', 'onnx'],
        required: true,
    },
    files: {
        type: [
            {
                _id: false,
                role: { type: String, enum: ['model', 'encoder', 'decoder', 'config', 'tokenizer'], required: true },
                fileName: { type: String, required: true },
                megaFileId: { type: String, required: true },
                sizeMB: { type: Number, required: true },
            },
        ],
        default: [],
    },
});

const VoiceAITierSchema = new Schema<IVoiceAITier>({
    name: { type: String, required: true, trim: true },
    difficultyLevel: {
        type: String,
        enum: TIER_ORDER, // M1: 'hard' → 'high' — enum chốt theo FR-100
        required: true,
    },
    requirements: {
        minRamGB: { type: Number, required: true },
        minCpuCores: { type: Number, required: true },
        gpuRequired: { type: Boolean, default: false },
    },
    components: {
        stt: makeComponentSchema(),
        llm: makeComponentSchema(),
        tts: makeComponentSchema(),
    },
    totalSizeMB: { type: Number, required: true },
    // M4: field 'downloadCount' đã xóa theo BA decision 2026-08-29 (không cần metric lượt tải)
    status: {
        type: String,
        enum: ['available', 'deprecated', 'updating'],
        default: 'available',
    },
}, { timestamps: true });

// Auto-sum totalSizeMB — dùng pre('validate') vì Mongoose validate TRƯỚC pre('save'):
// nếu để pre('save') thì field required sẽ fail trước khi hook kịp tính (đã gặp khi chạy seed).
// - Component có files[] → sum sizeMB các file (chuẩn mới — ONNX 2 file)
// - Component không có files[] → dùng sizeMB legacy (back-compat GGUF 1 file)
VoiceAITierSchema.pre('validate', function(next) {
    if (!this.isModified('totalSizeMB')) {
        if (this.components) {
            const componentSize = (c?: { sizeMB: number; files?: { sizeMB: number }[] }) =>
                c && Array.isArray(c.files) && c.files.length > 0
                    ? c.files.reduce((sum, f) => sum + (f.sizeMB || 0), 0)
                    : c?.sizeMB || 0;
            this.totalSizeMB = componentSize(this.components.stt) + componentSize(this.components.llm) + componentSize(this.components.tts);
        }
    }
    next();
});

VoiceAITierSchema.index({ difficultyLevel: 1 });
VoiceAITierSchema.index({ status: 1, difficultyLevel: 1 });
VoiceAITierSchema.index({ 'requirements.minRamGB': 1 });

export const VoiceAITier = mongoose.model<IVoiceAITier>('VoiceAITier', VoiceAITierSchema);
