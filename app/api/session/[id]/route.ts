import { NextResponse } from 'next/server';
import { getDb, toRow } from '@/db/database';

function parseState(row: Record<string, unknown>) {
  return {
    ...row,
    error_pattern: JSON.parse(row.error_pattern as string),
    style_effectiveness: JSON.parse(row.style_effectiveness as string),
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();
    const sessionId = parseInt(id);

    const sRes = await db.execute({ sql: 'SELECT * FROM sessions WHERE id = ?', args: [sessionId] });
    if (!sRes.rows[0]) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    const session = toRow(sRes.rows[0] as Record<string, unknown>);

    const stuRes = await db.execute({ sql: 'SELECT * FROM students WHERE id = ?', args: [session.student_id as number] });
    const student = toRow(stuRes.rows[0] as Record<string, unknown>);

    const lsRes = await db.execute({ sql: 'SELECT * FROM learner_state WHERE session_id = ?', args: [sessionId] });
    const learnerStates = lsRes.rows.map(r => parseState(toRow(r as Record<string, unknown>)));

    const intRes = await db.execute({
      sql: 'SELECT * FROM interactions WHERE session_id = ? ORDER BY timestamp DESC LIMIT 15',
      args: [sessionId],
    });
    const recentInteractions = intRes.rows.map(r => toRow(r as Record<string, unknown>));

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
