import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { useStats } from '@/lib/queries';
import { formatMoney, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/ui/layout';

type Period = 'mes' | 'trimestre' | 'año' | '12m';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'mes', label: 'Este mes' },
  { value: 'trimestre', label: '3 meses' },
  { value: 'año', label: 'Este año' },
  { value: '12m', label: '12 meses' },
];

function periodFrom(p: Period): string {
  const now = new Date();
  const d = new Date(now);
  if (p === 'mes') d.setDate(1);
  else if (p === 'trimestre') d.setMonth(d.getMonth() - 3);
  else if (p === '12m') d.setFullYear(d.getFullYear() - 1);
  if (p === 'año') {
    d.setMonth(0);
    d.setDate(1);
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Estadisticas() {
  const [period, setPeriod] = useState<Period>('mes');
  const from = periodFrom(period);
  const { data, isLoading } = useStats(from);

  const stats = useMemo(() => {
    if (!data) return null;
    const orders = data.orders as unknown as Array<{
      id: string;
      client_id: string | null;
      total: number | string;
      order_date: string;
      clients: { name: string } | null;
    }>;
    const items = data.items as unknown as Array<{
      product_id: string | null;
      product_code: string | null;
      description: string | null;
      quantity: number | string;
      line_total: number | string;
    }>;
    const total = orders.reduce((s, o) => s + Number(o.total), 0);
    const count = orders.length;
    const clients = new Set(orders.map((o) => o.client_id)).size;

    const byClient = new Map<string, { name: string; total: number; n: number }>();
    for (const o of orders) {
      const key = o.client_id ?? o.id;
      const existing = byClient.get(key) ?? { name: o.clients?.name ?? '—', total: 0, n: 0 };
      existing.total += Number(o.total);
      existing.n += 1;
      byClient.set(key, existing);
    }

    const byProduct = new Map<string, { code: string; desc: string; qty: number; total: number }>();
    for (const i of items) {
      const key = (i.product_id ?? i.product_code) as string;
      const existing = byProduct.get(key) ?? {
        code: i.product_code ?? '—',
        desc: i.description ?? '—',
        qty: 0,
        total: 0,
      };
      existing.qty += Number(i.quantity);
      existing.total += Number(i.line_total);
      byProduct.set(key, existing);
    }

    // Chart buckets
    const isMonth = period === 'mes';
    const chartMap = new Map<string, number>();
    const start = new Date(`${from}T12:00:00`);
    const end = new Date();
    if (isMonth) {
      for (let day = 1; day <= end.getDate(); day++) chartMap.set(String(day).padStart(2, '0'), 0);
    } else {
      const cur = new Date(start);
      while (cur <= end) {
        const k = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
        chartMap.set(k, 0);
        cur.setMonth(cur.getMonth() + 1);
      }
    }
    for (const o of orders) {
      const key = isMonth ? o.order_date.slice(8, 10) : o.order_date.slice(0, 7);
      if (chartMap.has(key)) chartMap.set(key, (chartMap.get(key) ?? 0) + Number(o.total));
    }
    const chart = [...chartMap.entries()].map(([k, v]) => ({
      label: isMonth ? String(Number(k)) : new Date(`${k}-01T12:00:00`).toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''),
      total: Math.round(v * 100) / 100,
    }));

    return {
      total,
      count,
      clients,
      avg: count ? total / count : 0,
      topClients: [...byClient.values()].sort((a, b) => b.total - a.total).slice(0, 5),
      topProducts: [...byProduct.values()].sort((a, b) => b.total - a.total).slice(0, 8),
      chart,
    };
  }, [data, period, from]);

  return (
    <div className="min-h-dvh bg-background pb-28">
      <PageHeader title="Estadísticas" subtitle="Ventas sin pedidos cancelados" />
      <div className="mx-auto max-w-md px-4 pt-4">
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-secondary p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-xl py-2 text-xs font-semibold transition-colors ${
                period === p.value ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {isLoading || !stats ? (
          <p className="py-20 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : stats.count === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
              <BarChart3 className="size-7" />
            </div>
            <p className="mt-4 font-display text-lg font-bold">Sin ventas en este periodo</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Cuando guardes pedidos verás aquí la evolución de tus ventas.
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            <div className="rounded-3xl bg-hero p-5 text-primary-foreground shadow-float">
              <p className="text-sm text-primary-foreground/80">Total vendido</p>
              <p className="mt-1 font-display text-4xl font-extrabold tabular">{formatMoney(stats.total)}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-primary-foreground/20 pt-3 text-center">
                {[
                  { label: 'Pedidos', value: String(stats.count) },
                  { label: 'Ticket medio', value: formatMoney(stats.avg) },
                  { label: 'Clientes', value: String(stats.clients) },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="font-display text-base font-bold tabular">{s.value}</p>
                    <p className="text-[11px] text-primary-foreground/75">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <section className="rounded-3xl bg-card p-4 shadow-card">
              <h2 className="mb-3 font-semibold">Evolución</h2>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.chart} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                      interval="preserveStartEnd"
                      stroke="var(--muted-foreground)"
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--secondary)' }}
                      formatter={(v) => [formatMoney(Number(v)), 'Ventas']}
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        background: 'var(--card)',
                      }}
                    />
                    <Bar dataKey="total" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-3xl bg-card p-4 shadow-card">
              <h2 className="mb-3 font-semibold">Mejores clientes</h2>
              <Ranking
                items={stats.topClients.map((c) => ({
                  title: c.name,
                  sub: `${c.n} pedidos`,
                  value: c.total,
                }))}
              />
            </section>

            <section className="rounded-3xl bg-card p-4 shadow-card">
              <h2 className="mb-3 font-semibold">Productos más vendidos</h2>
              <Ranking
                accent
                items={stats.topProducts.map((p) => ({
                  title: p.desc,
                  sub: `${p.code} · ${formatNumber(p.qty)} uds`,
                  value: p.total,
                }))}
              />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Ranking({
  items,
  accent,
}: {
  items: { title: string; sub: string; value: number }[];
  accent?: boolean;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-medium">
              <span className="mr-2 text-muted-foreground">{i + 1}.</span>
              {item.title}
            </p>
            <p className="shrink-0 font-display text-sm font-bold tabular">{formatMoney(item.value)}</p>
          </div>
          <p className="text-xs text-muted-foreground">{item.sub}</p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full ${accent ? 'bg-accent' : 'bg-primary'}`}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
