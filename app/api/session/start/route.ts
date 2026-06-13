import { NextResponse } from 'next/server';
import { getDb } from '@/db/database';
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

    const db = getDb();

    // Create student
    const studentResult = db
      .prepare('INSERT INTO students (name) VALUES (?) RETURNING *')
      .get(student_name.trim()) as { id: number; name: string; created_at: string };

    // Determine first concept
    const firstConcept = conceptList(topic)[0];

    // Generate first question
    const firstQuestion = await generateQuestion({
      topic,
      concept: firstConcept,
      difficulty: 3,
      style: 'direct',
      questionType: 'practice',
      errorPattern: { conceptual: 0, procedural: 0, careless: 0 },
      recentQuestions: [],
    });

    // Create session
    const sessionResult = db
      .prepare(`
        INSERT INTO sessions (student_id, topic, current_concept, current_difficulty, current_style, current_question)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING *
      `)
      .get(studentResult.id, topic, firstConcept, 3, 'direct', JSON.stringify(firstQuestion)) as Record<string, unknown>;

    // Init learner state for first concept
    db.prepare('INSERT OR IGNORE INTO learner_state (session_id, concept) VALUES (?, ?)').run(
      sessionResult.id as number,
      firstConcept
    );

    return NextResponse.json({
      session_id: sessionResult.id,
      student: studentResult,
      session: { ...sessionResult, current_question: firstQuestion },
    });
  } catch (err) {
    console.error('[/api/session/start]', err);
    return NextResponse.json({ error: 'Failed to start session' }, { status: 500 });
  }
}
