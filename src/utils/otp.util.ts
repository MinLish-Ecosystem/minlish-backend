import crypto from 'crypto';

/**
 * Tạo mã OTP 6 chữ số ngẫu nhiên
 * Dùng crypto để bảo mật hơn Math.random()
 */
export const generateOTP = (): string => {
  // Tạo số ngẫu nhiên từ 100000 đến 999999
  const otp = crypto.randomInt(100000, 999999);
  return otp.toString();
};

/**
 * Tính thời điểm hết hạn OTP
 * @param minutes - Số phút OTP còn hiệu lực (mặc định 10 phút)
 */
export const getOTPExpiresAt = (minutes: number = 10): Date => {
  return new Date(Date.now() + minutes * 60 * 1000);
};
