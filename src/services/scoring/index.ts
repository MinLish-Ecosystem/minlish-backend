/**
 * Factory chọn scoring engine cho Speaking (UC-16 CAP-7 / BR-04).
 * Phase 2: thêm `aiScoringEngine` cùng IScoringEngine rồi đổi binding ở đây —
 * request/response submit và Session/Result/Attempt giữ nguyên (AC-12).
 */
export { ruleBasedScoringEngine } from './ruleBasedScoringEngine';
export type { IScoringEngine, ScoringEngineResult } from './ruleBasedScoringEngine';

import { ruleBasedScoringEngine } from './ruleBasedScoringEngine';
import type { IScoringEngine } from './ruleBasedScoringEngine';

/** v1 cố định rule-based (BR-01) — swap tại đây khi Phase 2 bật AI */
export function getSpeakingScoringEngine(): IScoringEngine {
  return ruleBasedScoringEngine;
}
