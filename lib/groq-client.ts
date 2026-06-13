import Groq from 'groq-sdk';
import { GeneratedQuestion, EvaluationResult, Style, QuestionType } from '@/types';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'llama-3.3-70b-versatile';

const STYLE_INSTRUCTIONS: Record<Style, string> = {
  direct: 'Ask the question directly, no extra scaffolding.',
  example_first: 'Show a brief 2-3 line worked example of a similar (but different) problem first, then ask the student\'s question.',
  step_by_step: 'Break the problem into numbered sub-steps the student should follow, then state the full question.',
  analogy: 'Open with a concrete real-world analogy that maps to the concept, then ask the question.',
  worked_example: 'Show a COMPLETE step-by-step solution to a similar problem, then present a new related problem for the student to solve.',
};

const CONCEPT_DESCRIPTIONS: Record<string, string> = {
  linear_equations: 'linear equations in the form ax + b = c — solving for x',
  inequalities: 'linear inequalities, solution sets, and number line interpretation',
  systems_of_equations: 'systems of two linear equations — substitution and elimination methods',
  quadratic_equations: 'quadratic equations — factoring, quadratic formula, discriminant',
  word_problems: 'algebra word problems requiring setting up and solving equations',
  variables_and_types: 'Python variables, data types (int, str, float, bool), and type conversion',
  conditionals: 'Python if/elif/else statements, boolean expressions, and nested conditions',
  loops: 'Python for-loops, while-loops, range(), and loop control (break, continue)',
  functions: 'Python function definitions, parameters, return values, and scope',
  lists_and_iteration: 'Python lists, indexing, slicing, methods, and iterating with loops',
};

const DIFFICULTY_LABELS = ['', 'very easy (1-step)', 'easy (2-step)', 'moderate (multi-step)', 'hard (requires combining ideas)', 'challenging (edge cases and depth)'];

export async function generateQuestion(opts: {
  topic: string;
  concept: string;
  difficulty: number;
  style: Style;
  questionType: QuestionType;
  errorPattern: { conceptual: number; procedural: number; careless: number };
  recentQuestions: string[];
}): Promise<GeneratedQuestion> {
  const { topic, concept, difficulty, style, questionType, errorPattern, recentQuestions } = opts;
  const conceptDesc = CONCEPT_DESCRIPTIONS[concept] || concept.replace(/_/g, ' ');
  const styleInstr = STYLE_INSTRUCTIONS[style];
  const errorCtx = Object.entries(errorPattern)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k} (${v}×)`)
    .join(', ') || 'none recorded';

  const prompt = `You are an adaptive AI tutor teaching ${topic} to a student.

Concept to cover: ${conceptDesc}
Difficulty: ${difficulty}/5 — ${DIFFICULTY_LABELS[difficulty]}
Instructional style: ${style} — ${styleInstr}
Question type: ${questionType}
Student's recent error patterns: ${errorCtx}
${recentQuestions.length > 0 ? `Avoid repeating these recent questions:\n${recentQuestions.map(q => `- ${q}`).join('\n')}` : ''}

Generate a question that addresses the student's current needs. If they have conceptual errors, test the concept from a new angle. If procedural, give a clean step-by-step problem.

Respond with ONLY valid JSON — no markdown, no explanation:
{
  "question": "the full question text, clearly formatted (include the worked example or steps if the style requires)",
  "concept": "${concept}",
  "difficulty": ${difficulty},
  "hints": [
    "subtle hint that nudges without giving away the answer",
    "more direct hint that points toward the method",
    "near-answer hint that walks them to the last step"
  ],
  "solution_steps": ["step 1 description", "step 2 description", "step 3 description"],
  "question_type": "${questionType}",
  "expected_answer": "the correct final answer"
}`;

  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);

    return {
      question: parsed.question || 'Solve: 2x + 4 = 10',
      concept: parsed.concept || concept,
      difficulty: parsed.difficulty || difficulty,
      hints: Array.isArray(parsed.hints) && parsed.hints.length >= 3
        ? [parsed.hints[0], parsed.hints[1], parsed.hints[2]]
        : ['Think about the definition.', 'Try working backwards.', 'The answer involves direct substitution.'],
      solution_steps: Array.isArray(parsed.solution_steps) ? parsed.solution_steps : ['Set up.', 'Solve.', 'Check.'],
      question_type: parsed.question_type || questionType,
      expected_answer: parsed.expected_answer || 'See solution steps.',
    };
  } catch (err) {
    console.error('[groq] generateQuestion failed:', err);
    return fallbackQuestion(concept, difficulty, questionType);
  }
}

export async function evaluateAnswer(opts: {
  topic: string;
  concept: string;
  question: string;
  studentAnswer: string;
  difficulty: number;
  hintUsed: boolean;
  hintLevel: number;
}): Promise<EvaluationResult> {
  const { topic, concept, question, studentAnswer, difficulty, hintUsed, hintLevel } = opts;

  const prompt = `You are evaluating a student's answer in an adaptive tutoring system.

Topic: ${topic}
Concept: ${concept.replace(/_/g, ' ')}
Difficulty: ${difficulty}/5
Question: ${question}
Student's answer: "${studentAnswer}"
Hint used: ${hintUsed} (level ${hintLevel}/3)

Evaluate carefully. Accept equivalent forms (e.g. "x=3" and "3" are both correct for "find x").

Respond with ONLY valid JSON:
{
  "is_correct": true or false,
  "partial_credit": 0.0 to 1.0,
  "error_type": null or "conceptual" or "procedural" or "careless",
  "feedback": "specific 1-2 sentence feedback about THIS answer — what was right or wrong",
  "encouragement": "brief 1-sentence motivating message tailored to their performance",
  "explanation": "clear 2-3 sentence explanation of the correct approach or confirmation of why they got it right"
}

error_type rules:
- null: answer is correct or essentially correct
- "conceptual": student misunderstands the underlying mathematical/programming concept
- "procedural": understands the concept but made an arithmetic, syntax, or procedural error
- "careless": minor mistake (sign error, typo, dropped term) that doesn't indicate deeper misunderstanding`;

  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);

    return {
      is_correct: typeof parsed.is_correct === 'boolean' ? parsed.is_correct : false,
      partial_credit: typeof parsed.partial_credit === 'number' ? parsed.partial_credit : 0,
      error_type: parsed.error_type ?? null,
      feedback: parsed.feedback || 'Good effort!',
      encouragement: parsed.encouragement || 'Keep going — you can do this!',
      explanation: parsed.explanation || 'Review the solution steps for details.',
    };
  } catch (err) {
    console.error('[groq] evaluateAnswer failed:', err);
    return {
      is_correct: false,
      partial_credit: 0,
      error_type: null,
      feedback: 'Could not evaluate — please try again.',
      encouragement: 'Keep going!',
      explanation: 'An error occurred during evaluation.',
    };
  }
}

function fallbackQuestion(concept: string, difficulty: number, questionType: QuestionType): GeneratedQuestion {
  return {
    question: 'Solve for x: 3x + 6 = 15',
    concept,
    difficulty,
    hints: ['Isolate the variable.', 'Subtract 6 from both sides first.', '3x = 9, so x = ?'],
    solution_steps: ['Subtract 6 from both sides: 3x = 9', 'Divide both sides by 3: x = 3', 'Check: 3(3)+6 = 15 ✓'],
    question_type: questionType,
    expected_answer: 'x = 3',
  };
}
