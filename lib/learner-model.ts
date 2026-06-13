import { Style, ErrorType, LearnerState } from '@/types';

// Bayesian Knowledge Tracing parameters
const P_LEARN = 0.09;  // probability of learning per trial
const P_GUESS = 0.20;  // probability of guessing correctly without knowledge
const P_SLIP  = 0.10;  // probability of error despite knowledge
const P_INIT  = 0.30;  // prior probability of knowing the concept
export const MASTERY_THRESHOLD = 0.95;

export function updateBKT(prior: number, isCorrect: boolean): number {
  const pCorrect   = prior * (1 - P_SLIP) + (1 - prior) * P_GUESS;
  const pIncorrect = prior * P_SLIP        + (1 - prior) * (1 - P_GUESS);

  const posterior = isCorrect
    ? (prior * (1 - P_SLIP)) / pCorrect
    : (prior * P_SLIP)       / pIncorrect;

  // Learning transition
  return posterior + (1 - posterior) * P_LEARN;
}

export function isMastered(mastery: number): boolean {
  return mastery >= MASTERY_THRESHOLD;
}

export function difficultyFromMastery(mastery: number): number {
  if (mastery < 0.35) return 1;
  if (mastery < 0.55) return 2;
  if (mastery < 0.72) return 3;
  if (mastery < 0.88) return 4;
  return 5;
}

export function updateStyleEffectiveness(
  current: Partial<Record<Style, number>>,
  style: Style,
  isCorrect: boolean,
  hintUsed: boolean
): Partial<Record<Style, number>> {
  const rawScore = isCorrect ? (hintUsed ? 0.6 : 1.0) : 0.0;
  const prev = current[style] ?? 0.5;
  // Exponential moving average — recent performance weighted more
  return { ...current, [style]: 0.65 * prev + 0.35 * rawScore };
}

export function bestStyle(effectiveness: Partial<Record<Style, number>>): Style {
  const styles: Style[] = ['direct', 'example_first', 'step_by_step', 'analogy', 'worked_example'];
  return styles.reduce((best, s) => {
    return (effectiveness[s] ?? 0.5) > (effectiveness[best] ?? 0.5) ? s : best;
  }, 'direct' as Style);
}

export function dominantErrorType(
  pattern: { conceptual: number; procedural: number; careless: number }
): ErrorType {
  const max = Math.max(pattern.conceptual, pattern.procedural, pattern.careless);
  if (max < 2) return null;
  if (pattern.conceptual === max) return 'conceptual';
  if (pattern.procedural === max) return 'procedural';
  return 'careless';
}

export function getInitialMastery(): number {
  return P_INIT;
}

export function getOrInitState(
  states: LearnerState[],
  concept: string,
  session_id: number
): Omit<LearnerState, 'id' | 'updated_at'> {
  const existing = states.find(s => s.concept === concept);
  if (existing) return existing;
  return {
    session_id,
    concept,
    mastery_prob: P_INIT,
    attempts: 0,
    correct_count: 0,
    hint_count: 0,
    avg_response_time_ms: 0,
    consecutive_correct: 0,
    consecutive_wrong: 0,
    error_pattern: { conceptual: 0, procedural: 0, careless: 0 },
    style_effectiveness: {},
  };
}
