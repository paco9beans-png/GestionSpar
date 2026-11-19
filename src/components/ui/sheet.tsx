import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-background shadow-float sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-9 place-items-center rounded-full bg-secondary text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

interface ConfirmProps {
  open: boolean;
  onClose: () => void;
  title: string;
  text: string;
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmDialog({ open, onClose, title, text, onConfirm, loading }: ConfirmProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="text-sm text-muted-foreground">{text}</p>
      <div className="mt-5 flex gap-3">
        <button
          onClick={onClose}
          className="h-11 flex-1 rounded-xl border border-border bg-card text-sm font-semibold"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="h-11 flex-1 rounded-xl bg-destructive text-sm font-semibold text-destructive-foreground disabled:opacity-60"
        >
          {loading ? 'Eliminando…' : 'Eliminar'}
        </button>
      </div>
    </Sheet>
  );
}
