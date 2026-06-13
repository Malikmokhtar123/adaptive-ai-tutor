import MasteryBar from './MasteryBar';
import { LearnerState, Session, Student, AdaptiveDecision } from '@/types';

const DIFF_LABELS = ['', 'Very Easy', 'Easy', 'Moderate', 'Hard', 'Challenge'];
const DIFF_COLORS = ['', 'text-success', 'text-success', 'text-warning', 'text-orange-400', 'text-danger'];

const STYLE_LABELS: Record<string, string> = {
  direct: 'Direct',
  example_first: 'Example First',
  step_by_step: 'Step-by-Step',
  analogy: 'Analogy',
  worked_example: 'Worked Example',
};

interface Props {
  session: Session;
  student: Student;
  learnerStates: LearnerState[];
  lastDecision: AdaptiveDecision | null;
  totalQuestions: number;
  correctCount: number;
  streak: number;
}

export default function LearnerSidebar({
  session,
  student,
  learnerStates,
  lastDecision,
  totalQuestions,
  correctCount,
  streak,
}: Props) {
  const currentState = learnerStates.find(ls => ls.concept === session.current_concept);

  return (
    <aside className="w-72 flex-shrink-0 bg-surface rounded-2xl border border-slate-700 p-5 space-y-6 overflow-y-auto scrollbar-thin">
      {/* Student */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Student</p>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center font-bold text-accent">
            {student.name[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-white text-sm">{student.name}</p>
            <p className="text-xs text-slate-400">{session.topic === 'algebra' ? 'Algebra' : 'Python'}</p>
          </div>
        </div>
      </div>

      {/* Session stats */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Session Stats</p>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Questions" value={totalQuestions} />
          <StatCard label="Correct" value={`${totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%`} />
          <StatCard label="Streak" value={streak} highlight={streak >= 3} />
        </div>
      </div>

      {/* Current adaptation state */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Current Settings</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-surface-2 rounded-lg px-3 py-2">
            <span className="text-xs text-slate-400">Difficulty</span>
            <span className={`text-xs font-semibold ${DIFF_COLORS[session.current_difficulty]}`}>
              {'●'.repeat(session.current_difficulty)}{'○'.repeat(5 - session.current_difficulty)} {DIFF_LABELS[session.current_difficulty]}
            </span>
          </div>
          <div className="flex items-center justify-between bg-surface-2 rounded-lg px-3 py-2">
            <span className="text-xs text-slate-400">Style</span>
            <span className="text-xs font-semibold text-accent">{STYLE_LABELS[session.current_style]}</span>
          </div>
          <div className="flex items-center justify-between bg-surface-2 rounded-lg px-3 py-2">
            <span className="text-xs text-slate-400">Concept</span>
            <span className="text-xs font-semibold text-slate-200 text-right">{session.current_concept.replace(/_/g, ' ')}</span>
          </div>
        </div>
      </div>

      {/* Mastery across all concepts */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Concept Mastery</p>
        <div className="space-y-3">
          {learnerStates.map(ls => (
            <MasteryBar
              key={ls.concept}
              mastery={ls.mastery_prob}
              label={ls.concept.replace(/_/g, ' ')}
              size="sm"
            />
          ))}
        </div>
      </div>

      {/* Error patterns */}
      {currentState && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Error Patterns</p>
          <div className="space-y-1.5">
            {Object.entries(currentState.error_pattern).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-xs text-slate-400 capitalize">{type}</span>
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-sm ${i < count ? 'bg-warning' : 'bg-slate-700'}`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-slate-500 w-4 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Adaptation reason */}
      {lastDecision?.reason && (
        <div className="bg-accent/5 border border-accent/20 rounded-xl p-3">
          <p className="text-xs text-accent font-medium mb-1">Last adaptation</p>
          <p className="text-xs text-slate-300 leading-relaxed">{lastDecision.reason}</p>
        </div>
      )}
    </aside>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className="bg-surface-2 rounded-xl p-2 text-center">
      <p className={`text-base font-bold ${highlight ? 'text-success' : 'text-white'}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
