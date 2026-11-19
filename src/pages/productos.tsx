import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileImage, Filter, Package, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useProducts, signProductPhotoUrl } from '@/lib/queries';
import type { Product } from '@/lib/types';
import { formatMoney, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/ui/layout';
import { ProductPhoto } from '@/components/product-photo';
import { ProductForm } from './product-form';

export default function Productos() {
  const { data: products, isLoading } = useProducts();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('Todas');
  const [onlyActive, setOnlyActive] = useState(true);
  const [editing, setEditing] = useState<Product | undefined>();
  const [signed, setSigned] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!products) return;
    let alive = true;
    Promise.all(
      products
        .filter((p) => p.photo_url && !p.photo_url.startsWith('http'))
        .map(async (p) => [p.id, await signProductPhotoUrl(p.photo_url)] as const),
    ).then((pairs) => {
      if (alive) setSigned(Object.fromEntries(pairs.filter(([, url]) => url) as [string, string][]));
    });
    return () => { alive = false; };
  }, [products]);

  const categories = useMemo(
    () => ['Todas', ...Array.from(new Set((products ?? []).map((p) => p.category).filter(Boolean))) as string[]],
    [products],
  );
  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return (products ?? []).filter((p) => {
      const matchesText = !text || [p.code, p.barcode_ean, p.spar_ref, p.spar_code, p.description]
        .filter(Boolean).some((value) => value!.toLowerCase().includes(text));
      return matchesText && (!onlyActive || p.active) && (category === 'Todas' || p.category === category);
    });
  }, [products, q, onlyActive, category]);

  return (
    <div className="min-h-dvh bg-background pb-28">
      <PageHeader
        title="Catálogo"
        subtitle={products ? `${filtered.length} productos disponibles` : undefined}
        action={<div className="flex gap-2"><Link to="/fotos-productos" aria-label="Preparar fotografías" className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary"><FileImage className="size-5" /></Link><Link to="/importar?tipo=productos" aria-label="Importar productos" className="grid size-10 place-items-center rounded-full bg-secondary"><Package className="size-5" /></Link></div>}
      />
      <div className="mx-auto max-w-md px-4 pt-4">
        <div className="sticky top-[65px] z-20 -mx-4 space-y-3 border-b border-border/70 bg-background/95 px-4 pb-3 backdrop-blur">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar código, EAN, referencia o descripción" className="w-full rounded-2xl border border-border bg-card py-3 pl-10 pr-3 text-sm shadow-card outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground"><SlidersHorizontal className="size-3.5" /> Familia</span>
            {categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${category === item ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>{item}</button>)}
            <button onClick={() => setOnlyActive((value) => !value)} className={`ml-auto flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${onlyActive ? 'bg-primary-soft text-primary' : 'bg-secondary text-muted-foreground'}`}><Filter className="size-3.5" /> Activos</button>
          </div>
        </div>

        {isLoading ? <p className="py-16 text-center text-sm text-muted-foreground">Cargando catálogo…</p> : filtered.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center"><Package className="size-9 text-muted-foreground" /><p className="mt-3 font-display text-lg font-bold">No hay productos</p><p className="mt-1 text-sm text-muted-foreground">Prueba otra búsqueda o añade el primer producto.</p></div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {filtered.map((product) => <ProductCard key={product.id} product={product} photo={product.photo_url?.startsWith('http') ? product.photo_url : signed[product.id]} onClick={() => setEditing(product)} />)}
          </div>
        )}
      </div>
      <ProductForm key={editing?.id ?? 'closed'} editing={editing} open={!!editing} onClose={() => setEditing(undefined)} />
      {!editing && <ProductFormTrigger />}
    </div>
  );
}

function ProductCard({ product, photo, onClick }: { product: Product; photo?: string; onClick: () => void }) {
  const hasDiscount = Number(product.discount_pct) > 0 && Number(product.discount_pct) < 100;
  const regularPrice = hasDiscount ? Number(product.price) / (1 - Number(product.discount_pct) / 100) : 0;
  return <button onClick={onClick} className={`group overflow-hidden rounded-2xl bg-card text-left shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-float active:scale-[0.98] ${!product.active ? 'opacity-60' : ''}`}>
    <div className="relative aspect-square bg-secondary"><ProductPhoto src={photo} alt={product.description} className="size-full" />{hasDiscount && <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground">-{formatNumber(product.discount_pct)}%</span>}</div>
    <div className="space-y-1.5 p-3">
      <div className="flex flex-wrap gap-x-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground"><span>{product.code}</span>{product.barcode_ean && <span>· EAN {product.barcode_ean}</span>}</div>
      <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5">{product.description}</p>
      <div className="space-y-0.5 text-[10px] text-muted-foreground"><p>Ref. {product.spar_ref || '—'} · SPAR {product.spar_code || '—'}</p><p>{product.category || 'Sin familia'}</p></div>
      <div className="flex items-end justify-between gap-1 pt-1"><span><span className="block font-display text-base font-bold tabular">{formatMoney(product.price)}</span>{hasDiscount && <span className="block text-[10px] text-muted-foreground line-through">{formatMoney(regularPrice)}</span>}</span><span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground"><Plus className="size-4" /></span></div>
    </div>
  </button>;
}

function ProductFormTrigger() {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)} className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-float"><Plus className="size-5" /> Añadir producto</button>{open && <ProductForm open onClose={() => setOpen(false)} />}</>;
}
