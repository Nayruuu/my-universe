import { SpaceObject } from '../../data/models/universe.models';
import { LabelCanvasPainter } from './label-canvas-painter';

describe('LabelCanvasPainter', () => {
  it('mesure et dessine toutes les variantes de cartouches et d’ancres', () => {
    const context = createContext(300);
    const painter = new LabelCanvasPainter(context, (_objectId, fallback) => fallback);
    const planet = createLabelObject('earth', 'planet');
    const galaxy = createLabelObject('andromeda', 'galaxy');
    const star = createLabelObject('sirius', 'star');
    const catalog = createLabelObject('hyg-1', 'star', { catalogRecordIndex: 0 });

    const selectedRectangle = painter.measureRectangle(planet, 100, 100, true);
    const galaxyRectangle = painter.measureRectangle(galaxy, 100, 100, false);
    const starRectangle = painter.measureRectangle(star, 100, 100, false);
    const catalogRectangle = painter.measureRectangle(catalog, 100, 100, false);
    const solarSystemPlanetRectangle = painter.measureRectangle(planet, 100, 100, false, 1);

    expect(solarSystemPlanetRectangle.bottom - solarSystemPlanetRectangle.top).toBe(27);
    painter.drawLabel(planet, solarSystemPlanetRectangle, false, false, 1);
    expect(context.font).toContain('600 13px');
    expect(context.fillStyle).toBe('#43b4dd');
    expect(context.strokeStyle).toBe('#43b4dd');
    expect(context.stroke).toHaveBeenCalled();
    const labelAlphas: number[] = [];

    context.fillText.mockImplementation(() => labelAlphas.push(context.globalAlpha));
    painter.drawLabel(planet, solarSystemPlanetRectangle, false, false, 1, 0.4);
    expect(labelAlphas.at(-1)).toBe(0.4);
    expect(context.globalAlpha).toBe(1);
    painter.drawLabel(planet, solarSystemPlanetRectangle, true, false, 1);
    expect(context.fillStyle).toBe('#9ae8ff');
    expect(context.strokeStyle).toBe('#9ae8ff');

    painter.drawLabel(star, starRectangle, true, false);
    painter.drawLabel(catalog, catalogRectangle, false, true);
    painter.drawLabel(catalog, catalogRectangle, false, false);
    painter.drawLabel(star, starRectangle, false, false);
    painter.drawLabel(planet, selectedRectangle, false, false);
    painter.drawLabel(galaxy, galaxyRectangle, false, false);
    painter.drawAnchor(starRectangle, 100, 120, false, false);
    painter.drawAnchor(starRectangle, 100, 120, true, false);
    painter.drawAnchor(starRectangle, 100, 120, false, true);
    painter.drawAnchor(starRectangle, 100, 120, false, false, true);
    expect(context.strokeStyle).toBe('rgba(241, 188, 91, 0.56)');
    expect(context.fillStyle).toBe('rgba(255, 211, 124, 0.86)');
    painter.drawAnchor(starRectangle, 100, 120, true, false, true);
    expect(context.strokeStyle).toBe('rgba(255, 221, 145, 0.9)');
    expect(context.fillStyle).toBe('rgba(255, 236, 190, 0.98)');
    const anchorAlphas: number[] = [];

    context.fill.mockImplementation(() => anchorAlphas.push(context.globalAlpha));
    painter.drawAnchor(starRectangle, 100, 120, false, false, true, 0.25);
    expect(anchorAlphas.at(-1)).toBe(0.25);
    expect(context.globalAlpha).toBe(1);
  });

  it('efface le canvas et applique immédiatement un nouveau résolveur de noms', () => {
    const context = createContext();
    const earth = createLabelObject('earth', 'planet');
    const painter = new LabelCanvasPainter(context, (objectId, fallback) =>
      objectId === 'earth' ? 'Earth' : fallback,
    );
    const rectangle = painter.measureRectangle(earth, 100, 80, false);

    painter.drawLabel(earth, rectangle, false, false);
    expect(context.measureText).toHaveBeenCalledWith('Earth');
    expect(context.fillText).toHaveBeenCalledWith(
      'Earth',
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );

    painter.setNameResolver((objectId, fallback) => (objectId === 'earth' ? 'Erde' : fallback));
    painter.drawLabel(earth, rectangle, false, false);
    expect(context.fillText).toHaveBeenLastCalledWith(
      'Erde',
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );

    painter.clear(800, 600, 2);
    expect(context.setTransform).toHaveBeenNthCalledWith(1, 1, 0, 0, 1, 0, 0);
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(context.setTransform).toHaveBeenNthCalledWith(2, 2, 0, 0, 2, 0, 0);
  });
});

interface ContextSpies {
  readonly setTransform: ReturnType<typeof vi.fn>;
  readonly clearRect: ReturnType<typeof vi.fn>;
  readonly fillText: ReturnType<typeof vi.fn>;
  readonly fill: ReturnType<typeof vi.fn>;
  readonly measureText: ReturnType<typeof vi.fn>;
  readonly stroke: ReturnType<typeof vi.fn>;
  readonly font: string;
  readonly fillStyle: string;
  readonly strokeStyle: string;
  readonly globalAlpha: number;
}

function createContext(measuredWidth = 80): CanvasRenderingContext2D & ContextSpies {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    measureText: vi.fn(() => ({ width: measuredWidth })),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
    textAlign: 'start',
    textBaseline: 'alphabetic',
  } as unknown as CanvasRenderingContext2D & ContextSpies;
}

function createLabelObject(
  id: string,
  type: SpaceObject['type'],
  metadata?: SpaceObject['metadata'],
): SpaceObject {
  return {
    id,
    name: id,
    type,
    referenceFrame: type === 'galaxy' ? 'galactic' : 'stellar',
    scientificConfidence: 'observed',
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'light-year',
    },
    ...(metadata ? { metadata } : {}),
  };
}
