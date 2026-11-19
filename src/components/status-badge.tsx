import type { OrderStatus } from '@/lib/types';

const styles: Record<OrderStatus, string> = {
  pendiente: 'bg-accent/15 text-accent-foreground border-accent/30',
  enviado: 'bg-blue-100 text-blue-800 border-blue-200',
  entregado: 'bg-primary-soft text-primary border-primary/25',
  cancelado: 'bg-destructive/10 text-destructive border-destructive/25',
};

const labels: Record<OrderStatus, string> = {
  pendiente: 'Pendiente',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
