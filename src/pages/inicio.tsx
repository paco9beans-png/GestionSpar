import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  Package,
  Users,
  LogOut,
} from 'lucide-react';
import { useClients, useOrders, useProducts, signProductPhotoUrl } from '@/lib/queries';
import { formatDate, formatMoney, greeting } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { ProductPhoto } from '@/components/product-photo';
import { StatusBadge } from '@/components/status-badge';

export default function Inicio() {
  const session = useSession();
  const { data: clients } = useClients();
  const { data: products } = useProducts();
  const { data: orders } = useOrders();

  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = new Date().toISOString().slice(0, 7);
  const todayOrders = (orders ?? []).filter((o) => o.order_date.startsWith(today));
  const monthOrders = (orders ?? []).filter((o) => o.order_date.startsWith(monthPrefix));
  const pending = monthOrders.filter((o) => o.status === 'pendiente');
  const monthTotal = monthOrders
    .filter((o) => o.status !== 'cancelado')
    .reduce((s, o) => s + Number(o.total), 0);
  const recent = (orders ?? []).slice(0, 4);

  const shortcuts = [
    { to: '/clientes', icon: Users, label: 'Clientes', count: clients?.length ?? 0 },
    { to: '/productos', icon: Package, label: 'Productos', count: products?.length ?? 0 },
    { to: '/pedidos', icon: ClipboardList, label: 'Pedidos', count: orders?.length ?? 0 },
  ];

  return (
    <div className="min-h-dvh bg-background pb-28">
      <div className="bg-hero px-4 pb-20 pt-5 text-primary-foreground">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-card font-display text-xl font-extrabold text-primary shadow-none">
                S
              </div>
              <div className="leading-tight">
                <p className="text-xs text-primary-foreground/80">{greeting()}</p>
                <p className="font-display text-lg font-bold">
                  {session?.user.email?.split('@')[0]}
                </p>
              </div>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              aria-label="Cerrar sesión"
              className="grid size-10 place-items-center rounded-full bg-primary-foreground/15"
            >
              <LogOut className="size-5" />
            </button>
          </div>
          <p className="mt-5 text-xs uppercase tracking-wide text-primary-foreground/75">
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <p className="font-display text-3xl font-extrabold tabular">{formatMoney(monthTotal)}</p>
          <p className="text-xs text-primary-foreground/80">ventas de este mes</p>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-primary-foreground/10 p-3 text-center">
            {[
              { label: 'Hoy', value: formatMoney(todayOrders.reduce((s, o) => s + Number(o.total), 0)) },
              { label: 'Pedidos mes', value: String(monthOrders.length) },
              { label: 'Pendientes', value: String(pending.length) },
            ].map((s) => (
              <div key={s.label}>
                <p className="font-display text-base font-bold tabular">{s.value}</p>
                <p className="text-[11px] text-primary-foreground/75">{s.label}</p>
              </div>
            ))}
          </div>
          <Link
            to="/pedidos/nuevo"
            className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-card py-3.5 font-display text-base font-bold text-primary shadow-float transition-transform active:scale-[0.98]"
          >
            Nuevo pedido <ArrowRight className="size-5" />
          </Link>
        </div>
      </div>

      <div className="mx-auto -mt-12 max-w-md space-y-5 px-4">
        <div className="grid grid-cols-3 gap-3">
          {shortcuts.map(({ to, icon: Icon, label, count }) => (
            <Link
              key={to}
              to={to}
              className="rounded-2xl bg-card p-3.5 shadow-card transition-transform active:scale-[0.98]"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
                <Icon className="size-5" />
              </span>
              <p className="mt-2 text-xs font-medium text-muted-foreground">{label}</p>
              <p className="font-display text-lg font-bold tabular">{count}</p>
            </Link>
          ))}
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Últimos pedidos</h2>
            {(orders?.length ?? 0) > 0 && (
              <Link to="/pedidos" className="flex items-center gap-1 text-sm font-semibold text-primary">
                Ver todos <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
          {recent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-center text-sm text-muted-foreground">
              Aquí aparecerán tus pedidos más recientes.
            </div>
          ) : (
            <ul className="space-y-2">
              {recent.map((o) => (
                <li key={o.id}>
                  <Link
                    to={`/pedidos/${o.id}`}
                    className="flex items-center justify-between rounded-2xl bg-card p-3.5 shadow-card transition-transform active:scale-[0.99]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{o.clients?.name ?? 'Cliente'}</p>
                      <p className="text-xs text-muted-foreground">
                        nº {o.order_number} · {formatDate(o.order_date)}
                      </p>
                    </div>
                    <div className="ml-3 text-right">
                      <p className="font-display text-lg font-bold tabular">{formatMoney(o.total)}</p>
                      <StatusBadge status={o.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
