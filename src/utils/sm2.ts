/**
 * ─── Thuật Toán SuperMemo-2 (SM-2) ───────────────────────────────────────────
 * Cài đặt chuẩn công thức SM-2 để tính toán độ dễ (easeFactor), số lần lặp đúng
 * liên tiếp (repetitions) và khoảng cách ngày ôn tập tiếp theo (interval).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface SM2Input {
  easeFactor: number;
  interval: number;
  repetitions: number;
}

export interface SM2Result {
  easeFactor: number;
  interval: number;
  repetitions: number;
  status: 'learning' | 'review' | 'mastered';
  nextReviewDate: Date;
}

/**
 * Áp dụng kết quả đánh giá (rating) của người dùng để cập nhật chỉ số SRS.
 * Mức đánh giá rating:
 * - 'again': Quên từ hoàn toàn (q = 0)
 * - 'hard': Nhớ mang máng, mất nhiều thời gian nghĩ (q = 2)
 * - 'good': Nhớ tốt, phản xạ nhanh (q = 3)
 * - 'easy': Nhớ cực tốt, siêu dễ dàng (q = 5)
 */
export function applyReview(
  progress: SM2Input,
  rating: 'again' | 'hard' | 'good' | 'easy'
): SM2Result {
  // Bản đồ ánh xạ rating sang điểm số q (0-5) phục vụ tính toán SM-2
  const q = { again: 0, hard: 2, good: 3, easy: 5 }[rating];

  // 1. Tính toán Ease Factor mới (EF)
  // Công thức chuẩn SM-2: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  let ef = progress.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  
  // Ease Factor tối thiểu không được dưới 1.3
  ef = Math.max(1.3, ef);

  // 2. Tính toán Khoảng Cách Ôn Tập Mới (Interval - số ngày)
  let { repetitions } = progress;
  let interval: number;

  if (q < 3) {
    // Quên từ (again hoặc hard quá mức) -> Reset số lần lặp và đặt lịch ôn tập lại vào ngày mai
    repetitions = 0;
    interval = 1;
  } else {
    // Trả lời đúng (good hoặc easy) -> Tăng số lần lặp đúng liên tục
    repetitions += 1;

    if (repetitions === 1) {
      interval = 1; // Học lần đầu thành công -> Ôn lại sau 1 ngày
    } else if (repetitions === 2) {
      interval = 6; // Ôn lần 2 thành công -> Ôn lại sau 6 ngày
    } else {
      // Ôn từ lần 3 trở đi -> Nhân khoảng cách cũ với Ease Factor
      interval = Math.round(progress.interval * ef);
    }

    // Giới hạn khoảng cách ôn tập tối đa là 365 ngày
    interval = Math.min(365, interval);
  }

  // 3. Phân loại Trạng Thái Học Tập (Status)
  let status: 'learning' | 'review' | 'mastered';
  if (q < 3) {
    status = 'learning';
  } else if (rating === 'easy' && repetitions >= 5) {
    // Đạt cấp độ Easy liên tục -> Đã thuộc lòng (mastered)
    status = 'mastered';
  } else if (repetitions >= 3) {
    // Đã ôn tập đều đặn -> Chuyển sang trạng thái review định kỳ
    status = 'review';
  } else {
    status = 'learning';
  }

  // 4. Tính toán ngày ôn tập tiếp theo
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  return {
    easeFactor: Number(ef.toFixed(2)), // Làm tròn 2 chữ số thập phân cho đẹp DB
    interval,
    repetitions,
    status,
    nextReviewDate,
  };
}
