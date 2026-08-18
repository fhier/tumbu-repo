'use client';

import { useMemo, useState } from 'react';

type Mode = 'master' | 'master_plus_open' | 'full_history';

type FieldDef = { key: string; label: string; required?: boolean };
type EntityDef = { kind: string; label: string; fields: FieldDef[]; modes: Mode[] };
type SheetInfo = { name: string; headers: string[]; sampleRows: string[][]; rowCount: number };
type EntityMapping = {
  kind: string;
  sheetName: string | null;
  columns: Record<string, string | null>;
  groupBy?: string | null;
};
type Mapping = { entities: EntityMapping[]; mode: Mode; preset?: string | null };

type ParseResult = {
  sheets: SheetInfo[];
  suggestedMapping: Mapping;
  detectedPreset: string | null;
  catalog: { entities: EntityDef[]; modes: Array<{ id: Mode; label: string; description: string }> };
  fileMeta: { name: string; bytes: number };
};

type PreviewSummary = {
  mode: Mode;
  counts: Record<string, { ok: number; skip: number; error: number }>;
  issues: Array<{ entity: string; row: number; message: string }>;
  warnings: string[];
};

type CommitResult = {
  ok?: boolean;
  message: string;
  added: Record<string, number>;
  skipped: Record<string, number>;
  errors: Array<{ entity: string; row: number; message: string }>;
  warnings?: string[];
};

const MODE_HINT: Record<Mode, string> = {
  master: 'Hanya mitra, ukuran, dan produk.',
  master_plus_open: 'Master + hutang/piutang/saldo terbuka.',
  full_history: 'Master + histori pembelian, penjualan, kas, BA.',
};

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const b64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(b64);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsDataURL(file);
  });
}

