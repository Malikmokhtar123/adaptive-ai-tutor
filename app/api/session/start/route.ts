import { NextResponse } from 'next/server';
import { generateQuestion } from '@/lib/groq-client';
import { conceptList } from '@/lib/adaptive-engine';
import { LocalSession } from '@/types';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
  try {
    const { student_name, topic } = await req.json() as { student_name: string; topic: string };
    if (!student_name?.trim()) {
      return NextResponse.json({ error: 'student_name is required' }, { status: 400 });
    }
    if (topic !== 'algebra' && topic !== 'python') {
      return NextResponse.json({ error: 'topic must be algebra or python' }, { status: 400 });
    }

    const firstConcept = conceptList(topic)[0];
    const firstQuestion = await generateQuestion({
      topic, concept: firstConcept, difficulty: 3, style: 'direct',
      questionType: 'practice',
      errorPattern: { conceptual: 0, procedural: 0, careless: 0 },
      recentQuestions: [],
    });

    const session: LocalSession = {
      session_id: randomUUID(),
      student_name: student_name.trim(),
      topic,
      current_concept: firstConcept,
      current_difficulty: 3,
      current_style: 'direct',
      current_question: firstQuestion,
      learner_states: [{
        concept: firstConcept,
        mastery_prob: 0.3,
        attempts: 0,
        correct_count: 0,
        hint_count: 0,
        avg_response_time_ms: 0,
        consecutive_correct: 0,
        consecutive_wrong: 0,
        error_pattern: { conceptual: 0, procedural: 0, careless: 0 },
        style_effectiveness: {},
      }],
      recent_questions: [],
      started_at: new Date().toISOString(),
    };

    return NextResponse.json({ session_id: session.session_id, session });
  } catch (err) {
    console.error('[/api/session/start]', err);
    return NextResponse.json({ error: 'Failed to start session' }, { status: 500 });
  }
}
