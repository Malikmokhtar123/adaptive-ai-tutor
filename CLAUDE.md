# CLAUDE.md

## Commands
- `npm install` — install dependencies
- `npm run dev` — start dev server at http://localhost:3000
- `npm run build` — production build
- `npm run lint` — ESLint

## Architecture
Next.js 15 App Router. No `src/` directory — app lives at `app/`.

**Database**: SQLite via `better-sqlite3` (synchronous). Singleton in `db/database.ts`.

**Schema**:
- `students(id, name, created_at)`
- `sessions(id, student_id, topic, current_concept, current_difficulty, current_style, current_question, status, started_at, ended_at)` — `current_question` is JSON
- `interactions(id, session_id, concept, question, student_answer, is_correct, partial_credit, error_type, hint_used, hint_level, confidence, response_time_ms, ai_feedback, difficulty_at_time, style_at_time, timestamp)`
- `learner_state(id, session_id, concept, mastery_prob, attempts, correct_count, hint_count, avg_response_time_ms, consecutive_correct, consecutive_wrong, error_pattern, style_effectiveness, updated_at)` — UNIQUE(session_id, concept); error_pattern and style_effectiveness are JSON

**API routes**:
- `POST /api/session/start` — create student + session, generate first question (Groq)
- `GET /api/session/[id]` — full session state + learner states + recent interactions
- `POST /api/session/[id]/interact` — evaluate answer → update BKT → adaptive decision → generate next question

**Core logic**:
- `lib/learner-model.ts` — BKT (Bayesian Knowledge Tracing), style effectiveness tracking
- `lib/adaptive-engine.ts` — pedagogical decision: next difficulty, style, concept, question type
- `lib/groq-client.ts` — Groq LLaMA-3.3-70B for question generation + answer evaluation

**Frontend** (`app/tutor/[sessionId]/page.tsx`): single client component, manages all session state.

## Environment
```
GROQ_API_KEY=...   # required in .env.local (gitignored)
```

## Adaptive Logic
The system adapts per-concept via BKT and these rules:
- **Difficulty** (1–5): driven by BKT mastery, capped at ±1 per question
- **Style**: `step_by_step` after 2 consecutive wrong; `analogy` on repeated conceptual errors; `worked_example` after 3 consecutive wrong; `direct` when mastery is high
- **Question type**: `practice` → `multi_step` (mastery > 0.72) → `mastery_check` (every 5th question)
- **Concept progression**: advances when mastery > 0.95 with 5+ attempts
- **Intervention messages**: shown when student is struggling or excelling

## Topics
- **Algebra**: linear_equations → inequalities → systems_of_equations → quadratic_equations → word_problems
- **Python**: variables_and_types → conditionals → loops → functions → lists_and_iteration
