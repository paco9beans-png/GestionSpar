import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Plus } from 'lucide-react';
import { useOrders } from '@/lib/queries';
import type { OrderStatus } from '@/lib/types';
import { ORDER_STATUSES } from '@/lib/types';
import { formatDate, formatMoney } from '@/lib/format';
import { PageHeader } from '@/components/ui/layout';
import { SearchInput } from '@/components/ui/search-input';
import { StatusBadge } from '@/components/status-badge';

const FILTERS: { value: 'todos' | OrderStatus; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  ...ORDER_STATUSES,
];

export default function Pedidos() {
  const { data: orders, isLoading } = useOrders();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'todos' | OrderStatus>('todos');

  const filtered = useMemo(() => {
    const list = orders ?? [];
    const t = q.trim().toLowerCase();
    return list
      .filter((o) => (filter === 'todos' ? true : o.status === filter))
      .filter(
        (o) =>
          !t ||
          (o.clients?.name ?? '').toLowerCase().includes(t) ||
          String(o.order_number).includes(t),
      );
  }, [orders, q, filter]);

  return (
    <div className="min-h-dvh bg-background pb-28">
      <PageHeader title="Pedidos" subtitle={orders ? `${orders.length} registrados` : undefined} />
      <div className="mx-auto max-w-md px-4 pt-4">
        {orders && orders.length > 0 && (
          <>
            <div className="mb-3">
              <SearchInput value={q} onChange={setQ} placeholder="Buscar por cliente o nº de pedido…" />
            </div>
            <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 scrollbar-none">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                    filter === f.value ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted-foreground'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </>
        )}
        {isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
              <ClipboardList className="size-7" />
            </div>
            <p className="mt-4 font-display text-lg font-bold">
              {(orders?.length ?? 0) === 0 ? 'Sin pedidos todavía' : 'Sin resultados'}
            </p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {(orders?.length ?? 0) === 0
                ? 'Crea tu primer pedido seleccionando un cliente y añadiendo productos.'
                : 'Prueba con otro filtro o búsqueda.'}
            </p>
            {(orders?.length ?? 0) === 0 && (
              <Link
                to="/pedidos/nuevo"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                <Plus className="size-4" /> Nuevo pedido
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((o) => (
              <li key={o.id}>
                <Link
                  to={`/pedidos/${o.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-card p-3.5 shadow-card transition-transform active:scale-[0.99]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{o.clients?.name ?? 'Cliente'}</p>
                    <p className="text-xs text-muted-foreground">
                      nº {o.order_number} · {formatDate(o.order_date)}
                    </p>
                  </div>
                  <div className="ml-3 flex flex-col items-end gap-1">
                    <span className="font-display text-base font-bold tabular">{formatMoney(o.total)}</span>
                    <StatusBadge status={o.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Link
        to="/pedidos/nuevo"
        className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-float"
      >
        <Plus className="size-5" /> Nuevo pedido
      </Link>
    </div>
  );
}
