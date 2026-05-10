import { User } from '../models/User';
<<<<<<< Updated upstream
=======
import { OTP } from '../models/OTP';
import { generateOTP, getOTPExpiresAt } from '../utils/otp.util';
import { sendOTPRegistrationEmail, sendPasswordResetEmail } from './mail.service';
>>>>>>> Stashed changes
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  TokenPayload,
} from '../utils/jwt.util';
import { addToBlacklist } from '../utils/tokenBlacklist';
import { AppError } from '../utils/AppError';
import { HttpStatus } from '../constants/httpStatus';
import { ErrorCodes } from '../constants/errorCodes';

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN SERVICE — Bảo phụ trách
// ─────────────────────────────────────────────────────────────────────────────

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Xử lý logic đăng nhập
 * 1. Tìm user theo email (kèm password - bị ẩn mặc định bởi select: false)
 * 2. So sánh password
 * 3. Tạo Access + Refresh Token
 * 4. Lưu Refresh Token vào DB (để có thể revoke sau này)
 * 5. Trả về tokens và thông tin user
 */
export const loginUser = async (input: LoginInput) => {
  const { email, password } = input;

  // 1. Tìm user — phải dùng .select('+password') vì schema có select: false
  const user = await User.findOne({ email }).select('+password +refreshToken');
  if (!user) {
    throw new AppError('Invalid email or password', HttpStatus.UNAUTHORIZED, ErrorCodes.INVALID_CREDENTIALS);
  }

  // 2. So sánh password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('Invalid email or password', HttpStatus.UNAUTHORIZED, ErrorCodes.INVALID_CREDENTIALS);
  }

  // 3. Tạo payload cho token
  const payload: TokenPayload = {
    userId: (user._id as any).toString(),
    email: user.email,
    role: user.role,
  };

  // 4. Ký Access Token và Refresh Token
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // 5. Lưu Refresh Token vào DB (để sau này có thể logout = xóa token này)
  user.refreshToken = refreshToken;
  await user.save();

  // 6. Trả về data (không trả password)
  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      isVerified: user.isVerified,
    },
  };
};

/**
 * Làm mới Access Token bằng Refresh Token
 */
export const refreshTokenService = async (refreshToken: string) => {
  // Verify refresh token hợp lệ
  let payload: TokenPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', HttpStatus.UNAUTHORIZED, ErrorCodes.TOKEN_INVALID);
  }

  // Kiểm tra refresh token có trong DB không (để phát hiện nếu đã bị logout)
  const user = await User.findById(payload.userId).select('+refreshToken');
  if (!user || user.refreshToken !== refreshToken) {
    throw new AppError('Refresh token has been revoked', HttpStatus.UNAUTHORIZED, ErrorCodes.TOKEN_REVOKED);
  }

  // Tạo Access Token mới
  const newPayload: TokenPayload = {
    userId: (user._id as any).toString(),
    email: user.email,
    role: user.role,
  };
  const newAccessToken = signAccessToken(newPayload);

  return { accessToken: newAccessToken };
};

/**
 * Đăng xuất: xóa Refresh Token khỏi DB và đưa Access Token vào blacklist
 */
export const logoutUser = async (userId: string, accessToken: string) => {
  await User.findByIdAndUpdate(userId, { refreshToken: null });
  if (accessToken) {
    addToBlacklist(accessToken);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER SERVICE — Minh phụ trách
// ─────────────────────────────────────────────────────────────────────────────

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export const registerUser = async (_input: RegisterInput): Promise<any> => {
  throw new Error('Not implemented');
};

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD RESET SERVICE — Nhàn phụ trách
// ─────────────────────────────────────────────────────────────────────────────

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  email: string;
  otp: string;
  newPassword: string;
}

export const requestPasswordReset = async (input: ForgotPasswordInput): Promise<{ message: string }> => {
  const email = input.email.trim().toLowerCase();
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError('Không tìm thấy tài khoản với email này', HttpStatus.NOT_FOUND, ErrorCodes.USER_NOT_FOUND);
  }

  await OTP.deleteMany({ email, type: 'reset_password' });

  const otpCode = generateOTP();
  await OTP.create({
    email,
    otp: otpCode,
    type: 'reset_password',
    expiresAt: getOTPExpiresAt(10),
  });

  await sendPasswordResetEmail(user.email, user.name, otpCode);

  return {
    message: 'Mã OTP đặt lại mật khẩu đã được gửi tới email của bạn.',
  };
};

export const resetPasswordWithOTP = async (input: ResetPasswordInput): Promise<{ message: string }> => {
  const email = input.email.trim().toLowerCase();
  const now = new Date();

  const latestOTP = await OTP.findOne({ email, type: 'reset_password' }).sort({ createdAt: -1 });
  const validOTP = await OTP.findOne({ email, otp: input.otp, type: 'reset_password' });

  if (!latestOTP) {
    throw new AppError('Mã OTP không hợp lệ', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
  }

  if (latestOTP.expiresAt.getTime() < now.getTime()) {
    throw new AppError('Mã OTP đã hết hạn', HttpStatus.GONE, ErrorCodes.VALIDATION_FAILED);
  }

  if (!validOTP) {
    throw new AppError('Mã OTP không chính xác', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
  }

  const user = await User.findOne({ email }).select('+password +refreshToken');
  if (!user) {
    throw new AppError('Không tìm thấy người dùng', HttpStatus.NOT_FOUND, ErrorCodes.USER_NOT_FOUND);
  }

  user.password = input.newPassword;
  user.refreshToken = null;
  await user.save();

  await OTP.deleteMany({ email, type: 'reset_password' });

  return {
    message: 'Đặt lại mật khẩu thành công.',
  };
};
