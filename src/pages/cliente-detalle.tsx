import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, ClipboardList, History, Mail, MapPin, Minus, Pencil, Phone, Plus, Repeat2, Search, Trash2, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { LucideIcon } from 'lucide-react';
import { useDeleteClient, useClientPurchaseHistory } from '@/lib/queries';
import type { Client, Order, PrefilledLine } from '@/lib/types';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/ui/layout';
import { StatusBadge } from '@/components/status-badge';
import { ConfirmDialog, Sheet } from '@/components/ui/sheet';
import { ClientForm } from './client-form';

function Row({ icon: Icon, value, href }: { icon: LucideIcon; value: string; href?: string }) {
  if (!value) return null;
  const content = (
    <span className="flex min-w-0 items-center gap-3 text-sm">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <span className="truncate">{value}</span>
    </span>
  );
  return href ? (
    <a href={href} className="block rounded-xl hover:bg-secondary/50">
      {content}
    </a>
  ) : (
    <div className="rounded-xl">{content}</div>
  );
}

export default function ClienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: client } = useQuery({
    queryKey: ['clients', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as Client | null;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ['orders', 'by-client', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, order_date, status, total, order_items(product_id, product_code, description, unit, unit_price, discount_pct, quantity)')
        .eq('client_id', id!)
        .order('order_date', { ascending: false });
      if (error) throw error;
      return data as (Order & { order_items: Array<{ product_id: string | null; product_code: string | null; description: string | null; unit: string | null; unit_price: number; discount_pct: number; quantity: number }> })[];
    },
  });

  const { data: purchaseHistory } = useClientPurchaseHistory(id);

  const deleteClient = useDeleteClient(id!);
  const totalBilled = useMemo(
    () =>
      (orders ?? [])
        .filter((o) => o.status !== 'cancelado')
        .reduce((s, o) => s + Number(o.total), 0),
    [orders],
  );

  if (!client) {
    return (
      <div className="min-h-dvh bg-background">
        <PageHeader title="Cliente" backTo="/clientes" />
        <p className="p-8 text-center text-sm text-muted-foreground">Este cliente no existe.</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-28">
      <PageHeader
        title="Detalle de cliente"
        backTo="/clientes"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmOpen(true)}
              aria-label="Eliminar cliente"
              className="grid size-10 place-items-center rounded-full bg-secondary text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
            <button
              onClick={() => navigate(`/clientes/${id}`)}
              aria-label="Editar cliente"
              className="hidden"
            />
          </div>
        }
      />
      <div className="mx-auto max-w-md space-y-4 px-4 pt-4">
        <div className="flex items-center gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Building2 className="size-7" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-display text-xl font-bold">{client.name}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {[client.code && `#${client.code}`, client.tax_id].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="ml-auto">
            <EditButton client={client} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Pedidos</p>
            <p className="font-display text-xl font-bold tabular">{orders?.length ?? 0}</p>
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Facturado</p>
            <p className="font-display text-xl font-bold tabular">{formatMoney(totalBilled)}</p>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl bg-card p-3 shadow-card">
          <Row icon={UserRound} value={client.contact_name ?? ''} />
          <Row icon={Phone} value={client.phone ?? ''} href={client.phone ? `tel:${client.phone}` : undefined} />
          <Row icon={Mail} value={client.email ?? ''} href={client.email ? `mailto:${client.email}` : undefined} />
          <Row
            icon={MapPin}
            value={[client.address, client.postal_code, client.city].filter(Boolean).join(', ')}
          />
          {client.notes && (
            <p className="whitespace-pre-wrap rounded-xl bg-secondary px-3.5 py-2.5 text-sm text-muted-foreground">
              {client.notes}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            to={`/pedidos/nuevo?cliente=${client.id}`}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-center text-sm font-semibold text-primary-foreground shadow-card transition-transform active:scale-[0.98]"
          >
            Nuevo pedido
          </Link>
          <Link
            to={`/clientes/${client.id}/hoja-ruta`}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-secondary text-center text-sm font-semibold text-foreground transition-transform active:scale-[0.98]"
          >
            <ClipboardList className="size-4" /> Hoja de ruta
          </Link>
        </div>

        <PurchaseHistorySection
          clientId={client.id}
          history={purchaseHistory ?? []}
          orders={(orders ?? []).filter((o) => o.status !== 'cancelado')}
          onRepeat={(lines) =>
            navigate(`/pedidos/nuevo?cliente=${client.id}`, { state: { lines } })
          }
        />

        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Pedidos</h3>
          {(orders ?? []).length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card p-5 text-center text-sm text-muted-foreground">
              Este cliente aún no tiene pedidos.
            </p>
          ) : (
            <ul className="space-y-2">
              {(orders ?? []).map((o) => (
                <li key={o.id}>
                  <Link
                    to={`/pedidos/${o.id}`}
                    className="flex items-center justify-between rounded-2xl bg-card p-3.5 shadow-card"
                  >
                    <div>
                      <p className="text-sm font-semibold">Pedido nº {o.order_number}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(o.order_date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-display font-bold tabular">{formatMoney(o.total)}</span>
                      <StatusBadge status={o.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="¿Eliminar este cliente?"
        text="Se eliminará el cliente. Sus pedidos anteriores se conservarán sin cliente asociado."
        onConfirm={() =>
          deleteClient.mutate(undefined, {
            onSuccess: () => navigate('/clientes', { replace: true }),
          })
        }
        loading={deleteClient.isPending}
      />
    </div>
  );
}

function EditButton({ client }: { client: Client }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Editar cliente"
        className="flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2.5 text-sm font-semibold"
      >
        <Pencil className="size-4" /> Editar
      </button>
      {open && <ClientForm editing={client} onClose={() => setOpen(false)} />}
    </>
  );
}

interface HistoryRow {
  product_id: string | null;
  product_code: string | null;
  description: string | null;
  barcode_ean: string | null;
  unit_price: number;
  discount_pct: number;
  total_quantity: number;
  last_date: string;
  last_order_id: string;
  last_order_number: number;
}

interface RepeatableOrder {
  id: string;
  order_number: number;
  order_date: string;
  status: string;
  order_items: Array<{
    product_id: string | null;
    product_code: string | null;
    description: string | null;
    unit: string | null;
    unit_price: number;
    discount_pct: number;
    quantity: number;
  }>;
}

function PurchaseHistorySection({
  history,
  orders,
  onRepeat,
}: {
  clientId: string;
  history: HistoryRow[];
  orders: RepeatableOrder[];
  onRepeat: (lines: PrefilledLine[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [repeatPicker, setRepeatPicker] = useState(false);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return history;
    return history.filter(
      (h) =>
        (h.description ?? '').toLowerCase().includes(t) ||
        (h.product_code ?? '').toLowerCase().includes(t) ||
        (h.barcode_ean ?? '').includes(t),
    );
  }, [history, search]);

  function toggle(id: string) {
    setSelected((s) => {
      if (id in s) {
        const { [id]: _, ...rest } = s;
        return rest;
      }
      return { ...s, [id]: 1 };
    });
  }

  function setQty(id: string, qty: number) {
    setSelected((s) => ({ ...s, [id]: Math.max(1, qty) }));
  }

  const selectedLines: PrefilledLine[] = useMemo(() => {
    return Object.entries(selected).map(([key, qty]) => {
      const h = history.find(
        (x) => (x.product_id ?? x.product_code ?? '') === key,
      );
      return {
        product_id: h?.product_id ?? '',
        product_code: h?.product_code ?? '',
        description: h?.description ?? '',
        unit: null,
        photo: null,
        unit_price: h?.unit_price ?? 0,
        discount_pct: h?.discount_pct ?? 0,
        quantity: qty,
      };
    });
  }, [selected, history]);

  function addSelectedToOrder() {
    if (selectedLines.length === 0) return;
    onRepeat(selectedLines);
  }

  function repeatLast() {
    const last = orders[0];
    if (!last) return;
    onRepeat(itemsToPrefilled(last.order_items));
  }

  const itemsToPrefilled = (items: RepeatableOrder['order_items']): PrefilledLine[] =>
    items
      .filter((i) => i.product_id || i.product_code)
      .map((i) => ({
        product_id: i.product_id ?? '',
        product_code: i.product_code ?? '',
        description: i.description ?? '',
        unit: i.unit,
        photo: null,
        unit_price: i.unit_price,
        discount_pct: i.discount_pct,
        quantity: i.quantity,
      }));

  if (history.length === 0 && orders.length === 0) {
    return (
      <section>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Historial de compras</h3>
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card p-5 text-center">
          <History className="size-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Este cliente aún no tiene historial de compras.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Historial de compras</h3>
        {orders.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={repeatLast}
              className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold"
            >
              <Repeat2 className="size-3.5" /> Repetir último
            </button>
            <button
              onClick={() => setRepeatPicker(true)}
              className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold"
            >
              <Repeat2 className="size-3.5" /> Pedidos anteriores
            </button>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto…"
              className="w-full rounded-2xl border border-border bg-card py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <ul className="space-y-1.5">
            {filtered.map((h) => {
              const key = h.product_id ?? h.product_code ?? '';
              const isSelected = key in selected;
              return (
                <li key={key}>
                  <div
                    className={`rounded-2xl bg-card p-3 shadow-card transition-colors ${isSelected ? 'ring-2 ring-primary' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {h.product_code}
                        </p>
                        <p className="truncate text-sm font-medium">{h.description}</p>
                        {h.barcode_ean && (
                          <p className="text-xs text-muted-foreground">EAN: {h.barcode_ean}</p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatNumber(h.total_quantity)} uds · Últ. compra {formatDate(h.last_date)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-display text-sm font-bold tabular">{formatMoney(h.unit_price)}</p>
                        {h.discount_pct > 0 && (
                          <p className="text-[10px] font-semibold text-accent-foreground">
                            −{formatNumber(h.discount_pct)}%
                          </p>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
                        <span className="text-xs text-muted-foreground">Cantidad:</span>
                        <button
                          onClick={() => setQty(key, selected[key] - 1)}
                          aria-label="Restar"
                          className="grid size-7 place-items-center rounded-lg bg-secondary"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <input
                          inputMode="decimal"
                          value={selected[key]}
                          onChange={(e) => {
                            const n = Number(e.target.value.replace(',', '.'));
                            if (!Number.isNaN(n)) setQty(key, Math.max(1, n));
                          }}
                          className="w-12 rounded-lg border border-border bg-card px-2 py-1 text-center text-sm tabular outline-none focus:border-primary"
                        />
                        <button
                          onClick={() => setQty(key, selected[key] + 1)}
                          aria-label="Sumar"
                          className="grid size-7 place-items-center rounded-lg bg-secondary"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => toggle(key)}
                      className={`mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        isSelected
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-primary-soft text-primary'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Trash2 className="size-3.5" /> Quitar selección
                        </>
                      ) : (
                        <>
                          <Plus className="size-3.5" /> Añadir al pedido
                        </>
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {Object.keys(selected).length > 0 && (
            <button
              onClick={addSelectedToOrder}
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-card transition-transform active:scale-[0.98]"
            >
              <Plus className="size-4" />
              Crear pedido con {Object.keys(selected).length} producto{Object.keys(selected).length > 1 ? 's' : ''}
            </button>
          )}
        </>
      )}

      {history.length === 0 && orders.length > 0 && (
        <p className="rounded-2xl border border-dashed border-border bg-card p-5 text-center text-sm text-muted-foreground">
          Los pedidos de este cliente están cancelados o no tienen productos.
        </p>
      )}

      {/* Repeat order picker */}
      <Sheet open={repeatPicker} onClose={() => setRepeatPicker(false)} title="Repetir pedido anterior">
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <button
                onClick={() => {
                  onRepeat(itemsToPrefilled(o.order_items));
                }}
                className="flex w-full items-center justify-between rounded-xl bg-secondary px-3.5 py-3 text-left"
              >
                <span>
                  <span className="block text-sm font-semibold">Pedido nº {o.order_number}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDate(o.order_date)} · {o.order_items.length} productos
                  </span>
                </span>
                <Repeat2 className="size-5 text-primary" />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </section>
  );
}
