interface Props {
  mastery: number;
  label?: string;
  size?: 'sm' | 'md';
}

export default function MasteryBar({ mastery, label, size = 'md' }: Props) {
  const pct = Math.round(mastery * 100);
  const color =
    pct >= 90 ? 'bg-success' :
    pct >= 65 ? 'bg-accent' :
    pct >= 40 ? 'bg-warning' :
    'bg-danger';

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-1">
          <span className={`text-slate-300 truncate ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>{label}</span>
          <span className={`font-mono font-medium ml-2 ${size === 'sm' ? 'text-xs' : 'text-sm'} ${pct >= 65 ? 'text-success' : 'text-slate-400'}`}>
            {pct}%
          </span>
        </div>
      )}
      <div className={`w-full bg-slate-700 rounded-full overflow-hidden ${size === 'sm' ? 'h-1.5' : 'h-2'}`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
