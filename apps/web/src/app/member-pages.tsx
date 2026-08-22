'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BrandLogo } from './brand';
import { AuthBrandPanel, bizTypeIcon } from './fisheries-visual';
import { Ti, PAGE_ICONS } from './icons';
import { SPECIES_LICENSE_OPTIONS } from './filter-context';
import { TUMBU_CONTACT, TUMBU_MAILTO } from './contact';

type Blueprint = {
  id: string;
  name: string;
  categoryLabel: string;
  description: string;
  kind: string;
};

type PlanOpt = {
  id: string;
  code: string;
  name: string;
  description: string;
  monthlyAmount: number;
  workspaceQuota: number;
  trialDays: number;
};

type WsCtx = {
  workspace: { name: string; code: string };
  blueprint: { id: string; name: string; kind?: string };
  modules: string[];
  pages: string[];
};

type OwnerWs = {
  id: string;
  name: string;
  code: string;
  blueprint: string;
  role: string;
  status: string;
  statusLabel: string;
  graceUntil?: string | null;
};

type OwnerInvoice = {
  id: string;
  number: string;
  periodYm: string;
  planName: string;
  amount: number;
  status: string;
  dueAt: string | null;
  proofStatus: string;
  proofFileName?: string;
  hasProof?: boolean;
};

