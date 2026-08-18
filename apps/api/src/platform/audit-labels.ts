/** Label operasional untuk Audit Log Founder (bukan nama event internal). */

const ACTION_LABELS: Record<string, string> = {
  'workspace.approve': 'Usaha disetujui',
  'workspace.reject': 'Usaha ditolak',
  'workspace.suspend': 'Usaha ditangguhkan',
  'workspace.create': 'Usaha dibuat',
  'workspace.self_create': 'Usaha diajukan',
  'workspace.update': 'Usaha diperbarui',
  'workspace.status': 'Status usaha diubah',
  'workspace.switch': 'Pindah usaha',
  'workspace.reset_data': 'Data usaha direset',
  'billing.restore': 'Layanan dipulihkan',
  'billing.grace': 'Usaha masuk masa tenggang',
  'billing.suspend': 'Usaha ditangguhkan (tagihan)',
  'billing.generate': 'Tagihan dibuat',
  'billing.invoice_update': 'Tagihan diperbarui',
  'billing.proof_upload': 'Bukti pembayaran diunggah',
  'billing.proof_reject': 'Bukti pembayaran ditolak',
  'billing.profile_update': 'Profil tagihan diperbarui',
  'payment.checkout': 'Pembayaran dimulai',
  'payment.webhook.paid': 'Pembayaran diterima',
  'reminder.sent': 'Pengingat dikirim',
  'auth.login': 'Masuk',
  'auth.register': 'Pendaftaran akun',
  'auth.logout': 'Keluar',
  'auth.email_verify.request': 'Permintaan verifikasi email',
  'auth.email_verify.confirm': 'Email diverifikasi',
  'auth.password_reset.request': 'Permintaan reset kata sandi',
  'auth.password_reset.confirm': 'Kata sandi direset',
  'member.create': 'Anggota ditambahkan',
  'member.role_change': 'Peran anggota diubah',
  'member.remove': 'Anggota dinonaktifkan',
  'lead.convert': 'Minat diubah menjadi usaha',
  'lead.create': 'Minat baru',
  'module.toggle': 'Modul diubah',
  'plan.assign': 'Paket ditetapkan',
  'blueprint.activate': 'Blueprint diaktifkan',
  'settings.update': 'Pengaturan diperbarui',
};

export function labelAuditAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  // Fallback: soften dotted names without inventing wrong meaning
  const soft = action.replace(/\./g, ' · ').replace(/_/g, ' ');
  return soft.charAt(0).toUpperCase() + soft.slice(1);
}

/** Ringkas satu baris untuk Founder. */
export function summarizeAuditEvent(input: {
  action: string;
  workspaceName?: string | null;
  meta?: Record<string, unknown>;
}): string {
  const label = labelAuditAction(input.action);
  const name = (input.workspaceName || '').trim();
  if (input.action === 'payment.webhook.paid' || input.action === 'billing.restore') {
    if (name) return `${label} — ${name}`;
    if (input.action === 'payment.webhook.paid') return 'Pembayaran diterima, layanan dipulihkan';
    return label;
  }
  if (name) return `${label} — ${name}`;
  return label;
}
