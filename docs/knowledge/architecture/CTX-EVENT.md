# CTX-EVENT
- Event = fakta masa lalu, immutable, past tense: CycleOpened, PondCreated
- Format: { type, aggregateId, occurredAt, version, payload }
- Event dipublish setelah transaksi local sukses
- Event disimpan di event_store local untuk audit
