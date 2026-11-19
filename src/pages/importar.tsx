import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { normalizeKey, parseNumberInput } from '@/lib/format';
import { PageHeader } from '@/components/ui/layout';

type Tipo = 'clientes' | 'productos';

interface ColumnDef {
  key: string;
  label: string;
  required?: boolean;
  type?: 'text' | 'number' | 'percent' | 'boolean';
  synonyms: string[];
}

const CLIENT_COLUMNS: ColumnDef[] = [
  { key: 'code', label: 'Código', synonyms: ['cod', 'codigo cliente', 'cod cliente', 'code', 'ref'] },
  { key: 'name', label: 'Nombre', required: true, type: 'text', synonyms: ['name', 'nombre', 'razon social', 'cliente', 'nombre cliente', 'nombre comercial', 'establecimiento', 'tienda'] },
  { key: 'tax_id', label: 'CIF / NIF', synonyms: ['tax_id', 'cif', 'nif', 'cif nif', 'nif cif', 'dni'] },
  { key: 'contact_name', label: 'Contacto', synonyms: ['contact_name', 'contacto', 'persona contacto', 'responsable', 'encargado'] },
  { key: 'phone', label: 'Teléfono', synonyms: ['phone', 'telefono', 'tel', 'tlf', 'movil'] },
  { key: 'email', label: 'Email', synonyms: ['email', 'e mail', 'correo', 'mail'] },
  { key: 'address', label: 'Dirección', synonyms: ['address', 'direccion', 'domicilio', 'calle'] },
  { key: 'city', label: 'Localidad', synonyms: ['city', 'localidad', 'poblacion', 'municipio', 'ciudad'] },
  { key: 'postal_code', label: 'Código postal', synonyms: ['postal_code', 'codigo postal', 'cod postal', 'postal'] },
  { key: 'notes', label: 'Notas', synonyms: ['notes', 'notas', 'observaciones', 'comentarios', 'obs'] },
];

const PRODUCT_COLUMNS: ColumnDef[] = [
  { key: 'code', label: 'Código producto', required: true, synonyms: ['code', 'codigo', 'codigo producto', 'sku', 'articulo'] },
  { key: 'barcode_ean', label: 'Código de barras EAN', synonyms: ['barcode_ean', 'ean', 'ean13', 'codigo barras', 'barcode'] },
  { key: 'spar_ref', label: 'Referencia SPAR', synonyms: ['spar_ref', 'referencia spar', 'ref spar', 'referencia'] },
  { key: 'spar_code', label: 'Código SPAR', synonyms: ['spar_code', 'codigo spar', 'cod spar', 'spar'] },
  { key: 'observations', label: 'Observaciones', synonyms: ['observaciones', 'observacion', 'observations', 'foto', 'imagen', 'fotografia', 'archivo foto'] },
  { key: 'description', label: 'Descripción', required: true, synonyms: ['description', 'descripcion', 'desc', 'producto', 'denominacion'] },
  { key: 'category', label: 'Categoría', synonyms: ['category', 'categoria', 'familia', 'seccion'] },
  { key: 'unit', label: 'Formato / unidad', synonyms: ['unit', 'unidad', 'envase', 'presentacion'] },
  { key: 'price', label: 'Precio', required: true, type: 'number', synonyms: ['price', 'precio', 'pvp', 'tarifa', 'importe'] },
  { key: 'discount_pct', label: 'Descuento %', type: 'percent', synonyms: ['discount_pct', 'descuento', 'dto', 'discount', 'dcto'] },
  { key: 'active', label: 'Activo', type: 'boolean', synonyms: ['active', 'activo', 'estado', 'alta'] },
];

function matchColumns(headers: string[], defs: ColumnDef[]): Record<string, string | null> {
  const normalized = headers.map((h) => normalizeKey(h));
  const used = new Set<number>();
  const mapping: Record<string, string | null> = {};

  // Pass 1: exact matches on key and synonyms (most reliable)
  for (const def of defs) {
    const candidates = [def.key, ...def.synonyms].map((s) => normalizeKey(s));
    let found: string | null = null;
    for (let i = 0; i < headers.length; i++) {
      if (used.has(i)) continue;
      if (candidates.includes(normalized[i])) {
        found = headers[i];
        used.add(i);
        break;
      }
    }
    mapping[def.key] = found;
  }

  // Pass 2: includes matches for defs still unmapped (less reliable)
  for (const def of defs) {
    if (mapping[def.key]) continue;
    let found: string | null = null;
    for (const syn of def.synonyms) {
      const sn = normalizeKey(syn);
      if (!sn) continue;
      for (let i = 0; i < headers.length; i++) {
        if (used.has(i)) continue;
        if (normalized[i].includes(sn)) {
          found = headers[i];
          used.add(i);
          break;
        }
      }
      if (found) break;
    }
    mapping[def.key] = found;
  }

  return mapping;
}

