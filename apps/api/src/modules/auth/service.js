const crypto = require('node:crypto');

const ROLE_BUILDER = 'Builder';
const ROLE_ADMIN = 'Admin';
const ROLE_TAMU = 'Tamu';
const BUILDER_DEFAULT_USER = 'builder';
const BUILDER_DEFAULT_PASS = 'MinaBuilder2026!';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function normalizeRole(role) {
  const r = String(role || '').trim();
  if (/^builder$/i.test(r)) return ROLE_BUILDER;
  if (/^(tamu|guest)$/i.test(r)) return ROLE_TAMU;
  if (/^admin$/i.test(r)) return ROLE_ADMIN;
  return ROLE_ADMIN;
}

function createHash(password, salt) {
  return crypto.createHash('sha256').update(`${password}:${salt}`).digest('hex');
}

function createSalt() {
  return crypto.randomBytes(8).toString('hex');
}

function createSession(user, workspaceMode = '') {
  const role = normalizeRole(user.role);
  const token = crypto.randomUUID();
  return {
    username: user.username,
    nama: user.nama || user.username,
    role,
    harusGantiPassword: !!user.harusGantiPassword,
    loginAt: new Date().toISOString(),
    token,
    builderMode: role === ROLE_BUILDER ? 'platform' : 'usaha',
    workspaceMode,
    redirectPage: workspaceMode === 'member' ? 'dashboard' : (role === ROLE_BUILDER ? 'platform' : 'dashboard')
  };
}

function login(username, password, options = {}) {
  const users = options.users || [];
  const workspaceMode = options.workspaceMode || '';
  const user = users.find((entry) => String(entry.username || '').trim().toLowerCase() === String(username || '').trim().toLowerCase()) || null;

  if (!user || !user.aktif) {
    return { sukses: false, pesan: 'Username atau password salah.' };
  }

  const hash = createHash(password, user.salt);
  if (hash !== user.passwordHash) {
    return { sukses: false, pesan: 'Username atau password salah.' };
  }

  const sesi = createSession(user, workspaceMode);
  return {
    sukses: true,
    data: {
      username: sesi.username,
      nama: sesi.nama,
      role: sesi.role,
      harusGantiPassword: sesi.harusGantiPassword,
      token: sesi.token,
      builderMode: sesi.builderMode,
      workspaceMode: sesi.workspaceMode,
      redirectPage: sesi.redirectPage,
      defaultPassHint: (user.username.toLowerCase() === BUILDER_DEFAULT_USER && user.harusGantiPassword)
        ? BUILDER_DEFAULT_PASS
        : ''
    },
    session: sesi
  };
}

function getInfoLoginAwal(options = {}) {
  const builder = (options.users || []).find((entry) => String(entry.username || '').trim().toLowerCase() === BUILDER_DEFAULT_USER) || null;
  const shown = String(options.builderDefaultPassShown || 'Ya');
  return {
    adaBuilder: !!builder,
    usernameDefault: BUILDER_DEFAULT_USER,
    tampilkanHint: !!(builder && builder.harusGantiPassword && shown !== 'Tidak'),
    passwordHint: (builder && builder.harusGantiPassword) ? BUILDER_DEFAULT_PASS : ''
  };
}

module.exports = {
  ROLE_BUILDER,
  ROLE_ADMIN,
  ROLE_TAMU,
  BUILDER_DEFAULT_USER,
  BUILDER_DEFAULT_PASS,
  SESSION_TTL_SECONDS,
  normalizeRole,
  createHash,
  createSalt,
  createSession,
  login,
  getInfoLoginAwal
};
