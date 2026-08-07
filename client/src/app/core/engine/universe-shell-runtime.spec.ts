import { UniverseShellRuntime } from './universe-shell-runtime';

describe('UniverseShellRuntime', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('rend les trois panneaux exclusifs et recharge les éclipses seulement à l’ouverture', () => {
    const { runtime, state, returnToCurrentEclipses } = createRuntime();

    state.helpOpen = true;
    state.eclipseBrowserOpen = true;
    runtime.toggleSettings();
    expect(state).toMatchObject({ settingsOpen: true, helpOpen: false, eclipseBrowserOpen: false });
    runtime.toggleSettings();
    expect(state.settingsOpen).toBe(false);

    state.settingsOpen = true;
    state.eclipseBrowserOpen = true;
    runtime.toggleHelp();
    expect(state).toMatchObject({ settingsOpen: false, helpOpen: true, eclipseBrowserOpen: false });
    runtime.toggleHelp();
    expect(state.helpOpen).toBe(false);

    runtime.toggleEclipseBrowser();
    expect(state.eclipseBrowserOpen).toBe(true);
    expect(returnToCurrentEclipses).toHaveBeenCalledOnce();
    runtime.toggleEclipseBrowser();
    expect(state.eclipseBrowserOpen).toBe(false);
    expect(returnToCurrentEclipses).toHaveBeenCalledOnce();
  });

  it('copie le lien, remplace son timer et libère la notification au démontage', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const { runtime, state } = createRuntime(writeText);

    await runtime.copyShareUrl();
    await runtime.copyShareUrl();

    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText).toHaveBeenLastCalledWith('https://example.test/?target=earth');
    expect(state.shareNotice).toBe('Lien copié');
    vi.advanceTimersByTime(2_399);
    expect(state.shareNotice).toBe('Lien copié');

    runtime.dispose();
    vi.advanceTimersByTime(1);
    expect(state.shareNotice).toBe('Lien copié');
    runtime.dispose();
  });

  it('affiche le message de repli lorsque le presse-papiers refuse le lien', async () => {
    const { runtime, state } = createRuntime(() => Promise.reject(new Error('refus')));

    await runtime.copyShareUrl();

    expect(state.shareNotice).toBe('Copie impossible');
    vi.advanceTimersByTime(2_400);
    expect(state.shareNotice).toBeNull();
  });
});

function createRuntime(writeText: (url: string) => Promise<void> = async () => undefined) {
  const state = {
    settingsOpen: false,
    helpOpen: false,
    eclipseBrowserOpen: false,
    shareNotice: null as string | null,
  };
  const returnToCurrentEclipses = vi.fn();
  const runtime = new UniverseShellRuntime({
    isSettingsOpen: () => state.settingsOpen,
    setSettingsOpen: (open) => (state.settingsOpen = open),
    isHelpOpen: () => state.helpOpen,
    setHelpOpen: (open) => (state.helpOpen = open),
    isEclipseBrowserOpen: () => state.eclipseBrowserOpen,
    setEclipseBrowserOpen: (open) => (state.eclipseBrowserOpen = open),
    returnToCurrentEclipses,
    createShareUrl: () => 'https://example.test/?target=earth',
    writeClipboardText: writeText,
    setShareNotice: (notice) => (state.shareNotice = notice),
    getShareCopiedMessage: () => 'Lien copié',
    getShareFailedMessage: () => 'Copie impossible',
  });

  return { runtime, state, returnToCurrentEclipses };
}
