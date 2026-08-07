import type { EarthSkyScene, EarthSkySprite } from './earth-sky-scene';

export type EarthSkyNameResolver = (objectId: string, fallback: string) => string;

export function paintEarthSky(
  context: CanvasRenderingContext2D,
  scene: EarthSkyScene,
  resolveName: EarthSkyNameResolver,
): void {
  context.clearRect(0, 0, scene.width, scene.height);
  paintConstellations(context, scene, resolveName);

  for (const star of scene.stars) {
    if (star.haloOpacity > 0) {
      paintHalo(context, star);
    }
    context.globalAlpha = star.opacity;
    context.fillStyle = '#edf4f8';
    context.shadowColor = star.color;
    context.shadowBlur = star.radius * 0.9;
    context.beginPath();
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    context.fill();

    if (star.showLabel) {
      context.globalAlpha = 0.74;
      context.fillStyle = '#dce9f7';
      context.shadowBlur = 8;
      context.shadowColor = '#020713';
      context.font = '600 12px Inter, system-ui, sans-serif';
      context.textBaseline = 'middle';
      context.fillText(resolveName(star.id, star.name), star.x + 12, star.y - 10);
    }
  }

  context.globalAlpha = 1;
  context.shadowBlur = 0;
  context.lineWidth = 1;
}

function paintConstellations(
  context: CanvasRenderingContext2D,
  scene: EarthSkyScene,
  resolveName: EarthSkyNameResolver,
): void {
  for (const constellation of scene.constellations) {
    context.globalAlpha = constellation.highlighted ? 0.54 : 0.16;
    context.strokeStyle = constellation.highlighted ? '#a8c9d8' : '#718d9e';
    context.lineWidth = constellation.highlighted ? 1.35 : 0.7;
    context.shadowColor = constellation.highlighted ? '#6d9db5' : '#07111f';
    context.shadowBlur = constellation.highlighted ? 3 : 1;
    context.beginPath();
    for (const segment of constellation.segments) {
      context.moveTo(segment.fromX, segment.fromY);
      context.lineTo(segment.toX, segment.toY);
    }
    context.stroke();

    if (constellation.showLabel) {
      context.globalAlpha = constellation.highlighted ? 0.74 : 0.42;
      context.fillStyle = constellation.highlighted ? '#c4dce7' : '#9aafbb';
      context.font = constellation.highlighted
        ? '650 13px Inter, system-ui, sans-serif'
        : '600 11px Inter, system-ui, sans-serif';
      context.textBaseline = 'middle';
      context.fillText(
        resolveName(constellation.id, constellation.name),
        constellation.labelX,
        constellation.labelY,
      );
    }
  }
}

function paintHalo(context: CanvasRenderingContext2D, star: EarthSkySprite): void {
  const haloRadius = star.radius * 3.6;
  const gradient = context.createRadialGradient(star.x, star.y, 0, star.x, star.y, haloRadius);

  gradient.addColorStop(0, star.color);
  gradient.addColorStop(0.18, star.color);
  gradient.addColorStop(1, 'transparent');
  context.globalAlpha = star.haloOpacity;
  context.fillStyle = gradient;
  context.shadowBlur = 0;
  context.beginPath();
  context.arc(star.x, star.y, haloRadius, 0, Math.PI * 2);
  context.fill();
}
