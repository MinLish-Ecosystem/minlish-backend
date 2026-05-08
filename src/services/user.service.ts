// ─────────────────────────────────────────────────────────────────────────────
// User Service — Nhàn phụ trách
// ─────────────────────────────────────────────────────────────────────────────
import { User } from '../models/User';

/**
 * Lấy thông tin profile của user theo ID
 */
export const getUserById = async (_userId: string): Promise<any> => {
  throw new Error('Not implemented');
};

/**
 * Cập nhật thông tin profile
 */
export const updateUserProfile = async (
  _userId: string,
  _data: Partial<{ name: string; avatar: string }>
): Promise<any> => {
  throw new Error('Not implemented');
};
