function normalizeName(value) {
  return String(value || '').trim();
}

function createKode(prefix, existing = []) {
  const current = existing.length + 1;
  return `${prefix}${String(current).padStart(3, '0')}`;
}

function buildMasterDataState(items = {}) {
  const supplier = (items.supplier || []).map((entry) => ({
    kode: entry.kode,
    nama: entry.nama,
    alamat: entry.alamat || '',
    hp: entry.hp || '',
    status: entry.status || 'Aktif'
  }));

  const pelanggan = (items.pelanggan || []).map((entry) => ({
    kode: entry.kode,
    nama: entry.nama,
    alamat: entry.alamat || '',
    hp: entry.hp || '',
    status: entry.status || 'Aktif'
  }));

  const ukuran = (items.ukuran || []).map((entry) => String(entry || '').trim()).filter(Boolean);

  return { supplier, pelanggan, ukuran };
}

function addSupplier(state, data = {}) {
  const name = normalizeName(data.nama);
  if (!name) throw new Error('Nama supplier tidak boleh kosong.');

  const duplicate = (state.supplier || []).find((entry) => String(entry.nama || '').trim().toLowerCase() === name.toLowerCase());
  if (duplicate) throw new Error(`Supplier '${name}' sudah terdaftar.`);

  const code = createKode('SUP', state.supplier || []);
  state.supplier = [...(state.supplier || []), { kode: code, nama: name, alamat: data.alamat || '', hp: data.hp || '', status: 'Aktif' }];
  return code;
}

function addPelanggan(state, data = {}) {
  const name = normalizeName(data.nama);
  if (!name) throw new Error('Nama pelanggan tidak boleh kosong.');

  const duplicate = (state.pelanggan || []).find((entry) => String(entry.nama || '').trim().toLowerCase() === name.toLowerCase());
  if (duplicate) throw new Error(`Pelanggan '${name}' sudah terdaftar.`);

  const code = createKode('PLG', state.pelanggan || []);
  state.pelanggan = [...(state.pelanggan || []), { kode: code, nama: name, alamat: data.alamat || '', hp: data.hp || '', status: 'Aktif' }];
  return code;
}

function addUkuran(state, nama) {
  const value = normalizeName(nama);
  if (!value) throw new Error('Nama ukuran tidak boleh kosong.');
  if ((state.ukuran || []).includes(value)) throw new Error(`Ukuran '${value}' sudah ada.`);
  state.ukuran = [...(state.ukuran || []), value];
  return true;
}

function updateSupplier(state, data = {}) {
  const target = (state.supplier || []).find((entry) => String(entry.kode || '') === String(data.kode || ''));
  if (!target) throw new Error('Supplier tidak ditemukan.');
  Object.assign(target, {
    nama: normalizeName(data.nama),
    alamat: data.alamat || target.alamat || '',
    hp: data.hp || target.hp || ''
  });
  return true;
}

function updatePelanggan(state, data = {}) {
  const target = (state.pelanggan || []).find((entry) => String(entry.kode || '') === String(data.kode || ''));
  if (!target) throw new Error('Pelanggan tidak ditemukan.');
  Object.assign(target, {
    nama: normalizeName(data.nama),
    alamat: data.alamat || target.alamat || '',
    hp: data.hp || target.hp || ''
  });
  return true;
}

function toggleStatusSupplier(state, kode) {
  const target = (state.supplier || []).find((entry) => String(entry.kode || '') === String(kode || ''));
  if (!target) throw new Error('Supplier tidak ditemukan.');
  target.status = target.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
  return target.status;
}

function toggleStatusPelanggan(state, kode) {
  const target = (state.pelanggan || []).find((entry) => String(entry.kode || '') === String(kode || ''));
  if (!target) throw new Error('Pelanggan tidak ditemukan.');
  target.status = target.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
  return target.status;
}

module.exports = {
  normalizeName,
  createKode,
  buildMasterDataState,
  addSupplier,
  addPelanggan,
  addUkuran,
  updateSupplier,
  updatePelanggan,
  toggleStatusSupplier,
  toggleStatusPelanggan
};