interface ParsedRow {
  data: Record<string, string | number | boolean | null>;
  errors: string[];
  status: 'ok' | 'error' | 'duplicate';
}

export default function Importar() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const tipo: Tipo = params.get('tipo') === 'productos' ? 'productos' : 'clientes';
  const defs = tipo === 'clientes' ? CLIENT_COLUMNS : PRODUCT_COLUMNS;

  const [rows, setRows] = useState<Record<string, string | number | boolean | null>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [phase, setPhase] = useState<'pick' | 'review' | 'done'>('pick');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<{ ok: number; errors: number; errorDetail: string | null } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    let wb: XLSX.WorkBook;
    if (/\.(csv|txt|tsv)$/i.test(file.name)) {
      const text = new TextDecoder().decode(buf).replace(/^\uFEFF/, '');
      wb = XLSX.read(text, { type: 'string', raw: true });
    } else {
      wb = XLSX.read(buf, { type: 'array' });
    }
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][];
    const headerRow = (json[0] as string[])?.map((h) => String(h).trim()).filter(Boolean) ?? [];
    if (headerRow.length < 2) {
      setPhase('pick');
      return;
    }
    setHeaders(headerRow);
    setMapping(matchColumns(headerRow, defs));
    const dataRows = json.slice(1).map((r) => {
      const obj: Record<string, string | number | boolean | null> = {};
      headerRow.forEach((h, i) => {
        const v = (r as unknown[])[i];
        obj[h] = v == null ? '' : String(v);
      });
      return obj;
    });
    setRows(dataRows);
    setPhase('review');
  }

  function remap(key: string, header: string) {
    setMapping((m) => ({ ...m, [key]: header }));
  }

  const parsed: ParsedRow[] = useMemo(() => {
    if (rows.length === 0) return [];
    const seenCodes = new Set<string>();
    const result: ParsedRow[] = [];
    for (const row of rows) {
      const data: Record<string, string | number | boolean | null> = {};
      const errors: string[] = [];
      for (const def of defs) {
        const col = mapping[def.key];
        const raw = col ? row[col] : '';
        const str = String(raw ?? '').trim();
        if (def.required && !str) {
          errors.push(`${def.label} obligatorio`);
        }
        if (def.type === 'number') {
          data[def.key] = str ? parseNumberInput(str) : 0;
        } else if (def.type === 'percent') {
          const n = str ? Math.min(100, Math.max(0, parseNumberInput(str))) : 0;
          data[def.key] = n;
        } else if (def.type === 'boolean') {
          // If no column is mapped, default to true for active; otherwise interpret the text
          if (!col) {
            data[def.key] = true;
          } else if (!str) {
            data[def.key] = true;
          } else {
            data[def.key] = !['false', 'no', 'falso', 'baja', 'inactivo', '0', ''].includes(str.toLowerCase());
          }
        } else {
          data[def.key] = str || null;
        }
      }
      const codeKey = String(data.code ?? '').toLowerCase();
      let status: ParsedRow['status'] = 'ok';
      if (errors.length === 0 && codeKey) {
        if (seenCodes.has(codeKey)) {
          status = 'duplicate';
          errors.push('Código repetido en el archivo');
        } else {
          seenCodes.add(codeKey);
        }
      }
      result.push({ data, errors, status: errors.length ? 'error' : status });
    }
    return result;
  }, [rows, mapping, defs]);

  const okRows = parsed.filter((r) => r.status === 'ok');

  async function doImport() {
    if (okRows.length === 0) return;
    setPhase('done');
    setProgress({ done: 0, total: okRows.length });
    const table = tipo === 'clientes' ? 'clients' : 'products';
    let okCount = 0;
    let errCount = 0;
    let firstError: string | null = null;
    const batchSize = 50;
    for (let i = 0; i < okRows.length; i += batchSize) {
      const batch = okRows.slice(i, i + batchSize).map((r) => {
        const d = { ...r.data } as Record<string, unknown>;
        // Ensure owner defaults — do not send user_id, let DEFAULT auth.uid() handle it
        if (tipo === 'productos') {
          d.discount_pct = d.discount_pct ?? 0;
          d.active = d.active ?? true;
          d.price = d.price ?? 0;
        }
        return d;
      });
      const { error } = await supabase.from(table).insert(batch);
      if (error) {
        errCount += batch.length;
        if (!firstError) firstError = error.message || error.code || String(error);
      } else {
        okCount += batch.length;
      }
      setProgress({ done: Math.min(i + batchSize, okRows.length), total: okRows.length });
    }
    setSummary({ ok: okCount, errors: errCount, errorDetail: firstError });
    await qc.invalidateQueries({ queryKey: [tipo === 'clientes' ? 'clients' : 'products'] });
  }

  return (
    <div className="min-h-dvh bg-background pb-28">
      <PageHeader title="Importar" backTo={tipo === 'clientes' ? '/clientes' : '/productos'} />
      <div className="mx-auto max-w-md px-4 pt-4">
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1">
          {(['clientes', 'productos'] as Tipo[]).map((t) => (
            <button
              key={t}
              onClick={() => navigate(`/importar?tipo=${t}`, { replace: true })}
              className={`rounded-xl py-2 text-xs font-semibold capitalize transition-colors ${
                tipo === t ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {phase === 'pick' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
              <div className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
                <FileSpreadsheet className="size-7" />
              </div>
              <p className="mt-4 font-display text-lg font-bold">Importar {tipo} desde Excel o CSV</p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Selecciona un archivo .xlsx, .csv o .txt. Reconoceremos automáticamente las columnas.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.txt,.tsv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-card"
            >
              <Upload className="size-4" /> Seleccionar archivo
            </button>
          </div>
        )}

        {phase === 'review' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {fileName} · {rows.length} filas · {okRows.length} válidas
            </p>
            <div className="space-y-2 rounded-2xl bg-card p-4 shadow-card">
              <p className="text-sm font-semibold">Mapeo de columnas</p>
              {defs.map((def) => (
                <div key={def.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm">
                    {def.label}
                    {def.required && <span className="text-destructive"> *</span>}
                  </span>
                  <select
                    value={mapping[def.key] ?? ''}
                    onChange={(e) => remap(def.key, e.target.value)}
                    className="max-w-[55%] truncate rounded-lg border border-border bg-card px-2 py-1.5 text-xs"
                  >
                    <option value="">— Ignorar —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="max-h-60 overflow-y-auto rounded-2xl bg-card p-3 text-xs shadow-card">
              {parsed.slice(0, 20).map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 border-b border-border/60 py-1.5 last:border-0 ${
                    r.status === 'ok' ? 'text-foreground' : 'text-destructive'
                  }`}
                >
                  {r.status === 'ok' ? (
                    <CheckCircle2 className="size-4 shrink-0 text-primary" />
                  ) : (
                    <AlertTriangle className="size-4 shrink-0 text-destructive" />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {String(r.data.name ?? r.data.description ?? `Fila ${i + 2}`)}
                  </span>
                  {r.errors[0] && <span className="shrink-0 text-destructive">{r.errors[0]}</span>}
                </div>
              ))}
              {parsed.length > 20 && (
                <p className="py-2 text-center text-muted-foreground">… y {parsed.length - 20} más</p>
              )}
            </div>
            <button
              onClick={doImport}
              disabled={okRows.length === 0}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-card disabled:opacity-60"
            >
              Importar {okRows.length} {tipo}
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center rounded-3xl bg-card px-6 py-12 text-center shadow-card">
              {summary ? (
                <>
                  <div className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
                    <CheckCircle2 className="size-7" />
                  </div>
                  <p className="mt-4 font-display text-lg font-bold">Importación completa</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {summary.ok} {tipo} importados
                    {summary.errors > 0 ? `, ${summary.errors} con error` : ''}
                  </p>
                  {summary.errors > 0 && summary.errorDetail && (
                    <p className="mt-3 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-left text-xs text-destructive">
                      {summary.errorDetail}
                    </p>
                  )}
                  <button
                    onClick={() => navigate(tipo === 'clientes' ? '/clientes' : '/productos')}
                    className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                  >
                    Ver {tipo}
                  </button>
                </>
              ) : (
                <>
                  <div className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
                    <Upload className="size-7 animate-pulse" />
                  </div>
                  <p className="mt-4 font-display text-lg font-bold">Guardando registros…</p>
                  {progress && (
                    <div className="mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${(progress.done / progress.total) * 100}%` }}
                      />
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {progress?.done} / {progress?.total}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
