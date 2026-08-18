# Formula Layer — BOP, HPP, FCR, …

```text
formula/
├── calculators/     # pure functions
├── services/        # baca Event → calculators
├── tests/
└── types.ts
```

**BOP interim:** `PROVISIONAL_*` dari Stocking/Feed `totalCost` hanya langkah transisi.  
Saat Expense API penuh → `ExpenseEvent` kanonik; provisional dinonaktifkan (lihat `FORMULA-8.5.md`).

Dashboard (8.6) memanggil `CycleFormulaService` — bukan calculator langsung.
