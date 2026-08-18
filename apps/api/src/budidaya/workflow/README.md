# workflow/

**8.3:** `cycle-transition.ts` + `CycleTransitionService` — **satu-satunya** penulis state CultureCycle.

Transisi yang butuh event (`STOCKING_EVENT`, `HARVEST_EVENT`, `CLOSE_EVENT`) sudah terdefinisi di matriks, tetapi **belum** dipanggil dari event service (itu 8.4).
