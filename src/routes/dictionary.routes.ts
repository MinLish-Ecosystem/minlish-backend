import {Router} from "express";
import {verifyToken} from "../middlewares/auth.middleware";
import {lookupWordController, batchLookupController} from "../controllers/dictionary.controller";

const router = Router();
router.use(verifyToken);
router.get("/lookup", lookupWordController);
router.post("/batch-lookup", batchLookupController);
export default router;