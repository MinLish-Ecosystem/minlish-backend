import { env } from '../config/env';

/**
 * Build link tải weights từ megaFileId (UC-13 / FR-102, architecture.md §5.3).
 *
 * Hỗ trợ 2 dạng giá trị lưu trong DB:
 *  - Full URL (bắt đầu http:// hoặc https://) → trả nguyên vẹn
 *  - File handle (Mega file id, ...) → ghép sau `VOICE_AI_CDN_URL`
 *
 * CDN base đọc từ env `VOICE_AI_CDN_URL` (default https://mega.nz/file/),
 * nên đổi provider storage chỉ cần sửa env — không đụng code (codingRule §11).
 */
export function buildMegaLink(megaFileId: string): string {
  const trimmed = megaFileId.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${env.VOICE_AI_CDN_URL.replace(/\/+$/, '')}/${trimmed}`;
}
