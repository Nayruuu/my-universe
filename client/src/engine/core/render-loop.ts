export type RenderLoopCallback = (deltaSeconds: number, elapsedSeconds: number) => void;

export class RenderLoop {
  private animationFrameId: number | null = null;
  private previousTimestamp = 0;
  private elapsedSeconds = 0;

  constructor(private readonly callback: RenderLoopCallback) {}

  public start(): void {
    if (this.animationFrameId !== null) {
      return;
    }
    this.previousTimestamp = performance.now();
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    if (this.animationFrameId === null) {
      return;
    }
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }

  private readonly tick = (timestamp: number): void => {
    const deltaSeconds = Math.min((timestamp - this.previousTimestamp) / 1_000, 0.1);

    this.previousTimestamp = timestamp;
    this.elapsedSeconds += deltaSeconds;
    this.callback(deltaSeconds, this.elapsedSeconds);
    this.animationFrameId = requestAnimationFrame(this.tick);
  };
}
