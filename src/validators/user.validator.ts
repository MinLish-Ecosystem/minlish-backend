import { body } from 'express-validator';

/**
 * Rules validate cho Update Profile
 */
export const updateProfileValidator = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
    .trim(),

  body('avatar')
    .optional()
    .isURL().withMessage('Avatar must be a valid URL')
    .trim(),
];

export const requestEmailChangeValidator = [
  body('newEmail')
    .notEmpty().withMessage('New email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
];

export const confirmEmailChangeValidator = [
  body('newEmail')
    .notEmpty().withMessage('New email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('otp')
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 characters')
    .isNumeric().withMessage('OTP must contain only numbers'),
];

/**
 * Rules validate cho Learning Profile update (Phase 2-B)
 */
export const learningProfileValidator = [
  body('learningGoal')
    .optional()
    .isIn(['ielts', 'toeic', 'business', 'travel', 'general', 'other'])
    .withMessage('Invalid learning goal'),
  body('targetLevel')
    .optional()
    .isIn(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
    .withMessage('Invalid target level'),
  body('dailyGoal')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('dailyGoal must be between 1 and 100'),
  body('reviewPerDay')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('reviewPerDay must be between 1 and 200'),
  body('reminderTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('reminderTime must be in HH:mm format'),
  body('timezone')
    .optional()
    .isString()
    .withMessage('timezone must be a string'),
  body('preferences.pushNotification')
    .optional()
    .isBoolean()
    .withMessage('preferences.pushNotification must be boolean'),
  body('preferences.soundEffect')
    .optional()
    .isBoolean()
    .withMessage('preferences.soundEffect must be boolean'),
];

/**
 * Rules validate cho FCM Token (Phase 5-B)
 */
export const fcmTokenValidator = [
  body('token')
    .notEmpty()
    .withMessage('FCM token is required'),
  body('deviceId')
    .notEmpty()
    .withMessage('deviceId is required'),
  body('platform')
    .isIn(['android', 'ios', 'web'])
    .withMessage('platform must be android, ios, or web'),
];
