'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import LearnerSidebar from '@/components/LearnerSidebar';
import MasteryBar from '@/components/MasteryBar';
import {
  Session, Student, LearnerState, GeneratedQuestion,
  EvaluationResult, AdaptiveDecision, InteractRequest
} from '@/types';

type Phase = 'loading' | 'question' | 'submitting' | 'feedback' | 'error';

interface TutorState {
  phase: Phase;
  session: Session | null;
  student: Student | null;
  currentQuestion: GeneratedQuestion | null;
  learnerStates: LearnerState[];
  answer: string;
  confidence: number;
  hintsRevealed: number;
  startTime: number;
  lastEvaluation: EvaluationResult | null;
  lastDecision: AdaptiveDecision | null;
  lastResponseTimeMs: number | null;
  interventionMsg: string | null;
  totalQuestions: number;
  correctCount: number;
  streak: number;
  errorMsg: string;
}

const CONFIDENCE_LABELS = ['', 'Guessing', 'Unsure', 'Okay', 'Confident', 'Certain'];

export default function TutorPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const answerRef = useRef<HTMLTextAreaElement>(null);

  const [state, setState] = useState<TutorState>({
    phase: 'loading',
    session: null,
    student: null,
    currentQuestion: null,
    learnerStates: [],
    answer: '',
    confidence: 3,
    hintsRevealed: 0,
    startTime: Date.now(),
    lastEvaluation: null,
    lastDecision: null,
    lastResponseTimeMs: null,
    interventionMsg: null,
    totalQuestions: 0,
    correctCount: 0,
    streak: 0,
    errorMsg: '',
  });

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Load session on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/session/${sessionId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setState(s => ({
          ...s,
          phase: 'question',
          session: data.session,
          student: data.student,
          currentQuestion: data.session.current_question,
          learnerStates: data.learner_states,
          startTime: Date.now(),
        }));
      } catch (err) {
        setState(s => ({ ...s, phase: 'error', errorMsg: String(err) }));
      }
    }
    load();
  }, [sessionId]);

  // Auto-focus answer input when question phase starts
  useEffect(() => {
    if (state.phase === 'question') {
      setTimeout(() => answerRef.current?.focus(), 100);
    }
  }, [state.phase]);

  // Live elapsed-time ticker — only runs during question phase
  useEffect(() => {
    if (state.phase !== 'question') return;
    setElapsedSeconds(0);
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - state.startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [state.phase, state.startTime]);

  const handleSubmit = useCallback(async () => {
    if (!state.session || !state.currentQuestion || !state.answer.trim()) return;
    const responseTime = Date.now() - state.startTime;

    setState(s => ({ ...s, phase: 'submitting' }));

    const body: InteractRequest = {
      concept: state.currentQuestion.concept,
      question: state.currentQuestion.question,
      student_answer: state.answer.trim(),
      hint_used: state.hintsRevealed > 0,
      hint_level: state.hintsRevealed,
      confidence: state.confidence,
      response_time_ms: responseTime,
    };

    try {
      const res = await fetch(`/api/session/${sessionId}/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const wasCorrect = data.evaluation.is_correct;

      setState(s => ({
        ...s,
        phase: 'feedback',
        session: data.session,
        learnerStates: data.learner_states,
        lastEvaluation: data.evaluation,
        lastDecision: data.adaptive_decision,
        lastResponseTimeMs: responseTime,
        interventionMsg: data.adaptive_decision.intervention_message,
        totalQuestions: s.totalQuestions + 1,
        correctCount: s.correctCount + (wasCorrect ? 1 : 0),
        streak: wasCorrect ? s.streak + 1 : 0,
      }));
    } catch (err) {
      setState(s => ({ ...s, phase: 'error', errorMsg: String(err) }));
    }
  }, [state, sessionId]);

  function handleNext() {
    if (!state.session?.current_question) return;
    setState(s => ({
      ...s,
      phase: 'question',
      currentQuestion: s.session!.current_question,
      answer: '',
      confidence: 3,
      hintsRevealed: 0,
      startTime: Date.now(),
      interventionMsg: null,
    }));
  }

  function revealHint() {
    if (state.hintsRevealed < 3 && state.currentQuestion) {
      setState(s => ({ ...s, hintsRevealed: s.hintsRevealed + 1 }));
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (state.phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto" />
          <p className="text-slate-400">Loading your session...</p>
        </div>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <p className="text-danger text-lg font-semibold">Something went wrong</p>
          <p className="text-slate-400 text-sm">{state.errorMsg}</p>
          <button onClick={() => router.push('/')} className="px-6 py-2 rounded-xl bg-accent text-white hover:bg-accent-dim transition">
            Back to home
          </button>
        </div>
      </div>
    );
  }

  if (!state.session || !state.student || !state.currentQuestion) return null;

  const currentLs = state.learnerStates.find(ls => ls.concept === state.session!.current_concept);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🧠</span>
          <span className="font-semibold text-white">Adaptive AI Tutor</span>
        </div>
        {currentLs && (
          <div className="flex items-center gap-3 w-48">
            <MasteryBar mastery={currentLs.mastery_prob} />
          </div>
        )}
        <button
          onClick={() => router.push('/')}
          className="text-sm text-slate-500 hover:text-slate-300 transition"
        >
          End session
        </button>
      </header>

      {/* Main content */}
      <div className="flex flex-1 gap-6 p-6 overflow-hidden">
        {/* Left: tutoring area */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto scrollbar-thin">

          {/* Intervention message banner */}
          {state.interventionMsg && (
            <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 flex items-start gap-3">
              <span className="text-accent text-lg mt-0.5">⚡</span>
              <p className="text-sm text-slate-200">{state.interventionMsg}</p>
            </div>
          )}

          {/* Question card */}
          <div className="bg-surface rounded-2xl border border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <QuestionMeta
                concept={state.currentQuestion.concept}
                difficulty={state.session.current_difficulty}
                style={state.session.current_style}
                questionType={state.currentQuestion.question_type}
              />
              {state.phase === 'question' && (
                <span className={`ml-auto flex-shrink-0 font-mono text-sm px-3 py-1 rounded-lg border ${
                  elapsedSeconds < 30 ? 'text-success border-success/30 bg-success/10' :
                  elapsedSeconds < 60 ? 'text-warning border-warning/30 bg-warning/10' :
                  'text-danger border-danger/30 bg-danger/10'
                }`}>
                  ⏱ {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
                </span>
              )}
            </div>
            <div className="text-white text-base leading-relaxed whitespace-pre-wrap font-mono bg-surface-2/50 rounded-xl p-4 border border-slate-800">
              {state.currentQuestion.question}
            </div>
          </div>

          {/* Hints */}
          {state.phase === 'question' && state.currentQuestion.hints && (
            <div className="bg-surface rounded-2xl border border-slate-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-slate-300">Hints</p>
                <span className="text-xs text-slate-500">{state.hintsRevealed}/3 revealed</span>
              </div>
              <div className="space-y-2">
                {state.currentQuestion.hints.map((hint, i) => (
                  <div key={i} className={`rounded-xl border transition-all overflow-hidden ${
                    state.hintsRevealed > i
                      ? 'border-accent/30 bg-accent/5'
                      : 'border-slate-700 bg-surface-2/30'
                  }`}>
                    {state.hintsRevealed > i ? (
                      <p className="px-4 py-3 text-sm text-slate-200">
                        <span className="text-accent font-medium mr-2">Hint {i + 1}:</span>{hint}
                      </p>
                    ) : (
                      <button
                        onClick={revealHint}
                        className="w-full px-4 py-3 text-sm text-slate-500 hover:text-slate-300 text-left transition"
                        disabled={state.hintsRevealed < i}
                      >
                        {state.hintsRevealed === i ? `Reveal Hint ${i + 1}` : `Hint ${i + 1} (locked)`}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Answer area (question phase) */}
          {state.phase === 'question' && (
            <div className="bg-surface rounded-2xl border border-slate-700 p-5">
              <label className="block text-sm font-medium text-slate-300 mb-3">Your Answer</label>
              <textarea
                ref={answerRef}
                value={state.answer}
                onChange={e => setState(s => ({ ...s, answer: e.target.value }))}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer here... (Ctrl+Enter to submit)"
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-slate-700 text-white placeholder-slate-600
                           focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none transition font-mono text-sm"
              />

              {/* Confidence slider */}
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs text-slate-400">How confident are you?</label>
                  <span className="text-xs font-medium text-accent">{CONFIDENCE_LABELS[state.confidence]}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={state.confidence}
                  onChange={e => setState(s => ({ ...s, confidence: Number(e.target.value) }))}
                  className="w-full accent-indigo-500"
                />
                <div className="flex justify-between text-xs text-slate-600 mt-1">
                  <span>Guessing</span>
                  <span>Certain</span>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!state.answer.trim()}
                className="mt-4 w-full py-3 rounded-xl bg-accent hover:bg-accent-dim text-white font-semibold
                           transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Submit Answer
              </button>
            </div>
          )}

          {/* Submitting */}
          {state.phase === 'submitting' && (
            <div className="bg-surface rounded-2xl border border-slate-700 p-8 flex items-center justify-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <p className="text-slate-400">Evaluating your answer...</p>
            </div>
          )}

          {/* Feedback */}
          {state.phase === 'feedback' && state.lastEvaluation && (
            <FeedbackCard
              evaluation={state.lastEvaluation}
              question={state.currentQuestion}
              responseTimeMs={state.lastResponseTimeMs ?? 0}
              onNext={handleNext}
            />
          )}
        </div>

        {/* Right: learner sidebar */}
        <LearnerSidebar
          session={state.session}
          student={state.student}
          learnerStates={state.learnerStates}
          lastDecision={state.lastDecision}
          totalQuestions={state.totalQuestions}
          correctCount={state.correctCount}
          streak={state.streak}
        />
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function QuestionMeta({ concept, difficulty, style, questionType }: {
  concept: string; difficulty: number; style: string; questionType: string;
}) {
  const diffColors = ['', 'text-success', 'text-success', 'text-warning', 'text-orange-400', 'text-danger'];
  const typeIcons: Record<string, string> = {
    practice: '📝', multi_step: '🔢', worked_example: '📖', mastery_check: '🎯'
  };
  const typeLabels: Record<string, string> = {
    practice: 'Practice', multi_step: 'Multi-step', worked_example: 'Worked Example', mastery_check: 'Mastery Check'
  };

  return (
    <div className="flex items-center gap-2 flex-wrap w-full">
      <span className="px-2 py-1 bg-surface-2 rounded-lg text-xs text-slate-300 capitalize">
        {concept.replace(/_/g, ' ')}
      </span>
      <span className={`px-2 py-1 bg-surface-2 rounded-lg text-xs font-semibold ${diffColors[difficulty]}`}>
        D{difficulty}
      </span>
      <span className="px-2 py-1 bg-surface-2 rounded-lg text-xs text-accent">
        {style.replace(/_/g, ' ')}
      </span>
      <span className="px-2 py-1 bg-surface-2 rounded-lg text-xs text-slate-400 ml-auto">
        {typeIcons[questionType]} {typeLabels[questionType]}
      </span>
    </div>
  );
}

function FeedbackCard({ evaluation, question, responseTimeMs, onNext }: {
  evaluation: EvaluationResult;
  question: GeneratedQuestion;
  responseTimeMs: number;
  onNext: () => void;
}) {
  const [showSteps, setShowSteps] = useState(false);
  const totalSeconds = Math.round(responseTimeMs / 1000);
  const timeLabel = totalSeconds < 60
    ? `${totalSeconds}s`
    : `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;

  return (
    <div className={`bg-surface rounded-2xl border p-6 space-y-4 ${
      evaluation.is_correct ? 'border-success/40' : 'border-danger/30'
    }`}>
      {/* Result header */}
      <div className={`flex items-center gap-3 p-4 rounded-xl ${
        evaluation.is_correct ? 'bg-success/10' : 'bg-danger/10'
      }`}>
        <span className="text-2xl">{evaluation.is_correct ? '✓' : '✗'}</span>
        <div className="flex-1">
          <p className={`font-semibold ${evaluation.is_correct ? 'text-success' : 'text-danger'}`}>
            {evaluation.is_correct ? 'Correct!' : 'Not quite'}
          </p>
          <p className="text-sm text-slate-300 mt-0.5">{evaluation.encouragement}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-slate-500">Time taken</p>
          <p className={`font-mono font-semibold text-sm ${
            totalSeconds < 30 ? 'text-success' : totalSeconds < 60 ? 'text-warning' : 'text-danger'
          }`}>⏱ {timeLabel}</p>
        </div>
      </div>

      {/* Feedback */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Feedback</p>
        <p className="text-sm text-slate-200 leading-relaxed">{evaluation.feedback}</p>
      </div>

      {/* Explanation */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Explanation</p>
        <p className="text-sm text-slate-200 leading-relaxed">{evaluation.explanation}</p>
      </div>

      {/* Error type badge */}
      {evaluation.error_type && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-warning/10 border border-warning/30 rounded-lg">
          <span className="text-warning text-xs font-medium capitalize">
            {evaluation.error_type} error
          </span>
          <span className="text-xs text-slate-400">— tutor will adjust</span>
        </div>
      )}

      {/* Solution steps toggle */}
      <div>
        <button
          onClick={() => setShowSteps(v => !v)}
          className="text-xs text-accent hover:text-indigo-300 transition"
        >
          {showSteps ? 'Hide' : 'Show'} solution steps
        </button>
        {showSteps && (
          <ol className="mt-2 space-y-1">
            {question.solution_steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-300">
                <span className="text-accent font-mono w-5 flex-shrink-0">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <button
        onClick={onNext}
        className="w-full py-3 rounded-xl bg-accent hover:bg-accent-dim text-white font-semibold transition"
      >
        Next Question →
      </button>
    </div>
  );
}
