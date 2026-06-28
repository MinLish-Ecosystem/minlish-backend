// ─────────────────────────────────────────────────────────────────────────────
// User Service — Nhàn phụ trách
// ─────────────────────────────────────────────────────────────────────────────
import { User } from '../models/User';
import { UserProfile } from '../models/UserProfile';

import { AppError } from '../utils/AppError';
import { HttpStatus } from '../constants/httpStatus';
import { ErrorCodes } from '../constants/errorCodes';
import { OTP } from '../models/OTP';
import { generateOTP, getOTPExpiresAt } from '../utils/otp.util';
import { sendEmailChangeRequestEmail, sendChangePasswordMfaEmail } from './mail.service';
import { updateImage } from './cloudinary.service';
import { getOrCreateSystemConfig } from '../models/SystemConfig';

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
    if (data.avatar && (data.avatar.startsWith('data:image/') || data.avatar.includes('base64,'))) {
      const uploadRes = await updateImage(user.avatar, data.avatar, 'minlish_avatars');
      user.avatar = uploadRes.secure_url;
    } else {
      user.avatar = data.avatar ? data.avatar.trim() : null;
    }
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

/**
 * Lấy learning profile của user (mục tiêu học tập, cài đặt)
 */
export const getLearningProfile = async (userId: string) => {
  let profile = await UserProfile.findOne({ userId });
  if (!profile) {
    profile = await UserProfile.create({
      userId,
      learningGoal: 'general',
      dailyGoal: 20,
      reviewPerDay: 40,
      reminderTime: '20:00',
      preferences: {
        pushNotification: true,
        emailNotification: true,
        soundEffect: true,
      }
    });
  }
  return {
    learningGoal: profile.learningGoal,
    targetLevel: profile.targetLevel,
    currentLevel: profile.currentLevel,
    dailyGoal: profile.dailyGoal,
    reviewPerDay: profile.reviewPerDay ?? 40,
    reminderTime: profile.reminderTime,
    timezone: profile.timezone,
    preferences: {
      pushNotification: profile.preferences.pushNotification,
      emailNotification: profile.preferences.emailNotification,
      soundEffect: profile.preferences.soundEffect,
    },
  };
};

/**
 * Cập nhật learning profile (upsert nếu chưa tồn tại)
 */
export const updateLearningProfile = async (
  userId: string,
  data: Partial<{
    learningGoal: "ielts" | "toeic" | "business" | "travel" | "general" | "other";
    targetLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
    dailyGoal: number;
    reviewPerDay: number;
    reminderTime: string;
    timezone: string;
    preferences: { pushNotification?: boolean; emailNotification?: boolean; soundEffect?: boolean };
  }>,
) => {
  const updateData: Record<string, any> = {};
  if (data.learningGoal !== undefined) updateData.learningGoal = data.learningGoal;
  if (data.targetLevel !== undefined) updateData.targetLevel = data.targetLevel;
  if (data.dailyGoal !== undefined) updateData.dailyGoal = data.dailyGoal;
  if (data.reviewPerDay !== undefined) updateData.reviewPerDay = data.reviewPerDay;
  if (data.reminderTime !== undefined) updateData.reminderTime = data.reminderTime;
  if (data.timezone !== undefined) updateData.timezone = data.timezone;
  if (data.preferences?.pushNotification !== undefined) {
    updateData['preferences.pushNotification'] = data.preferences.pushNotification;
  }
  if (data.preferences?.emailNotification !== undefined) {
    updateData['preferences.emailNotification'] = data.preferences.emailNotification;
  }
  if (data.preferences?.soundEffect !== undefined) {
    updateData['preferences.soundEffect'] = data.preferences.soundEffect;
  }

  const profile = await UserProfile.findOneAndUpdate(
    { userId },
    { $set: updateData },
    { new: true, upsert: true, runValidators: true },
  );

  return {
    learningGoal: profile.learningGoal,
    targetLevel: profile.targetLevel,
    currentLevel: profile.currentLevel,
    dailyGoal: profile.dailyGoal,
    reviewPerDay: profile.reviewPerDay ?? 40,
    reminderTime: profile.reminderTime,
    timezone: profile.timezone,
    preferences: {
      pushNotification: profile.preferences.pushNotification,
      emailNotification: profile.preferences.emailNotification,
      soundEffect: profile.preferences.soundEffect,
    },
  };
};

/**
 * Yêu cầu đổi mật khẩu (hỗ trợ kiểm tra MFA cho Admin)
 */
export const changePasswordService = async (
  userId: string,
  data: { oldPassword: string; newPassword: string }
): Promise<{ mfaRequired: boolean; message?: string }> => {
  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new AppError('Không tìm thấy người dùng', HttpStatus.NOT_FOUND, ErrorCodes.USER_NOT_FOUND);
  }

  // So sánh mật khẩu cũ
  const isMatch = await user.comparePassword(data.oldPassword);
  if (!isMatch) {
    throw new AppError('Mật khẩu hiện tại không chính xác', HttpStatus.BAD_REQUEST, ErrorCodes.INVALID_CREDENTIALS);
  }

  // Kiểm tra MFA đối với Admin
  if (user.role === 'admin') {
    const config = await getOrCreateSystemConfig();
    if (config.enforceMfaAdmin) {
      // Xóa OTP đổi mật khẩu cũ
      await OTP.deleteMany({ email: user.email, type: 'change_password' });

      // Sinh OTP mới
      const otpCode = generateOTP(config.otpLength || 6);
      const expiresAt = getOTPExpiresAt(5); // 5 phút

      await OTP.create({
        email: user.email,
        otp: otpCode,
        type: 'change_password',
        expiresAt,
      });

      // Gửi email
      await sendChangePasswordMfaEmail(user.email, user.name, otpCode);

      return { mfaRequired: true };
    }
  }

  // Đổi mật khẩu trực tiếp (với User thường hoặc khi Admin tắt MFA)
  user.password = data.newPassword;
  await user.save();

  return { mfaRequired: false, message: 'Đổi mật khẩu thành công' };
};

/**
 * Xác nhận mã OTP và hoàn tất đổi mật khẩu
 */
export const verifyChangePasswordService = async (
  userId: string,
  data: { oldPassword: string; newPassword: string; otp: string }
): Promise<{ message: string }> => {
  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new AppError('Không tìm thấy người dùng', HttpStatus.NOT_FOUND, ErrorCodes.USER_NOT_FOUND);
  }

  // So sánh mật khẩu cũ lần nữa để đảm bảo an toàn
  const isMatch = await user.comparePassword(data.oldPassword);
  if (!isMatch) {
    throw new AppError('Mật khẩu hiện tại không chính xác', HttpStatus.BAD_REQUEST, ErrorCodes.INVALID_CREDENTIALS);
  }

  // Xác minh OTP
  const otpRecord = await OTP.findOne({
    email: user.email,
    otp: data.otp,
    type: 'change_password',
  });

  if (!otpRecord) {
    throw new AppError('Mã OTP xác thực không chính xác hoặc đã hết hạn', HttpStatus.BAD_REQUEST, ErrorCodes.OTP_INVALID);
  }

  // Xóa OTP
  await OTP.deleteOne({ _id: otpRecord._id });

  // Lưu mật khẩu mới
  user.password = data.newPassword;
  await user.save();

  return { message: 'Đổi mật khẩu thành công' };
};
