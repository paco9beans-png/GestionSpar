import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MapPin, Phone, Users } from 'lucide-react';
import { useClients } from '@/lib/queries';
import { PageHeader } from '@/components/ui/layout';
import { SearchInput } from '@/components/ui/search-input';
import { ClientForm } from './client-form';

export default function Clientes() {
  const { data: clients, isLoading } = useClients();
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const list = clients ?? [];
    if (!q.trim()) return list;
    const t = q.toLowerCase();
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(t) ||
        (c.code ?? '').toLowerCase().includes(t) ||
        (c.city ?? '').toLowerCase().includes(t),
    );
  }, [clients, q]);

  return (
    <div className="min-h-dvh bg-background pb-28">
      <PageHeader
        title="Clientes"
        subtitle={clients ? `${clients.length} en total` : undefined}
        action={<Link to="/importar" aria-label="Importar" className="grid size-10 place-items-center rounded-full bg-secondary"><Users className="size-5" /></Link>}
      />
      <div className="mx-auto max-w-md px-4 pt-4">
        {clients && clients.length > 0 && (
          <div className="mb-3">
            <SearchInput value={q} onChange={setQ} placeholder="Buscar cliente…" />
          </div>
        )}
        {isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
              <Users className="size-7" />
            </div>
            <p className="mt-4 font-display text-lg font-bold">
              {(clients?.length ?? 0) === 0 ? 'Sin clientes todavía' : 'Sin resultados'}
            </p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {(clients?.length ?? 0) === 0
                ? 'Añade tu primer cliente o impórtalos desde un archivo Excel o CSV.'
                : 'Prueba con otro término de búsqueda.'}
            </p>
            {(clients?.length ?? 0) === 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link
                  to="/importar?tipo=clientes"
                  className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold"
                >
                  Importar
                </Link>
              </div>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/clientes/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-card p-3.5 shadow-card transition-transform active:scale-[0.99]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {c.code && <span>#{c.code}</span>}
                      {c.city && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="size-3" /> {c.city}
                        </span>
                      )}
                      {c.phone && (
                        <span className="flex items-center gap-0.5">
                          <Phone className="size-3" /> {c.phone}
                        </span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ClientForm />
    </div>
  );
}
