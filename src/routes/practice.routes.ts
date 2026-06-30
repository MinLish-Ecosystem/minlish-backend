import { Router } from "express";
import { verifyToken } from "../middlewares/auth.middleware";
import { validateZod } from "../middlewares/validate.middleware";
import {
  getDailyChallenge,
  submitDailyChallenge,
  getDailyLeaderboard,
  submitPracticeSchema,
} from "../controllers/practice.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Practice
 *     description: Luyện tập hàng ngày và Thử thách (yêu cầu đăng nhập)
 */

/**
 * @swagger
 * /api/v1/practice/daily:
 *   get:
 *     summary: Lấy đề thử thách trắc nghiệm hàng ngày (10 câu hỏi ngẫu nhiên từ kho từ của user)
 *     tags: [Practice]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Đề thi thử thách hàng ngày
 */
router.get("/daily", verifyToken, getDailyChallenge);

/**
 * @swagger
 * /api/v1/practice/submit:
 *   post:
 *     summary: Nộp kết quả làm bài trắc nghiệm thử thách hàng ngày
 *     tags: [Practice]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [answers]
 *             properties:
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [wordId, selectedOption, isCorrect]
 *                   properties:
 *                     wordId:
 *                       type: string
 *                     selectedOption:
 *                       type: string
 *                     isCorrect:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Điểm số đạt được và cập nhật SRS
 */
router.post("/submit", verifyToken, validateZod(submitPracticeSchema), submitDailyChallenge);

/**
 * @swagger
 * /api/v1/practice/leaderboard:
 *   get:
 *     summary: Xem bảng xếp hạng luyện tập hàng ngày
 *     tags: [Practice]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách bảng xếp hạng (Top users)
 */
router.get("/leaderboard", verifyToken, getDailyLeaderboard);

export default router;
