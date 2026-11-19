import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { ArrowDown, Check, FileUp, Filter, Minus, Plus, Search, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useClientRoadmaps } from '@/lib/queries';
import type { Client, ClientRoadmapItem, PrefilledLine, Product } from '@/lib/types';
import { formatDate, formatMoney, formatNumber, normalizeKey, parseNumberInput } from '@/lib/format';
import { PageHeader } from '@/components/ui/layout';

interface DraftItem {
  id?: string;
  ean: string | null;
  reference: string | null;
  description: string;
  price: number;
  tariff: string | null;
  units_sold: number;
  last_purchase_date: string | null;
  product_id: string | null;
  quantity_to_order?: number;
  selected?: boolean;
}

const HEADERS = {
  ean: ['ean', 'codigo ean', 'codbarra', 'cod barra', 'codigo barras', 'barcode'],
  reference: ['referencia', 'ref', 'rf', 'codigo producto', 'codigo'],
  description: ['descripcion', 'description', 'producto', 'articulo', 'denominacion'],
  price: ['precio', 'price', 'tarifa', 'pvp'],
  tariff: ['tarifa', 'tipo tarifa'],
  units_sold: ['unidades vendidas', 'und vendidas', 'vendidas', 'unidades'],
  last_purchase_date: ['fecha ultimo', 'fecha última', 'ultima compra', 'fecha compra', 'fecha'],
};

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function findHeader(headers: string[], names: string[]): string | null {
  const normalized = headers.map(normalizeKey);
  for (const name of names) {
    const key = normalizeKey(name);
    const index = normalized.findIndex((h) => h === key || h.includes(key));
    if (index >= 0) return headers[index];
  }
  return null;
}

function parseDate(value: string): string | null {
  const match = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!match) return null;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

function numberValue(value: string): number {
  return parseNumberInput(value.replace(/[^\d,.-]/g, '')) || 0;
}

function dedupeItems(items: DraftItem[]): DraftItem[] {
  const map = new Map<string, DraftItem>();
  for (const item of items) {
    const key = normalizeKey(item.ean || item.reference || item.description);
    if (!key) continue;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

function mapRows(rows: unknown[][]): DraftItem[] {
  const headers = (rows[0] ?? []).map(clean);
  const columns = {
    ean: findHeader(headers, HEADERS.ean),
    reference: findHeader(headers, HEADERS.reference),
    description: findHeader(headers, HEADERS.description),
    price: findHeader(headers, HEADERS.price),
    tariff: findHeader(headers, HEADERS.tariff),
    units_sold: findHeader(headers, HEADERS.units_sold),
    last_purchase_date: findHeader(headers, HEADERS.last_purchase_date),
  };
  return dedupeItems(
    rows.slice(1).map((row) => {
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => { record[header] = row[index]; });
      return {
        ean: columns.ean ? clean(record[columns.ean]) || null : null,
        reference: columns.reference ? clean(record[columns.reference]) || null : null,
        description: columns.description ? clean(record[columns.description]) : '',
        price: columns.price ? numberValue(clean(record[columns.price])) : 0,
        tariff: columns.tariff ? clean(record[columns.tariff]) || null : null,
        units_sold: columns.units_sold ? numberValue(clean(record[columns.units_sold])) : 0,
        last_purchase_date: columns.last_purchase_date ? parseDate(clean(record[columns.last_purchase_date])) : null,
        product_id: null,
      };
    }).filter((item) => item.description || item.ean || item.reference),
  );
}

async function parsePdf(file: File): Promise<DraftItem[]> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const items: DraftItem[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const positioned = content.items
      .filter((item): item is typeof item & { str: string; transform: number[] } => 'str' in item && 'transform' in item)
      .map((item) => ({ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }))
      .filter((item) => item.text);
    const lines: { y: number; cells: typeof positioned }[] = [];
    for (const cell of positioned.sort((a, b) => b.y - a.y || a.x - b.x)) {
      const line = lines.find((candidate) => Math.abs(candidate.y - cell.y) < 3);
      if (line) line.cells.push(cell);
      else lines.push({ y: cell.y, cells: [cell] });
    }
    for (const line of lines) {
      const cells = line.cells.sort((a, b) => a.x - b.x);
      const date = cells.find((cell) => /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(cell.text));
      const ean = cells.find((cell) => /^\d{7,14}$/.test(cell.text.replace(/\s/g, '')));
      const numeric = cells.filter((cell) => /^-?\d+(?:[,.]\d+)?$/.test(cell.text));
      const description = cells.find((cell) => cell.x > 75 && cell.x < 220 && /[A-Za-zÁÉÍÓÚáéíóú]/.test(cell.text));
      const reference = cells.find((cell) => cell.x < 85 && /^\d+$/.test(cell.text));
      if (!description || !ean || !date || !reference) continue;
      const price = numeric.find((cell) => cell.x >= 300 && cell.x < 355);
      const tariff = numeric.find((cell) => cell.x >= 350 && cell.x < 390);
      const units = numeric.find((cell) => cell.x >= 390 && cell.x < 445);
      items.push({
        ean: ean.text.replace(/\s/g, ''),
        reference: reference.text,
        description: description.text,
        price: price ? numberValue(price.text) : 0,
        tariff: tariff?.text ?? null,
        units_sold: units ? numberValue(units.text) : 0,
        last_purchase_date: parseDate(date.text),
        product_id: null,
      });
    }
  }
  return dedupeItems(items);
}

