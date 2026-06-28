import { User } from "../models/User";
import { OTP } from "../models/OTP";
import { generateOTP, getOTPExpiresAt } from "../utils/otp.util";
import {
  sendOTPRegistrationEmail,
  sendPasswordResetEmail,
  sendMfaLoginEmail,
} from "./mail.service";
import { getOrCreateSystemConfig } from "../models/SystemConfig";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  TokenPayload,
} from "../utils/jwt.util";
import { addToBlacklist } from "../utils/tokenBlacklist";
import { AppError } from "../utils/AppError";
import { HttpStatus } from "../constants/httpStatus";
import { ErrorCodes } from "../constants/errorCodes";

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
  const user = await User.findOne({ email }).select("+password +refreshToken");
  if (!user) {
    throw new AppError(
      "Invalid email or password",
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.INVALID_CREDENTIALS,
    );
  }

  // 2. So sánh password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError(
      "Invalid email or password",
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.INVALID_CREDENTIALS,
    );
  }

  // Kiểm tra trạng thái hoạt động (Bị khóa/Ban)
  if (!user.isActive) {
    throw new AppError(
      user.banReason || "Account has been suspended",
      HttpStatus.FORBIDDEN,
      ErrorCodes.FORBIDDEN,
    );
  }

  // Kiểm tra xác thực email
  if (!user.isVerified) {
    throw new AppError(
      "Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email.",
      HttpStatus.FORBIDDEN,
      ErrorCodes.EMAIL_NOT_VERIFIED,
    );
  }

  // 3. Check for admin MFA setting
  if (user.role === "admin") {
    const config = await getOrCreateSystemConfig();
    if (config.enforceMfaAdmin) {
      const otp = generateOTP(config.otpLength || 6);
      const expiresAt = getOTPExpiresAt(5); // 5 minutes expiration

      await OTP.create({
        email: user.email,
        otp,
        type: "mfa_login",
        expiresAt,
      });

      await sendMfaLoginEmail(user.email, user.name, otp);

      return {
        mfaRequired: true,
        email: user.email,
      };
    }
  }

  // 4. Tạo payload cho token
  const payload: TokenPayload = {
    userId: (user._id as any).toString(),
    email: user.email,
    role: user.role,
  };

  // 5. Ký Access Token và Refresh Token
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // 6. Lưu Refresh Token vào DB
  user.refreshToken = refreshToken;
  await user.save();

  // Tính toán redirectUrl dựa vào role
  const redirectUrl =
    user.role === "admin" ? "/admin/dashboard" : "/dashboard";

  // 7. Trả về data (không trả password)
  return {
    accessToken,
    refreshToken,
    redirectUrl,
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
 * Xác minh mã OTP đăng nhập MFA (Admin)
 */
export interface VerifyMfaInput {
  email: string;
  otp: string;
}

export const verifyMfaLogin = async (input: VerifyMfaInput) => {
  const { email, otp } = input;

  const otpRecord = await OTP.findOne({
    email: email.toLowerCase(),
    otp,
    type: "mfa_login",
  });

  if (!otpRecord) {
    throw new AppError(
      "Mã xác thực không chính xác hoặc đã hết hạn",
      HttpStatus.BAD_REQUEST,
      ErrorCodes.OTP_INVALID
    );
  }

  await OTP.deleteOne({ _id: otpRecord._id });

  const user = await User.findOne({ email: email.toLowerCase() }).select("+refreshToken");
  if (!user) {
    throw new AppError(
      "Người dùng không tồn tại hoặc đã bị xóa",
      HttpStatus.NOT_FOUND,
      ErrorCodes.USER_NOT_FOUND
    );
  }

  if (!user.isActive) {
    throw new AppError(
      user.banReason || "Tài khoản của bạn đã bị khóa",
      HttpStatus.FORBIDDEN,
      ErrorCodes.FORBIDDEN
    );
  }

  const payload: TokenPayload = {
    userId: (user._id as any).toString(),
    email: user.email,
    role: user.role,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  user.refreshToken = refreshToken;
  await user.save();

  const redirectUrl = user.role === "admin" ? "/admin/dashboard" : "/dashboard";

  return {
    accessToken,
    refreshToken,
    redirectUrl,
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
    throw new AppError(
      "Invalid or expired refresh token",
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.TOKEN_INVALID,
    );
  }

  // Kiểm tra refresh token có trong DB không (để phát hiện nếu đã bị logout)
  const user = await User.findById(payload.userId).select("+refreshToken");
  if (!user || user.refreshToken !== refreshToken) {
    throw new AppError(
      "Refresh token has been revoked",
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.TOKEN_REVOKED,
    );
  }

  // Tạo Access Token mới và Refresh Token mới (RTR)
  const newPayload: TokenPayload = {
    userId: (user._id as any).toString(),
    email: user.email,
    role: user.role,
  };
  const newAccessToken = signAccessToken(newPayload);
  const newRefreshToken = signRefreshToken(newPayload);

  // Cập nhật Refresh Token mới vào cơ sở dữ liệu
  user.refreshToken = newRefreshToken;
  await user.save();

  return { 
    accessToken: newAccessToken,
    refreshToken: newRefreshToken
  };
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

export const registerUser = async (input: RegisterInput): Promise<any> => {
  const { name, email, password } = input;

  // 1. Kiểm tra email đã tồn tại chưa
  let user = await User.findOne({ email });

  if (user) {
    if (user.isVerified) {
      // Nếu đã xác thực -> Báo lỗi trùng email
      throw new AppError(
        "Email đã được sử dụng",
        HttpStatus.CONFLICT,
        ErrorCodes.EMAIL_ALREADY_EXISTS,
      );
    } else {
      // Nếu chưa xác thực -> Cập nhật thông tin (nếu có đổi) và gửi lại OTP mới
      user.name = name;
      user.password = password; // pre-save hook sẽ tự động hash lại password
      await user.save();

      // Xoá OTP cũ (nếu chưa bị MongoDB xoá)
      await OTP.deleteMany({ email, type: "verify_email" });
    }
  } else {
    // 2. Tạo user mới với isVerified = false
    user = new User({
      name,
      email,
      password, // Password sẽ tự động được hash qua pre-save hook
      isVerified: false,
    });
    await user.save();
  }

  // 3. Tạo mã OTP mới
  const otpCode = generateOTP();
  const otpDoc = new OTP({
    email,
    otp: otpCode,
    type: "verify_email",
    expiresAt: getOTPExpiresAt(10), // Hết hạn sau 10 phút
  });
  await otpDoc.save();

  // 4. Gửi email kích hoạt
  await sendOTPRegistrationEmail(email, name, otpCode);

  return {
    message:
      "Mã OTP đã được gửi. Vui lòng kiểm tra email để kích hoạt tài khoản.",
  };
};

/**
 * Xác thực email bằng OTP
 */
export const verifyEmailOTP = async (email: string, otp: string) => {
  const validOTP = await OTP.findOne({ email, otp, type: "verify_email" });

  if (!validOTP) {
    throw new AppError(
      "Mã OTP không hợp lệ hoặc đã hết hạn",
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_FAILED,
    );
  }

  // Cập nhật trạng thái user
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError(
      "Không tìm thấy người dùng",
      HttpStatus.NOT_FOUND,
      ErrorCodes.USER_NOT_FOUND,
    );
  }

  user.isVerified = true;
  await user.save();

  // Xóa OTP đã sử dụng
  await OTP.deleteOne({ _id: validOTP._id });

  return { message: "Xác thực tài khoản thành công." };
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

export const requestPasswordReset = async (
  input: ForgotPasswordInput,
): Promise<{ message: string }> => {
  const email = input.email.trim().toLowerCase();
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError(
      "Không tìm thấy tài khoản với email này",
      HttpStatus.NOT_FOUND,
      ErrorCodes.USER_NOT_FOUND,
    );
  }

  await OTP.deleteMany({ email, type: "reset_password" });

  const otpCode = generateOTP();
  await OTP.create({
    email,
    otp: otpCode,
    type: "reset_password",
    expiresAt: getOTPExpiresAt(10),
  });

  await sendPasswordResetEmail(user.email, user.name, otpCode);

  return {
    message: "Mã OTP đặt lại mật khẩu đã được gửi tới email của bạn.",
  };
};

export const resetPasswordWithOTP = async (
  input: ResetPasswordInput,
): Promise<{ message: string }> => {
  const email = input.email.trim().toLowerCase();
  const now = new Date();

  const latestOTP = await OTP.findOne({ email, type: "reset_password" }).sort({
    createdAt: -1,
  });
  const validOTP = await OTP.findOne({
    email,
    otp: input.otp,
    type: "reset_password",
  });

  if (!latestOTP) {
    throw new AppError(
      "Mã OTP không hợp lệ",
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_FAILED,
    );
  }

  if (latestOTP.expiresAt.getTime() < now.getTime()) {
    throw new AppError(
      "Mã OTP đã hết hạn",
      HttpStatus.GONE,
      ErrorCodes.VALIDATION_FAILED,
    );
  }

  if (!validOTP) {
    throw new AppError(
      "Mã OTP không chính xác",
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_FAILED,
    );
  }

  const user = await User.findOne({ email }).select("+password +refreshToken");
  if (!user) {
    throw new AppError(
      "Không tìm thấy người dùng",
      HttpStatus.NOT_FOUND,
      ErrorCodes.USER_NOT_FOUND,
    );
  }

  user.password = input.newPassword;
  user.refreshToken = null;
  await user.save();

  await OTP.deleteMany({ email, type: "reset_password" });

  return {
    message: "Đặt lại mật khẩu thành công.",
  };
};
