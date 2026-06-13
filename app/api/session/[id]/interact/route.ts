import { NextResponse } from 'next/server';
import { evaluateAnswer, generateQuestion } from '@/lib/groq-client';
import { updateBKT, updateStyleEffectiveness } from '@/lib/learner-model';
import { makeAdaptiveDecision } from '@/lib/adaptive-engine';
import { LocalSession, LocalLearnerState, Session, LearnerState } from '@/types';

function toSession(ls: LocalSession): Session {
  return {
    id: 0, student_id: 0, topic: ls.topic,
    current_concept: ls.current_concept,
    current_difficulty: ls.current_difficulty,
    current_style: ls.current_style,
    current_question: ls.current_question,
    status: 'active', started_at: ls.started_at, ended_at: null,
  };
}

function toLearnerState(lls: LocalLearnerState): LearnerState {
  return { id: 0, session_id: 0, updated_at: new Date().toISOString(), ...lls };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params;
    const body = await req.json() as {
      session: LocalSession;
      concept: string;
      question: string;
      student_answer: string;
      hint_used: boolean;
      hint_level: number;
      confidence: number;
      response_time_ms: number;
    };

    const { session } = body;

    // Find or init learner state for this concept
    let ls = session.learner_states.find(s => s.concept === body.concept);
    if (!ls) {
      ls = {
        concept: body.concept,
        mastery_prob: 0.3, attempts: 0, correct_count: 0, hint_count: 0,
        avg_response_time_ms: 0, consecutive_correct: 0, consecutive_wrong: 0,
        error_pattern: { conceptual: 0, procedural: 0, careless: 0 },
        style_effectiveness: {},
      };
    }

    // Evaluate answer via Groq
    const evaluation = await evaluateAnswer({
      topic: session.topic, concept: body.concept, question: body.question,
      studentAnswer: body.student_answer, difficulty: session.current_difficulty,
      hintUsed: body.hint_used, hintLevel: body.hint_level,
    });

    // Update BKT mastery
    const newMastery = updateBKT(ls.mastery_prob, evaluation.is_correct);

    // Update error pattern
    const newErrorPattern = { ...ls.error_pattern };
    if (evaluation.error_type) newErrorPattern[evaluation.error_type]++;

    // Update style effectiveness
    const newStyleEff = updateStyleEffectiveness(
      ls.style_effectiveness, session.current_style, evaluation.is_correct, body.hint_used
    );

    // Running average response time
    const newAvgTime = ls.attempts === 0
      ? body.response_time_ms
      : (ls.avg_response_time_ms * ls.attempts + body.response_time_ms) / (ls.attempts + 1);

    const newConsecCorrect = evaluation.is_correct ? ls.consecutive_correct + 1 : 0;
    const newConsecWrong   = evaluation.is_correct ? 0 : ls.consecutive_wrong + 1;

    const updatedLs: LocalLearnerState = {
      ...ls,
      mastery_prob: newMastery,
      attempts: ls.attempts + 1,
      correct_count: ls.correct_count + (evaluation.is_correct ? 1 : 0),
      hint_count: ls.hint_count + (body.hint_used ? 1 : 0),
      avg_response_time_ms: newAvgTime,
      consecutive_correct: newConsecCorrect,
      consecutive_wrong: newConsecWrong,
      error_pattern: newErrorPattern,
      style_effectiveness: newStyleEff,
    };

    // Adaptive decision
    const decision = makeAdaptiveDecision(toSession(session), toLearnerState(updatedLs));

    // Recent questions for dedup (keep last 4)
    const recentQs = [...session.recent_questions.slice(-4), body.question];

    // Generate next question
    const nextQuestion = await generateQuestion({
      topic: session.topic, concept: decision.next_concept,
      difficulty: decision.next_difficulty, style: decision.next_style,
      questionType: decision.question_type, errorPattern: newErrorPattern,
      recentQuestions: recentQs,
    });

    // Build updated session
    const updatedSession: LocalSession = {
      ...session,
      current_concept: decision.next_concept,
      current_difficulty: decision.next_difficulty,
      current_style: decision.next_style,
      current_question: nextQuestion,
      learner_states: [
        ...session.learner_states.filter(s => s.concept !== body.concept),
        updatedLs,
      ],
      recent_questions: recentQs,
    };

    return NextResponse.json({
      evaluation,
      session: updatedSession,
      adaptive_decision: decision,
    });
  } catch (err) {
    console.error('[POST /api/session/[id]/interact]', err);
    return NextResponse.json({ error: 'Failed to process interaction' }, { status: 500 });
  }
}
