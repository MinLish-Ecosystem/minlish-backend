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

// GET  /api/v1/vocab/sets          — My Library (search + filter + pagination)
router.get("/sets", verifyToken, validateZod(searchQuerySchema), getUserSetsController);

// GET  /api/v1/vocab/sets/public   — Explore public sets (search + filter mạnh)
// NOTE: Route này PHẢI đứng TRƯỚC /sets/:id để tránh conflict
router.get("/sets/public", verifyToken, validateZod(searchQuerySchema), getPublicSetsController);

// GET  /api/v1/vocab/sets/:id      — Chi tiết một bộ từ
router.get("/sets/:id", verifyToken, getSetDetailController);

// POST /api/v1/vocab/sets          — Tạo bộ từ mới
router.post("/sets", verifyToken, validateZod(createSetSchema), createSetController);

// PUT  /api/v1/vocab/sets/:id      — Cập nhật bộ từ
router.put("/sets/:id", verifyToken, validateZod(updateSetSchema), updateSetController);

// DELETE /api/v1/vocab/sets/:id    — Xóa bộ từ (cascade words + progress)
router.delete("/sets/:id", verifyToken, deleteSetController);

// POST /api/v1/vocab/sets/:id/clone          — Clone public set về My Library
router.post("/sets/:id/clone", verifyToken, clonePublicSetController);

// POST /api/v1/vocab/sets/:id/cancel-pending  — Cancel pending review (atomic, race-safe)
router.post("/sets/:id/cancel-pending", verifyToken, cancelPendingApprovalController);

// ─── Words trong một Set ────────────────────────────────────────────────────

// GET  /api/v1/vocab/sets/:id/words           — Danh sách từ (có text search ?q=)
router.get("/sets/:id/words", verifyToken, validateZod(searchQuerySchema), getWordsController);

// POST /api/v1/vocab/sets/:id/words           — Thêm từ mới
router.post("/sets/:id/words", verifyToken, validateZod(addWordSchema), addWordController);

// PUT  /api/v1/vocab/sets/:id/words/:wordId   — Sửa từ
router.put("/sets/:id/words/:wordId", verifyToken, validateZod(updateWordSchema), updateWordController);

// DELETE /api/v1/vocab/sets/:id/words/:wordId — Xóa từ
router.delete("/sets/:id/words/:wordId", verifyToken, deleteWordController);

export default router;

