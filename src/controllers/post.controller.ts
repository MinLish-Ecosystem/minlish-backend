import { Request, Response } from 'express';
import { Post } from '../models/Post';
import { Comment } from '../models/Comment';
import { sendSuccess, sendError } from '../utils/response.util';
import { catchAsync } from '../utils/catchAsync';
import { HttpStatus } from '../constants/httpStatus';
import mongoose from 'mongoose';

/**
 * GET /api/v1/posts
 * Lấy danh sách bài viết cộng đồng (hỗ trợ search, filter, sort, pagination)
 */
export const getPosts = catchAsync(async (req: Request, res: Response) => {
  const currentUserId = req.user?.id;
  const q = req.query.q as string | undefined;
  const category = req.query.category as string | undefined;
  const difficulty = req.query.difficulty as string | undefined;
  const readingTime = req.query.readingTime as string | undefined;
  const sortBy = req.query.sortBy as string | undefined;
  const author = req.query.author as string | undefined;
  const bookmarked = req.query.bookmarked as string | undefined;

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 12;
  const skip = (page - 1) * limit;

  // Build match object
  const matchStage: any = {};
  if (q) {
    matchStage.$or = [
      { title: { $regex: q, $options: 'i' } },
      { content: { $regex: q, $options: 'i' } },
      { category: { $regex: q, $options: 'i' } },
    ];
  }
  if (category && category !== 'All Topics' && category !== 'All') {
    matchStage.category = category;
  }
  if (difficulty) {
    matchStage.difficulty = difficulty;
  }
  if (readingTime) {
    if (readingTime === 'short') {
      matchStage.readingTime = { $lt: 5 };
    } else if (readingTime === 'medium') {
      matchStage.readingTime = { $gte: 5, $lte: 10 };
    } else if (readingTime === 'long') {
      matchStage.readingTime = { $gt: 10 };
    }
  }

  const isManager = req.query.manage === 'true';
  if (isManager && currentUserId) {
    matchStage.author = new mongoose.Types.ObjectId(currentUserId);
  } else {
    if (author && mongoose.Types.ObjectId.isValid(author)) {
      matchStage.author = new mongoose.Types.ObjectId(author);
      if (author !== currentUserId) {
        matchStage.isPublic = true;
        matchStage.moderationStatus = 'approved';
      }
    } else {
      matchStage.isPublic = true;
      matchStage.moderationStatus = 'approved';
    }
  }

  if (bookmarked === 'true' && currentUserId && mongoose.Types.ObjectId.isValid(currentUserId)) {
    matchStage.bookmarks = new mongoose.Types.ObjectId(currentUserId);
  }



  // Sort order stage
  let sortStage: any = { createdAt: -1 };
  if (sortBy === 'popular') {
    sortStage = { likeCount: -1, createdAt: -1 };
  } else if (sortBy === 'discussed') {
    sortStage = { commentCount: -1, createdAt: -1 };
  } else if (sortBy === 'trending') {
    sortStage = { likeCount: -1, commentCount: -1, createdAt: -1 };
  }

  // Count total matching documents
  const total = await Post.countDocuments(matchStage);

  // Aggregation query
  const posts = await Post.aggregate([
    { $match: matchStage },
    // Look up author
    {
      $lookup: {
        from: 'users',
        localField: 'author',
        foreignField: '_id',
        as: 'authorInfo',
      },
    },
    { $unwind: '$authorInfo' },
    // Look up comments
    {
      $lookup: {
        from: 'comments',
        localField: '_id',
        foreignField: 'post',
        as: 'commentsInfo',
      },
    },
    // Project output fields
    {
      $project: {
        title: 1,
        content: 1,
        excerpt: 1,
        coverImage: 1,
        category: 1,
        difficulty: 1,
        readingTime: 1,
        likes: 1,
        bookmarks: 1,
        isFeatured: 1,
        isPublic: 1,
        moderationStatus: 1,
        moderationReason: 1,
        createdAt: 1,
        updatedAt: 1,
        author: {
          _id: '$authorInfo._id',
          name: '$authorInfo.name',
          avatar: '$authorInfo.avatar',
          email: '$authorInfo.email',
        },
        likeCount: { $size: { $ifNull: ['$likes', []] } },
        commentCount: { $size: { $ifNull: ['$commentsInfo', []] } },
      },
    },
    { $sort: sortStage },
    { $skip: skip },
    { $limit: limit },
  ]);

  // Compute boolean fields for the current user
  const formattedPosts = posts.map((post) => ({
    ...post,
    isLiked: currentUserId
      ? post.likes.some((id: any) => id.toString() === currentUserId.toString())
      : false,
    isBookmarked: currentUserId
      ? post.bookmarks.some((id: any) => id.toString() === currentUserId.toString())
      : false,
  }));

  const totalPages = Math.ceil(total / limit);

  return sendSuccess(res, 'Posts fetched successfully', formattedPosts, HttpStatus.OK, {
    page,
    limit,
    total,
    totalPages,
  });
});

