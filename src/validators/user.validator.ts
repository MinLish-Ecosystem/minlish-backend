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
