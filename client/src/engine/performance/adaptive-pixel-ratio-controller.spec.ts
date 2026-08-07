import type { GraphicQuality } from '../../data/models/universe.models';
import {
  ADAPTIVE_FRAME_SAMPLE_COUNT,
  AdaptivePixelRatioController,
} from './adaptive-pixel-ratio-controller';
import { getAdaptiveFrameProfile } from './adaptive-rendering-profile';

describe('AdaptivePixelRatioController', () => {
  it('attend une fenêtre complète et ignore les échantillons invalides', () => {
    const controller = new AdaptivePixelRatioController();

    controller.reset(1.5);
    expect(controller.observe(Number.NaN, getAdaptiveFrameProfile('high'), false)).toBeNull();
    expect(controller.observe(0, getAdaptiveFrameProfile('high'), false)).toBeNull();
    sampleFrames(controller, 'high', 16, ADAPTIVE_FRAME_SAMPLE_COUNT - 1);

    expect(controller.snapshot).toEqual({
      status: 'warming',
      p95FrameMs: null,
      longFrameRatio: null,
      targetPixelRatio: 1.5,
      currentPixelRatio: 1.5,
    });

    expect(controller.observe(0.016, getAdaptiveFrameProfile('high'), false)).toBeNull();
    expect(controller.snapshot).toMatchObject({
      status: 'stable',
      p95FrameMs: 16,
      longFrameRatio: 0,
    });
  });

  it('ne réagit pas à quelques frames longues dans une fenêtre globalement fluide', () => {
    const controller = new AdaptivePixelRatioController();

    controller.reset(1.5);
    sampleFrames(controller, 'high', 16, ADAPTIVE_FRAME_SAMPLE_COUNT - 4);
    sampleFrames(controller, 'high', 80, 4);

    expect(controller.snapshot).toMatchObject({
      status: 'stable',
      p95FrameMs: 16,
    });
    expect(controller.currentPixelRatio).toBe(1.5);
  });

  it('conserve son dernier diagnostic pendant la collecte de la fenêtre suivante', () => {
    const controller = new AdaptivePixelRatioController();

    controller.reset(1.5);
    sampleWindow(controller, 'high', 16);
    sampleFrames(controller, 'high', 16, 20);

    expect(controller.snapshot.status).toBe('stable');
    expect(controller.snapshot.p95FrameMs).toBe(16);
  });

  it('réduit progressivement la résolution après deux fenêtres durablement lentes', () => {
    const controller = new AdaptivePixelRatioController();

    controller.reset(1.5);
    sampleWindow(controller, 'high', 24);
    expect(controller.currentPixelRatio).toBe(1.5);

    expect(sampleWindow(controller, 'high', 24)).toBe(1.375);
    expect(controller.snapshot).toMatchObject({
      status: 'degraded',
      p95FrameMs: 24,
      currentPixelRatio: 1.375,
    });

    controller.observe(0.016, getAdaptiveFrameProfile('high'), true);
    sampleFrames(controller, 'high', 16, 20);
    expect(controller.snapshot.status).toBe('degraded');
  });

  it('réagit à une fenêtre sévère mais ne descend jamais sous son plancher', () => {
    const controller = new AdaptivePixelRatioController();

    controller.reset(1.5);
    expect(sampleWindow(controller, 'high', 40)).toBe(1.25);
    expect(sampleWindow(controller, 'high', 40)).toBe(1);
    expect(sampleWindow(controller, 'high', 40)).toBe(0.8);
    expect(sampleWindow(controller, 'high', 40)).toBeNull();
    expect(controller.currentPixelRatio).toBe(0.8);
  });

  it('considère 30 FPS comme stable avec le profil de qualité faible', () => {
    const controller = new AdaptivePixelRatioController();

    controller.reset(1);
    sampleWindow(controller, 'low', 1000 / 30);

    expect(controller.snapshot.status).toBe('stable');
    expect(controller.currentPixelRatio).toBe(1);
  });

  it('remonte plus prudemment après six fenêtres saines', () => {
    const controller = new AdaptivePixelRatioController();

    controller.reset(1.5);
    sampleWindow(controller, 'high', 40);
    expect(controller.currentPixelRatio).toBe(1.25);

    for (let windowIndex = 0; windowIndex < 5; windowIndex += 1) {
      expect(sampleWindow(controller, 'high', 16)).toBeNull();
    }
    expect(controller.snapshot.status).toBe('recovering');
    expect(sampleWindow(controller, 'high', 16)).toBe(1.375);
    expect(controller.snapshot.status).toBe('recovering');
  });

  it('réinitialise une série lente avec une fenêtre neutre', () => {
    const controller = new AdaptivePixelRatioController();

    controller.reset(1.5);
    sampleWindow(controller, 'high', 24);
    sampleWindow(controller, 'high', 20);
    expect(sampleWindow(controller, 'high', 24)).toBeNull();
    expect(sampleWindow(controller, 'high', 24)).toBe(1.375);
  });

  it('suspend et réchauffe ses mesures pendant une transition', () => {
    const controller = new AdaptivePixelRatioController();

    controller.reset(1.5);
    sampleFrames(controller, 'high', 40, ADAPTIVE_FRAME_SAMPLE_COUNT - 1);
    expect(controller.observe(0.04, getAdaptiveFrameProfile('high'), true)).toBeNull();
    expect(controller.snapshot.status).toBe('paused');

    sampleFrames(controller, 'high', 40, ADAPTIVE_FRAME_SAMPLE_COUNT - 1);
    expect(controller.snapshot.status).toBe('warming');
    expect(controller.currentPixelRatio).toBe(1.5);
  });

  it('borne la cible lorsqu’elle est déjà inférieure au plancher adaptatif', () => {
    const controller = new AdaptivePixelRatioController();

    expect(controller.reset(0.75)).toBe(0.75);
    expect(sampleWindow(controller, 'high', 80)).toBeNull();
    expect(controller.currentPixelRatio).toBe(0.75);
  });
});

function sampleWindow(
  controller: AdaptivePixelRatioController,
  quality: GraphicQuality,
  frameMilliseconds: number,
): number | null {
  return sampleFrames(controller, quality, frameMilliseconds, ADAPTIVE_FRAME_SAMPLE_COUNT);
}

function sampleFrames(
  controller: AdaptivePixelRatioController,
  quality: GraphicQuality,
  frameMilliseconds: number,
  count: number,
): number | null {
  let decision: number | null = null;

  for (let index = 0; index < count; index += 1) {
    decision = controller.observe(
      frameMilliseconds / 1_000,
      getAdaptiveFrameProfile(quality),
      false,
    );
  }

  return decision;
}
