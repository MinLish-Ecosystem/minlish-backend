import nodemailer from 'nodemailer';

/**
 * Transporter dùng chung cho toàn bộ ứng dụng
 * Sử dụng Gmail SMTP + App Password (không phải mật khẩu Gmail thật)
 */
export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

/**
 * Kiểm tra kết nối SMTP khi server khởi động (tùy chọn)
 */
export const verifyMailer = async (): Promise<void> => {
  try {
    await transporter.verify();
    console.log('📧 Gmail SMTP connected');
  } catch (error) {
    console.warn('⚠️  Gmail SMTP not configured (set MAIL_USER & MAIL_PASS in .env)');
  }
};
