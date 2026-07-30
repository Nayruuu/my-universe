const LEVEL_THRESHOLDS = [80, 700, 2_400, 12_000, 50_000, 200_000] as const;
const ENTER_MARGIN = 1.08;
const EXIT_MARGIN = 0.92;

export class LodManager {
  private currentLevel = -1;

  public selectLevel(cameraDistance: number): number {
    if (this.currentLevel < 0) {
      this.currentLevel = LEVEL_THRESHOLDS.findIndex((threshold) => cameraDistance < threshold);
      if (this.currentLevel < 0) {
        this.currentLevel = LEVEL_THRESHOLDS.length;
      }

      return this.currentLevel;
    }

    while (
      this.currentLevel < LEVEL_THRESHOLDS.length &&
      cameraDistance > LEVEL_THRESHOLDS[this.currentLevel]! * ENTER_MARGIN
    ) {
      this.currentLevel += 1;
    }
    while (
      this.currentLevel > 0 &&
      cameraDistance < LEVEL_THRESHOLDS[this.currentLevel - 1]! * EXIT_MARGIN
    ) {
      this.currentLevel -= 1;
    }

    return this.currentLevel;
  }

  public get level(): number {
    return this.currentLevel;
  }
}
