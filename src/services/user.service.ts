// ─────────────────────────────────────────────────────────────────────────────
// User Service — Nhàn phụ trách
// ─────────────────────────────────────────────────────────────────────────────
import { User } from '../models/User';
import { AppError } from '../utils/AppError';
import { HttpStatus } from '../constants/httpStatus';
import { ErrorCodes } from '../constants/errorCodes';
import { OTP } from '../models/OTP';
import { generateOTP, getOTPExpiresAt } from '../utils/otp.util';
import { sendEmailChangeRequestEmail } from './mail.service';

/**
 * Lấy thông tin profile của user theo ID
 */
export const getUserById = async (userId: string): Promise<any> => {
  const user = await User.findById(userId).select('-password -refreshToken');

  if (!user) {
    throw new AppError('Không tìm thấy người dùng', HttpStatus.NOT_FOUND, ErrorCodes.USER_NOT_FOUND);
  }

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

/**
 * Cập nhật thông tin profile
 */
export const updateUserProfile = async (
  userId: string,
  data: Partial<{ name: string; avatar: string }>
): Promise<any> => {
  const user = await User.findById(userId).select('-password -refreshToken');

  if (!user) {
    throw new AppError('Không tìm thấy người dùng', HttpStatus.NOT_FOUND, ErrorCodes.USER_NOT_FOUND);
  }

  if (data.name !== undefined) {
    user.name = data.name.trim();
  }

  if (data.avatar !== undefined) {
    user.avatar = data.avatar ? data.avatar.trim() : null;
  }

  await user.save();

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

/**
 * Yêu cầu đổi email: gửi OTP tới `newEmail`
 */
export const requestEmailChange = async (userId: string, newEmail: string): Promise<{ message: string }> => {
  const email = newEmail.trim().toLowerCase();

  // Kiểm tra email mới đã tồn tại
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('Email này đã có người sử dụng', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
  }

  const user = await User.findById(userId).select('-password -refreshToken');
  if (!user) {
    throw new AppError('Không tìm thấy người dùng', HttpStatus.NOT_FOUND, ErrorCodes.USER_NOT_FOUND);
  }

  // Xóa OTP cũ cho mục đích change_email trên cùng email
  await OTP.deleteMany({ email, type: 'change_email' });

  const otpCode = generateOTP();
  await OTP.create({
    email,
    otp: otpCode,
    type: 'change_email',
    expiresAt: getOTPExpiresAt(10),
    meta: { requestedBy: userId },
  });

  await sendEmailChangeRequestEmail(email, user.name, otpCode, email);

  return { message: 'Mã OTP xác nhận thay đổi email đã được gửi tới địa chỉ mới.' };
};

/**
 * Xác nhận đổi email bằng OTP
 */
export const confirmEmailChange = async (userId: string, newEmail: string, otp: string): Promise<{ message: string }> => {
  const email = newEmail.trim().toLowerCase();
  const now = new Date();

  const latestOTP = await OTP.findOne({ email, type: 'change_email' }).sort({ createdAt: -1 });
  const validOTP = await OTP.findOne({ email, otp, type: 'change_email' });

  if (!latestOTP) {
    throw new AppError('OTP không tồn tại hoặc đã hết hạn', HttpStatus.GONE, ErrorCodes.VALIDATION_FAILED);
  }

  if (latestOTP.expiresAt < now) {
    throw new AppError('OTP đã hết hạn', HttpStatus.GONE, ErrorCodes.VALIDATION_FAILED);
  }

  if (!validOTP) {
    throw new AppError('OTP không hợp lệ', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
  }

  // Kiểm tra email mới chưa có user (race condition check)
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('Email này đã có người sử dụng', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('Không tìm thấy người dùng', HttpStatus.NOT_FOUND, ErrorCodes.USER_NOT_FOUND);
  }

  user.email = email;
  user.isVerified = true; // since OTP to new email verified
  await user.save();

  // Xóa OTPs liên quan
  await OTP.deleteMany({ email, type: 'change_email' });

  return { message: 'Email đã được cập nhật thành công.' };
};
