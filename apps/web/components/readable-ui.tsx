type PageHeaderProps = {
  title: string;
  description?: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="space-y-2.5">
      <h1 className="app-header-title">{title}</h1>
      {description ? <p className="app-header-description">{description}</p> : null}
    </header>
  );
}

type SectionCardProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function SectionCard({ title, description, actions, children }: SectionCardProps) {
  return (
    <section className="app-surface space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-900">{title}</h2>
          {description ? <p className="text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="app-empty-state">
      <p className="font-medium text-slate-800">{title}</p>
      <p className="mt-1.5 leading-6">{description}</p>
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  helper?: string;
};

export function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <article className="app-surface">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-3 text-[28px] font-semibold tracking-[-0.03em] text-slate-950">{value}</p>
      {helper ? <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p> : null}
    </article>
  );
}

type StatusTone = 'green' | 'amber' | 'red' | 'slate';

const statusToneMap: Record<StatusTone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200'
};

export function StatusBadge({
  label,
  tone = 'slate'
}: {
  label: string;
  tone?: StatusTone;
}) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusToneMap[tone]}`}>
      {label}
    </span>
  );
}

export function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: value.includes('T') ? 'short' : undefined
  }).format(date);
}

export function formatNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  const parsed = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(parsed)) return String(value);
  return new Intl.NumberFormat('tr-TR').format(parsed);
}

export function formatTextList(values: Array<string | null | undefined>) {
  const items = values.filter((value): value is string => Boolean(value));
  return items.length > 0 ? items.join(', ') : '-';
}
