import mongoose, { Document, Schema } from 'mongoose';
export type DifficultyLevel = 'light' | 'medium' | 'hard' | 'ultra' | 'extreme';
export type ModelStatus = 'available' | 'deprecated' | 'updating';

export interface IComponent{
    name:string;
    megaField: string;
    sizeMB: number;
}

export interface IModelRequirements{
    minRamGb: number;
    minCpuCores: number;
    gpuRequired: boolean;
}

export interface IVoiceAITier extends Document{
    name: string;
    difficultyLevel: DifficultyLevel;
    requirements: IModelRequirements;

    components: {
        stt: IComponent;
        llm: IComponent;
        tts: IComponent;
    };

    totalSizeMB: number;
    downloadCount: number;
    status: ModelStatus;
    createdAt: Date;
    updatedAt: Date;
}

const VoiceAITierSchema = new Schema<IVoiceAITier>({
    name: { type: String, required: true, trim: true },
    difficultyLevel: {
        type: String,
        enum: ['light', 'medium', 'hard', 'ultra', 'extreme'],
        required: true
    },
    requirements: {
        minRamGB: { type: Number, required: true },
        minCpuCores: { type: Number, required: true },
        gpuRequired: { type: Boolean, default: false },
    },
    components: {
        stt: {
            name: { type: String, required: true },
            megaFileId: { type: String, required: true },
            sizeMB: { type: Number, required: true },
        },
        llm: {
            name: { type: String, required: true },
            megaFileId: { type: String, required: true },
            sizeMB: { type: Number, required: true },
        },
        tts: {
            name: { type: String, required: true },
            megaFileId: { type: String, required: true },
            sizeMB: { type: Number, required: true },
        },
    },
    totalSizeMB: { type: Number, required: true },
    downloadCount: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['available', 'deprecated', 'updating'],
        default: 'available'
    },
}, { timestamps: true });

VoiceAITierSchema.pre('save', function(next) {
    if (!this.isModified('totalSizeMB')) {
        if (this.components) {
            this.totalSizeMB =
                (this.components.stt?.sizeMB || 0) +
                (this.components.llm?.sizeMB || 0) +
                (this.components.tts?.sizeMB || 0);
        }
    }
    next();
});

VoiceAITierSchema.index({ difficultyLevel: 1 });
VoiceAITierSchema.index({ status: 1, difficultyLevel: 1 });
VoiceAITierSchema.index({ 'requirements.minRamGB': 1 });

export const VoiceAITier = mongoose.model<IVoiceAITier>('VoiceAITier', VoiceAITierSchema);