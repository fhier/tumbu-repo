/**
 * S01 feed-today fact helper (not Formula KPI).
 */
function sumFeedKgToday(
  feeds: Array<{ quantityKg?: unknown; eventAt?: unknown; recordStatus?: unknown }>,
  now: Date,
): number {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  let total = 0;
  for (const f of feeds) {
    if (String(f.recordStatus || 'RECORDED') === 'VOIDED') continue;
    const at = f.eventAt ? new Date(String(f.eventAt)) : null;
    if (!at || Number.isNaN(at.getTime())) continue;
    if (at.getFullYear() !== y || at.getMonth() !== m || at.getDate() !== d) continue;
    const kg = Number(f.quantityKg);
    if (Number.isFinite(kg) && kg > 0) total += kg;
  }
  return total;
}

describe('S07 S01 empty/warning helpers', () => {
  const now = new Date('2026-07-21T10:00:00+07:00');

  it('R7.4 — pakan hari ini aggregates only today RECORDED feeds', () => {
    expect(
      sumFeedKgToday(
        [
          { quantityKg: 5, eventAt: '2026-07-21T08:00:00+07:00', recordStatus: 'RECORDED' },
          { quantityKg: 3, eventAt: '2026-07-20T08:00:00+07:00', recordStatus: 'RECORDED' },
          { quantityKg: 2, eventAt: '2026-07-21T09:00:00+07:00', recordStatus: 'VOIDED' },
        ],
        now,
      ),
    ).toBe(5);
  });

  it('R7.4 — zero today → empty notice signal', () => {
    expect(sumFeedKgToday([], now)).toBe(0);
  });
});
