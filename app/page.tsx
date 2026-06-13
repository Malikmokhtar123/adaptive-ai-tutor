'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TOPICS = [
  {
    id: 'algebra',
    label: 'Algebra',
    icon: '∑',
    desc: 'Linear equations, inequalities, quadratics, word problems',
    concepts: ['Linear Equations', 'Inequalities', 'Systems', 'Quadratics', 'Word Problems'],
  },
  {
    id: 'python',
    label: 'Python',
    icon: '⌨',
    desc: 'Variables, conditionals, loops, functions, lists',
    concepts: ['Variables & Types', 'Conditionals', 'Loops', 'Functions', 'Lists'],
  },
];

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [topic, setTopic] = useState<'algebra' | 'python'>('algebra');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter your name.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_name: name.trim(), topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start session');
      localStorage.setItem(`tutor_${data.session_id}`, JSON.stringify(data.session));
      router.push(`/tutor/${data.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/20 border border-accent/30 mb-4">
            <span className="text-3xl">🧠</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Adaptive AI Tutor</h1>
          <p className="text-slate-400 mt-2 text-sm">
            Learns how you learn — adjusts difficulty, style, and pacing in real time
          </p>
        </div>

        <form onSubmit={handleStart} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Your name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 rounded-xl bg-surface border border-slate-700 text-white placeholder-slate-500
                         focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
            />
          </div>

          {/* Topic selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Choose a subject</label>
            <div className="grid grid-cols-2 gap-3">
              {TOPICS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTopic(t.id as 'algebra' | 'python')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    topic === t.id
                      ? 'border-accent bg-accent/10 ring-1 ring-accent'
                      : 'border-slate-700 bg-surface hover:border-slate-500'
                  }`}
                >
                  <div className="text-2xl mb-2">{t.icon}</div>
                  <div className="font-semibold text-white">{t.label}</div>
                  <div className="text-xs text-slate-400 mt-1">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Concept preview */}
          <div className="bg-surface/50 rounded-xl p-4 border border-slate-800">
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Concepts covered</p>
            <div className="flex flex-wrap gap-2">
              {TOPICS.find(t => t.id === topic)?.concepts.map(c => (
                <span key={c} className="px-2 py-1 bg-surface-2 rounded-lg text-xs text-slate-300">{c}</span>
              ))}
            </div>
          </div>

          {/* What adapts info */}
          <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
            <p className="text-xs text-accent font-medium mb-2">What adapts in real time</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-slate-400">
              {['Difficulty (1–5)', 'Explanation style', 'Hint depth', 'Question type', 'Pacing', 'Concept sequencing'].map(item => (
                <span key={item} className="flex items-center gap-1">
                  <span className="text-accent">•</span> {item}
                </span>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-danger text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-accent hover:bg-accent-dim text-white font-semibold
                       transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating your first question...
              </>
            ) : (
              'Start Learning →'
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
