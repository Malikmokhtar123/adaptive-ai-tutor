import { NextResponse } from 'next/server';
import { getDb, toRow } from '@/db/database';
import { generateQuestion } from '@/lib/groq-client';
import { conceptList } from '@/lib/adaptive-engine';

export async function POST(req: Request) {
  try {
    const { student_name, topic } = await req.json() as { student_name: string; topic: string };

    if (!student_name?.trim()) {
      return NextResponse.json({ error: 'student_name is required' }, { status: 400 });
    }
    if (topic !== 'algebra' && topic !== 'python') {
      return NextResponse.json({ error: 'topic must be algebra or python' }, { status: 400 });
    }

    const db = await getDb();

    // Create student
    const sRes = await db.execute({
      sql: 'INSERT INTO students (name) VALUES (?) RETURNING *',
      args: [student_name.trim()],
    });
    const student = toRow(sRes.rows[0] as Record<string, unknown>);

    // Generate first question
    const firstConcept = conceptList(topic)[0];
    const firstQuestion = await generateQuestion({
      topic, concept: firstConcept, difficulty: 3, style: 'direct',
      questionType: 'practice',
      errorPattern: { conceptual: 0, procedural: 0, careless: 0 },
      recentQuestions: [],
    });

    // Create session
    const sessRes = await db.execute({
      sql: `INSERT INTO sessions (student_id, topic, current_concept, current_difficulty, current_style, current_question)
            VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
      args: [student.id as number, topic, firstConcept, 3, 'direct', JSON.stringify(firstQuestion)],
    });
    const session = toRow(sessRes.rows[0] as Record<string, unknown>);

    // Init learner state
    await db.execute({
      sql: 'INSERT OR IGNORE INTO learner_state (session_id, concept) VALUES (?, ?)',
      args: [session.id as number, firstConcept],
    });

    return NextResponse.json({
      session_id: session.id,
      student,
      session: { ...session, current_question: firstQuestion },
    });
  } catch (err) {
    console.error('[/api/session/start]', err);
    return NextResponse.json({ error: 'Failed to start session' }, { status: 500 });
  }
}
