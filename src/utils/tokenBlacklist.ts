/**
 * ─── Token Blacklist (In-Memory) ─────────────────────────────────────────────
 *
 * Lưu Access Token đã bị revoke (sau khi logout).
 * Middleware verifyToken sẽ kiểm tra blacklist trước khi cho phép request.
 *
 * ⚠️  In-memory: reset khi server restart — phù hợp cho DEV.
 * 📌  Production: thay bằng Redis với TTL = thời gian còn lại của token.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import jwt from 'jsonwebtoken';

// Set lưu các token đã bị vô hiệu hóa
// Key: token string | Value: thời điểm hết hạn (ms)
const blacklist = new Map<string, number>();

/**
 * Thêm Access Token vào blacklist khi user logout.
 * Token sẽ tự động được dọn dẹp sau khi hết hạn.
 */
export const addToBlacklist = (token: string): void => {
  try {
    // Decode để lấy thời gian hết hạn (không cần verify vì đã verify trước đó)
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (decoded?.exp) {
      // Lưu với expiry time (epoch ms)
      blacklist.set(token, decoded.exp * 1000);
    } else {
      // Không có exp → lưu 24h mặc định
      blacklist.set(token, Date.now() + 24 * 60 * 60 * 1000);
    }
  } catch {
    blacklist.set(token, Date.now() + 24 * 60 * 60 * 1000);
  }
};

/**
 * Kiểm tra token có trong blacklist không.
 * Tự động dọn dẹp token đã hết hạn khi kiểm tra.
 */
export const isBlacklisted = (token: string): boolean => {
  const expiry = blacklist.get(token);
  if (expiry === undefined) return false;

  // Token đã hết hạn tự nhiên → xóa khỏi blacklist để giải phóng bộ nhớ
  if (Date.now() > expiry) {
    blacklist.delete(token);
    return false;
  }

  return true;
};

/**
 * Dọn dẹp toàn bộ token hết hạn trong blacklist.
 * Gọi định kỳ để tránh memory leak (xem server.ts).
 */
export const cleanExpiredTokens = (): void => {
  const now = Date.now();
  for (const [token, expiry] of blacklist.entries()) {
    if (now > expiry) blacklist.delete(token);
  }
};

/** Số lượng token đang trong blacklist (để debug/monitor) */
export const blacklistSize = (): number => blacklist.size;