export function ExcelImportWizard({
  apiFetch,
  onNotify,
  onDone,
  confirmWorkspaceCode,
  compact,
}: {
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
  onDone?: (result: CommitResult) => void;
  confirmWorkspaceCode?: string;
  compact?: boolean;
}) {
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileBase64, setFileBase64] = useState('');
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [mode, setMode] = useState<Mode>('master');
  const [preview, setPreview] = useState<PreviewSummary | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [wsCode, setWsCode] = useState(confirmWorkspaceCode || '');

  const entitiesForMode = useMemo(() => {
    if (!parsed) return [] as EntityDef[];
    return parsed.catalog.entities.filter((e) => e.modes.includes(mode));
  }, [parsed, mode]);

  const onUpload = async (file: File | null) => {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      const msg = 'Gunakan file .xlsx';
      setLocalError(msg);
      onNotify(msg);
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      const msg = 'File terlalu besar (maks ~12 MB). Ekspor ulang sheet yang diperlukan saja.';
      setLocalError(msg);
      onNotify(msg);
      return;
    }
    setBusy(true);
    setLocalError('');
    try {
      const b64 = await fileToBase64(file);
      const res = await apiFetch<ParseResult>('/erp/import/excel/parse', {
        method: 'POST',
        body: JSON.stringify({ fileBase64: b64, fileName: file.name }),
      });
      setFileName(file.name);
      setFileBase64(b64);
      setPendingFile(null);
      setParsed(res);
      const nextMode = (res.suggestedMapping.mode || (res.detectedPreset ? 'full_history' : 'master')) as Mode;
      setMode(nextMode);
      setMapping({ ...res.suggestedMapping, mode: nextMode });
      setStep('map');
      onNotify(res.detectedPreset
        ? 'Format impor lama terdeteksi — kolom diisi otomatis (bisa diubah).'
        : 'File dibaca. Sesuaikan mapping kolom sesuai header Anda.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal membaca Excel.';
      setLocalError(msg);
      onNotify(msg);
    } finally {
      setBusy(false);
    }
  };

  const updateEntity = (kind: string, patch: Partial<EntityMapping>) => {
    setMapping((prev) => {
      if (!prev) return prev;
      const entities = prev.entities.map((e) => (e.kind === kind ? { ...e, ...patch } : e));
      if (!entities.some((e) => e.kind === kind)) {
        const def = parsed?.catalog.entities.find((d) => d.kind === kind);
        entities.push({
          kind,
          sheetName: patch.sheetName ?? null,
          columns: Object.fromEntries((def?.fields || []).map((f) => [f.key, null])),
          groupBy: patch.groupBy ?? null,
          ...patch,
        });
      }
      return { ...prev, entities, mode };
    });
  };

  const ensureEntity = (kind: string): EntityMapping => {
    const existing = mapping?.entities.find((e) => e.kind === kind);
    if (existing) return existing;
    const def = parsed?.catalog.entities.find((d) => d.kind === kind);
    return {
      kind,
      sheetName: null,
      columns: Object.fromEntries((def?.fields || []).map((f) => [f.key, null])),
      groupBy: ['purchases', 'sales', 'beritaAcara', 'suratJalan'].includes(kind) ? 'number' : null,
    };
  };

  const runPreview = async () => {
    if (!mapping || !fileBase64) return;
    setBusy(true);
    setLocalError('');
    try {
      const res = await apiFetch<PreviewSummary>('/erp/import/excel/preview', {
        method: 'POST',
        body: JSON.stringify({
          fileBase64,
          fileName,
          mode,
          mapping: { ...mapping, mode },
        }),
      });
      setPreview(res);
      setStep('preview');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Preview gagal.';
      setLocalError(msg);
      onNotify(msg);
    } finally {
      setBusy(false);
    }
  };

  const runCommit = async () => {
    if (!mapping || !fileBase64) return;
    setBusy(true);
    setLocalError('');
    try {
      const res = await apiFetch<CommitResult>('/erp/import/excel/commit', {
        method: 'POST',
        body: JSON.stringify({
          fileBase64,
          fileName,
          mode,
          mapping: { ...mapping, mode },
          confirmWorkspaceCode: wsCode || undefined,
        }),
      });
      setResult(res);
      setStep('done');
      onNotify(res.message);
      onDone?.(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Impor gagal.';
      setLocalError(msg);
      onNotify(msg);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setParsed(null);
    setMapping(null);
    setPreview(null);
    setResult(null);
    setFileBase64('');
    setFileName('');
    setPendingFile(null);
    setLocalError('');
  };

  return (
    <section className="panel" style={compact ? { boxShadow: 'none', border: '1px solid var(--border)' } : undefined}>
      <h2 style={{ marginBottom: 4 }}>Impor Excel (format bebas)</h2>
      <p className="hint">
        Unggah .xlsx milik Anda → petakan kolom ke field TUMBU → pilih mode → impor.
        File Excel/CSV dari sistem lain juga didukung; jika format dikenali, kolom diisi otomatis.
      </p>

      <div className="tl-flow" style={{ justifyContent: 'flex-start', margin: '12px 0', flexWrap: 'wrap', gap: 6 }}>
        {(['upload', 'map', 'preview', 'done'] as const).map((s, i) => (
          <span key={s} className={`tl-flow-step${step === s ? '' : ''}`} style={{ opacity: step === s ? 1 : 0.55 }}>
            {i + 1}. {s === 'upload' ? 'Unggah' : s === 'map' ? 'Mapping' : s === 'preview' ? 'Preview' : 'Selesai'}
          </span>
        ))}
      </div>

      {localError ? <p className="danger" style={{ margin: '0 0 8px' }}>{localError}</p> : null}

      {step === 'upload' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <label className="field">
            <span>File Excel (.xlsx)</span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setPendingFile(f);
                setLocalError('');
              }}
            />
          </label>
          {pendingFile ? (
            <p className="hint" style={{ margin: 0 }}>
              Dipilih: <b>{pendingFile.name}</b> ({(pendingFile.size / 1024).toFixed(0)} KB)
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy || !pendingFile}
            onClick={() => onUpload(pendingFile)}
          >
            {busy ? 'Membaca file…' : 'Baca & lanjut ke mapping'}
          </button>
        </div>
      )}

      {step === 'map' && parsed && mapping && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="form form-2">
            <label className="field">
              <span>Mode impor</span>
              <select
                value={mode}
                disabled={busy}
                onChange={(e) => {
                  const m = e.target.value as Mode;
                  setMode(m);
                  setMapping((prev) => (prev ? { ...prev, mode: m } : prev));
                }}
              >
                {(parsed.catalog.modes || []).map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
            <div className="field">
              <span>File</span>
              <p className="hint" style={{ margin: 0 }}>
                {fileName} · {parsed.sheets.length} sheet
                {parsed.detectedPreset ? ' · format dikenali' : ''}
              </p>
              <small style={{ color: 'var(--muted)' }}>{MODE_HINT[mode]}</small>
            </div>
          </div>

          {entitiesForMode.map((def) => {
            const ent = ensureEntity(def.kind);
            const sheet = parsed.sheets.find((s) => s.name === ent.sheetName);
            return (
              <div key={def.kind} style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                  <b>{def.label}</b>
                  <select
                    value={ent.sheetName || ''}
                    disabled={busy}
                    onChange={(e) => {
                      const sheetName = e.target.value || null;
                      const sh = parsed.sheets.find((s) => s.name === sheetName);
                      const columns: Record<string, string | null> = {};
                      for (const f of def.fields) {
                        columns[f.key] = null;
                        if (sh) {
                          const hit = sh.headers.find((h) => h.toLowerCase().includes(f.label.split(' ')[0].toLowerCase())
                            || h.toLowerCase().includes(f.key.toLowerCase()));
                          columns[f.key] = hit || null;
                        }
                      }
                      const prev = mapping.entities.find((x) => x.kind === def.kind);
                      updateEntity(def.kind, {
                        sheetName,
                        columns: sheetName && prev?.sheetName === sheetName ? prev.columns : columns,
                      });
                    }}
                  >
                    <option value="">— Lewati —</option>
                    {parsed.sheets.map((s) => (
                      <option key={s.name} value={s.name}>{s.name} ({s.rowCount} baris)</option>
                    ))}
                  </select>
                </div>
                {ent.sheetName && sheet ? (
                  <div className="form form-2">
                    {def.fields.map((f) => (
                      <label className="field" key={f.key}>
                        <span>{f.label}{f.required ? ' *' : ''}</span>
                        <select
                          value={ent.columns[f.key] || ''}
                          disabled={busy}
                          onChange={(e) => {
                            updateEntity(def.kind, {
                              sheetName: ent.sheetName,
                              columns: { ...ent.columns, [f.key]: e.target.value || null },
                            });
                          }}
                        >
                          <option value="">— Tidak dipakai —</option>
                          {sheet.headers.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="hint" style={{ margin: 0 }}>Sheet tidak dipilih — entitas ini dilewati.</p>
                )}
              </div>
            );
          })}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn-secondary" disabled={busy} onClick={reset}>Ganti file</button>
            <button type="button" disabled={busy} onClick={runPreview}>{busy ? 'Memeriksa…' : 'Preview impor'}</button>
          </div>
        </div>
      )}

      {step === 'preview' && preview && (
        <div style={{ display: 'grid', gap: 12 }}>
          <p className="hint">Mode: <b>{preview.mode}</b>. Periksa ringkasan sebelum menulis ke workspace.</p>
          <div className="table">
            <div className="tr head"><span>Entitas</span><span>OK</span><span>Skip/Error</span></div>
            {Object.entries(preview.counts).map(([k, v]) => (
              <div className="tr" key={k}>
                <span>{k}</span>
                <span>{v.ok}</span>
                <span className={(v.error || v.skip) ? 'danger' : ''}>{v.error || 0}{v.skip ? ` · skip ${v.skip}` : ''}</span>
              </div>
            ))}
          </div>
          {preview.warnings.length ? (
            <ul className="hint" style={{ margin: 0, paddingLeft: 18 }}>
              {preview.warnings.slice(0, 12).map((w) => <li key={w}>{w}</li>)}
            </ul>
          ) : null}
          {preview.issues.length ? (
            <details open>
              <summary className="danger">Perhatian: {preview.issues.length} isu (wajib dicek)</summary>
              <ul style={{ marginTop: 8 }}>
                {preview.issues.slice(0, 20).map((i, idx) => (
                  <li key={`${i.entity}-${i.row}-${idx}`}>{i.entity} baris {i.row}: {i.message}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {preview.issues.length ? (
            <p className="danger" style={{ margin: 0 }}>
              Ada isu di preview. Anda tetap bisa impor, tetapi dokumen bermasalah akan dilewati / dilaporkan.
            </p>
          ) : null}
          <label className="field">
            <span>Kode workspace (opsional, validasi)</span>
            <input value={wsCode} onChange={(e) => setWsCode(e.target.value)} placeholder="mis. demo-farm" disabled={busy} />
          </label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setStep('map')}>Kembali</button>
            <button type="button" disabled={busy} onClick={runCommit}>{busy ? 'Mengimpor…' : 'Konfirmasi & impor'}</button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div style={{ display: 'grid', gap: 12 }}>
          <p className={result.ok === false || (result.errors?.length ?? 0) > 0 ? 'danger' : undefined}>
            <b>{result.message}</b>
          </p>
          <div className="table">
            <div className="tr head"><span>Entitas</span><span>Ditambah</span><span>Dilewati</span></div>
            {Array.from(new Set([...Object.keys(result.added), ...Object.keys(result.skipped)])).map((k) => (
              <div className="tr" key={k}>
                <span>{k}</span>
                <span>{result.added[k] || 0}</span>
                <span className={(result.skipped[k] || 0) > 0 ? 'danger' : ''}>{result.skipped[k] || 0}</span>
              </div>
            ))}
          </div>
          {(result.warnings?.length ?? 0) > 0 ? (
            <details open>
              <summary>Peringatan ({result.warnings!.length})</summary>
              <ul style={{ marginTop: 8 }}>
                {result.warnings!.slice(0, 20).map((w) => <li key={w}>{w}</li>)}
              </ul>
            </details>
          ) : null}
          {(result.errors?.length ?? 0) > 0 ? (
            <details open>
              <summary className="danger">Error / dilewati dengan catatan ({result.errors.length})</summary>
              <ul style={{ marginTop: 8 }}>
                {result.errors.slice(0, 30).map((i, idx) => (
                  <li key={`${i.entity}-${i.row}-${idx}`}>{i.entity} baris {i.row}: {i.message}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <button type="button" className="btn-secondary" onClick={reset}>Impor file lain</button>
        </div>
      )}
    </section>
  );
}
