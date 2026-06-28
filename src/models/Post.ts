import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPost extends Document {
  title: string;
  content: string;
  excerpt: string;
  coverImage?: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  readingTime: number;
  author: Types.ObjectId;
  likes: Types.ObjectId[];
  bookmarks: Types.ObjectId[];
  isFeatured: boolean;
  isPublic: boolean;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  moderationReason: string;
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    title: {
      type: String,
      required: [true, 'Post title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    content: {
      type: String,
      required: [true, 'Post content is required'],
    },
    excerpt: {
      type: String,
      required: [true, 'Post excerpt is required'],
      trim: true,
      maxlength: [500, 'Excerpt cannot exceed 500 characters'],
    },
    coverImage: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      required: [true, 'Post category is required'],
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced'],
      default: 'Intermediate',
    },
    readingTime: {
      type: Number,
      default: 1,
      min: 1,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    bookmarks: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
    },
    moderationReason: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Indexes
PostSchema.index({ author: 1, createdAt: -1 });
PostSchema.index({ category: 1, difficulty: 1, createdAt: -1 });
PostSchema.index({ likes: 1 });
PostSchema.index({ bookmarks: 1 });
PostSchema.index({ isFeatured: 1, createdAt: -1 });

// Full text search for posts
PostSchema.index(
  { title: 'text', content: 'text', category: 'text' },
  { weights: { title: 10, category: 5, content: 1 }, name: 'post_text_search' }
);

export const Post = mongoose.model<IPost>('Post', PostSchema);
