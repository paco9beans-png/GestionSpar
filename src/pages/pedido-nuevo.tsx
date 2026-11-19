import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Minus, Plus, Repeat2, Search, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useClientPurchaseHistory, useClients, useProducts, signProductPhotoUrl } from '@/lib/queries';
import type { Client, NewOrderLine, PrefilledLine, Product } from '@/lib/types';
import { formatMoney, formatNumber, parseNumberInput } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { ProductPhoto } from '@/components/product-photo';

interface DraftLine extends NewOrderLine {
  unit_price: number;
  discount_pct: number;
  quantity: number;
}

type ProductTab = 'todos' | 'familias' | 'comprados' | 'ultimo' | 'repetir';

interface PreviousOrder {
  id: string;
  order_number: number;
  order_date: string;
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

function emptyLine(p: Product): DraftLine {
  return {
    product_id: p.id,
    product_code: p.code,
    description: p.description,
    unit: p.unit,
    photo: p.photo_url,
    price: Number(p.price),
    discount_pct: Number(p.discount_pct),
    quantity: 1,
    unit_price: Number(p.price),
  };
}

function lineTotal(l: DraftLine): number {
  const gross = l.quantity * l.unit_price;
  return Math.round((gross * (1 - l.discount_pct / 100)) * 100) / 100;
}

export default function NuevoPedido() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const preClient = params.get('cliente');
  const qc = useQueryClient();
  const [clientId, setClientId] = useState<string | null>(preClient);

  const { data: clients } = useClients();
  const { data: products } = useProducts();
  const { data: purchasedProducts } = useClientPurchaseHistory(clientId ?? undefined);
  const { data: previousOrders } = useQuery({
    queryKey: ['orders', 'client-history', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, order_date, order_items(product_id, product_code, description, unit, unit_price, discount_pct, quantity)')
        .eq('client_id', clientId!)
        .neq('status', 'cancelado')
        .order('order_date', { ascending: false })
        .order('order_number', { ascending: false });
      if (error) throw error;
      return data as PreviousOrder[];
    },
  });

  const prefilled = (location.state as { lines?: PrefilledLine[] } | null)?.lines ?? [];

  const [lines, setLines] = useState<DraftLine[]>(() =>
    prefilled.map((l) => ({
      product_id: l.product_id,
      product_code: l.product_code,
      description: l.description,
      unit: l.unit,
      photo: l.photo,
      price: l.unit_price,
      discount_pct: l.discount_pct,
      quantity: l.quantity,
      unit_price: l.unit_price,
    })),
  );

  useEffect(() => {
    if (prefilled.length === 0 || !products) return;
    setLines((current) => current.map((line) => {
      const product = products.find((candidate) => candidate.id === line.product_id);
      if (!product) return line;
      return {
        ...line,
        product_code: product.code,
        description: product.description,
        unit: product.unit,
        photo: product.photo_url,
        price: Number(product.price),
        unit_price: Number(product.price),
        discount_pct: Number(product.discount_pct),
      };
    }));
  }, [products, prefilled.length]);
  const [notes, setNotes] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [clientPicker, setClientPicker] = useState(false);
  const [productPicker, setProductPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productTab, setProductTab] = useState<ProductTab>('todos');
  const [family, setFamily] = useState('Todas');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClient = (clients ?? []).find((c) => c.id === clientId) ?? null;

  const filteredClients = useMemo(() => {
    const t = clientSearch.trim().toLowerCase();
    return (clients ?? []).filter(
      (c) => !t || c.name.toLowerCase().includes(t) || (c.code ?? '').toLowerCase().includes(t),
    );
  }, [clients, clientSearch]);

