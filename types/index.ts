export type Topic = 'algebra' | 'python';
export type Style = 'direct' | 'example_first' | 'step_by_step' | 'analogy' | 'worked_example';
export type ErrorType = 'conceptual' | 'procedural' | 'careless' | null;
export type QuestionType = 'practice' | 'multi_step' | 'worked_example' | 'mastery_check';

export interface Student {
  id: number;
  name: string;
  created_at: string;
}

export interface Session {
  id: number;
  student_id: number;
  topic: Topic;
  current_concept: string;
  current_difficulty: number;
  current_style: Style;
  current_question: GeneratedQuestion | null;
  status: 'active' | 'completed';
  started_at: string;
  ended_at: string | null;
}

export interface Interaction {
  id: number;
  session_id: number;
  concept: string;
  question: string;
  student_answer: string;
  is_correct: boolean;
  partial_credit: number;
  error_type: ErrorType;
  hint_used: boolean;
  hint_level: number;
  confidence: number;
  response_time_ms: number;
  ai_feedback: string;
  difficulty_at_time: number;
  style_at_time: Style;
  timestamp: string;
}

export interface LearnerState {
  id: number;
  session_id: number;
  concept: string;
  mastery_prob: number;
  attempts: number;
  correct_count: number;
  hint_count: number;
  avg_response_time_ms: number;
  consecutive_correct: number;
  consecutive_wrong: number;
  error_pattern: { conceptual: number; procedural: number; careless: number };
  style_effectiveness: Partial<Record<Style, number>>;
  updated_at: string;
}

export interface GeneratedQuestion {
  question: string;
  concept: string;
  difficulty: number;
  hints: [string, string, string];
  solution_steps: string[];
  question_type: QuestionType;
  expected_answer: string;
}

export interface EvaluationResult {
  is_correct: boolean;
  partial_credit: number;
  error_type: ErrorType;
  feedback: string;
  encouragement: string;
  explanation: string;
}

export interface AdaptiveDecision {
  next_difficulty: number;
  next_style: Style;
  next_concept: string;
  question_type: QuestionType;
  should_show_worked_example: boolean;
  intervention_message: string | null;
  reason: string;
}

export interface InteractRequest {
  concept: string;
  question: string;
  student_answer: string;
  hint_used: boolean;
  hint_level: number;
  confidence: number;
  response_time_ms: number;
}

export interface InteractResponse {
  evaluation: EvaluationResult;
  learner_states: LearnerState[];
  next_question: GeneratedQuestion;
  adaptive_decision: AdaptiveDecision;
  session: Session;
}

export interface SessionData {
  session: Session;
  student: Student;
  learner_states: LearnerState[];
  recent_interactions: Interaction[];
}
