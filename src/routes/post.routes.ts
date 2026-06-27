import { Router } from 'express';
import { verifyToken } from '../middlewares/auth.middleware';
import { validateZod } from '../middlewares/validate.middleware';
import {
  createPostSchema,
  createCommentSchema,
  queryPostSchema,
  updatePostSchema,
} from '../validators/post.schema';
import {
  getPosts,
  createPost,
  getPostDetail,
  toggleLike,
  toggleBookmark,
  getComments,
  addComment,
  toggleLikeComment,
  updatePost,
  deletePost,
} from '../controllers/post.controller';

const router = Router();

// GET /api/v1/posts - Lấy danh sách bài viết (query: q, category, difficulty, readingTime, sortBy, page, limit)
router.get('/', verifyToken, validateZod(queryPostSchema), getPosts);

// POST /api/v1/posts - Tạo bài viết mới
router.post('/', verifyToken, validateZod(createPostSchema), createPost);

// GET /api/v1/posts/:id - Chi tiết bài viết
router.get('/:id', verifyToken, getPostDetail);

// PUT /api/v1/posts/:id - Chỉnh sửa bài viết
router.put('/:id', verifyToken, validateZod(updatePostSchema), updatePost);

// DELETE /api/v1/posts/:id - Xóa bài viết
router.delete('/:id', verifyToken, deletePost);

// POST /api/v1/posts/:id/like - Like/Unlike bài viết
router.post('/:id/like', verifyToken, toggleLike);

// POST /api/v1/posts/:id/bookmark - Bookmark/Unbookmark bài viết
router.post('/:id/bookmark', verifyToken, toggleBookmark);

// GET /api/v1/posts/:id/comments - Lấy danh sách bình luận
router.get('/:id/comments', verifyToken, getComments);

// POST /api/v1/posts/:id/comments - Thêm bình luận mới
router.post('/:id/comments', verifyToken, validateZod(createCommentSchema), addComment);

// POST /api/v1/posts/comments/:commentId/like - Like/Unlike bình luận
router.post('/comments/:commentId/like', verifyToken, toggleLikeComment);

export default router;
