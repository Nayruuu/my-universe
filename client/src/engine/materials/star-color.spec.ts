import { colorIndexToCssColor, colorIndexToRgb } from './star-color';

describe('couleur stellaire B−V', () => {
  it('représente un indice faible plus bleu et un indice élevé plus rouge', () => {
    const blue = colorIndexToRgb(-0.2);
    const red = colorIndexToRgb(1.7);

    expect(blue[2]).toBeGreaterThan(blue[0]);
    expect(red[0]).toBeGreaterThan(red[2]);
  });

  it('produit une couleur CSS bornée et déterministe', () => {
    expect(colorIndexToCssColor(-0.4)).toBe('#91b0ff');
    expect(colorIndexToCssColor(99)).toBe('#ff4d26');
  });
});
