# CTX-DDD - Domain Driven Design Constitution

## Aggregate Root
- Satu transaksi = Satu Aggregate Root
- Semua mutasi lewat method aggregate, bukan setter
- Aggregate tidak boleh import Aggregate lain
- Cross-aggregate komunikasi hanya via Domain Event

## Entity vs Value Object
- Entity: punya ID, punya lifecycle (Pond, Cycle)
- Value Object: immutable, tanpa ID (Weight, Money, DateRange)

## Repository
- Interface di domain/, implementasi di infra/
- Repository hanya untuk Aggregate Root
- Dilarang Repository memanggil Repository lain

## Domain Service
- Hanya jika logic butuh 2+ aggregate dan tidak bisa di event
