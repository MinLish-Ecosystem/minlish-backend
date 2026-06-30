import { Router } from "express";
import { verifyToken } from "../middlewares/auth.middleware";
import { validateZod } from "../middlewares/validate.middleware";
import {
  createSetSchema,
  updateSetSchema,
  addWordSchema,
  updateWordSchema,
  searchQuerySchema,
} from "../validators/vocab.schema";
import {
  getUserSetsController,
  getPublicSetsController,
  getSetDetailController,
  createSetController,
  updateSetController,
  deleteSetController,
  clonePublicSetController,
  cancelPendingApprovalController,
  getWordsController,
  addWordController,
  updateWordController,
  deleteWordController,
} from "../controllers/vocab.controller";

/**
 * @swagger
 * tags:
 *   - name: Vocabulary
 *     description: Quản lý bộ từ vựng và từ vựng (yêu cầu đăng nhập)
 */

const router = Router();

// ─── Vocabulary Sets ────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/vocab/sets:
 *   get:
 *     summary: Lấy danh sách bộ từ vựng cá nhân (My Library)
 *     tags: [Vocabulary]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Danh sách bộ từ vựng
 */
router.get("/sets", verifyToken, validateZod(searchQuerySchema), getUserSetsController);

/**
 * @swagger
 * /api/v1/vocab/sets/public:
 *   get:
 *     summary: Khám phá các bộ từ vựng công khai
 *     tags: [Vocabulary]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Danh sách bộ từ vựng công khai
 */
router.get("/sets/public", verifyToken, validateZod(searchQuerySchema), getPublicSetsController);

/**
 * @swagger
 * /api/v1/vocab/sets/{id}:
 *   get:
 *     summary: Chi tiết bộ từ vựng
 *     tags: [Vocabulary]
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
 *         description: Thông tin chi tiết bộ từ vựng
 */
router.get("/sets/:id", verifyToken, getSetDetailController);

/**
 * @swagger
 * /api/v1/vocab/sets:
 *   post:
 *     summary: Tạo bộ từ vựng mới
 *     tags: [Vocabulary]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               level:
 *                 type: string
 *     responses:
 *       201:
 *         description: Đã tạo bộ từ thành công
 */
router.post("/sets", verifyToken, validateZod(createSetSchema), createSetController);

/**
 * @swagger
 * /api/v1/vocab/sets/{id}:
 *   put:
 *     summary: Chỉnh sửa bộ từ vựng
 *     tags: [Vocabulary]
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put("/sets/:id", verifyToken, validateZod(updateSetSchema), updateSetController);

/**
 * @swagger
 * /api/v1/vocab/sets/{id}:
 *   delete:
 *     summary: Xóa bộ từ vựng
 *     tags: [Vocabulary]
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
router.delete("/sets/:id", verifyToken, deleteSetController);

/**
 * @swagger
 * /api/v1/vocab/sets/{id}/clone:
 *   post:
 *     summary: Nhân bản (clone) một bộ từ vựng công khai về thư viện cá nhân
 *     tags: [Vocabulary]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Đã clone thành công
 */
router.post("/sets/:id/clone", verifyToken, clonePublicSetController);

/**
 * @swagger
 * /api/v1/vocab/sets/{id}/cancel-pending:
 *   post:
 *     summary: Hủy yêu cầu phê duyệt công khai bộ từ vựng (chuyển về chế độ cá nhân)
 *     tags: [Vocabulary]
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
 *         description: Thu hồi thành công
 */
router.post("/sets/:id/cancel-pending", verifyToken, cancelPendingApprovalController);

// ─── Words trong một Set ────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/vocab/sets/{id}/words:
 *   get:
 *     summary: Lấy danh sách từ trong một bộ từ
 *     tags: [Vocabulary]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Danh sách từ vựng
 */
router.get("/sets/:id/words", verifyToken, validateZod(searchQuerySchema), getWordsController);

/**
 * @swagger
 * /api/v1/vocab/sets/{id}/words:
 *   post:
 *     summary: Thêm từ vựng mới vào bộ từ
 *     tags: [Vocabulary]
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
 *             required: [word, definition]
 *             properties:
 *               word:
 *                 type: string
 *               definition:
 *                 type: string
 *               phonetic:
 *                 type: string
 *               translation:
 *                 type: string
 *     responses:
 *       210:
 *         description: Đã thêm từ thành công
 */
router.post("/sets/:id/words", verifyToken, validateZod(addWordSchema), addWordController);

/**
 * @swagger
 * /api/v1/vocab/sets/{id}/words/{wordId}:
 *   put:
 *     summary: Chỉnh sửa từ vựng
 *     tags: [Vocabulary]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: wordId
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
 *               word:
 *                 type: string
 *               definition:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put("/sets/:id/words/:wordId", verifyToken, validateZod(updateWordSchema), updateWordController);

/**
 * @swagger
 * /api/v1/vocab/sets/{id}/words/{wordId}:
 *   delete:
 *     summary: Xóa từ vựng khỏi bộ từ
 *     tags: [Vocabulary]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: wordId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa từ thành công
 */
router.delete("/sets/:id/words/:wordId", verifyToken, deleteWordController);

export default router;

