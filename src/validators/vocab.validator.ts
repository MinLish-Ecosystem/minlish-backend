import { body, query } from "express-validator";

// ─── Vocabulary Set ────────────────────────────────────────────────

/**
 * Validator cho POST /api/v1/vocab/sets  (tạo bộ từ mới)
 * Validator cho PUT  /api/v1/vocab/sets/:id (cập nhật bộ từ)
 */
export const createSetValidator = [
  body("name")
    .trim()
    .notEmpty().withMessage("Set name is required")
    .isLength({ max: 100 }).withMessage("Name cannot exceed 100 characters"),

  body("description")
    .optional()
    .isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters"),

  body("category")
    .optional()
    .isIn(["General", "Business", "IELTS", "TOEIC", "Travel", "Technology", "Academic", "Psychology", "Science", "Other"])
    .withMessage("Invalid category"),

  body("level")
    .optional()
    .isIn(["Beginner", "Intermediate", "Advanced", "Academic"])
    .withMessage("Invalid level"),

  body("colorTheme")
    .optional()
    .isIn(["blue", "emerald", "amber", "purple", "rose", "cyan"])
    .withMessage("Invalid color theme"),

  body("tags")
    .optional()
    .isArray({ max: 10 }).withMessage("Cannot have more than 10 tags")
    .custom((tags: any[]) => tags.every((t) => typeof t === "string" && t.length <= 30))
    .withMessage("Each tag must be a string under 30 characters"),

  body("isPublic")
    .optional()
    .isBoolean().withMessage("isPublic must be a boolean"),
];

// ─── Word ──────────────────────────────────────────────────────────

/**
 * Validator cho POST /api/v1/vocab/sets/:id/words  (thêm từ mới)
 * Validator cho PUT  /api/v1/vocab/sets/:id/words/:wordId (sửa từ)
 */
export const addWordValidator = [
  body("word")
    .trim()
    .notEmpty().withMessage("Word is required")
    .isLength({ max: 100 }).withMessage("Word cannot exceed 100 characters"),

  body("meaning")
    .trim()
    .notEmpty().withMessage("Meaning (definition) is required")
    .isLength({ max: 500 }).withMessage("Meaning cannot exceed 500 characters"),

  body("pronunciation")
    .optional()
    .isString().withMessage("Pronunciation must be a string"),

  body("partOfSpeech")
    .optional()
    .isIn(["noun", "verb", "adjective", "adverb", "phrase", "idiom", "other"])
    .withMessage("Invalid part of speech"),

  body("descriptionEN")
    .optional()
    .isLength({ max: 1000 }).withMessage("Description cannot exceed 1000 characters"),

  body("examples")
    .optional()
    .isArray({ max: 5 }).withMessage("Cannot have more than 5 examples"),

  body("synonyms")
    .optional()
    .isArray({ max: 10 }).withMessage("Cannot have more than 10 synonyms"),

  body("antonyms")
    .optional()
    .isArray({ max: 10 }).withMessage("Cannot have more than 10 antonyms"),

  body("note")
    .optional()
    .isLength({ max: 500 }).withMessage("Note cannot exceed 500 characters"),
];

// ─── Search & Filter Query Params ─────────────────────────────────

/**
 * Validator cho GET /api/v1/vocab/sets (My Library with filters)
 * Validator cho GET /api/v1/vocab/sets/public (Explore with filters)
 */
export const searchQueryValidator = [
  query("q")
    .optional()
    .isString().withMessage("Search query must be a string")
    .isLength({ max: 100 }).withMessage("Search query too long"),

  query("category")
    .optional()
    .isIn(["General", "Business", "IELTS", "TOEIC", "Travel", "Technology", "Academic", "Psychology", "Science", "Other"])
    .withMessage("Invalid category filter"),

  query("level")
    .optional()
    .isIn(["Beginner", "Intermediate", "Advanced", "Academic"])
    .withMessage("Invalid level filter"),

  query("tags")
    .optional()
    .isString().withMessage("Tags must be comma-separated string (e.g. IELTS,Travel)"),

  query("sortBy")
    .optional()
    .isIn(["newest", "oldest", "popular", "alphabetical"])
    .withMessage("sortBy must be: newest | oldest | popular | alphabetical"),

  query("page")
    .optional()
    .isInt({ min: 1 }).withMessage("Page must be a positive integer")
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage("Limit must be between 1 and 50")
    .toInt(),
];