/**
 * POST /api/v1/posts
 * Tạo một bài viết cộng đồng mới
 */
export const createPost = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const { title, content, category, difficulty, coverImage, isFeatured, isPublic } = req.body;

  // Auto-calculate reading time: avg 200 words/min
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  // Generate excerpt if not provided
  const cleanContent = content.replace(/<[^>]*>/g, ''); // strip HTML if any
  const excerpt = cleanContent.length > 180 ? `${cleanContent.substring(0, 180)}...` : cleanContent;

  const postIsPublic = isPublic === true;
  let moderationStatus: 'pending' | 'approved' | 'rejected' = 'approved';
  if (userRole === 'admin') {
    moderationStatus = 'approved';
  } else if (postIsPublic) {
    moderationStatus = 'pending';
  }

  const post = await Post.create({
    title,
    content,
    excerpt,
    category,
    difficulty: difficulty || 'Intermediate',
    coverImage: coverImage || '',
    readingTime,
    author: userId,
    isFeatured: isFeatured || false,
    isPublic: postIsPublic,
    moderationStatus,
    likes: [],
    bookmarks: [],
  });

  // Populate author details
  const populatedPost = await post.populate('author', 'name avatar email');

  return sendSuccess(res, 'Post created successfully', populatedPost, HttpStatus.CREATED);
});

/**
 * GET /api/v1/posts/:id
 * Lấy chi tiết bài viết
 */
export const getPostDetail = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = req.user?.id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid post ID', HttpStatus.BAD_REQUEST);
  }

  const post = await Post.findById(id).populate('author', 'name avatar email');
  if (!post) {
    return sendError(res, 'Post not found', HttpStatus.NOT_FOUND);
  }

  // Get comments count
  const commentCount = await Comment.countDocuments({ post: id });

  const postObj = post.toObject();
  const formattedPost = {
    ...postObj,
    likeCount: post.likes.length,
    commentCount,
    isLiked: currentUserId
      ? post.likes.some((uid: any) => uid.toString() === currentUserId.toString())
      : false,
    isBookmarked: currentUserId
      ? post.bookmarks.some((uid: any) => uid.toString() === currentUserId.toString())
      : false,
  };

  return sendSuccess(res, 'Post details fetched successfully', formattedPost);
});

/**
 * POST /api/v1/posts/:id/like
 * Like/Unlike bài viết
 */
export const toggleLike = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid post ID', HttpStatus.BAD_REQUEST);
  }

  const post = await Post.findById(id);
  if (!post) {
    return sendError(res, 'Post not found', HttpStatus.NOT_FOUND);
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const likeIndex = post.likes.findIndex((uid: any) => uid.toString() === userId.toString());

  let isLiked = false;
  if (likeIndex > -1) {
    // Unlike
    post.likes.splice(likeIndex, 1);
  } else {
    // Like
    post.likes.push(userObjectId);
    isLiked = true;
  }

  await post.save();

  return sendSuccess(res, isLiked ? 'Post liked successfully' : 'Post unliked successfully', {
    isLiked,
    likeCount: post.likes.length,
  });
});

/**
 * POST /api/v1/posts/:id/bookmark
 * Bookmark/Unbookmark bài viết
 */
export const toggleBookmark = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid post ID', HttpStatus.BAD_REQUEST);
  }

  const post = await Post.findById(id);
  if (!post) {
    return sendError(res, 'Post not found', HttpStatus.NOT_FOUND);
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const bookmarkIndex = post.bookmarks.findIndex((uid: any) => uid.toString() === userId.toString());

  let isBookmarked = false;
  if (bookmarkIndex > -1) {
    // Unbookmark
    post.bookmarks.splice(bookmarkIndex, 1);
  } else {
    // Bookmark
    post.bookmarks.push(userObjectId);
    isBookmarked = true;
  }

  await post.save();

  return sendSuccess(res, isBookmarked ? 'Post bookmarked' : 'Post bookmark removed', {
    isBookmarked,
  });
});

/**
 * GET /api/v1/posts/:id/comments
 * Lấy danh sách bình luận của bài viết
 */
export const getComments = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = req.user?.id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid post ID', HttpStatus.BAD_REQUEST);
  }

  const comments = await Comment.find({ post: id })
    .populate('author', 'name avatar email')
    .sort({ createdAt: 1 });

  const formattedComments = comments.map((comment) => {
    const commentObj = comment.toObject();
    const commentLikes = comment.likes || [];
    return {
      ...commentObj,
      likeCount: commentLikes.length,
      isLiked: currentUserId
        ? commentLikes.some((uid: any) => uid.toString() === currentUserId.toString())
        : false,
    };
  });

  return sendSuccess(res, 'Comments fetched successfully', formattedComments);
});

/**
 * POST /api/v1/posts/:id/comments
 * Gửi bình luận mới
 */
