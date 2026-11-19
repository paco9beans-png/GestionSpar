import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Share2, Trash2 } from 'lucide-react';
import { useOrder, useUpdateOrderStatus, useDeleteOrder } from '@/lib/queries';
import { ORDER_STATUSES, type OrderStatus } from '@/lib/types';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { ConfirmDialog } from '@/components/ui/sheet';

export default function PedidoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: order, isLoading } = useOrder(id);
  const updateStatus = useUpdateOrderStatus(id!);
  const deleteOrder = useDeleteOrder(id!);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background">
        <div className="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-dvh bg-background">
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Este pedido no existe.</p>
          <Link to="/pedidos" className="mt-4 inline-block font-semibold text-primary">
            Volver a pedidos
          </Link>
        </div>
      </div>
    );
  }

  async function share() {
    if (!order) return;
    const text = [
      `Pedido nº ${order.order_number} — ${order.clients?.name ?? ''}`,
      `Fecha: ${formatDate(order.order_date)}`,
      '',
      ...order.order_items!.map(
        (i) =>
          `${i.product_code} ${i.description} · ${formatNumber(i.quantity)} × ${formatMoney(i.unit_price)}${
            Number(i.discount_pct) > 0 ? ` (−${formatNumber(i.discount_pct)}%)` : ''
          } = ${formatMoney(i.line_total)}`,
      ),
      '',
      `TOTAL: ${formatMoney(order.total)}`,
      order.notes ? `\nObservaciones: ${order.notes}` : '',
    ].join('\n');
    if (navigator.share) {
      try {
        await navigator.share({ title: `Pedido nº ${order.order_number}`, text });
      } catch {
        /* cancelled */
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  }

  return (
    <div className="min-h-dvh bg-background pb-28">
      <div className="bg-hero px-4 pb-8 pt-4 text-primary-foreground">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <Link
              to="/pedidos"
              aria-label="Volver"
              className="grid size-10 place-items-center rounded-full bg-primary-foreground/15"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
            </Link>
            <div className="flex gap-2">
              <button
                onClick={share}
                aria-label="Compartir pedido"
                className="grid size-10 place-items-center rounded-full bg-primary-foreground/15"
              >
                <Share2 className="size-4" />
              </button>
              <button
                onClick={() => setConfirmOpen(true)}
                aria-label="Eliminar pedido"
                className="grid size-10 place-items-center rounded-full bg-primary-foreground/15"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
          <p className="mt-4 text-sm text-primary-foreground/80">
            Pedido nº {order.order_number} · {formatDate(order.order_date)}
          </p>
          {order.clients ? (
            <Link
              to={`/clientes/${order.clients.id}`}
              className="mt-1 block font-display text-2xl font-bold leading-tight"
            >
              {order.clients.name}
            </Link>
          ) : (
            <p className="mt-1 text-2xl font-bold">Cliente</p>
          )}
          <p className="mt-3 font-display text-4xl font-extrabold tabular">{formatMoney(order.total)}</p>
        </div>
      </div>

      <div className="mx-auto -mt-5 max-w-md space-y-4 px-4">
        <div className="rounded-2xl bg-card p-3 shadow-card">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</p>
          <div className="grid grid-cols-4 gap-1.5">
            {ORDER_STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => updateStatus.mutate(s.value as OrderStatus)}
                className={`rounded-xl py-2 text-xs font-semibold transition-colors ${
                  order.status === s.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <section className="rounded-2xl bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold">Productos</h2>
            <StatusBadge status={order.status} />
          </div>
          <ul className="divide-y divide-border">
            {order.order_items!.map((i) => (
              <li key={i.id} className="px-4 py-3">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {i.product_code}
                    </p>
                    <p className="text-sm font-medium leading-5">{i.description}</p>
                  </div>
                  <p className="shrink-0 font-display font-bold tabular">{formatMoney(i.line_total)}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground tabular">
                  {formatNumber(i.quantity)} × {formatMoney(i.unit_price)}
                  {Number(i.discount_pct) > 0 && (
                    <span className="ml-1 font-semibold text-accent-foreground">
                      −{formatNumber(i.discount_pct)}%
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
          <dl className="space-y-1.5 border-t border-border px-4 py-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <dt>Importe bruto</dt>
              <dd className="tabular">{formatMoney(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>Descuentos</dt>
              <dd className="tabular">−{formatMoney(order.discount_total)}</dd>
            </div>
            <div className="flex justify-between pt-1 text-base font-bold">
              <dt>Total</dt>
              <dd className="font-display tabular">{formatMoney(order.total)}</dd>
            </div>
          </dl>
        </section>

        {order.notes && (
          <section className="rounded-2xl bg-card p-4 shadow-card">
            <h2 className="mb-1 text-sm font-semibold text-muted-foreground">Observaciones</h2>
            <p className="whitespace-pre-wrap text-sm">{order.notes}</p>
          </section>
        )}

        <Button variant="outline" size="lg" className="w-full" onClick={share}>
          <Share2 className="size-4" /> Compartir pedido
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="¿Eliminar este pedido?"
        text="Se borrará el pedido y todas sus líneas."
        onConfirm={() =>
          deleteOrder.mutate(undefined, {
            onSuccess: () => navigate('/pedidos', { replace: true }),
          })
        }
        loading={deleteOrder.isPending}
      />
    </div>
  );
}
