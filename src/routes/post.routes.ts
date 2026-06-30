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

/**
 * @swagger
 * tags:
 *   - name: Posts
 *     description: Quản lý bài viết và bình luận cộng đồng (yêu cầu đăng nhập)
 */

/**
 * @swagger
 * /api/v1/posts:
 *   get:
 *     summary: Lấy danh sách bài viết cộng đồng (hỗ trợ search, filter, sort, pagination)
 *     tags: [Posts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *     responses:
 *       200:
 *         description: Danh sách bài viết
 */

// GET /api/v1/posts - Lấy danh sách bài viết (query: q, category, difficulty, readingTime, sortBy, page, limit)
router.get('/', verifyToken, validateZod(queryPostSchema), getPosts);

/**
 * @swagger
 * /api/v1/posts:
 *   post:
 *     summary: Tạo bài viết mới
 *     tags: [Posts]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               category:
 *                 type: string
 *               difficulty:
 *                 type: string
 *     responses:
 *       201:
 *         description: Đã tạo bài viết thành công
 */
router.post('/', verifyToken, validateZod(createPostSchema), createPost);

/**
 * @swagger
 * /api/v1/posts/{id}:
 *   get:
 *     summary: Chi tiết bài viết theo ID
 *     tags: [Posts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chi tiết bài viết
 */
router.get('/:id', verifyToken, getPostDetail);

/**
 * @swagger
 * /api/v1/posts/{id}:
 *   put:
 *     summary: Chỉnh sửa bài viết
 *     tags: [Posts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put('/:id', verifyToken, validateZod(updatePostSchema), updatePost);

/**
 * @swagger
 * /api/v1/posts/{id}:
 *   delete:
 *     summary: Xóa bài viết
 *     tags: [Posts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
router.delete('/:id', verifyToken, deletePost);

/**
 * @swagger
 * /api/v1/posts/{id}/like:
 *   post:
 *     summary: Thích hoặc bỏ thích bài viết
 *     tags: [Posts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thao tác thành công
 */
router.post('/:id/like', verifyToken, toggleLike);

/**
 * @swagger
 * /api/v1/posts/{id}/bookmark:
 *   post:
 *     summary: Bookmark hoặc bỏ bookmark bài viết
 *     tags: [Posts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thao tác thành công
 */
router.post('/:id/bookmark', verifyToken, toggleBookmark);

/**
 * @swagger
 * /api/v1/posts/{id}/comments:
 *   get:
 *     summary: Lấy danh sách bình luận của bài viết
 *     tags: [Posts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Danh sách bình luận
 */
router.get('/:id/comments', verifyToken, getComments);

/**
 * @swagger
 * /api/v1/posts/{id}/comments:
 *   post:
 *     summary: Thêm bình luận mới vào bài viết
 *     tags: [Posts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Thêm bình luận thành công
 */
router.post('/:id/comments', verifyToken, validateZod(createCommentSchema), addComment);

/**
 * @swagger
 * /api/v1/posts/comments/{commentId}/like:
 *   post:
 *     summary: Thích hoặc bỏ thích bình luận
 *     tags: [Posts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thao tác thành công
 */
router.post('/comments/:commentId/like', verifyToken, toggleLikeComment);

export default router;
