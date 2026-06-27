import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IComment extends Document {
  content: string;
  author: Types.ObjectId;
  post: Types.ObjectId;
  parentComment?: Types.ObjectId | null;
  likes: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      maxlength: [500, 'Comment cannot exceed 500 characters'],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

CommentSchema.index({ post: 1, createdAt: 1 });

export const Comment = mongoose.model<IComment>('Comment', CommentSchema);

