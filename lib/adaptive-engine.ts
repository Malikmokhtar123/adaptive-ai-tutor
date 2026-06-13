import { LearnerState, Session, AdaptiveDecision, Style, QuestionType } from '@/types';
import { difficultyFromMastery, isMastered, bestStyle, dominantErrorType } from './learner-model';

const ALGEBRA_CONCEPTS = [
  'linear_equations',
  'inequalities',
  'systems_of_equations',
  'quadratic_equations',
  'word_problems',
];

const PYTHON_CONCEPTS = [
  'variables_and_types',
  'conditionals',
  'loops',
  'functions',
  'lists_and_iteration',
];

export function conceptList(topic: string): string[] {
  return topic === 'algebra' ? ALGEBRA_CONCEPTS : PYTHON_CONCEPTS;
}

function advanceConcept(current: string, topic: string): string {
  const list = conceptList(topic);
  const idx = list.indexOf(current);
  if (idx === -1 || idx === list.length - 1) return current;
  return list[idx + 1];
}

export function makeAdaptiveDecision(
  session: Session,
  state: LearnerState
): AdaptiveDecision {
  const { mastery_prob, error_pattern, style_effectiveness } = state;

  // ── Difficulty ──────────────────────────────────────────────────────────
  const rawDiff = difficultyFromMastery(mastery_prob);
  // Cap: never jump more than 1 step at a time
  const next_difficulty = Math.max(
    1,
    Math.min(5, Math.max(session.current_difficulty - 1, Math.min(session.current_difficulty + 1, rawDiff)))
  );

  // ── Style ────────────────────────────────────────────────────────────────
  let next_style: Style;
  let reason = '';
  const dominant = dominantErrorType(error_pattern);

  if (state.consecutive_wrong >= 3) {
    next_style = 'worked_example';
    reason = 'Three consecutive wrong answers — showing a fully worked example.';
  } else if (state.consecutive_wrong >= 2) {
    next_style = 'step_by_step';
    reason = 'Two consecutive wrong answers — breaking this into guided steps.';
  } else if (dominant === 'conceptual' && error_pattern.conceptual >= 2) {
    next_style = 'analogy';
    reason = 'Repeated conceptual errors — using an analogy to reframe the idea.';
  } else if (dominant === 'procedural' && error_pattern.procedural >= 3) {
    next_style = 'step_by_step';
    reason = 'Repeated procedural errors — reinforcing the step-by-step procedure.';
  } else if (mastery_prob > 0.80 && state.consecutive_correct >= 3) {
    next_style = 'direct';
    reason = 'Strong mastery — presenting problems directly without scaffolding.';
  } else if (state.hint_count > state.attempts * 0.6 && state.attempts >= 4) {
    next_style = 'example_first';
    reason = 'Heavy hint usage — priming with a worked example to reduce dependence.';
  } else {
    next_style = bestStyle(style_effectiveness);
    reason = `Using best-performing style: ${next_style}.`;
  }

  // ── Question type ────────────────────────────────────────────────────────
  let question_type: QuestionType;
  let should_show_worked_example = false;

  if (state.consecutive_wrong >= 3) {
    question_type = 'worked_example';
    should_show_worked_example = true;
  } else if (state.attempts > 0 && state.attempts % 5 === 4) {
    question_type = 'mastery_check';
  } else if (mastery_prob > 0.72 && state.consecutive_correct >= 2) {
    question_type = 'multi_step';
  } else {
    question_type = 'practice';
  }

  // ── Concept progression ──────────────────────────────────────────────────
  const next_concept =
    isMastered(mastery_prob) && state.attempts >= 5
      ? advanceConcept(session.current_concept, session.topic)
      : session.current_concept;

  if (next_concept !== session.current_concept) {
    reason = `Mastery achieved on ${session.current_concept} — advancing to ${next_concept}.`;
  }

  // ── Intervention message ─────────────────────────────────────────────────
  let intervention_message: string | null = null;
  if (state.consecutive_wrong >= 3) {
    intervention_message = "You're working hard on a tough spot — let me show you a complete example first.";
  } else if (state.consecutive_wrong === 2) {
    intervention_message = "Let's slow down and walk through this step by step together.";
  } else if (mastery_prob > 0.90 && state.consecutive_correct >= 3) {
    intervention_message = "Excellent work! You're mastering this — time for a bigger challenge.";
  } else if (next_concept !== session.current_concept) {
    intervention_message = `Great job mastering ${session.current_concept.replace(/_/g, ' ')}! Moving on.`;
  } else if (state.attempts === 4) {
    intervention_message = "Quick mastery check — let's see how solid your understanding is.";
  }

  return {
    next_difficulty,
    next_style,
    next_concept,
    question_type,
    should_show_worked_example,
    intervention_message,
    reason,
  };
}
