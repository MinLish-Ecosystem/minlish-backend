import { z } from 'zod';

export const createPostSchema = z.object({
  body: z.object({
    title: z.string({ message: 'Title is required' })
      .trim()
      .min(1, 'Title is required')
      .max(150, 'Title cannot exceed 150 characters'),
    content: z.string({ message: 'Content is required' })
      .trim()
      .min(1, 'Content is required'),
    category: z.string({ message: 'Category is required' })
      .trim()
      .min(1, 'Category is required'),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced'], {
      message: 'Difficulty must be Beginner, Intermediate, or Advanced',
    }).optional(),
    coverImage: z.string().trim().optional(),
    isFeatured: z.boolean().optional(),
    isPublic: z.boolean().optional(),
  }),
});

export const createCommentSchema = z.object({
  body: z.object({
    content: z.string({ message: 'Comment content is required' })
      .trim()
      .min(1, 'Comment content is required')
      .max(500, 'Comment cannot exceed 500 characters'),
    parentComment: z.string().trim().optional(),
  }),
});

export const queryPostSchema = z.object({
  query: z.object({
    q: z.string().optional(),
    category: z.string().optional(),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
    readingTime: z.enum(['short', 'medium', 'long']).optional(),
    sortBy: z.enum(['latest', 'popular', 'trending', 'discussed']).optional(),
    author: z.string().optional(),
    bookmarked: z.string().optional(),
    manage: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }),
});

export const updatePostSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title cannot be empty').max(150, 'Title cannot exceed 150 characters').optional(),
    content: z.string().trim().min(1, 'Content cannot be empty').optional(),
    category: z.string().trim().min(1, 'Category cannot be empty').optional(),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
    coverImage: z.string().trim().optional(),
    isFeatured: z.boolean().optional(),
    isPublic: z.boolean().optional(),
  }),
});
