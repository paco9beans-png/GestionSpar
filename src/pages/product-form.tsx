import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import type { Product } from '@/lib/types';
import { parseNumberInput } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { ProductPhoto } from '@/components/product-photo';

const UNITS = ['uds', 'kg', 'l', 'caja', 'pack', 'bote', 'bolsa'];

interface FormState {
  code: string;
  barcode_ean: string;
  spar_ref: string;
  spar_code: string;
  observations: string;
  description: string;
  category: string;
  unit: string;
  price: string;
  discount_pct: string;
  active: boolean;
}

function toForm(p?: Product): FormState {
  return {
    code: p?.code ?? '',
    barcode_ean: p?.barcode_ean ?? '',
    spar_ref: p?.spar_ref ?? '',
    spar_code: p?.spar_code ?? '',
    observations: p?.observations ?? '',
    description: p?.description ?? '',
    category: p?.category ?? '',
    unit: p?.unit ?? 'uds',
    price: p ? String(p.price) : '',
    discount_pct: p ? String(p.discount_pct) : '0',
    active: p?.active ?? true,
  };
}

export function ProductForm({
  editing,
  open: openProp,
  onClose,
}: {
  editing?: Product;
  open?: boolean;
  onClose?: () => void;
} = {}) {
  const session = useSession();
  const qc = useQueryClient();
  const [openSelf, setOpenSelf] = useState(!!editing || !!openProp);
  const open = openProp ?? openSelf;
  const setOpen = (v: boolean) => {
    setOpenSelf(v);
    if (!v) onClose?.();
  };
  const [form, setForm] = useState<FormState>(() => toForm(editing));
  const [photoPath, setPhotoPath] = useState<string | null>(editing?.photo_url ?? null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(toForm(editing));
    setPhotoPath(editing?.photo_url ?? null);
    setPhotoPreview(null);
  }, [editing]);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function pickPhoto(file: File) {
    // Downscale to a manageable JPEG before upload
    const img = new Image();
    const url = URL.createObjectURL(file);
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('No se pudo leer la imagen'));
      img.src = url;
    });
    URL.revokeObjectURL(url);
    const max = 800;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
    if (!blob) {
      setError('No se pudo procesar la imagen');
      return;
    }
    setPhotoPreview(canvas.toDataURL('image/jpeg', 0.82));
    const ext = 'jpg';
    const path = `${session!.user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('product-photos')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (upErr) {
      setError('No se pudo subir la foto');
      return;
    }
    setPhotoPath(path);
  }

  async function save() {
    if (!form.code.trim() || !form.description.trim()) {
      setError('Código y descripción son obligatorios');
      return;
    }
    const discount = Math.min(100, Math.max(0, parseNumberInput(form.discount_pct)));
    const payload = {
      code: form.code.trim(),
      barcode_ean: form.barcode_ean.trim() || null,
      spar_ref: form.spar_ref.trim() || null,
      spar_code: form.spar_code.trim() || null,
      observations: form.observations.trim() || null,
      description: form.description.trim(),
      category: form.category.trim() || null,
      unit: form.unit || null,
      price: parseNumberInput(form.price),
      discount_pct: discount,
      active: form.active,
      photo_url: photoPath,
    };
    setBusy(true);
    setError(null);
    let err;
    if (editing) {
      if (editing.photo_url && photoPath !== editing.photo_url) {
        await supabase.storage.from('product-photos').remove([editing.photo_url]);
      }
      ({ error: err } = await supabase.from('products').update(payload).eq('id', editing.id));
    } else {
      ({ error: err } = await supabase.from('products').insert(payload));
    }
    setBusy(false);
    if (err) {
      setError(
        err.code === '23505' ? 'Ya existe un producto con ese código.' : 'No se pudo guardar el producto.',
      );
      return;
    }
    await qc.invalidateQueries({ queryKey: ['products'] });
    setOpen(false);
    if (!editing) {
      setForm(toForm());
      setPhotoPath(null);
      setPhotoPreview(null);
    }
  }

  const categories = Array.from(
    new Set((qc.getQueryData<Product[]>(['products']) ?? []).map((p) => p.category).filter(Boolean)),
  ) as string[];

  return (
    <>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar producto' : 'Nuevo producto'}
      >
        <div className="space-y-4 pb-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <ProductPhoto
                src={photoPreview ?? photoPath}
                alt={form.description || 'Producto'}
                className="size-20 rounded-2xl"
              />
              {photoPath && !photoPreview && (
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.storage.from('product-photos').remove([photoPath]);
                    setPhotoPath(null);
                  }}
                  aria-label="Quitar foto"
                  className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-destructive text-destructive-foreground"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickPhoto(f);
                e.target.value = '';
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Camera className="size-4" /> Añadir foto
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Código">
              <Input value={form.code} onChange={set('code')} required />
            </Field>
            <Field label="Categoría">
              <Input value={form.category} onChange={set('category')} list="product-categories" />
              <datalist id="product-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
          </div>
          <Field label="Descripción">
            <Input value={form.description} onChange={set('description')} required />
          </Field>
          <Field label="Observaciones / nombre de fotografía">
            <Input value={form.observations} onChange={set('observations')} placeholder="Ej.: 200000819" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio (€)">
              <Input inputMode="decimal" value={form.price} onChange={set('price')} placeholder="0,00" />
            </Field>
            <Field label="Descuento %">
              <Input
                inputMode="decimal"
                value={form.discount_pct}
                onChange={set('discount_pct')}
                placeholder="0"
              />
            </Field>
          </div>
          <Field label="Formato / unidad">
            <Select value={form.unit} onChange={set('unit')}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código de barras EAN">
              <Input inputMode="numeric" value={form.barcode_ean} onChange={set('barcode_ean')} />
            </Field>
            <Field label="Referencia SPAR">
              <Input value={form.spar_ref} onChange={set('spar_ref')} />
            </Field>
          </div>
          <Field label="Código SPAR">
            <Input value={form.spar_code} onChange={set('spar_code')} />
          </Field>
          <label className="flex items-center justify-between rounded-xl bg-secondary px-3.5 py-3">
            <span className="text-sm font-semibold">Activo en catálogo</span>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="size-5 accent-[#1f8a4c]"
            />
          </label>
          {error && <p className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">{error}</p>}
          <Button size="lg" className="w-full" loading={busy} onClick={save}>
            Guardar
          </Button>
        </div>
      </Sheet>
    </>
  );
}