export const addComment = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { content, parentComment } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid post ID', HttpStatus.BAD_REQUEST);
  }

  const post = await Post.findById(id);
  if (!post) {
    return sendError(res, 'Post not found', HttpStatus.NOT_FOUND);
  }

  if (parentComment && !mongoose.Types.ObjectId.isValid(parentComment)) {
    return sendError(res, 'Invalid parent comment ID', HttpStatus.BAD_REQUEST);
  }

  const comment = await Comment.create({
    content,
    post: id,
    author: userId,
    parentComment: parentComment || null,
    likes: [],
  });

  const populatedComment = await comment.populate('author', 'name avatar email');

  const commentObj = populatedComment.toObject();
  const formattedComment = {
    ...commentObj,
    likeCount: 0,
    isLiked: false,
  };

  return sendSuccess(res, 'Comment added successfully', formattedComment, HttpStatus.CREATED);
});

/**
 * POST /api/v1/posts/comments/:commentId/like
 * Like/Unlike bình luận
 */
export const toggleLikeComment = catchAsync(async (req: Request, res: Response) => {
  const { commentId } = req.params;
  const userId = req.user!.id;

  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    return sendError(res, 'Invalid comment ID', HttpStatus.BAD_REQUEST);
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    return sendError(res, 'Comment not found', HttpStatus.NOT_FOUND);
  }

  if (!comment.likes) {
    comment.likes = [];
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const likeIndex = comment.likes.findIndex((uid: any) => uid.toString() === userId.toString());

  let isLiked = false;
  if (likeIndex > -1) {
    comment.likes.splice(likeIndex, 1);
  } else {
    comment.likes.push(userObjectId);
    isLiked = true;
  }

  await comment.save();

  return sendSuccess(res, isLiked ? 'Comment liked successfully' : 'Comment unliked successfully', {
    isLiked,
    likeCount: comment.likes.length,
  });
});

/**
 * PUT /api/v1/posts/:id
 * Chỉnh sửa bài viết cộng đồng (chỉ tác giả bài viết mới được sửa)
 */
export const updatePost = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const { title, content, category, difficulty, coverImage, isFeatured, isPublic } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid post ID', HttpStatus.BAD_REQUEST);
  }

  const post = await Post.findById(id);
  if (!post) {
    return sendError(res, 'Post not found', HttpStatus.NOT_FOUND);
  }

  // Kiểm tra quyền: tác giả hoặc admin
  if (post.author.toString() !== userId.toString() && userRole !== 'admin') {
    return sendError(res, 'You do not have permission to edit this post', HttpStatus.FORBIDDEN);
  }

  // Cập nhật thông tin bài viết
  if (title !== undefined) post.title = title;
  if (content !== undefined) {
    post.content = content;
    // Tính toán lại thời gian đọc (trung bình 200 từ/phút)
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    post.readingTime = Math.max(1, Math.ceil(wordCount / 200));
    // Tạo lại đoạn trích (excerpt)
    const cleanContent = content.replace(/<[^>]*>/g, '');
    post.excerpt = cleanContent.length > 180 ? `${cleanContent.substring(0, 180)}...` : cleanContent;
  }
  if (category !== undefined) post.category = category;
  if (difficulty !== undefined) post.difficulty = difficulty;
  if (coverImage !== undefined) post.coverImage = coverImage;
  if (isFeatured !== undefined) post.isFeatured = isFeatured;

  if (isPublic !== undefined) {
    post.isPublic = isPublic;
    if (userRole !== 'admin') {
      if (isPublic === true) {
        post.moderationStatus = 'pending';
      }
    } else {
      post.moderationStatus = 'approved';
    }
  } else {
    // If user edited content/title while public, reset moderation status to pending
    if (userRole !== 'admin' && post.isPublic === true && (content !== undefined || title !== undefined)) {
      post.moderationStatus = 'pending';
    }
  }

  await post.save();

  const populatedPost = await post.populate('author', 'name avatar email');

  return sendSuccess(res, 'Post updated successfully', populatedPost);
});

/**
 * DELETE /api/v1/posts/:id
 * Xóa bài viết cộng đồng (tác giả hoặc admin mới được xóa)
 */
export const deletePost = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const userRole = req.user!.role;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid post ID', HttpStatus.BAD_REQUEST);
  }

  const post = await Post.findById(id);
  if (!post) {
    return sendError(res, 'Post not found', HttpStatus.NOT_FOUND);
  }

  // Kiểm tra quyền xóa: chỉ tác giả bài viết hoặc admin
  if (post.author.toString() !== userId.toString() && userRole !== 'admin') {
    return sendError(res, 'You do not have permission to delete this post', HttpStatus.FORBIDDEN);
  }

  // Xóa bài viết
  await Post.findByIdAndDelete(id);

  // Cascade delete bình luận liên quan
  await Comment.deleteMany({ post: id });

  return sendSuccess(res, 'Post deleted successfully');
});

