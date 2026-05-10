import nodemailer from 'nodemailer';

/**
 * Transporter dùng chung cho toàn bộ ứng dụng
 * Sử dụng Gmail SMTP + App Password (không phải mật khẩu Gmail thật)
 */
export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER?.trim(),
    pass: process.env.MAIL_PASS?.replace(/\s+/g, ''),
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
    console.warn('⚠️  Gmail SMTP verification failed');
    console.warn(error);
  }
};
