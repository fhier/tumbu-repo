# CTX-OFFLINE - Offline First

- Semua WRITE -> Local DB (Dexie/SQLite) dulu, status LOCAL
- UI tidak pernah tunggu network
- Event dipublish setelah save local sukses
- Semua entity punya: id (ULID), createdAt, updatedAt, syncStatus, version
