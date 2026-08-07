import * as THREE from 'three';

export function createSharedGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');

  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas 2D indisponible pour le halo stellaire.');
  }

  const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 64);

  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.15, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.52, 'rgba(255, 255, 255, 0.25)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

export function createPhotonRingTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');

  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas 2D indisponible pour l’anneau photonique.');
  }

  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);

  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(0.76, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(0.82, 'rgba(255, 255, 255, 0.22)');
  gradient.addColorStop(0.85, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.88, 'rgba(255, 255, 255, 0.16)');
  gradient.addColorStop(0.94, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

export function createSelectionMarker(): THREE.Sprite {
  const canvas = document.createElement('canvas');

  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas 2D indisponible pour le marqueur de sélection.');
  }

  context.clearRect(0, 0, 128, 128);
  context.strokeStyle = 'rgba(132, 202, 241, 0.56)';
  context.lineWidth = 1.5;
  context.setLineDash([4, 9]);
  context.beginPath();
  context.arc(64, 64, 51, 0, Math.PI * 2);
  context.stroke();

  const material = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);

  sprite.name = 'selection-marker';
  sprite.renderOrder = 20;

  return sprite;
}
