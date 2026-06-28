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
 * Template email OTP kích hoạt tài khoản
 */
const otpRegistrationTemplate = (name: string, otp: string): string => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Kích hoạt tài khoản - Minlish</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f7fe;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <tr>
      <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:28px;font-weight:700;">🎓 Minlish</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Kích hoạt tài khoản</p>
      </td>
    </tr>
    <tr>
      <td style="padding:40px;">
        <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 16px;">Xin chào, ${name}!</h2>
        <p style="color:#555;line-height:1.7;margin:0 0 24px;">
          Cảm ơn bạn đã đăng ký tài khoản tại Minlish. 
          Sử dụng mã OTP bên dưới để kích hoạt tài khoản của bạn:
        </p>
        <div style="background:#f8f9ff;border:2px dashed #667eea;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
          <p style="color:#667eea;font-size:12px;font-weight:600;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Mã OTP của bạn</p>
          <p style="color:#1a1a2e;font-size:40px;font-weight:800;letter-spacing:8px;margin:0;font-family:monospace;">${otp}</p>
          <p style="color:#aaa;font-size:13px;margin:8px 0 0;">Mã có hiệu lực trong <strong>10 phút</strong></p>
        </div>
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

/**
 * Gửi email nhắc nhở học tập hàng ngày
 */
export const sendDailyReminderEmail = async (
  to: string,
  name: string,
  dueWordsCount: number
): Promise<void> => {
  const html = `
  <!DOCTYPE html>
  <html lang="vi">
  <head>
    <meta charset="UTF-8">
    <title>Nhắc nhở học tập - Minlish</title>
  </head>
  <body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f7fe;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:28px;font-weight:700;">🎓 Minlish</h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Nhắc nhở học tập hàng ngày</p>
        </td>
      </tr>
      <tr>
        <td style="padding:40px;">
          <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 16px;">Chào bạn, ${name}! 👋</h2>
          <p style="color:#555;line-height:1.7;margin:0 0 24px;">
            Đã đến thời gian học tập của bạn hôm nay. Đừng bỏ lỡ thói quen học tập để duy trì chuỗi ngày liên tiếp của mình nhé!
          </p>
          <div style="background:#f8f9ff;border-radius:12px;padding:20px;margin:0 0 24px;text-align:center;">
            <p style="color:#667eea;font-weight:600;margin:0 0 8px;font-size:16px;">📊 Trạng thái học tập của bạn:</p>
            <p style="color:#1a1a2e;font-size:20px;font-weight:700;margin:0;">
              Bạn đang có <span style="color:#e53e3e;font-size:24px;">${dueWordsCount}</span> từ vựng cần ôn tập!
            </p>
            <p style="color:#aaa;font-size:13px;margin:8px 0 0;">Chỉ mất khoảng 10 phút mỗi ngày để nâng cao phản xạ tiếng Anh.</p>
          </div>
          <div style="text-align:center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" 
               style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;box-shadow:0 4px 12px rgba(102,126,234,0.3);">
              Bắt đầu học ngay →
            </a>
          </div>
        </td>
      </tr>
      <tr>
        <td style="background:#f8f9ff;padding:24px;text-align:center;">
          <p style="color:#aaa;font-size:13px;margin:0;">© 2025 Minlish. Email này được gửi tự động. Nếu muốn tắt thông báo qua email, bạn vui lòng thay đổi cài đặt trong mục Cấu hình tài khoản.</p>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  await sendMailAndLog({
    from: `"Minlish ⏰" <${process.env.MAIL_USER}>`,
    to,
    subject: '⏰ Đến giờ ôn tập tiếng Anh rồi! - Minlish',
    html,
  }, 'Daily reminder email');
};

/**
 * Gửi email OTP đăng nhập MFA
 */
export const sendMfaLoginEmail = async (
  to: string,
  name: string,
  otp: string
): Promise<void> => {
  const html = `
  <!DOCTYPE html>
  <html lang="vi">
  <head>
    <meta charset="UTF-8">
    <title>Mã xác thực đăng nhập (MFA) - Minlish</title>
  </head>
  <body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f7fe;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:28px;font-weight:700;">🔐 Minlish</h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Mã xác thực đăng nhập (MFA)</p>
        </td>
      </tr>
      <tr>
        <td style="padding:40px;">
          <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 16px;">Chào bạn, ${name}! 👋</h2>
          <p style="color:#555;line-height:1.7;margin:0 0 24px;">
            Bạn đang đăng nhập vào tài khoản Admin. Vì hệ thống bật chế độ bảo mật MFA, vui lòng sử dụng mã OTP dưới đây để hoàn tất đăng nhập:
          </p>
          <div style="background:#f8f9ff;border:2px dashed #667eea;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
            <p style="color:#667eea;font-size:12px;font-weight:600;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Mã xác thực OTP</p>
            <p style="color:#1a1a2e;font-size:40px;font-weight:800;letter-spacing:8px;margin:0;font-family:monospace;">${otp}</p>
            <p style="color:#aaa;font-size:13px;margin:8px 0 0;">Mã có hiệu lực trong <strong>5 phút</strong></p>
          </div>
          <p style="color:#888;font-size:13px;line-height:1.6;">Nếu bạn không thực hiện yêu cầu này, vui lòng thay đổi mật khẩu của mình ngay lập tức.</p>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  await sendMailAndLog({
    from: `"Minlish Bảo mật 🔐" <${process.env.MAIL_USER}>`,
    to,
    subject: '🔐 Mã xác thực đăng nhập (MFA) - Minlish',
    html,
  }, 'MFA Login OTP');
};

