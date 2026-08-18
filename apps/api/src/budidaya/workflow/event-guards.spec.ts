import { assertEventAllowedOnState } from './event-guards';

describe('Event workflow guards (8.4)', () => {
  it('allows stocking only on READY', () => {
    expect(() => assertEventAllowedOnState('STOCKING', 'READY')).not.toThrow();
    expect(() => assertEventAllowedOnState('STOCKING', 'PLANNED')).toThrow(/siap tebar/i);
    expect(() => assertEventAllowedOnState('STOCKING', 'ACTIVE')).toThrow(/siap tebar/i);
  });

  it('allows feed on ACTIVE/HARVESTING only', () => {
    expect(() => assertEventAllowedOnState('FEED', 'ACTIVE')).not.toThrow();
    expect(() => assertEventAllowedOnState('FEED', 'HARVESTING')).not.toThrow();
    expect(() => assertEventAllowedOnState('FEED', 'READY')).toThrow(/berjalan atau panen/i);
  });

  it('allows harvest on ACTIVE/HARVESTING', () => {
    expect(() => assertEventAllowedOnState('HARVEST', 'ACTIVE')).not.toThrow();
    expect(() => assertEventAllowedOnState('HARVEST', 'PLANNED')).toThrow();
  });

  it('allows close on ACTIVE/HARVESTING and rejects terminal', () => {
    expect(() => assertEventAllowedOnState('CLOSE', 'HARVESTING')).not.toThrow();
    expect(() => assertEventAllowedOnState('CLOSE', 'CLOSED')).toThrow(/Selesai/i);
  });

  it('allows mortality/sampling/medicine/expense on ACTIVE/HARVESTING only', () => {
    for (const kind of ['MORTALITY', 'SAMPLING', 'MEDICINE', 'EXPENSE'] as const) {
      expect(() => assertEventAllowedOnState(kind, 'ACTIVE')).not.toThrow();
      expect(() => assertEventAllowedOnState(kind, 'HARVESTING')).not.toThrow();
      expect(() => assertEventAllowedOnState(kind, 'READY')).toThrow();
      expect(() => assertEventAllowedOnState(kind, 'PLANNED')).toThrow();
      expect(() => assertEventAllowedOnState(kind, 'CLOSED')).toThrow(/Selesai/i);
    }
  });
});
