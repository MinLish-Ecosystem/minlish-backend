/**
 * Script verify nhanh rule-based scoring UC-16 (AC-03/04/05, AF-03/AF-04).
 * Chạy: npx ts-node --transpile-only src/scripts/verify-speaking-scoring.ts
 * Không đụng DB/Redis — pure function check theo Success signal SPEC.
 */

import {
  scoreRuleBased,
  normalizeTranscript,
  ScoringError,
} from '../utils/speakingScoring.util';
import { ruleBasedScoringEngine } from '../services/scoring';

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL  ${name} — ${(err as Error).message}`);
  }
}

function expect(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`expected ${e}, got ${a}`);
  }
}

function expectThrows(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (err) {
    if (err instanceof ScoringError && err.scoringCode === code) {
      return;
    }
    throw new Error(`expected ScoringError ${code}, got ${(err as Error).message}`);
  }
  throw new Error(`expected ScoringError ${code}, nothing thrown`);
}

// ─── Normalize (BR-02) ─────────────────────────────────────────────────────────
console.log('normalizeTranscript:');
check('lowercase + bỏ dấu câu + collapse space', () => {
  expect(
    normalizeTranscript('  Every Morning,   I Wake-up At SIX!  '),
    'every morning i wakeup at six'
  );
});
check('chuỗi chỉ dấu câu → rỗng', () => {
  expect(normalizeTranscript('!!! ... ???'), '');
});

// ─── Scoring AC-04: khớp 100% → 100 điểm ──────────────────────────────────────
console.log('score AC-04 (100%):');
check('transcript đúng → scorePercent 100, matched = total', () => {
  const r = scoreRuleBased(
    'Every morning, I wake up at six and eat breakfast.',
    'Every morning, I wake up at six and eat breakfast.'
  );
  expect(r.scorePercent, 100);
  expect(r.matchedWords, 10);
  expect(r.totalWords, 10);
});

// ─── Scoring AC-05: 6/10 từ → 60 ──────────────────────────────────────────────
console.log('score AC-05 (6/10):');
check('6/10 từ khớp → 60 điểm', () => {
  const r = scoreRuleBased(
    'every morning I at and breakfast',
    'Every morning, I wake up at six and eat breakfast.'
  );
  expect(r.scorePercent, 60);
  expect(r.matchedWords, 6);
  expect(r.totalWords, 10);
});
check('9/10 từ khớp (thiếu "eat") → 90 điểm', () => {
  const r = scoreRuleBased(
    'Every morning I wake up at six and breakfast',
    'Every morning, I wake up at six and eat breakfast.'
  );
  expect(r.scorePercent, 90);
  expect(r.matchedWords, 9);
});

// ─── AF-03: transcript rỗng → TRANSCRIPT_EMPTY ────────────────────────────────
console.log('AF-03 EMPTY:');
check('transcript rỗng → ScoringError TRANSCRIPT_EMPTY', () => {
  expectThrows(() => scoreRuleBased('', 'Any reference text here'), 'TRANSCRIPT_EMPTY');
});
check('transcriptor chỉ dấu câu → TRANSCRIPT_EMPTY', () => {
  expectThrows(() => scoreRuleBased('!!!', 'Any reference text here'), 'TRANSCRIPT_EMPTY');
});

// ─── AF-04/C-8: < 50% số từ → TRANSCRIPT_TOO_SHORT ─────────────────────────────
console.log('AF-04 TOO_SHORT:');
check('2/10 từ → TRANSCRIPT_TOO_SHORT', () => {
  expectThrows(
    () => scoreRuleBased('every morning', 'Every morning, I wake up at six and eat breakfast.'),
    'TRANSCRIPT_TOO_SHORT'
  );
});
check('5/10 từ (đúng ngưỡng 50%) → chấm bình thường', () => {
  const r = scoreRuleBased(
    'every morning I wake up',
    'Every morning, I wake up at six and eat breakfast.'
  );
  expect(r.scorePercent, 50);
});

// ─── CAP-7: engine qua interface ──────────────────────────────────────────────
console.log('engine IScoringEngine (CAP-7):');
check('ruleBasedScoringEngine.score trả kết quả như util', () => {
  const r = ruleBasedScoringEngine.score(
    'She walks to work every day.',
    'She walks to work every day.'
  );
  expect(r.scorePercent, 100);
  expect(r.matchedWords, r.totalWords);
});
check('engine.name = rule-based (snapshot payload)', () => {
  expect(ruleBasedScoringEngine.name, 'rule-based');
});
check('engine ném ScoringError y hệt util', () => {
  try {
    ruleBasedScoringEngine.score('', 'reference');
    throw new Error('should have thrown');
  } catch (err) {
    if (!(err instanceof ScoringError) || err.scoringCode !== 'TRANSCRIPT_EMPTY') {
      throw new Error(`unexpected: ${(err as Error).message}`);
    }
  }
});

console.log(`\nKết quả: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
