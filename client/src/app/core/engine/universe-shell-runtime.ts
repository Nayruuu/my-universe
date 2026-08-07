export interface UniverseShellRuntimeBindings {
  isSettingsOpen(): boolean;
  setSettingsOpen(open: boolean): void;
  isHelpOpen(): boolean;
  setHelpOpen(open: boolean): void;
  isEclipseBrowserOpen(): boolean;
  setEclipseBrowserOpen(open: boolean): void;
  returnToCurrentEclipses(): void;
  createShareUrl(): string;
  writeClipboardText(url: string): Promise<void>;
  setShareNotice(notice: string | null): void;
  getShareCopiedMessage(): string;
  getShareFailedMessage(): string;
}

const SHARE_NOTICE_DURATION_MILLISECONDS = 2_400;

export class UniverseShellRuntime {
  private shareNoticeTimeout: number | null = null;

  constructor(private readonly bindings: UniverseShellRuntimeBindings) {}

  public toggleSettings(): void {
    this.bindings.setSettingsOpen(!this.bindings.isSettingsOpen());
    this.bindings.setHelpOpen(false);
    this.bindings.setEclipseBrowserOpen(false);
  }

  public toggleHelp(): void {
    this.bindings.setHelpOpen(!this.bindings.isHelpOpen());
    this.bindings.setSettingsOpen(false);
    this.bindings.setEclipseBrowserOpen(false);
  }

  public toggleEclipseBrowser(): void {
    const open = !this.bindings.isEclipseBrowserOpen();

    this.bindings.setEclipseBrowserOpen(open);
    this.bindings.setSettingsOpen(false);
    this.bindings.setHelpOpen(false);
    if (open) {
      this.bindings.returnToCurrentEclipses();
    }
  }

  public async copyShareUrl(): Promise<void> {
    try {
      await this.bindings.writeClipboardText(this.bindings.createShareUrl());
      this.bindings.setShareNotice(this.bindings.getShareCopiedMessage());
    } catch {
      this.bindings.setShareNotice(this.bindings.getShareFailedMessage());
    }
    this.scheduleShareNoticeReset();
  }

  public dispose(): void {
    if (this.shareNoticeTimeout === null) {
      return;
    }
    window.clearTimeout(this.shareNoticeTimeout);
    this.shareNoticeTimeout = null;
  }

  private scheduleShareNoticeReset(): void {
    this.dispose();
    this.shareNoticeTimeout = window.setTimeout(() => {
      this.bindings.setShareNotice(null);
      this.shareNoticeTimeout = null;
    }, SHARE_NOTICE_DURATION_MILLISECONDS);
  }
}
