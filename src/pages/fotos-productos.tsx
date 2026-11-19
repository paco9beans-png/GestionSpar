import { useMemo, useRef, useState, type InputHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, FileImage, FolderOpen, Upload } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useProducts } from '@/lib/queries';
import { useSession } from '@/lib/session';
import type { Product } from '@/lib/types';

interface PhotoMatch {
  file: File;
  product: Product | null;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]/g, '');
}

function matchProduct(file: File, products: Product[]): Product | null {
  const stem = normalize(file.name);
  if (!stem) return null;
  return products.find((product) => {
    const observation = normalize(product.observations ?? '');
    return observation.includes(stem);
  }) ?? null;
}

export default function FotosProductos() {
  const session = useSession();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: products, isLoading } = useProducts();
  const [matches, setMatches] = useState<PhotoMatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const missingProducts = useMemo(() => (products ?? []).filter((product) => !product.photo_url), [products]);
  const matched = matches.filter((item) => item.product);
  const unmatched = matches.filter((item) => !item.product);

  function selectFiles(files: FileList | null) {
    if (!files || !products) return;
    const valid = Array.from(files).filter((file) => /image\/(jpeg|jpg)/i.test(file.type) || /\.jpe?g$/i.test(file.name));
    setMatches(valid.map((file) => ({ file, product: matchProduct(file, products) })));
    setMessage(valid.length === 0 ? 'No se encontraron archivos JPG válidos.' : null);
  }

  async function savePhotos() {
    if (!session || matched.length === 0) return;
    setBusy(true);
    setMessage(null);
    let saved = 0;
    for (const item of matched) {
      const product = item.product!;
      const path = `${session.user.id}/${normalize(item.file.name)}.jpg`;
      const { error: uploadError } = await supabase.storage.from('product-photos').upload(path, item.file, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) continue;
      const { error: updateError } = await supabase.from('products').update({ photo_url: path }).eq('id', product.id);
      if (!updateError) saved += 1;
    }
    await qc.invalidateQueries({ queryKey: ['products'] });
    setBusy(false);
    setMessage(`${saved} fotografía${saved === 1 ? '' : 's'} asociada${saved === 1 ? '' : 's'} correctamente.`);
    setMatches([]);
  }

  return <div className="min-h-dvh bg-background pb-28">
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur">
      <Link to="/productos" aria-label="Volver" className="grid size-10 place-items-center rounded-full bg-secondary"><ArrowLeft className="size-5" /></Link>
      <div><h1 className="font-display text-xl font-bold">Fotos de productos</h1><p className="text-xs text-muted-foreground">Preparación de asociación automática</p></div>
    </header>
    <div className="mx-auto max-w-md space-y-4 px-4 pt-4">
      <div className="rounded-2xl border border-primary/20 bg-primary-soft p-4 text-sm text-primary"><p className="font-semibold">No se sube nada al seleccionar archivos</p><p className="mt-1 text-xs leading-5">Primero revisa las coincidencias. Las fotografías solo se guardarán cuando pulses el botón de confirmación.</p></div>
      <section className="rounded-2xl bg-card p-4 shadow-card">
        <div className="flex items-start gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><FileImage className="size-5" /></div><div><h2 className="font-semibold">Seleccionar JPG</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Admite selección múltiple o una carpeta completa del pendrive.</p></div></div>
        <input ref={fileRef} type="file" accept="image/jpeg,.jpg,.jpeg" multiple className="hidden" onChange={(event) => { selectFiles(event.target.files); event.target.value = ''; }} />
        <input id="photo-folder" type="file" accept="image/jpeg,.jpg,.jpeg" multiple className="hidden" {...({ webkitdirectory: '', directory: '' } as InputHTMLAttributes<HTMLInputElement>)} onChange={(event) => { selectFiles(event.target.files); event.target.value = ''; }} />
        <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => fileRef.current?.click()} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"><Upload className="size-4" /> Varios archivos</button><button onClick={() => document.getElementById('photo-folder')?.click()} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-secondary text-sm font-semibold"><FolderOpen className="size-4" /> Elegir carpeta</button></div>
      </section>

      {isLoading ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando productos…</p> : <>
        <section className="grid grid-cols-3 gap-2"><Metric label="Productos" value={products?.length ?? 0} /><Metric label="Sin foto" value={missingProducts.length} tone="warning" /><Metric label="Coincidencias" value={matched.length} tone="success" /></section>
        {matches.length > 0 && <section className="space-y-2"><h2 className="text-sm font-semibold">Revisión de coincidencias</h2><div className="space-y-2">{matches.map((item) => <div key={`${item.file.name}-${item.file.lastModified}`} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card"><div className={`grid size-9 shrink-0 place-items-center rounded-xl ${item.product ? 'bg-primary-soft text-primary' : 'bg-accent/15 text-accent-foreground'}`}>{item.product ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.file.name}</p><p className="truncate text-xs text-muted-foreground">{item.product ? `${item.product.code} · ${item.product.description}` : 'Sin producto coincidente'}</p></div></div>)}</div><button disabled={busy || matched.length === 0} onClick={() => void savePhotos()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? 'Guardando fotografías…' : `Guardar ${matched.length} coincidencia${matched.length === 1 ? '' : 's'}`}</button></section>}
        {unmatched.length > 0 && <p className="rounded-xl bg-accent/10 px-3.5 py-2.5 text-xs text-accent-foreground">{unmatched.length} archivo{unmatched.length === 1 ? '' : 's'} no coincide{unmatched.length === 1 ? '' : 'n'} con ninguna OBSERVACIÓN.</p>}
        <section className="rounded-2xl bg-card p-4 shadow-card"><h2 className="font-semibold">Informe de productos sin fotografía</h2><p className="mt-1 text-xs text-muted-foreground">Se calcula con los productos actuales y se actualiza después de cada asociación.</p>{missingProducts.length === 0 ? <p className="mt-3 flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="size-4" /> Todos los productos tienen fotografía.</p> : <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">{missingProducts.map((product) => <li key={product.id} className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-0"><span className="min-w-0"><span className="block font-semibold">{product.code}</span><span className="block truncate text-xs text-muted-foreground">{product.description}</span></span><span className="shrink-0 text-[10px] text-muted-foreground">{product.observations ? `OBS: ${product.observations}` : 'Sin OBSERVACIONES'}</span></li>)}</ul>}</section>
      </>}
      {message && <p className="rounded-xl bg-primary-soft px-3.5 py-2.5 text-sm text-primary">{message}</p>}
    </div>
  </div>;
}

function Metric({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'warning' | 'success' }) {
  return <div className="rounded-2xl bg-card p-3 text-center shadow-card"><p className={`font-display text-xl font-bold ${tone === 'warning' ? 'text-accent-foreground' : tone === 'success' ? 'text-primary' : ''}`}>{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>;
}
