import { NextResponse } from 'next/server';
import { getDb } from '@/db/database';

function parseState(ls: Record<string, unknown>) {
  return {
    ...ls,
    error_pattern: JSON.parse(ls.error_pattern as string),
    style_effectiveness: JSON.parse(ls.style_effectiveness as string),
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const sessionId = parseInt(id);

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as Record<string, unknown> | undefined;
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(session.student_id as number);
    const learnerStates = (db.prepare('SELECT * FROM learner_state WHERE session_id = ?').all(sessionId) as Record<string, unknown>[]).map(parseState);
    const recentInteractions = db.prepare(
      'SELECT * FROM interactions WHERE session_id = ? ORDER BY timestamp DESC LIMIT 15'
    ).all(sessionId);

    return NextResponse.json({
      session: {
        ...session,
        current_question: session.current_question
          ? JSON.parse(session.current_question as string)
          : null,
      },
      student,
      learner_states: learnerStates,
      recent_interactions: recentInteractions,
    });
  } catch (err) {
    console.error('[GET /api/session/[id]]', err);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}
