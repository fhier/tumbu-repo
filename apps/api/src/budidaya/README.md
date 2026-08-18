# apps/api/src/budidaya/

Runtime Blueprint Budidaya (`operational_aquaculture_freshwater`).

**Status:** 8.1–8.8 lengkap · catalog **`available: false`** (Release HOLD).  
**Panduan:** `templates/03-budidaya-perikanan-air-tawar/DEVELOPER-GUIDE.md`  
**Keputusan Owner:** `templates/03-budidaya-perikanan-air-tawar/BLUEPRINT-READINESS.md`

## Lapisan

| Folder | Tanggung jawab |
|--------|----------------|
| `domain/` | Enum · EventBase |
| `workflow/` | State transitions · event guards |
| `application/` | Master · Cycle · Event |
| `formula/` | Pure calculators · CycleFormulaService |
| `dashboard/` | Widget composition |
| `analysis/` | Analysis views |
| `api/` | Controllers |
| `hardening/` | Regression specs |

## Pagar

- Jangan flip `available: true` tanpa RELEASE-GATE + Owner.
- Jangan hitung KPI di Event path.
- Jangan set `cycle.state` selain lewat `CycleTransitionService`.
- Jangan ubah logic Distributor / Service.