  const families = useMemo(() => ['Todas', ...Array.from(new Set((products ?? []).map((p) => p.category).filter(Boolean))) as string[]], [products]);
  const filteredProducts = useMemo(() => {
    const t = productSearch.trim().toLowerCase();
    const purchasedIds = new Set((purchasedProducts ?? []).map((item) => item.product_id).filter(Boolean));
    const purchasedCodes = new Set((purchasedProducts ?? []).map((item) => item.product_code).filter(Boolean));
    const lastIds = new Set((previousOrders?.[0]?.order_items ?? []).map((item) => item.product_id).filter(Boolean));
    const lastCodes = new Set((previousOrders?.[0]?.order_items ?? []).map((item) => item.product_code).filter(Boolean));
    return (products ?? []).filter((p) => {
      const matchesText = !t || [p.code, p.barcode_ean, p.spar_ref, p.spar_code, p.description].filter(Boolean).some((value) => value!.toLowerCase().includes(t));
      const matchesFamily = productTab !== 'familias' || family === 'Todas' || p.category === family;
      const matchesBought = productTab !== 'comprados' || purchasedIds.has(p.id) || purchasedCodes.has(p.code);
      const matchesLast = productTab !== 'ultimo' || lastIds.has(p.id) || lastCodes.has(p.code);
      return p.active && matchesText && matchesFamily && matchesBought && matchesLast;
    });
  }, [products, productSearch, productTab, family, purchasedProducts, previousOrders]);

  const [signedPhotos, setSignedPhotos] = useState<Record<string, string>>({});
  useMemo(() => {
    if (!products) return;
    let alive = true;
    Promise.all(
      products
        .filter((p) => p.photo_url && !p.photo_url.startsWith('http'))
        .map(async (p) => [p.id, await signProductPhotoUrl(p.photo_url)] as const),
    ).then((pairs) => {
      if (alive) setSignedPhotos(Object.fromEntries(pairs.filter(([, u]) => u) as [string, string][]));
    });
    return () => {
      alive = false;
    };
  }, [products]);

  function addProduct(p: Product) {
    setLines((prev) => {
      const existing = prev.find((l) => l.product_id === p.id);
      if (existing) {
        return prev.map((l) => (l.product_id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, emptyLine(p)];
    });
  }

  function updateLine(idx: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function repeatOrder(order: PreviousOrder) {
    setLines(order.order_items.map((item) => {
      const product = (products ?? []).find((candidate) => candidate.id === item.product_id || candidate.code === item.product_code);
      if (product) return { ...emptyLine(product), quantity: Number(item.quantity) };
      return {
        product_id: '',
        product_code: item.product_code ?? '',
        description: item.description ?? '',
        unit: item.unit,
        photo: null,
        price: Number(item.unit_price),
        unit_price: Number(item.unit_price),
        discount_pct: Number(item.discount_pct),
        quantity: Number(item.quantity),
      };
    }));
    setProductTab('repetir');
    setProductPicker(false);
  }

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
    const discount = lines.reduce((s, l) => s + l.quantity * l.unit_price * (l.discount_pct / 100), 0);
    const total = subtotal - discount;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      total: Math.round(total * 100) / 100,
      units: lines.reduce((s, l) => s + l.quantity, 0),
    };
  }, [lines]);

