import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Client } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';

const empty: Omit<Client, 'id' | 'user_id' | 'created_at'> = {
  code: null,
  name: '',
  tax_id: null,
  contact_name: null,
  phone: null,
  email: null,
  address: null,
  city: null,
  postal_code: null,
  notes: null,
};

export function ClientForm({
  editing,
  onClose,
}: {
  editing?: Client;
  onClose?: () => void;
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(!!editing);
  const [form, setForm] = useState(() =>
    editing
      ? {
          code: editing.code ?? '',
          name: editing.name,
          tax_id: editing.tax_id ?? '',
          contact_name: editing.contact_name ?? '',
          phone: editing.phone ?? '',
          email: editing.email ?? '',
          address: editing.address ?? '',
          city: editing.city ?? '',
          postal_code: editing.postal_code ?? '',
          notes: editing.notes ?? '',
        }
      : { ...empty, name: '' },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      ...form,
      name: form.name.trim(),
      code: form.code?.trim() || null,
      tax_id: form.tax_id?.trim() || null,
      contact_name: form.contact_name?.trim() || null,
      phone: form.phone?.trim() || null,
      email: form.email?.trim() || null,
      address: form.address?.trim() || null,
      city: form.city?.trim() || null,
      postal_code: form.postal_code?.trim() || null,
      notes: form.notes?.trim() || null,
    };
    const { error: err } = editing
      ? await supabase.from('clients').update(payload).eq('id', id)
      : await supabase.from('clients').insert(payload);
    setBusy(false);
    if (err) {
      setError('No se pudo guardar el cliente.');
      return;
    }
    await qc.invalidateQueries({ queryKey: ['clients'] });
    setOpen(false);
    if (!editing) navigate('/clientes', { replace: true });
    onClose?.();
  }

  const close = () => {
    setOpen(false);
    onClose?.();
  };

  return (
    <>
      {!editing && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-float"
        >
          Añadir cliente
        </button>
      )}
      <Sheet open={open} onClose={close} title={editing ? 'Editar cliente' : 'Nuevo cliente'}>
        <div className="space-y-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código">
              <Input value={form.code ?? ''} onChange={set('code')} placeholder="C-001" />
            </Field>
            <Field label="Nombre">
              <Input value={form.name} onChange={set('name')} required placeholder="Nombre comercial" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CIF / NIF">
              <Input value={form.tax_id ?? ''} onChange={set('tax_id')} />
            </Field>
            <Field label="Teléfono">
              <Input type="tel" inputMode="tel" value={form.phone ?? ''} onChange={set('phone')} />
            </Field>
          </div>
          <Field label="Persona de contacto">
            <Input value={form.contact_name ?? ''} onChange={set('contact_name')} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email ?? ''} onChange={set('email')} />
          </Field>
          <Field label="Dirección">
            <Input value={form.address ?? ''} onChange={set('address')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Localidad">
              <Input value={form.city ?? ''} onChange={set('city')} />
            </Field>
            <Field label="Código postal">
              <Input inputMode="numeric" value={form.postal_code ?? ''} onChange={set('postal_code')} />
            </Field>
          </div>
          <Field label="Notas">
            <Textarea rows={3} value={form.notes ?? ''} onChange={set('notes')} />
          </Field>
          {error && <p className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">{error}</p>}
          <Button size="lg" className="w-full" loading={busy} onClick={save}>
            Guardar
          </Button>
        </div>
      </Sheet>
    </>
  );
}
