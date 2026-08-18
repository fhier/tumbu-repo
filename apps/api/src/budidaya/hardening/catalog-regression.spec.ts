import { blueprintById, isPublicCatalogBlueprint, publicCatalogBlueprints } from '../../platform/catalog';

describe('Catalog regression (Budidaya Air Tawar)', () => {
  it('keeps Budidaya as core public catalog', () => {
    const aqua = blueprintById('operational_aquaculture_freshwater');
    expect(aqua.available).toBe(true);
    expect(aqua.kind).toBe('aquaculture');
    expect(aqua.catalog.hidden).toBe(false);
    expect(isPublicCatalogBlueprint(aqua)).toBe(true);
  });

  it('offers only Budidaya in public catalog', () => {
    const offered = publicCatalogBlueprints().map(b => b.id);
    expect(offered).toEqual(['operational_aquaculture_freshwater']);
  });
});
