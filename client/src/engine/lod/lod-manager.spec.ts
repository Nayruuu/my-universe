import { LodManager } from './lod-manager';

describe('sélection du niveau de détail', () => {
  it('passe progressivement des planètes au Groupe local', () => {
    const lod = new LodManager();

    expect(lod.selectLevel(30)).toBe(0);
    expect(lod.selectLevel(300)).toBe(1);
    expect(lod.selectLevel(1_200)).toBe(2);
    expect(lod.selectLevel(4_000)).toBe(3);
    expect(lod.selectLevel(17_000)).toBe(4);
  });

  it('utilise une hystérésis pour éviter les bascules au voisinage d’un seuil', () => {
    const lod = new LodManager();

    expect(lod.selectLevel(79)).toBe(0);
    expect(lod.selectLevel(84)).toBe(0);
    expect(lod.selectLevel(87)).toBe(1);
    expect(lod.selectLevel(76)).toBe(1);
    expect(lod.selectLevel(72)).toBe(0);
  });

  it('initialise directement le dernier niveau et expose le niveau courant', () => {
    const lod = new LodManager();

    expect(lod.selectLevel(20_000)).toBe(4);
    expect(lod.level).toBe(4);
    expect(lod.selectLevel(20)).toBe(0);
  });
});