async function parseFile(file: File): Promise<DraftItem[]> {
  if (/\.pdf$/i.test(file.name)) return parsePdf(file);
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return mapRows(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]);
}

function findMatchingProduct(item: DraftItem, products: Product[]): Product | null {
  const ean = normalizeKey(item.ean ?? '');
  const ref = normalizeKey(item.reference ?? '');
  return products.find((product) =>
    (ean && normalizeKey(product.barcode_ean ?? '') === ean) ||
    (ref && [product.spar_ref, product.spar_code, product.code].some((value) => normalizeKey(value ?? '') === ref)),
  ) ?? null;
}

export default function HojaRuta() {
  const { id: clientId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: client } = useQuery({
    queryKey: ['clients', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', clientId!).maybeSingle();
      if (error) throw error;
      return data as Client | null;
    },
  });
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      return data as Product[];
    },
  });
  const { data: roadmaps } = useClientRoadmaps(clientId);
  const [roadmapId, setRoadmapId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftItem[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [subclientCode, setSubclientCode] = useState('');
  const [subclientName, setSubclientName] = useState('');
  const [search, setSearch] = useState('');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = (roadmaps ?? []).find((roadmap) => roadmap.id === roadmapId) ?? roadmaps?.[0] ?? null;
  const items = useMemo(() => draft ?? current?.client_roadmap_items ?? [], [draft, current]);
  const filtered = useMemo(() => {
    const query = normalizeKey(search);
    return items.filter((item) => {
      const matchesSearch = !query || normalizeKey(item.description).includes(query) || normalizeKey(item.ean ?? '').includes(query) || normalizeKey(item.reference ?? '').includes(query);
      const matchesPending = !pendingOnly || item.selected;
      return matchesSearch && matchesPending;
    });
  }, [items, pendingOnly, search]);

  async function loadFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const parsed = await parseFile(file);
      const matched = parsed.map((item) => {
        const product = findMatchingProduct(item, products ?? []);
        return product ? { ...item, product_id: product.id, price: Number(product.price) } : item;
      });
      setDraft(matched);
      setFileName(file.name);
    } catch {
      setError('No se pudo leer el documento. Comprueba que sea un PDF, Excel o CSV válido.');
    } finally {
      setBusy(false);
    }
  }

  async function saveRoadmap() {
    if (!clientId || !draft?.length) return;
    setBusy(true);
    setError(null);
    const { data: roadmap, error: roadmapError } = await supabase.from('client_roadmaps').insert({
      client_id: clientId,
      source_name: fileName || null,
      subclient_code: subclientCode.trim() || null,
      subclient_name: subclientName.trim() || null,
    }).select('id').single();
    if (roadmapError || !roadmap) {
      setError('No se pudo guardar la hoja de ruta.');
      setBusy(false);
      return;
    }
    const { error: itemError } = await supabase.from('client_roadmap_items').insert(
      draft.map((item) => ({ ...item, roadmap_id: roadmap.id, quantity_to_order: 0, selected: false })),
    );
    if (itemError) {
      setError('No se pudieron guardar los artículos de la hoja de ruta.');
      setBusy(false);
      return;
    }
    await qc.invalidateQueries({ queryKey: ['roadmaps', clientId] });
    setRoadmapId(roadmap.id);
    setDraft(null);
    setBusy(false);
  }

  async function updateItem(item: ClientRoadmapItem, patch: Partial<ClientRoadmapItem>) {
    await supabase.from('client_roadmap_items').update(patch).eq('id', item.id);
    await qc.invalidateQueries({ queryKey: ['roadmaps', clientId] });
  }

  function selectedLines(): PrefilledLine[] {
    return items.filter((item) => item.selected && Number(item.quantity_to_order ?? 0) > 0).map((item) => ({
      product_id: item.product_id ?? '',
      product_code: item.reference ?? item.ean ?? '',
      description: item.description,
      unit: null,
      photo: null,
      unit_price: item.price,
      discount_pct: 0,
      quantity: item.quantity_to_order ?? 0,
    }));
  }

  function createOrder() {
    const lines = selectedLines();
    if (lines.length === 0) {
      setError('Marca artículos e introduce una cantidad mayor que cero.');
      return;
    }
    navigate(`/pedidos/nuevo?cliente=${clientId}`, { state: { lines } });
  }

  if (!client) return <div className="min-h-dvh bg-background"><PageHeader title="Hoja de ruta" backTo={`/clientes/${clientId}`} /><p className="p-8 text-center text-sm text-muted-foreground">Cliente no encontrado.</p></div>;

  return (
    <div className="min-h-dvh bg-background pb-28">
      <PageHeader title="Hoja de ruta" subtitle={client.name} backTo={`/clientes/${client.id}`} />
      <div className="mx-auto max-w-md space-y-4 px-4 pt-4">
        <section className="rounded-2xl bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Documentos del cliente</h2>
              <p className="text-xs text-muted-foreground">Guarda varias hojas y trabaja con la más reciente.</p>
            </div>
            <button onClick={() => fileRef.current?.click()} className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary" aria-label="Importar hoja de ruta"><Upload className="size-5" /></button>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.txt,.tsv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file); event.target.value = ''; }} />
          {(roadmaps ?? []).length > 0 && (
            <select value={current?.id ?? ''} onChange={(event) => setRoadmapId(event.target.value)} className="mt-3 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm">
              {(roadmaps ?? []).map((roadmap) => <option key={roadmap.id} value={roadmap.id}>{roadmap.source_name || 'Hoja de ruta'} · {formatDate(roadmap.imported_at)}</option>)}
            </select>
          )}
        </section>

        {draft && (
          <section className="space-y-3 rounded-2xl bg-card p-4 shadow-card">
            <div><p className="font-semibold">Revisar importación</p><p className="text-xs text-muted-foreground">{fileName} · {draft.length} artículos únicos</p></div>
            <div className="grid grid-cols-2 gap-2">
              <input value={subclientCode} onChange={(event) => setSubclientCode(event.target.value)} placeholder="Código subcliente" className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm" />
              <input value={subclientName} onChange={(event) => setSubclientName(event.target.value)} placeholder="Nombre subcliente" className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm" />
            </div>
            <button onClick={() => void saveRoadmap()} disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"><Check className="size-4" /> Guardar hoja de ruta</button>
          </section>
        )}

        {current && (
          <>
            <div className="flex items-center justify-between gap-2">
              <div><p className="text-sm font-semibold">{current.subclient_name || 'Hoja de ruta activa'}</p><p className="text-xs text-muted-foreground">{current.subclient_code ? `Subcliente ${current.subclient_code} · ` : ''}{items.length} artículos</p></div>
              <button onClick={() => setPendingOnly((value) => !value)} className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold ${pendingOnly ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}><Filter className="size-3.5" /> Pendientes</button>
            </div>
            <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar descripción, EAN o referencia…" className="w-full rounded-2xl border border-border bg-card py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary" /></div>
            <div className="space-y-2">
              {filtered.map((item) => <RoadmapItem key={item.id} item={item} onUpdate={(patch) => { if (item.id) void updateItem(item as ClientRoadmapItem, patch); }} />)}
              {filtered.length === 0 && <p className="rounded-2xl border border-dashed border-border bg-card p-5 text-center text-sm text-muted-foreground">No hay artículos que coincidan.</p>}
            </div>
            <button onClick={createOrder} className="sticky bottom-20 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-float"><ArrowDown className="size-4" /> Crear pedido desde hoja de ruta</button>
          </>
        )}
        {!current && !draft && <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card p-8 text-center"><FileUp className="size-9 text-muted-foreground" /><p className="mt-3 font-semibold">Importa la hoja de ruta del cliente</p><p className="mt-1 text-sm text-muted-foreground">Acepta PDF, Excel y CSV. Las unidades vendidas solo se consultan; las cantidades a servir las decides tú.</p><button onClick={() => fileRef.current?.click()} className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Seleccionar documento</button></div>}
        {error && <p className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}

function RoadmapItem({ item, onUpdate }: { item: ClientRoadmapItem | DraftItem; onUpdate: (patch: Partial<ClientRoadmapItem>) => void }) {
  const isDraft = !item.id;
  const selected = item.selected ?? false;
  const quantity = item.quantity_to_order ?? 0;
  return <div className={`rounded-2xl bg-card p-3 shadow-card ${selected ? 'ring-2 ring-primary' : ''}`}>
    <div className="flex gap-3">
      <button onClick={() => !isDraft && onUpdate({ selected: !selected })} className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-secondary'}`} aria-label={selected ? 'Quitar artículo' : 'Marcar artículo'}>{selected && <Check className="size-4" />}</button>
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.description}</p><p className="text-[11px] text-muted-foreground">{item.reference || 'Sin referencia'}{item.ean ? ` · EAN ${item.ean}` : ''}</p><p className="mt-1 text-xs text-muted-foreground">{formatMoney(item.price)} · Tarifa {item.tariff || '—'} · Vendidas {formatNumber(item.units_sold)}{item.last_purchase_date ? ` · Última ${formatDate(item.last_purchase_date)}` : ''}</p></div>
    </div>
    {!isDraft && <div className="mt-2 flex items-center justify-end gap-2 border-t border-border pt-2"><span className="text-xs text-muted-foreground">A servir</span><button onClick={() => onUpdate({ quantity_to_order: Math.max(0, quantity - 1), selected: quantity > 1 ? selected : false })} className="grid size-7 place-items-center rounded-lg bg-secondary" aria-label="Restar"><Minus className="size-3.5" /></button><input inputMode="decimal" value={quantity} onChange={(event) => { const next = Math.max(0, numberValue(event.target.value)); onUpdate({ quantity_to_order: next, selected: next > 0 }); }} className="w-14 rounded-lg border border-border bg-card px-2 py-1.5 text-center text-sm tabular" /><button onClick={() => onUpdate({ quantity_to_order: quantity + 1, selected: true })} className="grid size-7 place-items-center rounded-lg bg-secondary" aria-label="Sumar"><Plus className="size-3.5" /></button></div>}
  </div>;
}
