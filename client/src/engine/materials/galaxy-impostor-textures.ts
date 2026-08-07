import * as THREE from 'three';
import type { GalaxyVisualShape, GraphicQuality } from '../../data/models/universe.models';
import { mulberry32 } from './visual-random';

export function getGalaxyTextureResolution(quality: GraphicQuality): number {
  return quality === 'low' ? 256 : quality === 'medium' ? 384 : 512;
}

export function createGalaxyImpostorTextures(
  quality: GraphicQuality,
): Readonly<Record<GalaxyVisualShape, THREE.Texture>> {
  return {
    spiral: createGalaxyTexture('spiral', quality),
    elliptical: createGalaxyTexture('elliptical', quality),
    irregular: createGalaxyTexture('irregular', quality),
  };
}

function createGalaxyTexture(
  shape: GalaxyVisualShape,
  quality: GraphicQuality,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const resolution = getGalaxyTextureResolution(quality);

  canvas.width = resolution;
  canvas.height = resolution;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas 2D indisponible pour les imposteurs galactiques.');
  }

  context.save();
  context.scale(resolution / 256, resolution / 256);
  if (shape === 'spiral') {
    drawSpiralGalaxy(context);
  } else if (shape === 'irregular') {
    drawIrregularGalaxy(context);
  } else {
    drawEllipticalGalaxy(context);
  }
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = quality === 'high' ? 4 : quality === 'medium' ? 2 : 1;

  return texture;
}

function drawSpiralGalaxy(context: CanvasRenderingContext2D): void {
  drawRadialGlow(context, 128, 128, 5, 118, 0.38, [205, 224, 255], [63, 92, 151]);
  const random = mulberry32(0xa31d_2026);

  context.globalCompositeOperation = 'source-over';
  context.lineCap = 'round';
  context.filter = 'blur(4px)';
  for (let arm = 0; arm < 4; arm += 1) {
    context.strokeStyle = 'rgba(92, 132, 194, 0.12)';
    context.lineWidth = 13;
    traceSpiralArm(context, arm, 0);
    for (let filament = -1; filament <= 1; filament += 1) {
      context.strokeStyle =
        filament === 0 ? 'rgba(214, 229, 255, 0.12)' : 'rgba(126, 164, 219, 0.08)';
      context.lineWidth = filament === 0 ? 3.2 : 5;
      traceSpiralArm(context, arm, filament * 0.11);
    }
  }
  context.filter = 'blur(1px)';
  context.globalCompositeOperation = 'destination-out';
  context.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  context.lineWidth = 4.2;
  for (let arm = 0; arm < 4; arm += 1) {
    traceSpiralArm(context, arm, 0.13);
  }
  context.filter = 'none';
  context.globalCompositeOperation = 'lighter';
  for (let index = 0; index < 180; index += 1) {
    const radialProgress = Math.pow(random(), 0.62);
    const arm = index % 4;
    const angle =
      arm * (Math.PI / 2) +
      radialProgress * Math.PI * 2.45 +
      (random() - 0.5) * (0.14 + radialProgress * 0.28);
    const radius = 6 + radialProgress * 111;

    context.fillStyle = index % 13 === 0 ? '#ffd19a' : '#dcecff';
    context.globalAlpha = (1 - radialProgress * 0.68) * (0.08 + random() * 0.24);
    context.beginPath();
    context.arc(
      128 + Math.cos(angle) * radius,
      128 + Math.sin(angle) * radius,
      0.16 + random() * 0.32,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  drawRadialGlow(context, 128, 128, 1, 34, 1, [255, 247, 224], [238, 171, 102]);
}

function traceSpiralArm(context: CanvasRenderingContext2D, arm: number, offset: number): void {
  context.beginPath();
  for (let step = 0; step < 120; step += 1) {
    const progress = step / 119;
    const radius = 4 + progress * 112 + Math.sin(progress * 43 + arm * 1.3) * progress * 1.2;
    const angle =
      arm * (Math.PI / 2) +
      progress * Math.PI * 2.45 +
      offset +
      Math.sin(progress * 18 + arm * 1.7) * 0.035;
    const x = 128 + Math.cos(angle) * radius;
    const y = 128 + Math.sin(angle) * radius;

    if (step === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();
}

function drawEllipticalGalaxy(context: CanvasRenderingContext2D): void {
  context.save();
  context.translate(128, 128);
  context.scale(1, 0.72);
  const gradient = context.createRadialGradient(0, 0, 1, 0, 0, 118);

  gradient.addColorStop(0, 'rgba(255, 242, 211, 1)');
  gradient.addColorStop(0.18, 'rgba(245, 218, 180, 0.82)');
  gradient.addColorStop(0.52, 'rgba(174, 197, 230, 0.28)');
  gradient.addColorStop(1, 'rgba(90, 119, 164, 0)');
  context.fillStyle = gradient;
  context.fillRect(-128, -178, 256, 356);
  context.restore();
}

function drawIrregularGalaxy(context: CanvasRenderingContext2D): void {
  const random = mulberry32(0x1c10_2026);
  const blobs = [
    [94, 118, 58, 0.72],
    [142, 98, 65, 0.88],
    [164, 148, 54, 0.6],
    [111, 164, 49, 0.52],
  ] as const;

  for (const [index, [x, y, radius, alpha]] of blobs.entries()) {
    drawRadialGlow(
      context,
      x,
      y,
      2,
      radius,
      alpha,
      index % 2 === 0 ? [199, 224, 255] : [255, 219, 178],
      [79, 119, 175],
    );
  }
  for (let index = 0; index < 520; index += 1) {
    const x = 67 + random() * 132;
    const y = 66 + random() * 131;
    const size = 0.4 + random() * 1.35;

    context.fillStyle = index % 11 === 0 ? '#ffd19a' : '#dcecff';
    context.globalAlpha = 0.12 + random() * 0.58;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawRadialGlow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  innerRadius: number,
  outerRadius: number,
  opacity: number,
  innerColor: readonly [number, number, number] = [255, 255, 255],
  outerColor: readonly [number, number, number] = innerColor,
): void {
  const gradient = context.createRadialGradient(x, y, innerRadius, x, y, outerRadius);

  gradient.addColorStop(0, rgba(innerColor, opacity));
  gradient.addColorStop(0.24, rgba(innerColor, opacity * 0.68));
  gradient.addColorStop(0.62, rgba(outerColor, opacity * 0.2));
  gradient.addColorStop(1, rgba(outerColor, 0));
  context.fillStyle = gradient;
  context.fillRect(x - outerRadius, y - outerRadius, outerRadius * 2, outerRadius * 2);
}

function rgba(color: readonly [number, number, number], alpha: number): string {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}
