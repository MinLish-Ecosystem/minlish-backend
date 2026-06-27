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

// GET /api/v1/practice/daily - Get daily quiz challenge
router.get("/daily", verifyToken, getDailyChallenge);

// POST /api/v1/practice/submit - Submit daily challenge answers
router.post("/submit", verifyToken, validateZod(submitPracticeSchema), submitDailyChallenge);

// GET /api/v1/practice/leaderboard - Get daily practice leaderboard
router.get("/leaderboard", verifyToken, getDailyLeaderboard);

export default router;
