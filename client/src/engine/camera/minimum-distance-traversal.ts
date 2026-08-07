import * as THREE from 'three';

export interface MinimumTraversalUndo {
  readonly translation: THREE.Vector3;
  readonly remainingLogarithmicAmount: number;
}

interface MinimumTraversalStep {
  readonly translation: THREE.Vector3;
  logarithmicAmount: number;
}

const MAX_RECORDED_STEPS = 64;

export class MinimumDistanceTraversal {
  private readonly steps: MinimumTraversalStep[] = [];

  public get active(): boolean {
    return this.steps.length > 0;
  }

  public get logarithmicAmount(): number {
    return this.steps.reduce((total, step) => total + step.logarithmicAmount, 0);
  }

  public record(translation: THREE.Vector3, logarithmicAmount: number): void {
    if (
      translation.lengthSq() <= Number.EPSILON ||
      !Number.isFinite(logarithmicAmount) ||
      logarithmicAmount <= 0
    ) {
      return;
    }
    this.steps.push({ translation: translation.clone(), logarithmicAmount });
    this.compactHistory();
  }

  public unwind(logarithmicAmount: number): MinimumTraversalUndo {
    const translation = new THREE.Vector3();
    let remainingLogarithmicAmount = normalizeAmount(logarithmicAmount);

    while (remainingLogarithmicAmount > Number.EPSILON && this.steps.length > 0) {
      const step = this.steps.at(-1)!;
      const consumedAmount = Math.min(remainingLogarithmicAmount, step.logarithmicAmount);
      const consumedRatio = consumedAmount / step.logarithmicAmount;

      translation.addScaledVector(step.translation, consumedRatio);
      remainingLogarithmicAmount -= consumedAmount;
      if (consumedRatio >= 1 - Number.EPSILON) {
        this.steps.pop();
      } else {
        step.translation.multiplyScalar(1 - consumedRatio);
        step.logarithmicAmount -= consumedAmount;
      }
    }

    return { translation, remainingLogarithmicAmount };
  }

  public clear(): void {
    this.steps.length = 0;
  }

  private compactHistory(): void {
    if (this.steps.length <= MAX_RECORDED_STEPS) {
      return;
    }
    const oldest = this.steps.shift()!;
    const next = this.steps[0]!;

    next.translation.add(oldest.translation);
    next.logarithmicAmount += oldest.logarithmicAmount;
  }
}

function normalizeAmount(amount: number): number {
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}
