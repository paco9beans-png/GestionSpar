import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, text, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
        <Icon className="size-7" />
      </div>
      <p className="mt-4 font-display text-lg font-bold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

interface FabProps {
  onClick: () => void;
  label: string;
  icon?: LucideIcon;
}

export function Fab({ onClick, label, icon: Icon }: FabProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-24 right-1/2 z-40 flex translate-x-1/2 items-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-float transition-transform active:scale-95"
    >
      {Icon && <Icon className="size-5" />}
      {label}
    </button>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, backTo, action }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur">
      {backTo && (
        <Link
          to={backTo}
          aria-label="Volver"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
