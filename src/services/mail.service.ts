import { transporter } from '../config/mailer';

// ─── Email HTML Templates ─────────────────────────────────────────────────────

/**
 * Template email chào mừng đăng ký
 */
const welcomeTemplate = (name: string): string => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chào mừng đến với Minlish</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f7fe;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <tr>
      <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:28px;font-weight:700;letter-spacing:-0.5px;">🎓 Minlish</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">English Learning Platform</p>
      </td>
    </tr>
    <tr>
      <td style="padding:40px;">
        <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 16px;">Chào mừng, ${name}! 👋</h2>
        <p style="color:#555;line-height:1.7;margin:0 0 24px;">
          Tài khoản của bạn đã được tạo thành công. Bắt đầu hành trình học tiếng Anh của bạn ngay hôm nay!
        </p>
        <div style="background:#f8f9ff;border-radius:12px;padding:20px;margin:0 0 24px;">
          <p style="color:#667eea;font-weight:600;margin:0 0 8px;">✨ Những gì bạn có thể làm:</p>
          <ul style="color:#555;line-height:2;margin:0;padding-left:20px;">
            <li>Học từ vựng với flashcard thông minh</li>
            <li>Luyện nghe với bài tập đa dạng</li>
            <li>Theo dõi tiến độ học tập</li>
          </ul>
        </div>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" 
           style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
          Bắt đầu học ngay →
        </a>
      </td>
    </tr>
    <tr>
      <td style="background:#f8f9ff;padding:24px;text-align:center;">
        <p style="color:#aaa;font-size:13px;margin:0;">
          © 2025 Minlish. Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email này.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

/**
 * Template email OTP đặt lại mật khẩu
 */
const otpResetTemplate = (name: string, otp: string): string => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Đặt lại mật khẩu - Minlish</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f7fe;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <tr>
      <td style="background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);padding:40px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:28px;font-weight:700;">🔐 Minlish</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Đặt lại mật khẩu</p>
      </td>
    </tr>
    <tr>
      <td style="padding:40px;">
        <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 16px;">Xin chào, ${name}!</h2>
        <p style="color:#555;line-height:1.7;margin:0 0 24px;">
          Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. 
          Sử dụng mã OTP bên dưới để tiếp tục:
        </p>
        <div style="background:#fff5f5;border:2px dashed #f5576c;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
          <p style="color:#f5576c;font-size:12px;font-weight:600;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Mã OTP của bạn</p>
          <p style="color:#1a1a2e;font-size:40px;font-weight:800;letter-spacing:8px;margin:0;font-family:monospace;">${otp}</p>
          <p style="color:#aaa;font-size:13px;margin:8px 0 0;">Mã có hiệu lực trong <strong>10 phút</strong></p>
        </div>
        <p style="color:#888;font-size:13px;line-height:1.6;">
          ⚠️ Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. 
          Tài khoản của bạn vẫn an toàn.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:#f8f9ff;padding:24px;text-align:center;">
        <p style="color:#aaa;font-size:13px;margin:0;">© 2025 Minlish. Email này được gửi tự động, vui lòng không reply.</p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

/**
 * Template email OTP đổi email
 */
const otpChangeEmailTemplate = (name: string, otp: string, newEmail: string): string => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Xác nhận thay đổi email - Minlish</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f7fe;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <tr>
      <td style="background:linear-gradient(135deg,#43cea2 0%,#185a9d 100%);padding:40px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:28px;font-weight:700;">🔁 Minlish</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Xác nhận thay đổi email</p>
      </td>
    </tr>
    <tr>
      <td style="padding:40px;">
        <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 16px;">Xin chào, ${name}!</h2>
        <p style="color:#555;line-height:1.7;margin:0 0 24px;">
          Bạn đang yêu cầu thay đổi email sang <strong>${newEmail}</strong>.
          Sử dụng mã OTP bên dưới để xác nhận thay đổi email:
        </p>
        <div style="background:#f8f9ff;border:2px dashed #185a9d;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
          <p style="color:#185a9d;font-size:12px;font-weight:600;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Mã OTP của bạn</p>
          <p style="color:#1a1a2e;font-size:40px;font-weight:800;letter-spacing:8px;margin:0;font-family:monospace;">${otp}</p>
          <p style="color:#aaa;font-size:13px;margin:8px 0 0;">Mã có hiệu lực trong <strong>10 phút</strong></p>
        </div>
        <p style="color:#888;font-size:13px;line-height:1.6;">Nếu bạn không yêu cầu thay đổi email này, hãy bỏ qua email này.</p>
      </td>
    </tr>
    <tr>
      <td style="background:#f8f9ff;padding:24px;text-align:center;">
        <p style="color:#aaa;font-size:13px;margin:0;">© 2025 Minlish. Email này được gửi tự động, vui lòng không reply.</p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ─── Mail Service Functions ───────────────────────────────────────────────────

const sendMailAndLog = async (options: Parameters<typeof transporter.sendMail>[0], label: string): Promise<void> => {
  const info = await transporter.sendMail(options);
  const accepted = Array.isArray(info.accepted) ? info.accepted.join(', ') : String(info.accepted);
  const rejected = Array.isArray(info.rejected) ? info.rejected.join(', ') : String(info.rejected);

  console.log(`📧 ${label} sent`, {
    messageId: info.messageId,
    accepted,
    rejected,
  });

  if (info.rejected && info.rejected.length > 0) {
    throw new Error(`Email rejected by SMTP: ${rejected}`);
  }
};

/**
 * Gửi email chào mừng sau khi đăng ký
 */
export const sendWelcomeEmail = async (to: string, name: string): Promise<void> => {
  await sendMailAndLog({
    from: `"Minlish 🎓" <${process.env.MAIL_USER}>`,
    to,
    subject: `Chào mừng ${name} đến với Minlish! 🎉`,
    html: welcomeTemplate(name),
  }, 'Welcome email');
};

/**
 * Gửi email OTP đặt lại mật khẩu
 */
export const sendPasswordResetEmail = async (
  to: string,
  name: string,
  otp: string
): Promise<void> => {
  await sendMailAndLog({
    from: `"Minlish 🔐" <${process.env.MAIL_USER}>`,
    to,
    subject: 'Đặt lại mật khẩu Minlish',
    html: otpResetTemplate(name, otp),
  }, 'Password reset OTP');
};
<<<<<<< Updated upstream
=======

/**
 * Gửi email OTP kích hoạt tài khoản
 */
export const sendOTPRegistrationEmail = async (
  to: string,
  name: string,
  otp: string
): Promise<void> => {
  await sendMailAndLog({
    from: `"Minlish 🎓" <${process.env.MAIL_USER}>`,
    to,
    subject: 'Kích hoạt tài khoản Minlish',
    html: otpRegistrationTemplate(name, otp),
  }, 'Registration OTP');
};

/**
 * Gửi email OTP xác nhận đổi email
 */
export const sendEmailChangeRequestEmail = async (
  to: string,
  name: string,
  otp: string,
  newEmail: string
): Promise<void> => {
  await sendMailAndLog({
    from: `"Minlish 🔁" <${process.env.MAIL_USER}>`,
    to,
    subject: 'Xác nhận thay đổi email Minlish',
    html: otpChangeEmailTemplate(name, otp, newEmail),
  }, 'Email change OTP');
};
>>>>>>> Stashed changes
