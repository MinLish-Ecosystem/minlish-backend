// ─────────────────────────────────────────────────────────────────────────────
// OTP Service — Nhàn phụ trách
// ─────────────────────────────────────────────────────────────────────────────
import { OTP } from '../models/OTP';
import { generateOTP, getOTPExpiresAt } from '../utils/otp.util';

/**
 * Tạo và lưu OTP mới vào DB
 */
export const createOTP = async (
  email: string,
  type: 'verify_email' | 'reset_password'
): Promise<string> => {
  // Xóa OTP cũ cùng loại (nếu có) trước khi tạo mới
  await OTP.deleteMany({ email, type });

  const otp = generateOTP();
  const expiresAt = getOTPExpiresAt(10); // 10 phút

  await OTP.create({ email, otp, type, expiresAt });
  return otp;
};

/**
 * Xác minh OTP
 */
export const verifyOTP = async (
  _email: string,
  _otp: string,
  _type: 'verify_email' | 'reset_password'
): Promise<boolean> => {
  throw new Error('Not implemented');
};