function money(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function statusBadge(status: string, label?: string) {
  const cls = status === 'ACTIVE' ? 'badge-lunas' : status === 'GRACE' || status === 'PENDING' ? 'badge-warn' : 'badge-due';
  return <span className={`badge ${cls}`}>{label || status}</span>;
}

function payBadge(status: string) {
  if (status === 'PAID') return <span className="badge badge-lunas">Lunas</span>;
  if (status === 'OVERDUE') return <span className="badge badge-due">Jatuh tempo</span>;
  return <span className="badge badge-issued">Belum bayar</span>;
}

function bizCardKind(id: string, kind?: string): string {
  if (kind === 'aquaculture') return 'pembudidaya';
  if (kind === 'service') return 'service';
  if (kind === 'distributor' || id.includes('distributor')) return 'distributor';
  return 'distributor';
}

function planFeatures(code: string): string[] {
  const c = code.toLowerCase();
  if (c === 'growth') {
    return ['Hingga 3 workspace', 'Modul keuangan & anggota', 'Backup data', 'Trial 14 hari'];
  }
  if (c === 'business') {
    return ['Hingga 10 workspace', 'Modul penuh termasuk jasa', 'Backup & multi-tim', 'Trial 30 hari'];
  }
  return ['1 workspace', 'Modul operasional inti', 'Pembelian, penjualan, stok', 'Trial 14 hari'];
}

export function MemberSetup({
  userName,
  apiFetch,
  onCreated,
  onLogout,
  onGoPortal,
}: {
  userName: string;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  onCreated: (ctx: WsCtx) => void | Promise<void>;
  onLogout: () => void;
  onGoPortal?: () => void;
}) {
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [plans, setPlans] = useState<PlanOpt[]>([]);
  const [blueprintId, setBlueprintId] = useState('operational_distributor');
  const [planId, setPlanId] = useState('');
  const [speciesTier, setSpeciesTier] = useState<'single' | 'multi'>('single');
  const [primarySpecies, setPrimarySpecies] = useState('LELE');
  const [extraSpecies, setExtraSpecies] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [pendingMsg, setPendingMsg] = useState('');

  useEffect(() => {
    apiFetch<Blueprint[]>('/platform/catalog/blueprints')
      .then((rows) => {
        setBlueprints(rows);
        if (rows[0]) setBlueprintId(rows[0].id);
      })
      .catch(() => setError('Gagal memuat jenis usaha.'));
    apiFetch<PlanOpt[]>('/platform/catalog/plans')
      .then((rows) => {
        setPlans(rows);
        const starter = rows.find((p) => p.code === 'starter') || rows[0];
        if (starter) setPlanId(starter.id);
      })
      .catch(() => { /* paket opsional di UI — backend default starter */ });
  }, [apiFetch]);

  const selected = blueprints.find((b) => b.id === blueprintId);
  const selectedPlan = plans.find((p) => p.id === planId);

  const toggleExtra = (code: string) => {
    setExtraSpecies((prev) => (
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code].slice(0, 4)
    ));
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const allowedSpecies = selected?.kind === 'aquaculture'
        ? (speciesTier === 'multi'
          ? [primarySpecies, ...extraSpecies.filter((c) => c !== primarySpecies)]
          : [primarySpecies])
        : undefined;
      const res = await apiFetch<{
        context?: WsCtx;
        pendingApproval?: boolean;
        message?: string;
        name?: string;
        code?: string;
        status?: string;
      }>('/platform/my/workspaces', {
        method: 'POST',
        body: JSON.stringify({
          name: f.get('name'),
          phone: f.get('phone') || undefined,
          address: f.get('address') || undefined,
          blueprintId,
          planId: planId || undefined,
          ...(selected?.kind === 'aquaculture'
            ? {
              primarySpecies,
              allowedSpecies,
              speciesTier,
            }
            : {}),
        }),
      });
      if (res.pendingApproval || res.status === 'PENDING' || !res.context) {
        setPendingMsg(res.message || 'Pengajuan usaha menunggu persetujuan tim TUMBU.');
        setStep(4);
        return;
      }
      onCreated(res.context);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat usaha.');
    } finally {
      setBusy(false);
    }
  };

  const progressWidth = step >= 4 ? '100%' : step === 3 ? '75%' : step === 2 ? '50%' : '25%';
  const stepLabel = step === 1
    ? 'Pilih jenis usaha'
    : step === 2
      ? 'Pilih paket & spesies'
      : step === 3
        ? 'Profil usaha'
        : 'Selesai';

  return (
    <main className="login-screen member-flow">
      <AuthBrandPanel
        title={<>Business OS untuk<br />Industri Perikanan Indonesia</>}
        subtitle="Satu ruang kerja untuk mengelola operasional usaha secara lebih rapi."
      />
      <section className="login-panel">
        <div className="login-card member-card">
          <BrandLogo variant="light" size="md" />
          <div className="onb-progress">
            <div className="onb-progress-track">
              <div className="onb-progress-fill" style={{ width: progressWidth }} />
            </div>
            <div className="onb-progress-meta">
              <span>Langkah {step >= 4 ? 4 : step} dari 4</span>
              <span>{stepLabel}</span>
            </div>
          </div>
          <h2>Halo, {userName || 'Pemilik Usaha'}</h2>
          <p className="hint">
            {step === 4
              ? 'Pengajuan usaha terkirim.'
              : step === 1
                ? 'Pilih jenis usaha utama Anda. Kami menyiapkan alur kerja yang relevan.'
                : step === 2
                  ? 'Pilih paket langganan dan (untuk budidaya) lisensi spesies. Pilihan ini disimpan ke pengajuan.'
                  : 'Beri nama usaha Anda. Gunakan nama yang dikenali oleh tim.'}
          </p>

          {step === 1 && (
            <div className="biz-picker-grid">
              {blueprints.map((b) => {
                const cardKind = bizCardKind(b.id, b.kind);
                const icon = bizTypeIcon(b.id, b.kind);
                const active = blueprintId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    className={`biz-picker-card${active ? ' is-active' : ''}`}
                    onClick={() => setBlueprintId(b.id)}
                  >
                    <div className="biz-picker-art">
                      <img src={`/design/persona/${cardKind}.webp`} alt="" loading="lazy" />
                    </div>
                    <div className="biz-picker-ico" aria-hidden="true"><Ti name={PAGE_ICONS[icon] ?? icon} size={18} /></div>
                    <h3>{b.name}</h3>
                    <p>{b.description}</p>
                    <span className="biz-picker-tag">{b.categoryLabel}</span>
                  </button>
                );
              })}
              <button type="button" className="tl-btn tl-btn-primary biz-picker-next" disabled={!blueprintId} onClick={() => setStep(2)}>
                Lanjutkan
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="member-form" style={{ display: 'grid', gap: 16 }}>
              <p className="hint" style={{ margin: 0 }}>Jenis usaha: <b>{selected?.name || '—'}</b></p>

              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Pilih paket</span>
                <div className="pricing-grid">
                  {(plans.length ? plans : [
                    { id: 'starter', code: 'starter', name: 'Starter', description: '1 workspace · modul inti · trial 14 hari', monthlyAmount: 150000, workspaceQuota: 1, trialDays: 14 },
                  ]).map((p) => {
                    const active = planId === p.id || (!planId && p.code === 'starter');
                    const popular = p.code === 'growth';
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`pricing-card${active ? ' is-active' : ''}${popular ? ' is-popular' : ''}`}
                        onClick={() => setPlanId(p.id)}
                      >
                        {popular ? <span className="pricing-badge-popular">Paling Populer</span> : null}
                        <h3 className="pricing-card-name">{p.name}</h3>
                        <div className="pricing-card-price-row">
                          <span className="pricing-card-price">{money(p.monthlyAmount)}</span>
                          <span className="pricing-card-period">/ bulan</span>
                          <span className="pricing-trial-badge">Trial {p.trialDays} Hari</span>
                        </div>
                        <p className="pricing-card-desc">{p.description}</p>
                        <ul className="pricing-features">
                          {planFeatures(p.code).map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selected?.kind === 'aquaculture' ? (
                <>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Lisensi spesies</span>
                    <div className="license-grid" style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        className={`license-card${speciesTier === 'single' ? ' is-active' : ''}`}
                        onClick={() => { setSpeciesTier('single'); setExtraSpecies([]); }}
                      >
                        <p className="license-card-title">Single Species</p>
                        <p className="license-card-hint">Satu spesies utama — form hanya menampilkan spesies ini.</p>
                      </button>
                      <button
                        type="button"
                        className={`license-card${speciesTier === 'multi' ? ' is-active' : ''}`}
                        onClick={() => setSpeciesTier('multi')}
                      >
                        <p className="license-card-title">Multi Species (Add-on)</p>
                        <p className="license-card-hint">Beberapa spesies (maks. 5) — siap model monetisasi Multi-Species.</p>
                      </button>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Spesies utama *</span>
                    <div className="species-chip-grid" style={{ marginTop: 8 }}>
                      {SPECIES_LICENSE_OPTIONS.map((s) => {
                        const active = primarySpecies === s.code;
                        return (
                          <button
                            key={s.code}
                            type="button"
                            className={`species-chip${active ? ' is-active is-primary' : ''}`}
                            onClick={() => {
                              setPrimarySpecies(s.code);
                              setExtraSpecies((prev) => prev.filter((c) => c !== s.code));
                            }}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                    <span className="field-help">Ketuk chip untuk memilih spesies utama budidaya Anda.</span>
                  </div>

                  {speciesTier === 'multi' ? (
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Spesies tambahan (opsional)</span>
                      <div className="species-chip-grid" style={{ marginTop: 8 }}>
                        {SPECIES_LICENSE_OPTIONS.filter((s) => s.code !== primarySpecies).map((s) => {
                          const on = extraSpecies.includes(s.code);
                          return (
                            <button
                              key={s.code}
                              type="button"
                              className={`species-chip${on ? ' is-active' : ''}`}
                              onClick={() => toggleExtra(s.code)}
                            >
                              {on ? '✓ ' : ''}{s.label}
                            </button>
                          );
                        })}
                      </div>
                      <span className="field-help">Pilih hingga 4 spesies tambahan. Total maks. 5 termasuk spesies utama.</span>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="hint">Paket akan diaktifkan otomatis saat Founder menyetujui pengajuan Anda.</p>
              )}

              <div className="member-form-actions">
                <button type="button" className="btn-secondary" onClick={() => setStep(1)}>Kembali</button>
                <button type="button" className="tl-btn tl-btn-primary" disabled={!planId && !plans.length} onClick={() => setStep(3)}>
                  Lanjutkan
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <form className="form member-form" onSubmit={submit}>
              <input name="name" placeholder="Nama usaha" required disabled={busy} />
              <input name="phone" placeholder="Telepon usaha (opsional)" disabled={busy} />
              <input name="address" placeholder="Alamat (opsional)" disabled={busy} />
              <p className="hint" style={{ margin: 0 }}>
                {selected?.name || '—'} · paket <b>{selectedPlan?.name || 'Starter'}</b>
                {selected?.kind === 'aquaculture'
                  ? ` · ${speciesTier === 'multi' ? 'Multi' : 'Single'} species (${primarySpecies}${extraSpecies.length ? `, +${extraSpecies.length}` : ''})`
                  : ''}
              </p>
              <div className="member-form-actions">
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => setStep(2)}>Kembali</button>
                <button disabled={busy}>{busy ? 'Mengirim…' : 'Ajukan Usaha'}</button>
              </div>
            </form>
          )}

          {step === 4 && (
            <div className="member-pending">
              <p className="member-pending-msg">{pendingMsg}</p>
              <p className="hint">
                Setelah disetujui, Anda akan langsung diarahkan ke dashboard usaha Anda.
                Pantau status di Portal Owner.
              </p>
              {onGoPortal ? (
                <button type="button" className="tl-btn tl-btn-primary" onClick={onGoPortal}>Buka Portal Owner</button>
              ) : null}
            </div>
          )}

          {error && <p className="danger">{error}</p>}
          <button type="button" className="btn-secondary member-logout" onClick={onLogout}>Keluar</button>
        </div>
      </section>
    </main>
  );
}

/** Portal Owner — antarmuka tipis di atas Billing Enforcement. */
export function MemberHome({
  userName,
  workspaces,
  apiFetch,
  onOpen,
  onCreateNew,
  onLogout,
  onNotify,
}: {
  userName: string;
  workspaces: Array<{ id: string; name: string; blueprint: string; role: string; status?: string; statusLabel?: string }>;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  onOpen: (id: string) => void;
  onCreateNew: () => void;
  onLogout: () => void;
  onNotify?: (m: string) => void;
}) {
  const [tab, setTab] = useState<'usaha' | 'tagihan'>('usaha');
  const [ownerWs, setOwnerWs] = useState<OwnerWs[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [invoices, setInvoices] = useState<OwnerInvoice[]>([]);
  const [wsMeta, setWsMeta] = useState<{ status: string; statusLabel: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [autoOpened, setAutoOpened] = useState(false);

  const reloadWs = useCallback(async () => {
    try {
      const rows = await apiFetch<OwnerWs[]>('/platform/owner/workspaces');
      setOwnerWs(rows);
      if (!selectedId && rows[0]) setSelectedId(rows[0].id);
      return rows;
    } catch {
      const fallback = workspaces.map((w) => ({
        id: w.id, name: w.name, code: '', blueprint: w.blueprint, role: w.role,
        status: w.status || 'ACTIVE', statusLabel: w.statusLabel || w.status || 'Aktif',
      }));
      setOwnerWs(fallback);
      return fallback;
    }
  }, [apiFetch, workspaces, selectedId]);

  const reloadInvoices = useCallback(async (workspaceId: string) => {
    if (!workspaceId) return;
    try {
      const res = await apiFetch<{
        workspace: { status: string; statusLabel: string; name: string };
        invoices: OwnerInvoice[];
      }>(`/platform/owner/invoices?workspaceId=${encodeURIComponent(workspaceId)}`);
      setWsMeta(res.workspace);
      setInvoices(res.invoices || []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat tagihan.');
      setInvoices([]);
    }
  }, [apiFetch]);

  useEffect(() => { void reloadWs(); }, [reloadWs]);
  useEffect(() => {
    if (tab === 'tagihan' && selectedId) void reloadInvoices(selectedId);
  }, [tab, selectedId, reloadInvoices]);

  /** Auto-redirect pasca-approval: bila ada usaha ACTIVE, buka Dashboard langsung. */
  useEffect(() => {
    if (autoOpened) return;
    let cancelled = false;
    const tick = async () => {
      const rows = await reloadWs();
      if (cancelled || autoOpened) return;
      const active = rows.filter((w) => w.status === 'ACTIVE' || w.status === 'GRACE');
      if (active.length === 1) {
        setAutoOpened(true);
        onNotify?.(`Usaha ${active[0].name} sudah disetujui — membuka Dashboard…`);
        onOpen(active[0].id);
      } else if (active.length > 1) {
        setAutoOpened(true);
        onNotify?.('Ada usaha yang sudah aktif. Pilih usaha untuk masuk operasional.');
      }
    };
    void tick();
    const id = window.setInterval(() => { void tick(); }, 8000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [autoOpened, reloadWs, onOpen, onNotify]);

  const uploadProof = async (invoiceId: string, file: File, note: string) => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Gagal membaca file'));
        reader.readAsDataURL(file);
      });
      await apiFetch('/platform/owner/invoices/proof', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: selectedId,
          invoiceId,
          fileBase64: base64,
          fileName: file.name,
          mime: file.type || 'application/octet-stream',
          note: note || undefined,
        }),
      });
      onNotify?.('Bukti transfer terkirim.');
      await reloadInvoices(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal unggah bukti.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-screen member-flow">
      <AuthBrandPanel
        title={<>Portal Owner</>}
        subtitle="Pantau status usaha, tagihan, dan masuk operasional setelah disetujui."
      />
      <section className="login-panel">
        <div className="login-card member-card" style={{ maxWidth: 560 }}>
          <BrandLogo variant="light" size="md" />
          <h2>Halo, {userName || 'Owner'}</h2>
          <p className="hint">Kelola usaha Anda. Setelah Founder menyetujui, Dashboard dibuka otomatis.</p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button type="button" className={tab === 'usaha' ? 'tl-btn tl-btn-primary' : 'btn-secondary'} onClick={() => setTab('usaha')}>Usaha</button>
            <button type="button" className={tab === 'tagihan' ? 'tl-btn tl-btn-primary' : 'btn-secondary'} onClick={() => setTab('tagihan')}>Tagihan</button>
          </div>

          {tab === 'usaha' && (
            <div style={{ display: 'grid', gap: 10 }}>
              {(ownerWs.length ? ownerWs : workspaces.map((w) => ({
                id: w.id, name: w.name, code: '', blueprint: w.blueprint, role: w.role,
                status: w.status || 'ACTIVE', statusLabel: w.statusLabel || 'Aktif',
              }))).map((w) => {
                const canOpen = w.status === 'ACTIVE' || w.status === 'GRACE';
                return (
                  <div key={w.id} className="biz-picker-card" style={{ cursor: 'default' }}>
                    <h3>{w.name}</h3>
                    <p>{w.blueprint}</p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {statusBadge(w.status, w.statusLabel)}
                      {canOpen ? (
                        <button type="button" className="tl-btn tl-btn-primary btn-sm" onClick={() => onOpen(w.id)}>
                          Buka Operasional
                        </button>
                      ) : (
                        <span className="hint" style={{ margin: 0 }}>Menunggu persetujuan Founder</span>
                      )}
                    </div>
                  </div>
                );
              })}
              <button type="button" className="btn-secondary" onClick={onCreateNew}>+ Ajukan usaha baru</button>
            </div>
          )}

          {tab === 'tagihan' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ padding: '10px 12px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, fontSize: 12 }}>
                <strong style={{ color: '#166534' }}>ℹ️ Metode Pembayaran Aktif</strong>
                <p style={{ margin: '4px 0 0', color: '#15803D' }}>
                  Transfer manual ke rekening TUMBU → unggah bukti → Founder verifikasi → Workspace aktif.
                  <br />Payment gateway (QRIS/VA) dalam pengembangan.
                </p>
              </div>
              <p className="hint contact-help">
                Pertanyaan?{' '}
                <a href={TUMBU_MAILTO}>{TUMBU_CONTACT.email}</a>
              </p>
              <label className="field">
                <span>Usaha</span>
                <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                  {ownerWs.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
              {wsMeta ? <p className="hint">{wsMeta.name} · {statusBadge(wsMeta.status, wsMeta.statusLabel)}</p> : null}
              {error ? <p className="danger">{error}</p> : null}
              {!invoices.length ? (
                <p className="empty-state">Belum ada tagihan untuk usaha ini.</p>
              ) : invoices.map((inv) => (
                <div key={inv.id} className="biz-picker-card" style={{ cursor: 'default' }}>
                  <h3>{inv.number}</h3>
                  <p>{inv.planName} · {inv.periodYm} · {money(inv.amount)}</p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {payBadge(inv.status)}
                    {inv.hasProof ? <span className="badge badge-issued">Bukti terkirim — menunggu verifikasi</span> : null}
                  </div>
                  {inv.status !== 'PAID' && !inv.hasProof ? (
                    <div style={{ marginTop: 10, padding: '10px 12px', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 8, fontSize: 12 }}>
                      <strong style={{ color: '#92400E' }}>💳 Langkah Pembayaran</strong>
                      <ol style={{ margin: '6px 0 8px', paddingLeft: 16, color: '#78350F', lineHeight: 1.6 }}>
                        <li>Transfer ke rekening TUMBU (hubungi {TUMBU_CONTACT.email})</li>
                        <li>Unggah foto/PDF bukti transfer di bawah</li>
                        <li>Tunggu verifikasi admin (maks 1×24 jam)</li>
                        <li>Workspace otomatis aktif setelah disetujui</li>
                      </ol>
                      <label className="field" style={{ marginTop: 4 }}>
                        <span>Unggah bukti transfer (foto/PDF)</span>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          disabled={busy}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadProof(inv.id, file, '');
                          }}
                        />
                      </label>
                    </div>
                  ) : inv.status !== 'PAID' && inv.hasProof ? (
                    <p style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>✅ Bukti diterima — menunggu konfirmasi Founder</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <button type="button" className="btn-secondary member-logout" onClick={onLogout}>Keluar</button>
        </div>
      </section>
    </main>
  );
}
