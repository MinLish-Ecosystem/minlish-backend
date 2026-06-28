import crypto from 'crypto';

/**
 * Tạo mã OTP 6 chữ số ngẫu nhiên
 * Dùng crypto để bảo mật hơn Math.random()
 */
export const generateOTP = (length: number = 6): string => {
  if (length <= 0) length = 6;
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const otp = crypto.randomInt(min, max + 1);
  return otp.toString().padStart(length, '0');
};

/**
 * Tính thời điểm hết hạn OTP
 * @param minutes - Số phút OTP còn hiệu lực (mặc định 10 phút)
 */
export const getOTPExpiresAt = (minutes: number = 10): Date => {
  return new Date(Date.now() + minutes * 60 * 1000);
};
