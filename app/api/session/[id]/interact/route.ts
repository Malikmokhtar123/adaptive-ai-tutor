import { NextResponse } from 'next/server';
import { getDb, toRow } from '@/db/database';
import { evaluateAnswer, generateQuestion } from '@/lib/groq-client';
import { updateBKT, updateStyleEffectiveness } from '@/lib/learner-model';
import { makeAdaptiveDecision } from '@/lib/adaptive-engine';
import { InteractRequest, Session, LearnerState } from '@/types';

function parseState(row: Record<string, unknown>): LearnerState {
  return {
    ...(row as unknown as LearnerState),
    error_pattern: JSON.parse(row.error_pattern as string),
    style_effectiveness: JSON.parse(row.style_effectiveness as string),
  };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();
    const sessionId = parseInt(id);
    const body = await req.json() as InteractRequest;

    // Load session
    const sRes = await db.execute({ sql: 'SELECT * FROM sessions WHERE id = ?', args: [sessionId] });
    if (!sRes.rows[0]) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    const session = toRow(sRes.rows[0] as Record<string, unknown>) as unknown as Session;

    // Init learner state if missing
    await db.execute({
      sql: 'INSERT OR IGNORE INTO learner_state (session_id, concept) VALUES (?, ?)',
      args: [sessionId, body.concept],
    });
    const lsRes = await db.execute({
      sql: 'SELECT * FROM learner_state WHERE session_id = ? AND concept = ?',
      args: [sessionId, body.concept],
    });
    const ls = parseState(toRow(lsRes.rows[0] as Record<string, unknown>));

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
    const newStyleEff = updateStyleEffectiveness(ls.style_effectiveness, session.current_style, evaluation.is_correct, body.hint_used);

    // Update running average response time
    const newAvgTime = ls.attempts === 0
      ? body.response_time_ms
      : (ls.avg_response_time_ms * ls.attempts + body.response_time_ms) / (ls.attempts + 1);

    const newConsecCorrect = evaluation.is_correct ? ls.consecutive_correct + 1 : 0;
    const newConsecWrong   = evaluation.is_correct ? 0 : ls.consecutive_wrong + 1;

    // Persist interaction
    await db.execute({
      sql: `INSERT INTO interactions
        (session_id, concept, question, student_answer, is_correct, partial_credit,
         error_type, hint_used, hint_level, confidence, response_time_ms, ai_feedback,
         difficulty_at_time, style_at_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        sessionId, body.concept, body.question, body.student_answer,
        evaluation.is_correct ? 1 : 0, evaluation.partial_credit, evaluation.error_type,
        body.hint_used ? 1 : 0, body.hint_level, body.confidence, body.response_time_ms,
        `${evaluation.feedback} ${evaluation.explanation}`,
        session.current_difficulty, session.current_style,
      ],
    });

    // Update learner state
    await db.execute({
      sql: `UPDATE learner_state SET
        mastery_prob = ?, attempts = ?, correct_count = ?, hint_count = ?,
        avg_response_time_ms = ?, consecutive_correct = ?, consecutive_wrong = ?,
        error_pattern = ?, style_effectiveness = ?, updated_at = datetime('now')
        WHERE session_id = ? AND concept = ?`,
      args: [
        newMastery, ls.attempts + 1,
        ls.correct_count + (evaluation.is_correct ? 1 : 0),
        ls.hint_count + (body.hint_used ? 1 : 0),
        newAvgTime, newConsecCorrect, newConsecWrong,
        JSON.stringify(newErrorPattern), JSON.stringify(newStyleEff),
        sessionId, body.concept,
      ],
    });

    // Adaptive decision
    const updatedState: LearnerState = {
      ...ls, mastery_prob: newMastery,
      attempts: ls.attempts + 1,
      correct_count: ls.correct_count + (evaluation.is_correct ? 1 : 0),
      hint_count: ls.hint_count + (body.hint_used ? 1 : 0),
      avg_response_time_ms: newAvgTime,
      consecutive_correct: newConsecCorrect,
      consecutive_wrong: newConsecWrong,
      error_pattern: newErrorPattern,
      style_effectiveness: newStyleEff,
    };
    const decision = makeAdaptiveDecision(session, updatedState);

    // Recent questions for dedup
    const rqRes = await db.execute({
      sql: 'SELECT question FROM interactions WHERE session_id = ? ORDER BY timestamp DESC LIMIT 4',
      args: [sessionId],
    });
    const recentQs = rqRes.rows.map(r => r.question as string);

    // Generate next question
    const nextQuestion = await generateQuestion({
      topic: session.topic, concept: decision.next_concept,
      difficulty: decision.next_difficulty, style: decision.next_style,
      questionType: decision.question_type, errorPattern: newErrorPattern,
      recentQuestions: recentQs,
    });

    // Update session
    await db.execute({
      sql: 'UPDATE sessions SET current_concept = ?, current_difficulty = ?, current_style = ?, current_question = ? WHERE id = ?',
      args: [decision.next_concept, decision.next_difficulty, decision.next_style, JSON.stringify(nextQuestion), sessionId],
    });

    // Return updated state
    const allLsRes = await db.execute({ sql: 'SELECT * FROM learner_state WHERE session_id = ?', args: [sessionId] });
    const allStates = allLsRes.rows.map(r => parseState(toRow(r as Record<string, unknown>)));

    const updSessRes = await db.execute({ sql: 'SELECT * FROM sessions WHERE id = ?', args: [sessionId] });
    const updatedSession = toRow(updSessRes.rows[0] as Record<string, unknown>);

    return NextResponse.json({
      evaluation,
      learner_states: allStates,
      next_question: nextQuestion,
      adaptive_decision: decision,
      session: { ...updatedSession, current_question: nextQuestion },
    });
  } catch (err) {
    console.error('[POST /api/session/[id]/interact]', err);
    return NextResponse.json({ error: 'Failed to process interaction' }, { status: 500 });
  }
}