/**
 * Gửi email OTP đổi mật khẩu MFA
 */
export const sendChangePasswordMfaEmail = async (
  to: string,
  name: string,
  otp: string
): Promise<void> => {
  const html = `
  <!DOCTYPE html>
  <html lang="vi">
  <head>
    <meta charset="UTF-8">
    <title>Mã xác thực đổi mật khẩu (MFA) - Minlish</title>
  </head>
  <body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f7fe;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:28px;font-weight:700;">🔐 Minlish</h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Mã xác thực đổi mật khẩu (MFA)</p>
        </td>
      </tr>
      <tr>
        <td style="padding:40px;">
          <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 16px;">Chào bạn, ${name}! 👋</h2>
          <p style="color:#555;line-height:1.7;margin:0 0 24px;">
            Bạn đang yêu cầu thay đổi mật khẩu tài khoản Admin. Vui lòng nhập mã OTP dưới đây để hoàn tất việc đổi mật khẩu:
          </p>
          <div style="background:#f8f9ff;border:2px dashed #667eea;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
            <p style="color:#667eea;font-size:12px;font-weight:600;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Mã xác thực OTP</p>
            <p style="color:#1a1a2e;font-size:40px;font-weight:800;letter-spacing:8px;margin:0;font-family:monospace;">${otp}</p>
            <p style="color:#aaa;font-size:13px;margin:8px 0 0;">Mã có hiệu lực trong <strong>5 phút</strong></p>
          </div>
          <p style="color:#888;font-size:13px;line-height:1.6;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  await sendMailAndLog({
    from: `"Minlish Bảo mật 🔐" <${process.env.MAIL_USER}>`,
    to,
    subject: '🔐 Mã xác thực đổi mật khẩu (MFA) - Minlish',
    html,
  }, 'MFA Change Password OTP');
};

/**
 * Gửi email mật khẩu tạm thời khi Admin reset auth cho User
 */
export const sendResetAuthEmail = async (
  to: string,
  name: string,
  tempPassword: string
): Promise<void> => {
  const html = `
  <!DOCTYPE html>
  <html lang="vi">
  <head>
    <meta charset="UTF-8">
    <title>Mật khẩu tạm thời khôi phục tài khoản - Minlish</title>
  </head>
  <body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f7fe;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:28px;font-weight:700;">🔑 Minlish</h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Khôi phục quyền truy cập tài khoản</p>
        </td>
      </tr>
      <tr>
        <td style="padding:40px;">
          <h2 style="color:#1a1a2e;font-size:22px;margin:0 0 16px;">Chào bạn, ${name}! 👋</h2>
          <p style="color:#555;line-height:1.7;margin:0 0 24px;">
            Quản trị viên hệ thống đã cập nhật email và cấp lại mật khẩu tạm thời cho tài khoản của bạn. Vui lòng sử dụng thông tin đăng nhập mới bên dưới để truy cập vào hệ thống:
          </p>
          <div style="background:#f8f9ff;border-radius:12px;padding:20px;margin:0 0 24px;">
            <p style="color:#555;margin:0 0 8px;"><strong>Email đăng nhập mới:</strong> <span style="color:#1a1a2e;">${to}</span></p>
            <p style="color:#555;margin:0;"><strong>Mật khẩu tạm thời:</strong> <span style="color:#667eea;font-family:monospace;font-size:16px;font-weight:700;letter-spacing:1px;">${tempPassword}</span></p>
          </div>
          <p style="color:#888;font-size:13px;line-height:1.6;margin:0 0 24px;">
            Vì lý do bảo mật, vui lòng <strong>đổi lại mật khẩu mới</strong> ngay sau khi đăng nhập thành công tại mục Cài đặt tài khoản.
          </p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" 
             style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
            Đăng nhập ngay →
          </a>
        </td>
      </tr>
      <tr>
        <td style="background:#f8f9ff;padding:24px;text-align:center;">
          <p style="color:#aaa;font-size:13px;margin:0;">
            © 2025 Minlish. Nếu bạn không có yêu cầu hỗ trợ này từ Admin, hãy liên hệ ngay với chúng tôi.
          </p>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  await sendMailAndLog({
    from: `"Minlish Hỗ trợ 🔑" <${process.env.MAIL_USER}>`,
    to,
    subject: '🔑 Mật khẩu tạm thời khôi phục tài khoản Minlish',
    html,
  }, 'Reset user auth temporary password email');
};