  async function save() {
    if (!clientId) {
      setError('Selecciona un cliente');
      return;
    }
    if (lines.length === 0) {
      setError('Añade al menos un producto');
      return;
    }
    setBusy(true);
    setError(null);

    // Get next order_number for this user
    const { data: maxRow } = await supabase
      .from('orders')
      .select('order_number')
      .order('order_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNumber = (maxRow?.order_number ?? 0) + 1;

    const orderPayload = {
      client_id: clientId,
      order_number: nextNumber,
      order_date: orderDate,
      status: 'pendiente',
      subtotal: totals.subtotal,
      discount_total: totals.discount,
      total: totals.total,
      notes: notes.trim() || null,
    };

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select('id')
      .single();
    if (orderErr) {
      setBusy(false);
      setError('No se pudo crear el pedido');
      return;
    }

    const items = lines.map((l, i) => ({
      order_id: order.id,
      product_id: l.product_id || null,
      product_code: l.product_code,
      description: l.description,
      unit: l.unit,
      quantity: l.quantity,
      unit_price: l.unit_price,
      discount_pct: l.discount_pct,
      line_total: lineTotal(l),
      position: i,
    }));

    const { error: itemsErr } = await supabase.from('order_items').insert(items);
    setBusy(false);
    if (itemsErr) {
      setError('No se pudieron guardar las líneas del pedido');
      return;
    }
    await qc.invalidateQueries({ queryKey: ['orders'] });
    await qc.invalidateQueries({ queryKey: ['stats'] });
    await qc.invalidateQueries({ queryKey: ['purchase-history'] });
    navigate(`/pedidos/${order.id}`, { replace: true });
  }

  return (
    <div className="min-h-dvh bg-background pb-44">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur">
        <button
          onClick={() => navigate('/pedidos')}
          aria-label="Volver"
          className="grid size-10 place-items-center rounded-full bg-secondary"
        >
          <X className="size-5" />
        </button>
        <h1 className="text-xl font-bold">Nuevo pedido</h1>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 pt-4">
        <section>
          <p className="mb-1.5 text-sm font-semibold text-muted-foreground">Cliente</p>
          {(clients?.length ?? 0) === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
              No tienes clientes todavía.{' '}
              <a href="#/clientes" className="font-semibold text-primary">Añadir clientes</a>
            </div>
          ) : (
            <button
              onClick={() => setClientPicker(true)}
              className="flex w-full items-center gap-3 rounded-2xl bg-card p-3.5 text-left shadow-card"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                <span className="font-display text-base font-bold">
                  {selectedClient?.name.charAt(0) ?? '?'}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                {selectedClient ? (
                  <>
                    <span className="block truncate font-semibold">{selectedClient.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[selectedClient.code && `#${selectedClient.code}`, selectedClient.city]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </span>
                  </>
                ) : (
                  <span className="font-medium text-muted-foreground">Seleccionar cliente</span>
                )}
              </span>
              <ChevronDown className="size-5 text-muted-foreground" />
            </button>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-semibold text-muted-foreground">Resumen</p>
            <div className="rounded-xl bg-card px-3.5 py-2.5 text-sm shadow-card">
              <p className="flex justify-between">
                <span className="text-muted-foreground">Líneas</span>
                <span className="tabular">{lines.length}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground">Unidades</span>
                <span className="tabular">{formatNumber(totals.units)}</span>
              </p>
            </div>
          </div>
        </section>

        <section>
          <p className="mb-1.5 text-sm font-semibold text-muted-foreground">Productos</p>
          {lines.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-center text-sm text-muted-foreground">
              Añade productos al pedido.
            </div>
          ) : (
            <ul className="space-y-2">
              {lines.map((l, idx) => (
                <li key={l.product_id} className="rounded-2xl bg-card p-3 shadow-card">
                  <div className="flex gap-3">
                    <ProductPhoto
                      src={l.photo?.startsWith('http') ? l.photo : signedPhotos[l.product_id]}
                      alt={l.description}
                      className="size-12 shrink-0 rounded-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {l.product_code}
                      </p>
                      <p className="truncate text-sm font-medium">{l.description}</p>
                    </div>
                    <button
                      onClick={() => removeLine(idx)}
                      aria-label="Quitar"
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2">
                    <div>
                      <p className="mb-1 text-[11px] text-muted-foreground">Uds</p>
                      <QtyStepper value={l.quantity} onChange={(v) => updateLine(idx, { quantity: v })} />
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] text-muted-foreground">Precio</p>
                      <input
                        inputMode="decimal"
                        defaultValue={String(l.unit_price)}
                        onBlur={(e) => updateLine(idx, { unit_price: parseNumberInput(e.target.value) })}
                        className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-sm tabular outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] text-muted-foreground">Dto %</p>
                      <input
                        inputMode="decimal"
                        defaultValue={String(l.discount_pct)}
                        onBlur={(e) =>
                          updateLine(idx, {
                            discount_pct: Math.min(100, Math.max(0, parseNumberInput(e.target.value))),
                          })
                        }
                        className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-sm tabular outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-right font-display text-sm font-bold tabular">
                    {formatMoney(lineTotal(l))}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="outline"
            size="lg"
            className="mt-2 w-full"
            onClick={() => setProductPicker(true)}
            disabled={(products?.length ?? 0) === 0}
          >
            <Plus className="size-4" /> {lines.length === 0 ? 'Añadir productos' : 'Añadir más'}
          </Button>
        </section>

        <section>
          <Field label="Observaciones">
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas internas para este pedido…"
            />
          </Field>
        </section>

        <div className="rounded-2xl bg-card p-4 shadow-card">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Importe bruto</span>
            <span className="tabular">{formatMoney(totals.subtotal)}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm text-muted-foreground">
            <span>Descuentos</span>
            <span className="tabular">−{formatMoney(totals.discount)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold">
            <span>Total</span>
            <span className="font-display tabular">{formatMoney(totals.total)}</span>
          </div>
        </div>

        {error && <p className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">{error}</p>}

        <Button variant="primary" size="xl" className="w-full" loading={busy} onClick={save}>
          <Check className="size-5" /> Guardar pedido
        </Button>
      </div>

      {/* Client picker */}
      <Sheet open={clientPicker} onClose={() => setClientPicker(false)} title="Seleccionar cliente">
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Buscar cliente…"
              className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <ul className="space-y-1.5">
            {filteredClients.map((c: Client) => (
              <li key={c.id}>
                <button
                  onClick={() => {
                    setClientId(c.id);
                    setClientPicker(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl bg-secondary px-3.5 py-3 text-left"
                >
                  <span>
                    <span className="block text-sm font-semibold">{c.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[c.code && `#${c.code}`, c.city].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </span>
                  {c.id === clientId && <Check className="size-5 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>

      <Sheet open={productPicker} onClose={() => setProductPicker(false)} title="Añadir productos">
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-1 rounded-2xl bg-secondary p-1">
            {([
              ['todos', 'Todos'], ['familias', 'Familias'], ['comprados', 'Comprados'], ['ultimo', 'Último'], ['repetir', 'Repetir'],
            ] as [ProductTab, string][]).map(([value, label]) => <button key={value} onClick={() => setProductTab(value)} className={`min-w-0 rounded-xl px-1 py-2 text-[10px] font-semibold ${productTab === value ? 'bg-card text-primary shadow-card' : 'text-muted-foreground'}`}>{label}</button>)}
          </div>
          {productTab === 'familias' && <select value={family} onChange={(event) => setFamily(event.target.value)} className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm"><option value="Todas">Todas las familias</option>{families.filter((item) => item !== 'Todas').map((item) => <option key={item} value={item}>{item}</option>)}</select>}
          {productTab !== 'repetir' && <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Buscar código, EAN o descripción…" className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary" /></div>}
          {productTab === 'repetir' ? <ul className="space-y-2">{(previousOrders ?? []).map((order) => <li key={order.id}><button onClick={() => repeatOrder(order)} className="flex w-full items-center justify-between rounded-xl bg-secondary px-3.5 py-3 text-left"><span><span className="block text-sm font-semibold">Pedido nº {order.order_number}</span><span className="block text-xs text-muted-foreground">{order.order_date} · {order.order_items.length} artículos</span></span><Repeat2 className="size-5 text-primary" /></button></li>)}{(previousOrders ?? []).length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Este cliente aún no tiene pedidos.</p>}</ul> : <ul className="space-y-1.5">{filteredProducts.map((p) => { const inOrder = lines.find((l) => l.product_id === p.id); return <li key={p.id}><button onClick={() => addProduct(p)} className="flex w-full items-center gap-3 rounded-xl bg-secondary px-3.5 py-3 text-left"><ProductPhoto src={p.photo_url?.startsWith('http') ? p.photo_url : signedPhotos[p.id]} alt={p.description} className="size-11 shrink-0 rounded-lg" /><span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{p.code} · {p.spar_ref || 'Sin ref.'}</span><span className="block truncate text-sm font-medium">{p.description}</span><span className="block text-xs text-muted-foreground">{p.category || 'Sin familia'}</span></span><span className="shrink-0 text-right"><span className="block font-display text-sm font-bold tabular">{formatMoney(p.price)}</span>{Number(p.discount_pct) > 0 && <span className="block text-[10px] font-semibold text-accent-foreground">−{formatNumber(p.discount_pct)}%</span>}</span><span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Plus className="size-4" /></span>{inOrder && <Check className="size-5 shrink-0 text-primary" />}</button></li>; })}{filteredProducts.length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No hay productos en esta selección.</p>}</ul>}
          <Button size="lg" className="w-full" onClick={() => setProductPicker(false)}>Hecho</Button>
        </div>
      </Sheet>
    </div>
  );
}

function QtyStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        aria-label="Restar"
        className="grid size-8 place-items-center rounded-lg bg-secondary"
      >
        <Minus className="size-4" />
      </button>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(',', '.'));
          if (!Number.isNaN(n)) onChange(Math.max(0, n));
        }}
        className="w-full rounded-lg border border-border bg-card px-2 py-2 text-center text-sm tabular outline-none focus:border-primary"
      />
      <button
        onClick={() => onChange(value + 1)}
        aria-label="Sumar"
        className="grid size-8 place-items-center rounded-lg bg-secondary"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
