import { File as MegaFile } from 'megajs';

/**
 * UC-13 Voice AI — Mega storage proxy (FR-102, Phase 2 wllama).
 *
 * Lý do tồn tại: Mega chặn CORS — browser KHÔNG fetch trực tiếp
 * https://mega.nz/file/... được (đã xác nhận khi debug Cache Storage 0GB).
 * Spec FR-104 yêu cầu LLM chạy on-device trong browser → weights phải về
 * được browser → BE đứng giữa stream bytes từ Mega xuống cho FE.
 *
 * Ownership (AD-3): chỉ mega.service.ts được dùng megajs. Link tải vẫn build
 * từ DB qua utils/mega.util.ts như cũ.
 */

export interface MegaStreamResult {
  stream: NodeJS.ReadableStream;
  contentType: string;
  fileName: string;
}

/**
 * Parse full link Mega (fileid#key) và mở stream bytes ĐÃ GIẢI MÃ.
 * Route sẽ pipe stream thẳng ra response — KHÔNG buffer toàn bộ file multi-GB trong RAM.
 */
export async function streamFromMega(megaUrl: string): Promise<MegaStreamResult> {
  const link = megaUrl.trim();
  if (!/^https?:\/\/(mega\.nz|mega\.co\.nz)\/(file|embed)\/[A-Za-z0-9_-]+#[A-Za-z0-9_-]+$/.test(link)) {
    throw new Error('Invalid Mega URL');
  }

  const file = MegaFile.fromURL(link) as MegaFile & {
    name?: string;
    loadAttributes: (cb: (err: Error | undefined, attrs?: unknown) => void) => void;
    download: (opts?: { maxConnections?: number }) => NodeJS.ReadableStream;
  };

  // Đợi metadata (tên, size) — loadAttributes là API chuẩn của megajs
  await new Promise<void>((resolve, reject) => {
    file.loadAttributes((err: Error | undefined) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const stream = file.download({ maxConnections: 4 });
  const fileName = file.name ?? 'weights.bin';

  return { stream, contentType: 'application/octet-stream', fileName };
}
